import { useState } from "react";

type SyncKey = "noc" | "buffers" | "registers" | "cores";

const syncScopes = {
  noc: {
    index: "01",
    label: "NoC transactions",
    title: "Issue now. Wait at the first real dependency.",
    description: "noc_async_read/write enqueue transfers. Read, write, atomic, full and transaction-ID barriers select what must complete; writes_flushed promises departure, not destination completion.",
    sequence: ["noc_async_read", "independent work", "read_barrier", "consume L1"],
    failure: "Publishing a CB page before the read barrier makes incomplete bytes visible to compute.",
  },
  buffers: {
    index: "02",
    label: "Circular buffers",
    title: "Credits synchronize ownership, not transfer completion.",
    description: "A producer reserves and pushes. A consumer waits and pops. The pair gives backpressure across reader, compute and writer while the tile remains in local L1.",
    sequence: ["reserve_back", "fill page", "push_back", "wait_front → pop_front"],
    failure: "Popping an output page before its NoC write completes allows the next producer to overwrite live source data.",
  },
  registers: {
    index: "03",
    label: "Destination registers",
    title: "Math and pack exchange exclusive ownership.",
    description: "tile_regs_acquire/commit/wait/release coordinate the UNPACK, MATH and PACK binaries generated from one compute-kernel source.",
    sequence: ["acquire", "math", "commit", "pack wait → release"],
    failure: "Skipping the commit/wait/release protocol creates a pack-versus-math race or deadlock.",
  },
  cores: {
    index: "04",
    label: "Cross-core handshakes",
    title: "The waiter polls local L1; a peer signals by NoC atomic.",
    description: "noc_semaphore_inc atomically updates a remote 4-byte semaphore. wait and wait_min implement readiness, arrival counts, multicast credits and collective handoffs.",
    sequence: ["write payload", "write barrier", "atomic inc", "remote wait releases"],
    failure: "A missing increment or wrong fan-out count leaves the participant permanently blocked.",
  },
} as const;

const syncRows = [
  ["Host", "Command queue · event · Finish", "Submission order and device completion"],
  ["Data movement", "NoC async + typed barrier", "Transfer issue versus completion"],
  ["Local L1", "CB reserve/push/wait/pop", "Producer/consumer ownership"],
  ["Compute", "tile_regs acquire/commit/wait/release", "UNPACK/MATH/PACK register handoff"],
  ["Peer cores", "NoC semaphore + atomic increment", "Readiness, credits and arrival counts"],
  ["Compiler/CPU", "compiler fence · sfence/mfence", "Reordering only; not device completion"],
] as const;

const huaweiRows = [
  ["Local stream", "Circular buffer", "TQue + TPipe"],
  ["Async movement", "NoC read/write", "DataCopy on MTE pipelines"],
  ["Cross-engine event", "Internal LLK semaphore", "SetFlag / WaitFlag"],
  ["Same-engine order", "Specific NoC or compute barrier", "PipeBarrier"],
  ["Memory completion", "NoC read/write/full barrier", "DataSyncBarrier"],
  ["Shared update", "NoC atomic increment", "AtomicAdd/Min/Max/CAS"],
] as const;

function AsyncKernelsApp() {
  const [scope, setScope] = useState<SyncKey>("noc");
  const selected = syncScopes[scope];

  return (
    <div className="async-page">
      <header className="async-topbar">
        <a className="async-brand" href="./index.html"><b>TT•SIM</b><span>kernel field notes</span></a>
        <nav aria-label="Page navigation"><a href="#contracts">Contracts</a><a href="#geometry">Geometry</a><a href="#huawei">Huawei</a><a href="#practice">Practice</a><a className="async-back" href="./index.html#debug">← Lab guide</a></nav>
      </header>

      <main>
        <section className="async-hero">
          <div className="async-hero-meta"><span>FIELD NOTE / 03</span><small>SOURCE AUDIT · 16 AUG 2026</small></div>
          <div className="async-hero-copy"><p>TENSTORRENT KERNELS × HUAWEI ASCEND</p><h1>Async is a <em>contract</em>,<br/>not a keyword.</h1><div className="async-thesis"><strong>Corrected conclusion</strong><p>A 32×32 TT tile is four 16×16 faces. The current LLK MVMUL updates an 8×16 strip. Four MVMULs cover 32×16—not a full tile.</p></div></div>
          <div className="geometry-ledger" aria-label="Tenstorrent matrix geometry summary">
            <article><span>LOGICAL TILE</span><strong>32×32</strong><small>1,024 values</small></article>
            <article><span>STORAGE FACE</span><strong>16×16</strong><small>4 per tile</small></article>
            <article><span>LLK MVMUL DST</span><strong>8×16</strong><small>per issue</small></article>
          </div>
        </section>

        <section className="pipeline-ribbon" aria-label="Reader compute writer pipeline">
          <article><span>01 · READER</span><b>NoC read</b><i>read barrier</i></article><em>→</em>
          <article><span>02 · INPUT CB</span><b>push / wait</b><i>tile ownership</i></article><em>→</em>
          <article><span>03 · COMPUTE</span><b>unpack · math · pack</b><i>tile_regs handoff</i></article><em>→</em>
          <article><span>04 · OUTPUT CB</span><b>push / wait</b><i>backpressure</i></article><em>→</em>
          <article><span>05 · WRITER</span><b>NoC write</b><i>barrier before reuse</i></article>
        </section>

        <section id="contracts" className="async-section contracts-section">
          <div className="async-section-heading"><span>01 / SYNCHRONIZATION DOMAINS</span><h2>Each primitive proves<br/>one different fact.</h2><p>A semaphore does not replace a transfer barrier. A CB credit does not drain NoC. A compiler fence does not release PACK. Select the scope before selecting the API.</p></div>
          <div className="scope-workbench">
            <div className="scope-tabs" role="tablist" aria-label="Synchronization mechanisms">
              {(Object.keys(syncScopes) as SyncKey[]).map((key) => <button key={key} type="button" role="tab" aria-selected={scope === key} className={scope === key ? "active" : ""} onClick={() => setScope(key)}><span>{syncScopes[key].index}</span>{syncScopes[key].label}</button>)}
            </div>
            <article className="scope-panel" role="tabpanel"><span>ACTIVE CONTRACT</span><h3>{selected.title}</h3><p>{selected.description}</p><div className="scope-sequence">{selected.sequence.map((step, index) => <span key={step}><b>{step}</b>{index < selected.sequence.length - 1 && <i>→</i>}</span>)}</div><footer><small>FAILURE IF BROKEN</small><strong>{selected.failure}</strong></footer></article>
          </div>
          <div className="sync-ledger" role="region" aria-label="Tenstorrent synchronization scope table" tabIndex={0}><table><thead><tr><th>Scope</th><th>Mechanism</th><th>What it proves</th></tr></thead><tbody>{syncRows.map((row) => <tr key={row[0]}><th>{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table></div>
        </section>

        <section id="geometry" className="async-section geometry-section">
          <div className="async-section-heading inverse"><span>02 / MATRIX GRANULARITY</span><h2>Tile, face and issue<br/>are three levels.</h2><p>The word “tile” describes the public storage/compute unit. Faces explain the layout. MVMUL issue geometry explains the LLK replay.</p></div>
          <div className="face-stage">
            <div className="face-grid" aria-label="32 by 32 tile split into four 16 by 16 faces"><div><span>F0</span><b>16×16</b></div><div><span>F1</span><b>16×16</b></div><div><span>F2</span><b>16×16</b></div><div><span>F3</span><b>16×16</b></div><em>32×32 TILE</em></div>
            <div className="strip-stack" aria-label="MVMUL output strips"><span>ONE 16×16 FACE PRODUCT</span><div><b>8×16</b><small>MVMUL 0</small></div><div><b>8×16</b><small>MVMUL 1</small></div><p>Two strips update one 16-row destination face for one K-face contribution.</p></div>
            <div className="issue-equation"><span>STANDARD FULL-TILE REPLAY / FIDELITY PHASE</span><div><strong>4</strong><small>output faces</small><i>×</i><strong>2</strong><small>K faces</small><i>×</i><strong>2</strong><small>8-row strips</small><em>=</em><b>16 MVMUL</b></div><p>By contrast, 16×32 × 32×16 produces one 16×16 output face and takes four standard MVMUL issues.</p></div>
          </div>
          <div className="geometry-warning"><b>Quasar exception</b><p>The current LLK includes an MXFP4 “2x” specialization with a shorter traversal. It is format-specific and must not be generalized to BF16/BFP matmul.</p></div>
        </section>

        <section id="huawei" className="async-section huawei-sync-section">
          <div className="async-section-heading"><span>03 / HUAWEI ASCEND</span><h2>Same dependency problem.<br/>Different public boundary.</h2><p>Ascend C exposes asynchronous MTE, Vector, Cube and FixPipe pipelines. TQue and framework events abstract more routing than TT-Metal’s coordinate-addressed NoC interface.</p></div>
          <div className="huawei-pipeline"><span>GM / HBM</span><i>→ MTE2</i><span>L1 / UB</span><i>→ MTE1</i><span>L0A + L0B</span><i>→ CUBE</i><span>L0C</span><i>→ FIX / MTE3</i><span>GM</span></div>
          <div className="comparison-ledger" role="region" aria-label="Tenstorrent and Huawei asynchronous mechanism comparison" tabIndex={0}><table><thead><tr><th>Purpose</th><th>Tenstorrent</th><th>Huawei Ascend</th></tr></thead><tbody>{huaweiRows.map((row) => <tr key={row[0]}><th>{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table></div>
          <div className="fractal-pair"><article><span>HUAWEI FP16 / BF16</span><div><b>A</b>16×16</div><div><b>B</b>16×16</div><div><b>C</b>16×16</div><p>Cube fractal resembles a TT face, not a full TT tile.</p></article><article><span>HUAWEI INT8</span><div><b>A</b>16×32</div><div><b>B</b>32×16</div><div><b>C</b>16×16</div><p>The 16×32 input comes from fitting INT8 values into a 32-byte Cube block, not from TT-style two-face tiling.</p></article></div>
          <p className="public-boundary">Huawei documents 16×16 Cube fractals and datatype-dependent input width. It does not publicly expose a sub-fractal issue schedule equivalent to TT’s open 8×16 LLK path, so an exact lower-level instruction count would be speculation.</p>
        </section>

        <section id="practice" className="practice-section">
          <div><span>04 / REPEATABLE PRACTICE</span><h2>Break one edge.<br/>Name the blocked owner.</h2></div>
          <ol><li><b>Baseline</b><p>Run one tile copy and matmul with correct CB and NoC barriers.</p></li><li><b>Overlap</b><p>Issue two reads, then use one read barrier at the actual consumption boundary.</p></li><li><b>Deadlock</b><p>Remove one semaphore increment and identify the waiting RISC with Watcher.</p></li><li><b>Ordering</b><p>Audit data-before-signal and barrier-before-CB-reuse as separate obligations.</p></li></ol>
          <div className="practice-record"><span>RECORD</span><p>bytes · CB pointers · semaphore epoch · barrier site · MVMUL count · fidelity · PCC</p><a href="./ASYNC_KERNELS_AND_MATRIX_GRANULARITY.md">Open the complete technical guide ↗</a></div>
        </section>

        <section className="async-sources"><div><span>PRIMARY SOURCES</span><h2>Read the public contract,<br/>then inspect the LLK.</h2></div><div className="source-grid">
          <a href="https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/tiles.html"><small>01 · TT DOCS</small><b>Tile faces</b><p>32×32 tile and four 16×16 storage faces.</p><i>↗</i></a>
          <a href="https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/tt-llk/tt_llk_blackhole/llk_lib/llk_math_matmul.h#L47-L69"><small>02 · SOURCE</small><b>Blackhole MVMUL</b><p>Current 8×16 destination-strip comment and address mods.</p><i>↗</i></a>
          <a href="https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/matmul/lab3/lab3.html"><small>03 · TT LAB</small><b>NoC synchronization</b><p>Semaphores, ordering, flush versus completion and Watcher.</p><i>↗</i></a>
          <a href="https://www.hiascend.com/document/detail/en/canncommercial/850/API/ascendcopapi/atlasascendc_api_07_0179.html"><small>04 · HUAWEI</small><b>Pipeline synchronization</b><p>SetFlag/WaitFlag, PipeBarrier and asynchronous execution units.</p><i>↗</i></a>
          <a href="https://www.hiascend.com/document/detail/en/CANNCommunityEdition/900/API/ascendcopapi/atlasascendc_api_07_0249.html"><small>05 · HUAWEI</small><b>Cube Mmad</b><p>Datatype-dependent input fractals and 16×16 output.</p><i>↗</i></a>
          <a href="./ASYNC_KERNELS_AND_MATRIX_GRANULARITY.md"><small>06 · REPORT</small><b>Full evidence record</b><p>Correct patterns, failure cases, source paths and experiment.</p><i>↗</i></a>
        </div></section>
      </main>

      <footer className="async-footer"><div><b>TT•SIM KERNEL FIELD NOTES</b><p>Independent, source-backed learning guide.</p></div><a href="https://github.com/buicongnguyen/tt-sim">Source on GitHub ↗</a><a href="./huawei.html">Architecture comparison →</a><a href="./index.html">Lab guide →</a></footer>
    </div>
  );
}

export default AsyncKernelsApp;
