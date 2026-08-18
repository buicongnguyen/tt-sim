import { useMemo, useState } from "react";

const commit = "50a82f835593512c4176546b4af68d7e91315a86";
const sourceRoot = `https://github.com/tenstorrent/tt-metal/blob/${commit}`;

type PrimitiveId = "compiler" | "risc" | "noc" | "l1sem" | "t6sem" | "cb";

type Primitive = {
  id: PrimitiveId;
  index: string;
  short: string;
  title: string;
  domain: string;
  waitsFor: string;
  implementation: string;
  doesNot: string;
  source: string;
  sourceLabel: string;
};

const primitives: readonly Primitive[] = [
  {
    id: "compiler",
    index: "01",
    short: "COMPILER",
    title: "Compiler-only fence",
    domain: "C++ scheduling",
    waitsFor: "Nothing in hardware",
    implementation: 'asm volatile("" ::: "memory")',
    doesNot: "Emit an opcode, drain NoC traffic, or publish data to another core.",
    source: `${sourceRoot}/tt_metal/tt-llk/common/ckernel_fence.h#L10-L17`,
    sourceLabel: "ckernel_fence.h:10–17",
  },
  {
    id: "risc",
    index: "02",
    short: "RISC-V",
    title: "Blackhole RISC-V fence",
    domain: "One Baby RISC-V memory path",
    waitsFor: "The local ordering/commit condition defined by Blackhole's memory implementation",
    implementation: 'asm volatile("fence" ::: "memory")',
    doesNot: "Stand in for a Tenstorrent NoC completion barrier.",
    source: `${sourceRoot}/tt_metal/tt-llk/tt_llk_blackhole/common/inc/ckernel.h#L91-L134`,
    sourceLabel: "Blackhole ckernel.h:91–134",
  },
  {
    id: "noc",
    index: "03",
    short: "NoC",
    title: "Typed NoC barrier",
    domain: "NoC hardware queue",
    waitsFor: "Reads, non-posted writes, atomics, or all traffic—depending on the API",
    implementation: "RISC polls the matching NoC engine state while hardware moves packets",
    doesNot: "Transfer CB ownership or synchronize math and pack destination registers.",
    source: `${sourceRoot}/tt_metal/hw/inc/api/dataflow/dataflow_api.h#L1743-L1917`,
    sourceLabel: "dataflow_api.h:1743–1917",
  },
  {
    id: "l1sem",
    index: "04",
    short: "L1 SEM",
    title: "Program L1 semaphore",
    domain: "Cross-core readiness",
    waitsFor: "A local four-byte L1 word to equal or exceed a target",
    implementation: "Receiver polls local L1; sender can use a hardware NoC atomic increment",
    doesNot: "Complete an earlier payload transfer automatically.",
    source: `${sourceRoot}/tt_metal/hw/inc/api/dataflow/dataflow_api.h#L1935-L1969`,
    sourceLabel: "dataflow_api.h:1935–1969",
  },
  {
    id: "t6sem",
    index: "05",
    short: "T6 SEM",
    title: "Tensix hardware semaphore",
    domain: "Internal unpack / math / pack pipeline",
    waitsFor: "A four-bit internal counter condition while stalling selected Tensix resources",
    implementation: "TTI_SEMWAIT / TTI_SEMPOST / TTI_SEMGET; hardware mutex instructions also exist",
    doesNot: "Provide a public cross-core user semaphore namespace.",
    source: `${sourceRoot}/tt_metal/tt-llk/tt_llk_blackhole/common/inc/ckernel.h#L250-L340`,
    sourceLabel: "Blackhole ckernel.h:250–340",
  },
  {
    id: "cb",
    index: "06",
    short: "CB",
    title: "Circular-buffer credits",
    domain: "Producer / consumer ownership",
    waitsFor: "Free pages or received pages",
    implementation: "Received/acknowledged counters plus read/write pointer updates and polling waits",
    doesNot: "Make an outstanding NoC transfer complete before push.",
    source: `${sourceRoot}/tt_metal/hw/inc/api/dataflow/dataflow_api.h#L195-L485`,
    sourceLabel: "dataflow_api.h:195–485",
  },
] as const;

const waypointRows = [
  ["NRBW → NRBD", "NoC read barrier", "source, destination, byte count, route"],
  ["NWBW → NWBD", "non-posted write completion", "destination and acknowledgement path"],
  ["NABW → NABD", "non-posted atomic completion", "atomic address, route, posted choice"],
  ["NSMW → NSMD", "minimum L1 semaphore wait", "target epoch, remote coordinate, missing increment"],
  ["CRBW → CRBD", "producer waiting for CB space", "consumer pop and wrap accounting"],
  ["CWFW → CWFD", "consumer waiting for pages", "reader barrier, push, cumulative count"],
  ["CKW → CKD", "debug checkpoint", "same checkpoint on every active RISC"],
] as const;

const experiments = [
  {
    id: "A",
    title: "Delay payload writes",
    premise: "Can the readiness atomic become visible before the payload is safe?",
    action: "Target one producer core with the Watcher NoC write-delay hook; keep the signal path unchanged.",
    pass: "A typed write barrier before the atomic removes the stale-data outcome across all seeds.",
  },
  {
    id: "B",
    title: "Replace equality with epoch",
    premise: "Can a fast producer advance past the exact value the consumer expects?",
    action: "Never reset the shared counter; increment once per phase and wait for value ≥ target.",
    pass: "The consumer cannot hang merely because it observes a later valid phase.",
  },
  {
    id: "C",
    title: "Separate transfer from ownership",
    premise: "Was a CB page published before its NoC read completed?",
    action: "Compare push-before-barrier with read-barrier-before-push using the same pages and pattern.",
    pass: "Only valid completed pages become visible and received/acknowledged counts balance.",
  },
] as const;

const toolRows = [
  { tool: "WATCHER", answer: "Where is it blocked?", method: "Read the last W marker without its D partner.", caution: "Start here; lowest disturbance." },
  { tool: "DPRINT", answer: "What value reached this boundary?", method: "Print once before and after the wait.", caution: "Never print every spin iteration." },
  { tool: "CHECKPOINT", answer: "What did all RISCs see together?", method: "Synchronize participants and dump CB/L1/dest state.", caution: "Every active RISC must reach the same checkpoint." },
  { tool: "DELAY A/B", answer: "Which edge is timing-sensitive?", method: "Perturb one core/RISC/transaction class.", caution: "Not a performance measurement." },
  { tool: "PROFILER", answer: "When were NoC events issued/completed?", method: "Record NoC events in a separate run.", caution: "Do not stack all instrumentation in one run." },
  { tool: "GDB/JTAG", answer: "Which PC/register/memory word is wrong?", method: "Halt only after Watcher localizes the RISC.", caution: "A halted participant can create a false deadlock." },
] as const;

function PrimitiveWorkbench() {
  const [selectedId, setSelectedId] = useState<PrimitiveId>("noc");
  const selected = useMemo(() => primitives.find((item) => item.id === selectedId)!, [selectedId]);

  return (
    <div className="sync-workbench">
      <div className="sync-rail" role="tablist" aria-label="Synchronization mechanisms">
        {primitives.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={selectedId === item.id}
            className={selectedId === item.id ? "active" : ""}
            onClick={() => setSelectedId(item.id)}
            key={item.id}
          >
            <span>{item.index}</span><b>{item.short}</b>
          </button>
        ))}
      </div>
      <article className="sync-detail" role="tabpanel">
        <div className="sync-detail-kicker"><span>{selected.index}</span>{selected.domain}</div>
        <h3>{selected.title}</h3>
        <dl>
          <div><dt>WAITS FOR</dt><dd>{selected.waitsFor}</dd></div>
          <div><dt>MECHANISM</dt><dd>{selected.implementation}</dd></div>
          <div><dt>DOES NOT</dt><dd>{selected.doesNot}</dd></div>
        </dl>
        <a href={selected.source}>{selected.sourceLabel} ↗</a>
      </article>
    </div>
  );
}

function BlackholeSynchronizationApp() {
  return (
    <div className="sync-page">
      <header className="sync-topbar">
        <a className="sync-brand" href="./index.html"><b>TT•SIM</b><span>blackhole synchronization</span></a>
        <nav aria-label="Page navigation">
          <a href="#fences">Fences</a><a href="#semaphores">Semaphores</a><a href="#debug">Debug</a><a href="#labs">Labs</a>
          <a className="sync-back" href="./discussion.html">← Discussion</a>
        </nav>
      </header>

      <main>
        <section className="sync-hero">
          <div className="hero-grid" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
          <div className="sync-hero-copy">
            <p>DISCUSSION / SUBPAGE 03 · BLACKHOLE · SOURCE PINNED</p>
            <h1>Fence is not<br/><em>one fence.</em></h1>
            <div className="hero-contract">
              <span>THE RULE</span>
              <p>Choose the primitive whose guarantee crosses the broken dependency: compiler, local RISC, NoC, cross-core readiness, buffer ownership, or Tensix pipeline.</p>
            </div>
          </div>
          <aside className="sync-hero-aside">
            <span>PINNED REVISION</span><code>50a82f835593</code>
            <div><b>06</b><small>distinct mechanisms</small></div>
            <div><b>07</b><small>paired Watcher waits</small></div>
            <a href={`https://github.com/tenstorrent/tt-metal/tree/${commit}`}>Open tt-metal source ↗</a>
          </aside>
        </section>

        <section className="sync-thesis">
          <span>QUICK CORRECTION</span>
          <h2>A compiler fence emits no opcode. A RISC-V fence orders the local memory path. A NoC barrier proves a NoC condition. A semaphore publishes state.</h2>
        </section>

        <section id="fences" className="sync-section workbench-section">
          <div className="sync-heading"><span>01 / CONTRACT SELECTOR</span><h2>Six names.<br/>Six boundaries.</h2><p>Select a mechanism to see its exact domain, implementation and non-guarantee. This is the first decision before changing kernel code.</p></div>
          <PrimitiveWorkbench />
        </section>

        <section className="sync-section fence-section">
          <div className="sync-heading inverse"><span>02 / FENCE LADDER</span><h2>From source order<br/>to remote arrival.</h2><p>Each layer adds a different edge. No layer inherits the guarantee of the next one.</p></div>
          <div className="fence-ladder">
            <article><span>00</span><small>COMPILER</small><h3>Empty asm</h3><code>asm volatile("" ::: "memory")</code><p>Prevents compiler motion. It cannot wait for hardware.</p></article>
            <i>→</i>
            <article><span>01</span><small>BABY RISC-V</small><h3>Real fence</h3><code>asm volatile("fence" ::: "memory")</code><p>Local memory/cache ordering under Blackhole's implementation.</p></article>
            <i>→</i>
            <article><span>02</span><small>NoC ENGINE</small><h3>Typed barrier</h3><code>noc_async_write_barrier()</code><p>Waits for the selected transaction class to complete.</p></article>
            <i>→</i>
            <article><span>03</span><small>REMOTE OBSERVER</small><h3>Publish epoch</h3><code>noc_semaphore_inc(...)</code><p>Atomically notifies the remote L1 after payload completion.</p></article>
          </div>
          <div className="fence-warning"><b>FLUSH ≠ COMPLETE</b><p><code>noc_async_writes_flushed()</code> waits for writes to depart; it explicitly does not wait for remote completion.</p><a href={`${sourceRoot}/tt_metal/hw/inc/api/dataflow/dataflow_api.h#L1790-L1815`}>Read implementation ↗</a></div>
        </section>

        <section id="semaphores" className="sync-section semaphore-section">
          <div className="sync-heading"><span>03 / TWO SEMAPHORE FAMILIES</span><h2>Same noun.<br/>Different machine.</h2><p>Both families are fast in their intended scope. They are not interchangeable.</p></div>
          <div className="semaphore-compare">
            <article className="l1-sem">
              <header><span>PUBLIC / CROSS-CORE</span><b>16 IDs · 32-bit</b></header>
              <h3>Program L1 semaphore</h3><div className="sem-counter"><i>09</i><em>→</em><i>10</i><small>NoC atomic</small></div>
              <ul><li>16 program-visible IDs, 0…15</li><li>four-byte word in local L1</li><li>receiver RISC polls</li><li>remote sender uses NoC atomic</li><li>prefer monotonic epoch + wait_min</li></ul>
              <a href={`${sourceRoot}/tt_metal/impl/buffers/semaphore.hpp#L14-L17`}>Read program limit ↗</a>
            </article>
            <div className="sem-divider"><span>≠</span><small>NOT THE<br/>SAME BANK</small></div>
            <article className="t6-sem">
              <header><span>INTERNAL / TENSIX</span><b>4-bit</b></header>
              <h3>Hardware pipeline semaphore</h3><div className="sem-counter"><i>00</i><em>⇄</em><i>15</i><small>SEMWAIT / POST / GET</small></div>
              <ul><li>eight internal LLK IDs</li><li>stalls selected Tensix resources</li><li>coordinates unpack, math and pack</li><li>use public tile_regs_* wrappers</li></ul>
              <a href={`${sourceRoot}/tt_metal/tt-llk/tt_llk_blackhole/common/inc/ckernel_structs.h#L12-L43`}>Read ID map ↗</a>
            </article>
          </div>
          <div className="register-handshake">
            <div><span>TRISC1 / MATH</span><code>tile_regs_acquire()</code><i>→</i><code>compute</code><i>→</i><code>tile_regs_commit()</code></div>
            <div><span>TRISC2 / PACK</span><code>tile_regs_wait()</code><i>→</i><code>pack</code><i>→</i><code>tile_regs_release()</code></div>
            <a href={`${sourceRoot}/tt_metal/hw/inc/api/compute/reg_api.h#L40-L89`}>Public register API ↗</a>
          </div>
        </section>

        <section className="sync-section protocol-section">
          <div className="sync-heading inverse"><span>04 / DATA-BEFORE-SIGNAL</span><h2>Payload first.<br/>Epoch second.</h2><p>The readiness atomic answers only whether the counter changed. It does not retroactively finish the payload queue.</p></div>
          <div className="protocol-flow">
            <article><span>01</span><small>PRODUCER RISC</small><h3>Issue payload</h3><code>noc_async_write(...)</code></article><i>→</i>
            <article><span>02</span><small>NoC WRITE QUEUE</small><h3>Prove completion</h3><code>noc_async_write_barrier()</code></article><i>→</i>
            <article><span>03</span><small>NoC ATOMIC</small><h3>Publish epoch</h3><code>noc_semaphore_inc(...)</code></article><i>→</i>
            <article><span>04</span><small>CONSUMER RISC</small><h3>Wait threshold</h3><code>noc_semaphore_wait_min(...)</code></article>
          </div>
          <div className="protocol-notes"><p><b>Critical edge</b> The write barrier comes before the readiness atomic.</p><p><b>Optional sender proof</b> Add <code>noc_async_atomic_barrier()</code> only when the producer must know its non-posted atomic completed.</p></div>
        </section>

        <section id="debug" className="sync-section debug-section">
          <div className="sync-heading"><span>05 / DEBUG LADDER</span><h2>Observe before<br/>you halt.</h2><p>A debugger can manufacture a deadlock by stopping a participant. Begin with non-halting localization, then increase detail.</p></div>
          <div className="debug-tools">
            {toolRows.map((row, index) => <article key={row.tool}><span>{String(index + 1).padStart(2, "0")}</span><small>{row.tool}</small><h3>{row.answer}</h3><p>{row.method}</p><i>{row.caution}</i></article>)}
          </div>
          <div className="waypoint-console">
            <header><span>WATCHER / PAIRED WAYPOINT DECODER</span><small>W = WAIT ENTERED · D = WAIT DONE</small></header>
            <div className="waypoint-head"><b>PAIR</b><b>BLOCKED CONTRACT</b><b>FIRST CHECK</b></div>
            {waypointRows.map((row) => <div className="waypoint-row" key={row[0]}><code>{row[0]}</code><p>{row[1]}</p><p>{row[2]}</p></div>)}
          </div>
          <div className="debug-commands">
            <div><span>TARGETED RACE AMPLIFICATION</span><pre>{`export TT_METAL_WATCHER=1
unset TT_METAL_WATCHER_DISABLE_NOC_SANITIZE
export TT_METAL_WATCHER_DEBUG_DELAY=500
export TT_METAL_WRITE_DEBUG_DELAY_CORES=0,0
export TT_METAL_WRITE_DEBUG_DELAY_RISCVS=BR`}</pre></div>
            <div><span>SEPARATE NoC TIMELINE RUN</span><pre>{`export TT_METAL_DEVICE_PROFILER=1
export TT_METAL_DEVICE_PROFILER_NOC_EVENTS=1`}</pre></div>
            <div><span>CONSISTENT CHECKPOINT + DUMP</span><pre>{`export TT_METAL_CHECKPOINT=1
export TT_METAL_DPRINT_CORES=0,0

# Rebuild JIT kernels after toggling.
# Every active RISC must call the same checkpoint.`}</pre></div>
          </div>
          <p className="debug-caveat"><b>Do not stack every tool.</b> Watcher first, checkpoint or DPRINT second, profiler in a separate run, and GDB/JTAG only after a core/RISC is localized.</p>
        </section>

        <section id="labs" className="sync-section labs-section">
          <div className="sync-heading inverse"><span>06 / REPEATABLE LABS</span><h2>Break one edge.<br/>Prove one repair.</h2><p>Each lab changes one ordering variable while holding the input, binary identity and correctness oracle constant.</p></div>
          <div className="experiment-grid">{experiments.map((experiment) => <article key={experiment.id}><header><span>LAB {experiment.id}</span><b>EXPERIMENT</b></header><h3>{experiment.title}</h3><dl><div><dt>QUESTION</dt><dd>{experiment.premise}</dd></div><div><dt>ACTION</dt><dd>{experiment.action}</dd></div><div><dt>PASS</dt><dd>{experiment.pass}</dd></div></dl></article>)}</div>
          <div className="star-case">
            <header><span>STAR / STALE PAYLOAD AFTER “SUCCESSFUL” SIGNAL</span><b>RESULT MUST BE MEASURED</b></header>
            <div><article><span>S</span><h3>Situation</h3><p>Receiver epoch arrives, but an intermittent unit test reads old payload words.</p></article><article><span>T</span><h3>Task</h3><p>Separate local visibility, NoC completion, semaphore targeting and CB ownership.</p></article><article><span>A</span><h3>Action</h3><p>Pair Watcher markers, delay writes, find signal-before-barrier, repair the typed edge.</p></article><article><span>R</span><h3>Result</h3><p>Require deterministic validation over all seeds before claiming closure.</p></article></div>
          </div>
        </section>

        <section className="sync-download">
          <div><span>FULL SOURCE-BACKED GUIDE</span><h2>Mermaid diagrams, labs,<br/>commands and anti-patterns.</h2></div>
          <div><a href="./DISCUSSION_BLACKHOLE_SYNCHRONIZATION.md">Read Markdown guide ↗</a><a href="https://github.com/buicongnguyen/tt-sim/blob/main/docs/DISCUSSION_BLACKHOLE_SYNCHRONIZATION.md">Open source on GitHub ↗</a></div>
        </section>
      </main>

      <footer className="sync-footer"><div><b>TT•SIM · DISCUSSION SUBPAGE 03</b><p>Blackhole synchronization contracts and race-debugging field guide.</p></div><a href="./discussion-blackhole-bringup.html">← Bring-up chain</a><a href="./async-kernels.html">Async kernels →</a><a href="./discussion.html">Discussion →</a><a href="./index.html">Book →</a></footer>
    </div>
  );
}

export default BlackholeSynchronizationApp;
