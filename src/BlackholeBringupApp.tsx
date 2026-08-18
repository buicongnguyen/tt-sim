import { useState } from "react";

type SourceLink = { label: string; href: string };
type DecisionStep = {
  id: string;
  number: string;
  title: string;
  question: string;
  choice: string;
  yes: string;
  no: string;
  artifact: string;
  sources: readonly SourceLink[];
};

const commit = "50a82f835593512c4176546b4af68d7e91315a86";
const sourceRoot = `https://github.com/tenstorrent/tt-metal/blob/${commit}`;

const sourceLinks = {
  briscLaunch: `${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L290-L330`,
  briscLoop: `${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L354-L590`,
  ncriscLoop: `${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/ncrisc.cc#L77-L192`,
  ncrisck: `${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/ncrisck.cc#L38-L95`,
  hal: `${sourceRoot}/tt_metal/llrt/hal/tt-1xx/blackhole/bh_hal_tensix.cpp#L97-L147`,
  compiler: `${sourceRoot}/tt_metal/jit_build/build.cpp#L124-L205`,
  buildMap: `${sourceRoot}/tt_metal/jit_build/build.cpp#L628-L790`,
  buildKey: `${sourceRoot}/tt_metal/jit_build/build.cpp#L369-L388`,
  config: `${sourceRoot}/tt_metal/api/tt-metalium/kernel_types.hpp#L53-L102`,
  readback: `${sourceRoot}/tt_metal/llrt/llrt.cpp#L190-L250`,
  apiTargets: `${sourceRoot}/tests/tt_metal/tt_metal/CMakeLists.txt#L70-L86`,
  kernelCreationTest: `${sourceRoot}/tests/tt_metal/tt_metal/api/test_kernel_creation.cpp#L36-L53`,
  processorCompileTest: `${sourceRoot}/tests/tt_metal/tt_metal/api/test_kernel_compile_cache.cpp#L32-L68`,
  compileKernel: `${sourceRoot}/tests/tt_metal/tt_metal/test_kernels/dataflow/reader_unary_push_4.cpp`,
  directTests: `${sourceRoot}/tests/tt_metal/tt_metal/api/test_direct.cpp#L46-L317`,
  directTestCases: `${sourceRoot}/tests/tt_metal/tt_metal/api/test_direct.cpp#L548-L595`,
  directReaderKernel: `${sourceRoot}/tests/tt_metal/tt_metal/test_kernels/dataflow/unit_tests/dram/direct_reader_dram_to_l1.cpp`,
  directWriterKernel: `${sourceRoot}/tests/tt_metal/tt_metal/test_kernels/dataflow/unit_tests/dram/direct_writer_l1_to_dram.cpp`,
  combinedReaderKernel: `${sourceRoot}/tests/tt_metal/tt_metal/test_kernels/dataflow/unit_tests/dram/direct_reader_unary_2_0.cpp`,
  combinedWriterKernel: `${sourceRoot}/tests/tt_metal/tt_metal/test_kernels/dataflow/unit_tests/dram/direct_writer_unary_2_0.cpp`,
  threadSyncTest: `${sourceRoot}/tests/tt_metal/tt_metal/api/test_kernel_thread_sync.cpp#L77-L130`,
  threadSyncKernel: `${sourceRoot}/tests/tt_metal/tt_metal/test_kernels/dataflow/kernel_thread_barrier.cpp`,
  watcherTest: `${sourceRoot}/tests/tt_metal/tt_metal/debug_tools/watcher/test_waypoint.cpp#L54-L220`,
  dprintTest: `${sourceRoot}/tests/tt_metal/tt_metal/debug_tools/device_print/test_print_output.cpp#L226-L231`,
  callstackTest: `${sourceRoot}/tests/tt_metal/tt_metal/debug_tools/device_print/test_print_output.cpp#L640-L658`,
  firmwareLoad: `${sourceRoot}/tt_metal/impl/device/firmware/risc_firmware_initializer.cpp#L1143-L1165`,
  operationWrite: `${sourceRoot}/tt_metal/impl/kernels/kernel.cpp#L1079-L1092`,
} as const;

const decisionSteps: readonly DecisionStep[] = [
  {
    id: "freeze",
    number: "01",
    title: "Freeze one failure",
    question: "Can one Blackhole worker reproduce the same failure from a clean named cache?",
    choice: "Choose the smallest stable one-core reproducer before adding instrumentation.",
    yes: "Record commit, board, launch inputs, compiler path/version/hash and untouched logs.",
    no: "Reduce core count and model setup; investigate nondeterminism before compiler output.",
    artifact: "environment.txt + baseline.log",
    sources: [{ label: "JIT compiler selection", href: sourceLinks.compiler }],
  },
  {
    id: "waypoint",
    number: "02",
    title: "Find the missing boundary",
    question: "Which BRISC/NCRISC Watcher waypoint is the last one observed?",
    choice: "Run Watcher alone and classify initialization, host GO, shared GO, operation entry or kernel body.",
    yes: "Select one short code interval using GW/GD/W/R/K/KD/D.",
    no: "If no waypoint is valid, return to reset PC, firmware load and board state.",
    artifact: "watcher.log + paired-waypoint.txt",
    sources: [
      { label: "BRISC loop", href: sourceLinks.briscLoop },
      { label: "NCRISC loop", href: sourceLinks.ncriscLoop },
    ],
  },
  {
    id: "handshake",
    number: "03",
    title: "Test shared launch state",
    question: "Does BRISC publish LOAD/GO, and does NCRISC observe it after cache invalidation?",
    choice: "Treat BRISC as supervisor and shared subordinate state as the interface—there is no NCRISC→BRISC function call.",
    yes: "Firmware R proves launch preparation, but Blackhole may still be waiting for shared GO; require operation K before clearing handshake/handoff.",
    no: "Inspect DM1 enable, launch fields, cache visibility and the exact shared sync value.",
    artifact: "launch-state.txt + optional two-point DPRINT",
    sources: [
      { label: "BRISC publishes GO", href: sourceLinks.briscLaunch },
      { label: "NCRISC observes GO", href: sourceLinks.ncriscLoop },
    ],
  },
  {
    id: "image",
    number: "04",
    title: "Prove image identity",
    question: "Can the intended NCRISC image be proven at the actual L1 load range and HAL entry mapping?",
    choice: "Hash and explicitly read a supported L1/config-buffer range; the readback environment flag is not blanket proof for Blackhole multicast writes.",
    yes: "Resolve the PC against the saved ELF, symbols, map and source.",
    no: "Fix stale-cache, binary span, load-address or transport errors first.",
    artifact: "kernel.elf + map + readback-hashes.txt",
    sources: [
      { label: "Blackhole HAL bases", href: sourceLinks.hal },
      { label: "Unicast readback helper", href: sourceLinks.readback },
      { label: "BH firmware multicast load", href: sourceLinks.firmwareLoad },
    ],
  },
  {
    id: "entry",
    number: "05",
    title: "Locate operation entry",
    question: "Does NCRISC progress from firmware R to operation K and then KD?",
    choice: "Use R→K for shared GO, handoff, image/entry, CRT/ABI and K→KD for the user kernel body.",
    yes: "K without KD means the failure is inside kernel_main or its generated instructions.",
    no: "R without K means inspect shared GO, operation handoff, image/entry, CRT/data initialization, relocation and ABI.",
    artifact: "failing-pc.txt + ncrisc.dis",
    sources: [{ label: "NCRISC operation wrapper", href: sourceLinks.ncrisck }],
  },
  {
    id: "reduce",
    number: "06",
    title: "Reduce the source",
    question: "Can one valid source construct and optimization level make the symptom appear?",
    choice: "Start with a returning body, add constructs back, and sweep O0/O1/O2/Os.",
    yes: "Preserve matching .ii, assembly, ELF, map and disassembly pairs.",
    no: "Continue runtime, synchronization or nondeterminism analysis; do not blame the compiler.",
    artifact: "minimized.ii + optimization-matrix.md",
    sources: [{ label: "Public optimization config", href: sourceLinks.config }],
  },
  {
    id: "ab",
    number: "07",
    title: "Run compiler A/B",
    question: "With identical valid input and link state, does failure follow only the toolchain?",
    choice: "Use matching compiler/binutils sets, distinct caches and clean firmware/kernel pairs.",
    yes: "A minimal valid reproducer plus localized wrong code justifies a compiler defect.",
    no: "Reject the compiler root cause and reopen source, ABI, load or runtime branches.",
    artifact: "compiler-a-b.md + paired artifacts",
    sources: [
      { label: "Build-map artifacts", href: sourceLinks.buildMap },
      { label: "Build-key caveat", href: sourceLinks.buildKey },
    ],
  },
  {
    id: "fix",
    number: "08",
    title: "Fix and close",
    question: "Does a pinned or corrected toolchain pass clean rebuild and layered regression?",
    choice: "Contain, work around only the minimized construct, update the toolchain, then rebuild coherently.",
    yes: "Retain compile, one-core handshake, correctness and full bring-up regressions.",
    no: "The case is not closed; keep the failing artifacts and return to the first changed boundary.",
    artifact: "result.md + regression logs",
    sources: [{ label: "Firmware-symbol link relationship", href: sourceLinks.buildMap }],
  },
];

const waypointRows = [
  ["BR never I", "BRISC reset / firmware entry", "Reset PC, firmware image, board state"],
  ["BR:GW · NC:W", "BRISC waits for host GO", "Host launch and dispatch message"],
  ["BR:GD/R · NC:W", "BRISC saw GO; NCRISC did not start", "DM1 enable, shared GO, cache visibility"],
  ["NC:R · no NC:K", "Prepared; operation K not proven", "Shared GO, handoff, ELF entry, load, CRT, ABI"],
  ["NC:K · no NC:KD", "Inside kernel_main", "User wait, memory access, generated code"],
  ["NC:KD · no NC:D", "Body returned; postamble did not", "NoC checks, wrapper return, ABI"],
  ["NC:D · BR waits", "NCRISC completed", "DONE visibility or another subordinate"],
] as const;

const waypointDefinitions = [
  ["I", "firmware entered initialization"],
  ["GW", "BRISC is waiting for host GO"],
  ["GD", "BRISC observed host GO"],
  ["W", "NCRISC waits for BRISC LOAD / GO"],
  ["R", "NCRISC prepared this launch; operation handoff is next"],
  ["K", "operation wrapper finished setup and is about to call kernel_main"],
  ["KD", "kernel_main returned to the wrapper"],
  ["NKFW / NKFD", "post-kernel NoC checks started / finished"],
  ["D", "operation returned to persistent NCRISC firmware"],
  ["NTW / NTD", "BRISC waits for / observed all enabled subordinates done"],
] as const;

const starRungs = [
  {
    level: "L0",
    test: "Build the right suites",
    processor: "HOST",
    proves: "The API and debug-tool executables exist; the current local build initially contains only unit_tests_legacy.",
    branch: "If absent, build unit_tests_api and unit_tests_debug_tools before interpreting a missing test.",
    links: [{ label: "CMake targets", href: sourceLinks.apiTargets }],
  },
  {
    level: "L1",
    test: "TensixCreateKernelsOnComputeCores",
    processor: "HOST API",
    proves: "Kernel creation and configuration are accepted. It does not prove compilation, delivery or execution.",
    branch: "Failure stays in API/configuration; a pass advances only to compilation.",
    links: [{ label: "Host test", href: sourceLinks.kernelCreationTest }],
  },
  {
    level: "L2",
    test: "…DifferentProcessors",
    processor: "R0 + R1 BUILD",
    proves: "The same source produces separate RISCV_0 and RISCV_1 ELF files. Existence is not execution.",
    branch: "Missing only R1 ELF localizes build selection; two ELFs advance to device tests.",
    links: [
      { label: "Host test", href: sourceLinks.processorCompileTest },
      { label: "Kernel", href: sourceLinks.compileKernel },
    ],
  },
  {
    level: "L3",
    test: "Watcher + DPRINT self-tests",
    processor: "ALL RISCS",
    proves: "The observation channel works before it is trusted to classify the target failure.",
    branch: "Fix instrumentation first if its own tests fail; do not infer a firmware state from silence.",
    links: [
      { label: "Waypoint test", href: sourceLinks.watcherTest },
      { label: "DPRINT test", href: sourceLinks.dprintTest },
      { label: "Call-stack test", href: sourceLinks.callstackTest },
    ],
  },
  {
    level: "L4",
    test: "ReaderOnly + WriterOnly",
    processor: "RISCV_0 / BRISC",
    proves: "BRISC executes real DRAM↔L1 transfers and the host verifies every returned word.",
    branch: "If this fails, do not investigate NCRISC yet; fix baseline BRISC, memory or dispatch.",
    links: [
      { label: "Host tests", href: sourceLinks.directTests },
      { label: "Reader kernel", href: sourceLinks.directReaderKernel },
      { label: "Writer kernel", href: sourceLinks.directWriterKernel },
    ],
  },
  {
    level: "L5",
    test: "Add NCRISC-only data check",
    processor: "RISCV_1 / NCRISC",
    proves: "A new one-core known-pattern test must prove NCRISC entry, NoC transfer, completion and output without BRISC operation code.",
    branch: "R without K chooses shared GO/handoff/entry/CRT/ABI; K without KD chooses kernel_main; wrong data chooses NoC/addressing.",
    links: [{ label: "Config API", href: sourceLinks.config }],
  },
  {
    level: "L6",
    test: "…ReaderWriter",
    processor: "NCRISC + BRISC",
    proves: "RISCV_1 reader and RISCV_0 writer cooperate through L1 and return verified DRAM data.",
    branch: "If L4 and L5 pass but L6 fails, investigate shared state, buffer contract and cross-RISC ordering.",
    links: [
      { label: "Host mapping", href: sourceLinks.directTests },
      { label: "Reader kernel", href: sourceLinks.combinedReaderKernel },
      { label: "Writer kernel", href: sourceLinks.combinedWriterKernel },
    ],
  },
  {
    level: "L7",
    test: "BarrierSynchronizesThreads",
    processor: "BRISC ↔ NCRISC",
    proves: "The explicit RISCV_0 writer / RISCV_1 reader barrier contract produces verified L1 state.",
    branch: "A failure after individual passes selects synchronization rather than compiler delivery.",
    links: [
      { label: "Host test", href: sourceLinks.threadSyncTest },
      { label: "Kernel", href: sourceLinks.threadSyncKernel },
    ],
  },
  {
    level: "L8",
    test: "…ReaderDatacopyWriter",
    processor: "DM + TRISC",
    proves: "Reader → compute/datacopy → writer works before moving to full model kernels.",
    branch: "A first failure here selects circular buffers, compute setup or TRISC—not BRISC/NCRISC boot.",
    links: [{ label: "Host test", href: sourceLinks.directTestCases }],
  },
] as const;

const proofGates = [
  "Preprocessed source hashes match.",
  "Compile and link commands change only the intended toolchain paths.",
  "Host materialized spans and a supported explicit device readback agree.",
  "The failing PC stays in the same minimized source interval.",
  "The outcome follows compiler A/B across clean repeated runs.",
  "The minimized input is valid—no source UB or ABI violation.",
] as const;

const closureFields = [
  "Failing TT-Metal commit and Blackhole stepping",
  "Failing compiler path, version and SHA-256",
  "Passing compiler path, version and SHA-256",
  "Last BRISC/NCRISC waypoint pair",
  "Failing PC mapped to saved ELF and source",
  "Wrong versus correct instruction sequence",
  "Final compiler patch/version or source workaround",
  "Clean rebuild and regression logs",
] as const;

function SourceLinks({ links }: { links: readonly SourceLink[] }) {
  return (
    <div className="bringup-source-links" aria-label="Source code references">
      {links.map((source) => <a key={source.href} href={source.href}>{source.label} ↗</a>)}
    </div>
  );
}

function BlackholeBringupApp() {
  const [activeStep, setActiveStep] = useState(0);
  const step = decisionSteps[activeStep];

  return (
    <div className="bringup-page">
      <header className="bringup-topbar">
        <a className="bringup-brand" href="./index.html"><b>TT•SIM</b><span>discussion / chain 01</span></a>
        <nav aria-label="Page navigation">
          <a href="#star">STAR case</a>
          <a href="#model">Control flow</a>
          <a href="#decisions">Decision lab</a>
          <a href="#proof">Compiler proof</a>
          <a className="bringup-back" href="./discussion.html">← Discussion</a>
        </nav>
      </header>

      <main>
        <section className="bringup-hero">
          <div className="bringup-hero-index"><span>CASE</span><strong>01</strong><small>BLACKHOLE<br/>BRING-UP</small></div>
          <div className="bringup-hero-copy">
            <p>QUESTION → BOUNDARY → EVIDENCE → ROOT CAUSE</p>
            <h1>Prove the <span className="mobile-break"><br/></span>boundary<br/><em>before blaming</em><br/>the compiler.</h1>
            <div className="bringup-hero-note">
              <b>Remembered symptom</b>
              <p>“NCRISC could not call BRISC; a third-party compiler seemed to compile the kernel incorrectly.”</p>
            </div>
          </div>
          <aside className="bringup-verdict">
            <span>LOGIC REVIEW</span>
            <strong>Direction corrected</strong>
            <p>On this Blackhole path BRISC supervises NCRISC through shared <code>LOAD / GO / DONE</code> state. NCRISC does not call BRISC as a C/C++ function.</p>
            <div><i>Source baseline</i><code>{commit.slice(0, 12)}</code></div>
            <div><i>Case status</i><code>ROOT CAUSE OPEN</code></div>
          </aside>
        </section>

        <section className="bringup-question">
          <span>THE ONE-SENTENCE ANSWER</span>
          <p>Use Watcher to find the first missing <b>GW → GD → W → R → K → KD → D</b> transition, prove that the intended NCRISC ELF reached the device, then run a same-input compiler A/B with separate caches. Anything less proves sensitivity—not a compiler defect.</p>
        </section>

        <section id="star" className="bringup-section star-section">
          <div className="bringup-section-heading light">
            <span>STAR / FIRST-SILICON SCENARIO</span>
            <h2>Start with modules.<br/>Earn the root cause.</h2>
            <p>This is a source-backed reconstruction and repeatable lab, not a claim that the missing historical evidence has been recovered.</p>
          </div>

          <div className="star-grid">
            <article className="star-card situation"><span>S / SITUATION</span><strong>01</strong><h3>First Blackhole unit-test bring-up</h3><p>A one-core test involving BRISC and NCRISC stalls although both processor ELFs can be built. The remembered hypothesis is “the compiler generated bad NCRISC code,” but compilation alone does not establish delivery, entry or execution.</p></article>
            <article className="star-card task"><span>T / TASK</span><strong>02</strong><h3>Find the first broken boundary</h3><p>Separate host configuration, ELF generation, per-RISC execution, shared synchronization and returned data. Prove a compiler defect only if one valid input changes outcome with the compiler as the sole variable.</p></article>
            <article className="star-card action"><span>A / ACTION</span><strong>03</strong><h3>Climb an isolation ladder</h3><p>Build the API/debug suites, validate Watcher and DPRINT, run BRISC alone, add an NCRISC-only data test, combine both RISCs, add the barrier and TRISC, then repeat the smallest failure in slow and fast dispatch.</p></article>
            <article className="star-card result"><span>R / RESULT</span><strong>04</strong><h3>One real test gap is exposed</h3><p>The reviewed compile test checks that two ELFs exist; the combined reader/writer executes both processors. A standalone NCRISC result-verification rung is still required. The historical compiler verdict therefore remains open.</p></article>
          </div>

          <div className="star-learning">
            <span>L / LEARNING</span>
            <p><b>Compiled ELF ≠ delivered bytes ≠ entry executed ≠ <code>kernel_main</code> returned ≠ correct data.</b> Test each boundary independently. Optimization sensitivity is a locator, not proof of a compiler defect.</p>
          </div>

          <div className="star-ladder" role="table" aria-label="Blackhole module isolation ladder">
            <div className="star-ladder-row head" role="row"><b>LEVEL / TEST</b><b>PROCESSOR</b><b>WHAT A PASS PROVES</b><b>FAILURE BRANCH + SOURCE</b></div>
            {starRungs.map((rung) => (
              <div className="star-ladder-row" role="row" key={rung.level}>
                <div><span>{rung.level}</span><strong>{rung.test}</strong></div>
                <code>{rung.processor}</code>
                <p>{rung.proves}</p>
                <div className="star-branch"><p>{rung.branch}</p><nav>{rung.links.map((link) => <a key={link.href} href={link.href}>{link.label} ↗</a>)}</nav></div>
              </div>
            ))}
          </div>

          <div className="star-command-grid">
            <pre><code>{`# Current checkout: build these suites first
cmake --build build --target \\
  unit_tests_api unit_tests_debug_tools -j"$(nproc)"

API=./build/test/tt_metal/unit_tests_api
DBG=./build/test/tt_metal/unit_tests_debug_tools`}</code></pre>
            <pre><code>{`$API --gtest_filter='MeshDeviceFixture.TensixTestEquivalentDataMovementKernelsWithDifferentProcessors'

$DBG --gtest_filter='MeshWatcherFixture.TestWatcherWaypoints:DevicePrintOutputFixture.PrintConcurrentAllRiscs'`}</code></pre>
          </div>
        </section>

        <section id="model" className="bringup-section bringup-model-section">
          <div className="bringup-section-heading">
            <span>00 / CORRECTED MODEL</span>
            <h2>No firmware relay.<br/>One shared contract.</h2>
            <p>The shortest useful graph is the actual supervisor/worker handshake. Each node links directly to the pinned source that implements it.</p>
          </div>

          <div className="handshake-flow" aria-label="Blackhole BRISC and NCRISC launch sequence">
            <a href={sourceLinks.briscLoop} className="flow-node host"><small>HOST STATE</small><b>RUN_MSG_GO</b><span>launch fields become visible</span></a>
            <i aria-hidden="true">→</i>
            <a href={sourceLinks.briscLaunch} className="flow-node brisc"><small>BRISC FW</small><b>LOAD → GO</b><span>publish DM1 subordinate state</span></a>
            <i aria-hidden="true">→</i>
            <a href={sourceLinks.ncriscLoop} className="flow-node sync"><small>NCRISC FW</small><b>W → R</b><span>poll, invalidate, call kernel_lma</span></a>
            <i aria-hidden="true">→</i>
            <a href={sourceLinks.ncrisck} className="flow-node kernel"><small>OP ELF</small><b>K → KD</b><span>CRT, kernel_main, return</span></a>
            <i aria-hidden="true">→</i>
            <a href={sourceLinks.ncriscLoop} className="flow-node done"><small>SHARED SYNC</small><b>DONE</b><span>BRISC waits for all enabled RISCs</span></a>
          </div>

          <div className="model-notes">
            <article><span>01</span><h3>Firmware boundary</h3><p>BRISC writes the shared state; Blackhole NCRISC invalidates cached L1 state while polling.</p><a href={sourceLinks.briscLaunch}>Open supervisor code ↗</a></article>
            <article><span>02</span><h3>Operation boundary</h3><p>NCRISC firmware calls its operation image. The wrapper runs CRT and brackets <code>kernel_main</code> with K/KD.</p><a href={sourceLinks.ncrisck}>Open wrapper code ↗</a></article>
            <article><span>03</span><h3>Completion boundary</h3><p>NCRISC publishes DONE. A waiting BRISC may still be blocked by another enabled subordinate.</p><a href={sourceLinks.briscLoop}>Open completion wait ↗</a></article>
          </div>
        </section>

        <section className="bringup-section waypoint-section">
          <div className="bringup-section-heading light">
            <span>01 / FIRST OBSERVATION</span>
            <h2>Let the last waypoint<br/>choose the branch.</h2>
            <p>Run Watcher without DPRINT or Device Profiler for the first classification. Instrument only after the interval is small.</p>
          </div>
          <div className="waypoint-layout">
            <div className="waypoint-table" role="table" aria-label="Waypoint decision table">
              <div className="waypoint-row head" role="row"><b>PAIR</b><b>PROVEN BOUNDARY</b><b>NEXT BRANCH</b></div>
              {waypointRows.map(([pair, boundary, next]) => <div className="waypoint-row" role="row" key={pair}><code>{pair}</code><p>{boundary}</p><p>{next}</p></div>)}
            </div>
            <aside className="watcher-command">
              <span>PASS A · WAYPOINTS</span>
              <pre><code>{`export TT_METAL_WATCHER=5
export TT_METAL_WATCHER_APPEND=1
unset TT_METAL_DPRINT_CORES
unset TT_METAL_DEVICE_PROFILER

./path/to/one_core_reproducer`}</code></pre>
              <p><code>TT_METAL_WATCHER_DUMP_ALL</code> stays off initially: unsafe state reads can perturb a running kernel.</p>
              <a href="https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/watcher.html">Official Watcher guide ↗</a>
            </aside>
          </div>
          <div className="waypoint-definitions" aria-label="Watcher waypoint glossary">
            <header><span>WAYPOINT GLOSSARY</span><p>These short strings are Watcher progress markers, not C++ function names.</p></header>
            <div>{waypointDefinitions.map(([mark, meaning]) => <article key={mark}><code>{mark}</code><p>{meaning}</p></article>)}</div>
          </div>
          <p className="waypoint-rule"><b>Read the interval, not only the last letter.</b> <code>R</code> without <code>K</code> points to shared GO, operation handoff, image/entry, CRT or ABI. <code>K</code> without <code>KD</code> proves entry and setup completed, so investigate waits, circular buffers, NoC/memory access and generated instructions inside <code>kernel_main</code>.</p>
        </section>

        <section id="decisions" className="bringup-section decision-section">
          <div className="bringup-section-heading">
            <span>02 / DECISION LAB</span>
            <h2>Change one question<br/>at a time.</h2>
            <p>Select a stage to see the decision, both branches and the artifact that makes the answer reviewable.</p>
          </div>

          <div className="decision-workbench">
            <div className="decision-rail" role="tablist" aria-label="Debugging decision stages">
              {decisionSteps.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={activeStep === index}
                  className={activeStep === index ? "active" : ""}
                  onClick={() => setActiveStep(index)}
                >
                  <span>{item.number}</span><b>{item.title}</b><i>{activeStep === index ? "OPEN" : "→"}</i>
                </button>
              ))}
            </div>

            <article className="decision-detail" role="tabpanel">
              <header><span>DECISION {step.number}</span><code>{step.id.toUpperCase()}</code></header>
              <h3>{step.question}</h3>
              <p className="decision-choice"><b>Choice</b>{step.choice}</p>
              <div className="decision-branches">
                <div><span>YES / BOUNDARY PASSES</span><p>{step.yes}</p></div>
                <div><span>NO / FIRST FAILURE</span><p>{step.no}</p></div>
              </div>
              <div className="decision-artifact"><span>REQUIRED ARTIFACT</span><code>{step.artifact}</code></div>
              <SourceLinks links={step.sources} />
            </article>
          </div>
        </section>

        <section className="bringup-section binary-section">
          <div className="bringup-section-heading light">
            <span>03 / BINARY IDENTITY</span>
            <h2>Hash it. Read it back.<br/>Resolve the PC.</h2>
            <p>A compiler investigation is meaningless if the failing device did not execute the ELF being disassembled.</p>
          </div>
          <div className="binary-pipeline">
            <article><span>01</span><b>Preserve</b><p>Fresh compiler-specific cache, saved temporaries, compile/link commands and map.</p></article>
            <i>→</i>
            <article><span>02</span><b>Verify</b><p>Use a supported explicit L1/config-buffer readback. The environment flag alone does not prove Blackhole multicast operation writes.</p></article>
            <i>→</i>
            <article><span>03</span><b>Map</b><p>Read sections and symbols, then resolve the failing PC against that exact ELF.</p></article>
            <i>→</i>
            <article><span>04</span><b>Classify</b><p>Before K: entry/CRT/ABI. After K: generated user-kernel interval.</p></article>
          </div>
          <div className="binary-command-grid">
            <pre><code>{`export TT_METAL_CACHE=/tmp/tt-metal-bh-ncrisc-a
export TT_METAL_FORCE_JIT_COMPILE=1
export TT_METAL_KERNEL_MAP=1
export TT_METAL_LOG_KERNELS_COMPILE_COMMANDS=1
export TT_METAL_RISCV_DEBUG_INFO=1
# Useful only on paths that implement unicast readback:
export TT_METAL_KERNEL_READBACK_ENABLE=1`}</code></pre>
            <pre><code>{`TOOLS=runtime/sfpi/compiler/bin
$TOOLS/riscv-tt-elf-readelf -hSW kernel.elf
$TOOLS/riscv-tt-elf-nm -nC kernel.elf
$TOOLS/riscv-tt-elf-objdump -drSC kernel.elf
$TOOLS/riscv-tt-elf-addr2line -e kernel.elf \
  -fC 0xFAILING_PC`}</code></pre>
          </div>
          <SourceLinks links={[
            { label: "Blackhole firmware bases", href: sourceLinks.hal },
            { label: "Unicast write/readback helper", href: sourceLinks.readback },
            { label: "BH firmware multicast caveat", href: sourceLinks.firmwareLoad },
            { label: "Operation binary write path", href: sourceLinks.operationWrite },
            { label: "Saved build intermediates", href: sourceLinks.buildMap },
          ]} />
        </section>

        <section id="proof" className="bringup-section proof-section">
          <div className="bringup-section-heading">
            <span>04 / COMPILER PROOF</span>
            <h2>Sensitivity is a clue.<br/>A/B is the proof.</h2>
            <p><code>O0</code> passing and <code>O2</code> failing can also expose source undefined behavior, ABI errors or an LTO/link interaction. Keep the entire input contract fixed.</p>
          </div>

          <div className="proof-matrix" aria-label="Compiler A B experiment matrix">
            <div className="proof-axis"><span>INPUT</span><b>same validated .ii</b></div>
            <div className="proof-card fail"><span>A1</span><b>Suspected compiler</b><code>failing opt · cache A1</code><p>Must reproduce</p></div>
            <div className="proof-card"><span>A2</span><b>Suspected compiler</b><code>O0 · cache A2</code><p>Optimization locator</p></div>
            <div className="proof-card pass"><span>B1</span><b>Known-good compiler</b><code>same opt · cache B1</code><p>Toolchain variable</p></div>
            <div className="proof-card"><span>B2</span><b>Known-good compiler</b><code>O0 · cache B2</code><p>Matrix control</p></div>
          </div>

          <div className="proof-gates">
            <div><span>ROOT-CAUSE GATE</span><h3>All six must pass.</h3><p>If one fails, the compiler conclusion remains open.</p></div>
            <ol>{proofGates.map((gate, index) => <li key={gate}><span>{String(index + 1).padStart(2, "0")}</span><p>{gate}</p></li>)}</ol>
          </div>
          <p className="cache-warning"><b>Cache trap</b> Normal JIT keys include compiler version, but build-map mode deliberately omits it. Use distinct caches anyway and force JIT for every matrix cell.</p>
          <SourceLinks links={[
            { label: "Build-key compiler-version caveat", href: sourceLinks.buildKey },
            { label: "DataMovement optimization API", href: sourceLinks.config },
          ]} />
        </section>

        <section className="bringup-section fix-section">
          <div className="bringup-section-heading light">
            <span>05 / FIX LADDER</span>
            <h2>Contain. Correct.<br/>Regress.</h2>
            <p>A confirmed compiler defect is not closed when one binary boots. The complete firmware/operation relationship must be rebuilt coherently.</p>
          </div>
          <div className="fix-ladder">
            <article><span>NOW</span><strong>01</strong><h3>Pin known-good</h3><p>Lock compiler path, version and SHA-256. Fail early on drift.</p></article>
            <article><span>SHORT TERM</span><strong>02</strong><h3>Work around</h3><p>Rewrite only the minimized triggering construct; document code-size and performance cost.</p></article>
            <article><span>DURABLE</span><strong>03</strong><h3>Patch or update</h3><p>Move to the SFPI toolchain containing the reviewed compiler correction.</p></article>
            <article><span>CLOSURE</span><strong>04</strong><h3>Rebuild + regress</h3><p>Fresh caches, matched firmware/kernel pair, compile test, one-core test and full bring-up.</p></article>
          </div>
          <p className="fix-note">The operation ELF links against symbols from a weakened firmware ELF. Mixing firmware from compiler A with an operation image from compiler B is not a clean A/B.</p>
          <SourceLinks links={[{ label: "Firmware weakening and operation link", href: sourceLinks.buildMap }]} />
        </section>

        <section className="bringup-section honesty-section">
          <div className="bringup-section-heading">
            <span>06 / HISTORICAL RECORD</span>
            <h2>What we know.<br/>What we still need.</h2>
            <p>The process is complete; the historical root-cause claim is not. These fields prevent a remembered correlation from becoming a false technical fact.</p>
          </div>
          <div className="honesty-layout">
            <article className="known-card"><span>KNOWN FROM SOURCE</span><h3>BRISC supervises the launch.</h3><p>The Blackhole path and diagnostic boundaries are pinned to a real TT-Metal revision. The current local SFPI compiler identity was also captured.</p><code>sfpi:7.69.0[822] · GCC 15.1.0</code></article>
            <div className="missing-fields"><span>REQUIRED TO WRITE “HOW I FIXED IT” AS HISTORY</span><ul>{closureFields.map((field) => <li key={field}>{field}<i>NOT SUPPLIED</i></li>)}</ul></div>
          </div>
          <blockquote>The remembered failure is compatible with a toolchain-sensitive NCRISC operation-kernel problem, but it does not yet distinguish a compiler defect from source UB, ABI/link/load mismatch or launch synchronization.</blockquote>
        </section>

        <section className="bringup-download">
          <div><span>FULL REPEATABLE GUIDE</span><h2>Commands, Mermaid chunks,<br/>code links and closure checklist.</h2></div>
          <div><a href="./DISCUSSION_BLACKHOLE_BRINGUP.md">Read Markdown guide ↗</a><a href="https://github.com/buicongnguyen/tt-sim/blob/main/docs/DISCUSSION_BLACKHOLE_BRINGUP.md">Open source on GitHub ↗</a></div>
        </section>
      </main>

      <footer className="bringup-footer">
        <div><b>TT•SIM · DISCUSSION CHAIN 01</b><p>Blackhole BRISC/NCRISC bring-up with explicit root-cause gates.</p></div>
        <a href="./discussion-transformer-blackhole-optimization.html">Chain 02 →</a>
        <a href="./discussion.html">Discussion →</a>
        <a href="./firmware-flow.html">Firmware flow →</a>
        <a href="./index.html">Book →</a>
      </footer>
    </div>
  );
}

export default BlackholeBringupApp;
