import { useState } from "react";

type PhaseKey = "inventory" | "boot" | "dispatch" | "operation";

const phases = {
  inventory: {
    number: "01",
    label: "Inventory",
    question: "Which executable belongs to which RISC and lifetime?",
    evidence: "HAL thread IDs, compile macros, firmware source selection and per-processor load addresses.",
    gate: "Keep tt-1xx Wormhole/Blackhole separate from tt-2xx Quasar.",
  },
  boot: {
    number: "02",
    label: "Cold boot",
    question: "Who writes each firmware image, and which processor leaves reset first?",
    evidence: "RiscFirmwareInitializer host writes plus BRISC reset-PC and subordinate-init code.",
    gate: "Every diagram arrow must have a caller, receiver and observable state change.",
  },
  dispatch: {
    number: "03",
    label: "CQ bring-up",
    question: "How do persistent prefetch and dispatch programs differ from worker firmware?",
    evidence: "DispatchKernelInitializer, CQ Program configuration and device-side persistent loops.",
    gate: "Do not label command-queue Programs as BRISC/NCRISC boot firmware.",
  },
  operation: {
    number: "04",
    label: "Operation",
    question: "What crosses the host/device boundary on first use and on a warm launch?",
    evidence: "Program ELF packing, replicated binary buffer, dispatch command order, GO and worker completion.",
    gate: "Prove caching by comparing two identical Program launches.",
  },
} as const;

const objectLayers = [
  { number: "A", title: "Base RISC firmware", lifetime: "DEVICE SESSION", detail: "Separate BRISC, NCRISC and TRISC0/1/2 control-loop ELFs loaded before worker release." },
  { number: "B", title: "Fast-dispatch Programs", lifetime: "CQ SESSION", detail: "Persistent prefetch and dispatch kernels installed on selected command-queue cores." },
  { number: "C", title: "Operation kernels", lifetime: "PROGRAM CACHE", detail: "Selected DM binary or binaries plus three compute binaries generated for UNPACK, MATH and PACK." },
  { number: "D", title: "Launch state", lifetime: "EVERY ENQUEUE", detail: "Runtime arguments, kernel configuration, launch message, barriers and GO." },
] as const;

const bootSteps = [
  { id: "B1", from: "MetalContext", to: "JIT", title: "Create firmware build states", detail: "Build or reuse separate firmware targets for BRISC, NCRISC and the three TRISCs." },
  { id: "B2", from: "JIT", to: "MetalContext", title: "Return five ELF images", detail: "Firmware is linked first and its exported symbols support later operation-kernel linking." },
  { id: "B3", from: "Host", to: "Worker L1", title: "Initialize launch state", detail: "The host writes firmware tables, launch-ring fields and INIT/GO state." },
  { id: "B4", from: "Host", to: "Worker L1", title: "Load every firmware image", detail: "Each ELF span is multicast to the HAL address assigned to its processor." },
  { id: "B5", from: "Host", to: "BRISC", title: "Release the supervisor", detail: "On Wormhole and Blackhole, BRISC is the first worker RISC released by the host." },
  { id: "B6", from: "BRISC", to: "NCRISC + TRISCs", title: "Set reset PCs and initialize", detail: "BRISC releases the subordinate processors and requests their initialization." },
  { id: "B7", from: "NCRISC + TRISCs", to: "BRISC", title: "Acknowledge INIT DONE", detail: "BRISC waits until every enabled subordinate has completed initialization." },
  { id: "B8", from: "MetalContext", to: "CQ cores", title: "Install command transport", detail: "Persistent prefetch and dispatch Programs are configured after base firmware bring-up." },
] as const;

const runSteps = [
  { id: "R1", from: "Host / TTNN", to: "Program JIT", title: "Compile on cache miss", detail: "Build selected DM kernels and three TRISC variants from the compute source." },
  { id: "R2", from: "Program", to: "Device binary buffer", title: "Pack and upload ELF spans", detail: "Page-aligned binary_data records destination address, offset, size and processor metadata." },
  { id: "R3", from: "Host CQ", to: "Prefetch / dispatch", title: "Send the command stream", detail: "Runtime args and config precede optional binary placement, launch message and GO." },
  { id: "R4", from: "Dispatcher", to: "Worker L1", title: "Place code and launch state", detail: "NoC writes populate required worker regions; a barrier orders them before GO." },
  { id: "R5", from: "Dispatcher", to: "BRISC", title: "Issue GO", detail: "Resident BRISC firmware observes the launch, configures the run and starts subordinate work." },
  { id: "R6", from: "BRISC", to: "NCRISC + TRISCs", title: "Start parallel kernel roles", detail: "DM0, optional DM1 and UNPACK/MATH/PACK call their operation-kernel entry points." },
  { id: "R7", from: "NCRISC + TRISCs", to: "BRISC", title: "Collect operation DONE", detail: "This completion is different from the initialization acknowledgement at cold boot." },
  { id: "R8", from: "BRISC", to: "Dispatcher / host", title: "Publish completion", detail: "The command queue can retire the launch and release a waiting event or Finish." },
] as const;

const sourceCards = [
  { id: "01", kind: "TOPOLOGY", title: "Hardware thread map", detail: "BRISC, NCRISC, TRISC0/1/2 on tt-1xx; DM and NEO threads on tt-2xx.", url: "https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/internal/hw_thread.h#L23-L35" },
  { id: "02", kind: "BUILD", title: "Firmware source selection", detail: "The HAL chooses persistent firmware sources and separate operation-kernel wrappers.", url: "https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/hal/tt-1xx/hal_1xx_common.cpp#L80-L110" },
  { id: "03", kind: "HOST BOOT", title: "Load every RISC image", detail: "Host initialization writes launch state and each firmware binary before release.", url: "https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/context/risc_firmware_initializer.cpp#L1053-L1199" },
  { id: "04", kind: "DEVICE BOOT", title: "BRISC supervises startup", detail: "BRISC sets subordinate reset PCs, releases them and waits for initialization.", url: "https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L181-L275" },
  { id: "05", kind: "KERNEL BUILD", title: "DM and three compute ELFs", detail: "A compute source produces UNPACK, MATH and PACK binaries.", url: "https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/kernels/kernel.cpp#L900-L955" },
  { id: "06", kind: "DISPATCH", title: "Command sequence", detail: "Runtime args, config, optional binaries, launch state, barrier and GO.", url: "https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/program/dispatch.cpp#L3169-L3277" },
  { id: "07", kind: "WORKER RUN", title: "BRISC launch loop", detail: "GO handling, subordinate start, kernel call, waits and completion notification.", url: "https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L389-L592" },
  { id: "08", kind: "FULL REPORT", title: "Evidence ledger + Mermaid", detail: "The complete plan, logic review, two diagrams and repeatable experiment.", url: "./RISC_FIRMWARE_TO_KERNEL_FLOW.md" },
] as const;

function Sequence({ steps, label }: { steps: typeof bootSteps | typeof runSteps; label: string }) {
  return (
    <div className="risc-sequence" role="region" aria-label={label}>
      {steps.map((step, index) => (
        <article key={step.id}>
          <span className="sequence-id">{step.id}</span>
          <div className="sequence-route"><b>{step.from}</b><i>→</i><b>{step.to}</b></div>
          <div><h3>{step.title}</h3><p>{step.detail}</p></div>
          <em>{String(index + 1).padStart(2, "0")}</em>
        </article>
      ))}
    </div>
  );
}

function FirmwareFlowApp() {
  const [phase, setPhase] = useState<PhaseKey>("inventory");
  const selected = phases[phase];

  return (
    <div className="firmware-page">
      <header className="firmware-topbar">
        <a className="firmware-brand" href="./index.html"><b>TT•SIM</b><span>firmware flow atlas</span></a>
        <nav aria-label="Page navigation"><a href="#objects">Objects</a><a href="#boot">Boot</a><a href="#operation">Operation</a><a href="#quasar">Quasar</a><a className="firmware-back" href="./index.html#debug">← Lab guide</a></nav>
      </header>

      <main>
        <section className="firmware-hero">
          <div className="firmware-hero-meta"><span>FIELD NOTE / 04</span><small>TT-METAL · 50A82F83559</small></div>
          <div className="firmware-hero-copy">
            <p>HOST → FIRMWARE → OPERATION KERNEL</p>
            <h1>Five RISCs.<br/><em>No firmware relay.</em></h1>
            <div className="firmware-thesis"><strong>Corrected sequence</strong><p>The host loads separate BRISC, NCRISC and TRISC firmware images. It releases BRISC, and BRISC starts the subordinate RISCs. Model operations later supply cacheable kernel code plus per-launch state.</p></div>
          </div>
          <div className="truth-stack" aria-label="Three essential corrections">
            <article><span>WHO LOADS?</span><strong>HOST</strong><p>writes every base firmware ELF</p></article>
            <article><span>WHO SUPERVISES?</span><strong>BRISC</strong><p>releases NCRISC + TRISC0/1/2</p></article>
            <article><span>WHAT CHANGES?</span><strong>PROGRAM</strong><p>kernels and launch state—not base firmware</p></article>
          </div>
        </section>

        <section id="objects" className="firmware-section object-section">
          <div className="firmware-heading"><span>00 / THE LIFETIME TEST</span><h2>Do not call every<br/>binary “firmware.”</h2><p>Four executable or data layers cross different boundaries. Give an observed byte the correct lifetime before interpreting its address or call stack.</p></div>
          <div className="object-grid">{objectLayers.map((item) => <article key={item.number}><span>{item.number}</span><small>{item.lifetime}</small><h3>{item.title}</h3><p>{item.detail}</p></article>)}</div>
          <div className="topology-strip"><span>TT-1XX WORKER</span><b>BRISC / DM0</b><i>+</i><b>NCRISC / DM1</b><i>+</i><b>TRISC0 / UNPACK</b><i>+</i><b>TRISC1 / MATH</b><i>+</i><b>TRISC2 / PACK</b></div>
        </section>

        <section className="firmware-section plan-section">
          <div className="firmware-heading"><span>01 / ANALYSIS PLAN</span><h2>Prove the boundaries<br/>in source order.</h2><p>The plan advances only when the current phase has a concrete source path and a falsifiable review gate.</p></div>
          <div className="phase-workbench">
            <div className="phase-tabs" role="tablist" aria-label="Source analysis phases">
              {(Object.keys(phases) as PhaseKey[]).map((key) => <button type="button" role="tab" aria-selected={phase === key} className={phase === key ? "active" : ""} onClick={() => setPhase(key)} key={key}><span>{phases[key].number}</span>{phases[key].label}</button>)}
            </div>
            <article className="phase-panel" role="tabpanel"><small>QUESTION TO PROVE</small><h3>{selected.question}</h3><dl><div><dt>Evidence</dt><dd>{selected.evidence}</dd></div><div><dt>Review gate</dt><dd>{selected.gate}</dd></div></dl></article>
          </div>
        </section>

        <section id="boot" className="firmware-section sequence-section boot-section">
          <div className="firmware-heading inverse"><span>02 / COLD BOOT</span><h2>The host places code.<br/>BRISC releases peers.</h2><p>NCRISC is not a firmware relay. Host writes happen before BRISC establishes the subordinate initialization handshake.</p></div>
          <Sequence steps={bootSteps} label="Wormhole and Blackhole cold-boot sequence" />
          <div className="sequence-verdict"><span>INVALID MODEL</span><s>Host → NCRISC → BRISC → TRISCs</s><i>≠</i><span>CURRENT SOURCE</span><b>Host → all firmware regions; Host → BRISC; BRISC → subordinate reset/init</b></div>
        </section>

        <section id="operation" className="firmware-section sequence-section operation-section">
          <div className="firmware-heading"><span>03 / MODEL OPERATION</span><h2>Code on first use.<br/>State on every launch.</h2><p>A TTNN operation becomes one or more Programs. The command queue orders launches; persistent firmware calls the operation-kernel entry points.</p></div>
          <div className="cache-branch"><article><span>COLD PROGRAM</span><b>compile → pack → upload</b><p>Selected DM ELF(s) plus three compute ELFs enter the program binary path.</p></article><article><span>WARM PROGRAM</span><b>reuse committed binaries</b><p>New arguments, configuration, launch message and GO still define the next run.</p></article></div>
          <Sequence steps={runSteps} label="First-use and warm operation launch sequence" />
          <div className="wormhole-note"><span>WORMHOLE NUANCE</span><p>NCRISC may copy its own <b>operation kernel</b> from shared L1 to NCRISC IRAM. That is local relocation, not boot-firmware forwarding.</p></div>
        </section>

        <section id="quasar" className="firmware-section quasar-section">
          <div className="firmware-heading inverse"><span>04 / ARCHITECTURE BRANCH</span><h2>Quasar needs<br/>different labels.</h2><p>The five-RISC tt-1xx diagram is not a universal Tensix diagram. Quasar’s tt-2xx path exposes eight DMs and four NEO groups with four TRISCs each.</p></div>
          <div className="quasar-map"><article><span>DATA MOVEMENT</span><strong>DM0–DM7</strong><p>DM0 has supervisory initialization and launch duties in the inspected firmware.</p></article><div><span>N0</span><b>TR0 · TR1 · TR2 · TR3</b><span>N1</span><b>TR0 · TR1 · TR2 · TR3</b><span>N2</span><b>TR0 · TR1 · TR2 · TR3</b><span>N3</span><b>TR0 · TR1 · TR2 · TR3</b></div></div>
          <p className="quasar-rule">Branch the investigation at HAL selection. Reusing “BRISC/NCRISC/three TRISCs” for Quasar would erase the architectural change you are trying to learn.</p>
        </section>

        <section className="validation-section">
          <div><span>05 / REPEATABLE VALIDATION</span><h2>Run it twice.<br/>Watch what disappears.</h2></div>
          <ol><li><b>Slow-dispatch baseline</b><p>Use host GDB to record every firmware and operation-binary write: processor, address and byte count.</p></li><li><b>Boot waypoints</b><p>DPRINT or Watcher marks BRISC entry, subordinate INIT DONE and the first wait for GO.</p></li><li><b>First fast launch</b><p>Capture binary upload, worker-L1 placement, launch message, NoC barrier and GO.</p></li><li><b>Second identical launch</b><p>Prove committed binaries are reused while new arguments, launch state and GO remain.</p></li></ol>
          <div className="validation-record"><span>RECORD</span><p>ELF · processor · address · bytes · reset state · GO state · command type · completion state</p><a href="./RISC_FIRMWARE_TO_KERNEL_FLOW.md">Open the complete experiment ↗</a></div>
        </section>

        <section className="firmware-sources"><div><span>PRIMARY SOURCE LEDGER</span><h2>Every arrow has<br/>a code anchor.</h2></div><div className="firmware-source-grid">{sourceCards.map((source) => <a key={source.id} href={source.url}><small>{source.id} · {source.kind}</small><b>{source.title}</b><p>{source.detail}</p><i>↗</i></a>)}</div></section>
      </main>

      <footer className="firmware-footer"><div><b>TT•SIM FIRMWARE FLOW ATLAS</b><p>Independent, source-backed learning guide.</p></div><a href="https://github.com/buicongnguyen/tt-sim">Source on GitHub ↗</a><a href="./async-kernels.html">Kernel synchronization →</a><a href="./index.html">Lab guide →</a></footer>
    </div>
  );
}

export default FirmwareFlowApp;
