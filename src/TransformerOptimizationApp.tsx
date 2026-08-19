import { useMemo, useState } from "react";

type Mode = "prefill" | "decode";

type DecisionStep = {
  id: string;
  label: string;
  title: string;
  question: string;
  choose: Record<Mode, string>;
  ifYes: string;
  ifNo: string;
  artifact: string;
  source: { label: string; href: string };
};

const revision = "50a82f835593512c4176546b4af68d7e91315a86";
const sourceRoot = `https://github.com/tenstorrent/tt-metal/blob/${revision}`;
const ttMlirRevision = "71046369d603b97fd6a8dd8b947ca8588ac2a74f";
const ttMlirSourceRoot = `https://github.com/tenstorrent/tt-mlir/blob/${ttMlirRevision}`;
const forgeSnapshot = {
  release: "1.5.0.dev20260819000359",
  ttXla: "2ddaf4bc36f7",
  ttMlir: ttMlirRevision.slice(0, 12),
  ttMetal: "5beed318d0f0",
} as const;
const forgeLinks = {
  repo: "https://github.com/tenstorrent/tt-forge",
  docs: "https://docs.tenstorrent.com/forge/index.html",
  releases: "https://github.com/tenstorrent/tt-forge/releases",
  mlir: "https://github.com/tenstorrent/tt-mlir",
  mlirDialects: "https://docs.tenstorrent.com/tt-mlir/dialects-overview.html",
  optimizer: "https://docs.tenstorrent.com/tt-mlir/specs/ttnn-optimizer.html",
  cacheLowering: `${ttMlirSourceRoot}/lib/Conversion/StableHLOToTTIR/StableHLOToTTIRPatterns.cpp#L8449-L8641`,
  quantLowering: `${ttMlirSourceRoot}/lib/Conversion/StableHLOToTTIR/StableHLOToTTIRPatterns.cpp#L1307-L1385`,
  optimizerPipeline: `${ttMlirSourceRoot}/lib/Dialect/TTNN/Pipelines/TTNNPipelines.cpp#L100-L158`,
} as const;

const decisions: readonly DecisionStep[] = [
  {
    id: "D0",
    label: "CONTRACT",
    title: "Freeze the workload and quality contract.",
    question: "What exact model, SKU, mesh, shape distribution and quality loss are allowed?",
    choose: {
      prefill: "Record prompt-length percentiles, batch policy and TTFT/prefill-throughput objective.",
      decode: "Record active users, context-length percentiles, sampling policy and ms/token objective.",
    },
    ifYes: "The experiment has one primary metric and a numerical correctness gate.",
    ifNo: "Stop. A faster unnamed Transformer workload is not a reproducible result.",
    artifact: "model-contract.md + exact checkpoint and tt-metal commit",
    source: { label: "TT-Transformers README", href: `${sourceRoot}/models/tt_transformers/README.md` },
  },
  {
    id: "D1",
    label: "CORRECTNESS",
    title: "Prove one block before tuning all layers.",
    question: "Does a single TTNN decoder block match the reference at every major boundary?",
    choose: {
      prefill: "Compare norm, attention, residual, MLP and output at representative prompt buckets.",
      decode: "Compare the same boundaries while carrying the real KV cache and position state.",
    },
    ifYes: "Promote the test into the permanent regression set.",
    ifNo: "Localize shape, RoPE, cache, layout or precision before any performance edit.",
    artifact: "block-level PCC/token comparison with saved tensor shapes",
    source: { label: "decoder.py · block flow", href: `${sourceRoot}/models/tt_transformers/tt/decoder.py#L219-L338` },
  },
  {
    id: "D2",
    label: "PROFILE",
    title: "Measure warm prefill and decode separately.",
    question: "Is the dominant cost host dispatch, conversion, memory movement, compute or collectives?",
    choose: {
      prefill: "Profile a warmed prompt bucket and group time by QKV, SDPA, MLP, conversion and collective.",
      decode: "Profile the stable token loop after compilation and inspect host gaps between device ops.",
    },
    ifYes: "Route the next change to the highest layer that explains the hot region.",
    ifNo: "Add Tracy signposts and use TTNN Visualizer before changing configs.",
    artifact: "ops_perf_results.csv + memory report + signposted region",
    source: { label: "Official profiling guide", href: "https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/profiling_ttnn_operations.html" },
  },
  {
    id: "D3",
    label: "SHAPES",
    title: "Stabilize padding and program variants.",
    question: "Can the request distribution map to a small set of legal, reusable shapes?",
    choose: {
      prefill: "Bucket to the source path's 128-token divisibility and test the Blackhole 512-token MLP cutoff.",
      decode: "Keep tile-padded batch and cache/page-table shapes stable across captured iterations.",
    },
    ifYes: "Warm every intended bucket and record cache hits.",
    ifNo: "Keep an uncaptured fallback for rare shapes; do not silently recompile in the hot path.",
    artifact: "shape-bucket matrix and cold/warm compile ledger",
    source: { label: "model_config.py · Blackhole cutoff", href: `${sourceRoot}/models/tt_transformers/tt/model_config.py#L528-L680` },
  },
  {
    id: "D4",
    label: "MEMORY",
    title: "Make layout a producer-to-consumer decision.",
    question: "Which conversions are required, and which only repair mismatched neighboring choices?",
    choose: {
      prefill: "Track L1/DRAM and sharded/interleaved state through QKV, SDPA, output projection and MLP.",
      decode: "Keep residual and hot activations resident while respecting decode head and SDPA contracts.",
    },
    ifYes: "Remove only conversions whose consumer accepts the producer layout.",
    ifNo: "Retain the conversion and tune the two surrounding operations as one chain.",
    artifact: "tensor lifetime + layout table from TTNN Visualizer",
    source: { label: "decoder.py · memory transitions", href: `${sourceRoot}/models/tt_transformers/tt/decoder.py#L234-L336` },
  },
  {
    id: "D5",
    label: "ATTENTION",
    title: "Tune attention for its actual mode.",
    question: "Is attention limited by projection, cache traffic, SDPA work or output movement?",
    choose: {
      prefill: "Sweep legal Q/K chunks and QKV/SDPA configs at real prompt buckets; preserve causal results.",
      decode: "Test fused QKV, paged K/V update, SDPA chunking and output projection at context percentiles.",
    },
    ifYes: "Keep the smallest source-level change that moves the measured bottleneck.",
    ifNo: "Minimize the hot TTNN operation before descending into its program factory.",
    artifact: "attention stage breakdown + KV-cache traffic evidence",
    source: { label: "attention.py · decode path", href: `${sourceRoot}/models/tt_transformers/tt/attention.py#L589-L874` },
  },
  {
    id: "D6",
    label: "MLP",
    title: "Retune the gated MLP without extra materialization.",
    question: "Do gate/up matmuls, activation×multiply, down matmul or layout conversion dominate?",
    choose: {
      prefill: "Test the source's long-sequence reshape/minimal-matmul choices and Blackhole grid blocking.",
      decode: "Test DRAM-sharded HiFi2 configs against the quality gate and conversion cost.",
    },
    ifYes: "Keep fused activation-in-multiply and deallocate each tensor after its last consumer.",
    ifNo: "Do not write a new matmul kernel for a layout or lifetime problem.",
    artifact: "MLP op breakdown + L1 peak + block PCC",
    source: { label: "mlp.py · gate/up/down", href: `${sourceRoot}/models/tt_transformers/tt/mlp.py#L118-L330` },
  },
  {
    id: "D7",
    label: "PRECISION",
    title: "Spend precision by tensor role.",
    question: "Which weights or activations tolerate BFP8/BFP4 without violating model quality?",
    choose: {
      prefill: "Sweep QKV, MLP and output weights independently; keep norm/residual and sensitive accumulations wide first.",
      decode: "Include long-context KV/SDPA stability and token agreement, not only a one-step PCC.",
    },
    ifYes: "Retain the narrower role and document conversion/traffic savings.",
    ifNo: "Restore only the first failing role; continue testing the independent roles.",
    artifact: "per-role dtype matrix with PCC, token and perplexity gates",
    source: { label: "ttnn.linear · supported formats", href: `${sourceRoot}/ttnn/cpp/ttnn/operations/matmul/matmul_nanobind.cpp#L824-L898` },
  },
  {
    id: "D8",
    label: "TRACE",
    title: "Replay the stable token loop.",
    question: "After program-cache warm-up, is decode losing time to repeated host dispatch?",
    choose: {
      prefill: "Use trace only for stable prefill buckets where capture setup is amortized.",
      decode: "Capture one stable decode graph, update resident inputs and replay non-blocking per token.",
    },
    ifYes: "Measure the removed host gap and preserve a shape-change fallback.",
    ifNo: "Keep normal submission; trace cannot repair a device-compute bottleneck.",
    artifact: "before/after Tracy timeline and dispatch count per token",
    source: { label: "generator.py · capture/replay", href: `${sourceRoot}/models/tt_transformers/tt/generator.py#L1535-L1692` },
  },
  {
    id: "D9",
    label: "KERNEL",
    title: "Descend only with a minimized proof.",
    question: "Does an isolated TTNN op still show a factory, CB, NoC or compute-kernel bottleneck?",
    choose: {
      prefill: "Inspect the selected matmul/SDPA program factory, core grid, block sizes and CB footprint.",
      decode: "Inspect reader/writer/compute balance, page-table traffic and reduction/multicast synchronization.",
    },
    ifYes: "Patch the smallest lower layer and add an operation-level regression test.",
    ifNo: "Return to the model/layout/config layer; the kernel is not the proven cause.",
    artifact: "minimized op test + profiler counter + source-linked patch",
    source: { label: "SDPA program descriptor", href: `${sourceRoot}/ttnn/cpp/ttnn/operations/transformer/sdpa_decode/device/sdpa_decode_program_factory.cpp#L510-L1035` },
  },
] as const;

const codeLayers = [
  { id: "01", role: "MODEL", title: "Transformer block", detail: "Norm → attention → residual → norm → MLP → residual", href: `${sourceRoot}/models/tt_transformers/tt/decoder.py#L219-L338` },
  { id: "02", role: "TTNN PYTHON", title: "Fused projections", detail: "Mode-specific memory, program and compute configs", href: `${sourceRoot}/models/tt_transformers/tt/attention.py#L589-L608` },
  { id: "03", role: "BINDING", title: "ttnn.linear", detail: "Nanobind forwards tensors and tuning controls to C++", href: `${sourceRoot}/ttnn/cpp/ttnn/operations/matmul/matmul_nanobind.cpp#L824-L898` },
  { id: "04", role: "DEVICE OP", title: "Matmul operation", detail: "Validate, select config/factory and manage cacheable attributes", href: `${sourceRoot}/ttnn/cpp/ttnn/operations/matmul/device/matmul_device_operation.hpp#L18-L55` },
  { id: "05", role: "TT-METAL", title: "Program factory", detail: "Create kernels, circular buffers and per-core runtime arguments", href: `${sourceRoot}/ttnn/cpp/ttnn/operations/matmul/device/factory/matmul_multicore_reuse_mcast_1d_program_factory.cpp#L607-L1164` },
  { id: "06", role: "DEVICE", title: "RISC kernels", detail: "Data movement feeds CBs; TRISCs execute the compute kernel", href: `${sourceRoot}/ttnn/cpp/ttnn/operations/matmul/device/kernels/compute/bmm_large_block_zm_fused_bias_activation.cpp` },
] as const;

const measurementRows = [
  ["B0", "Accuracy baseline", "—", "—", "—", "baseline"],
  ["B1", "Performance config", "—", "—", "—", "open"],
  ["B2", "Shape buckets", "—", "—", "—", "open"],
  ["B3", "Layout + sharding", "—", "—", "—", "open"],
  ["B4", "Attention + KV cache", "—", "—", "—", "open"],
  ["B5", "MLP config", "—", "—", "—", "open"],
  ["B6", "Per-role precision", "—", "—", "—", "open"],
  ["B7", "Program cache + trace", "—", "—", "—", "open"],
] as const;

function TransformerOptimizationApp() {
  const [mode, setMode] = useState<Mode>("decode");
  const [activeId, setActiveId] = useState("D0");
  const active = useMemo(() => decisions.find((step) => step.id === activeId) ?? decisions[0], [activeId]);

  return (
    <div className="transformer-page">
      <header className="transformer-topbar">
        <a className="transformer-brand" href="./index.html"><b>TT•SIM</b><span>discussion chain 02</span></a>
        <nav aria-label="Page navigation">
          <a href="#decision">Decisions</a><a href="#code">TTNN → Metal</a><a href="#compiler">Forge → MLIR</a><a href="#measure">Measurements</a>
          <a className="transformer-back" href="./discussion.html">← Discussion</a>
        </nav>
      </header>

      <main>
        <section className="transformer-hero">
          <div className="transformer-hero-index"><span>CASE / OPT-06</span><strong>02</strong><small>19 AUG 2026</small></div>
          <div className="transformer-hero-copy">
            <p>TRANSFORMER × BLACKHOLE × SOURCE-TO-KERNEL</p>
            <h1>Optimize the<br/><em>path,</em> not<br/>the model name.</h1>
            <div className="transformer-hero-note"><b>Working premise</b><p>Prefill and decode are different programs. Every accepted change must move a measured bottleneck and pass the model's quality gate.</p></div>
          </div>
          <aside className="transformer-status">
            <span>CASE STATUS</span><strong>PLAN READY.<br/>MEASUREMENTS OPEN.</strong>
            <p>No checkpoint, shapes, SKU or baseline results were supplied. The source path is verified; model-specific speedup is intentionally unclaimed.</p>
            <dl><div><dt>SOURCE</dt><dd>{revision.slice(0, 12)}</dd></div><div><dt>TARGET</dt><dd>BLACKHOLE</dd></div><div><dt>PATH</dt><dd>TTNN → TT-METAL</dd></div></dl>
          </aside>
        </section>

        <section className="transformer-question">
          <span>THE QUESTION</span><p>How do I optimize a Transformer on Blackhole, step by step, while keeping every decision traceable from the model's <b>TTNN code</b> to the <b>device kernels</b>?</p>
        </section>

        <section className="mode-section">
          <div className="transformer-section-heading light"><span>01 / SPLIT THE WORKLOAD</span><h2>Two loops.<br/>Two bottlenecks.</h2><p>Choose a mode to change the decision details below. The source branches on mode; the experiment must too.</p></div>
          <div className="mode-switch" role="tablist" aria-label="Transformer execution mode">
            <button type="button" role="tab" aria-selected={mode === "prefill"} className={mode === "prefill" ? "active" : ""} onClick={() => setMode("prefill")}><span>01</span><b>PREFILL</b><p>Many prompt tokens. Large M. Compute and L1 pressure.</p><i>TTFT · prompt tokens/s</i></button>
            <button type="button" role="tab" aria-selected={mode === "decode"} className={mode === "decode" ? "active" : ""} onClick={() => setMode("decode")}><span>02</span><b>DECODE</b><p>One new token per user. Small M. Weight/KV traffic and dispatch.</p><i>ms/token · user & aggregate t/s</i></button>
          </div>
          <div className="mode-flow" aria-label="Transformer mode split">
            <article><small>INPUT</small><b>{mode === "prefill" ? "prompt buckets" : "token + position"}</b></article><i>→</i>
            <article><small>HOT LOOP</small><b>{mode === "prefill" ? "QKV + causal SDPA" : "QKV + KV update + SDPA"}</b></article><i>→</i>
            <article><small>PRIMARY GATE</small><b>{mode === "prefill" ? "TTFT + quality" : "latency + token match"}</b></article>
          </div>
        </section>

        <section id="decision" className="decision-section-transformer">
          <div className="transformer-section-heading"><span>02 / DECISION CHAIN</span><h2>Measure.<br/>Choose. Prove.</h2><p>Each step has a branch, an evidence artifact and a direct source anchor. Work top to bottom; later decisions depend on earlier invariants.</p></div>
          <div className="optimization-workbench">
            <div className="optimization-rail" role="tablist" aria-label="Optimization decisions">
              {decisions.map((step) => <button key={step.id} type="button" role="tab" aria-selected={step.id === active.id} className={step.id === active.id ? "active" : ""} onClick={() => setActiveId(step.id)}><span>{step.id}</span><b>{step.label}</b><i>→</i></button>)}
            </div>
            <article className="optimization-detail">
              <header><span>{active.id} / {active.label}</span><code>{mode.toUpperCase()}</code></header>
              <h3>{active.title}</h3>
              <div className="optimization-question"><b>ASK</b><p>{active.question}</p></div>
              <div className="optimization-choice"><b>CHOOSE</b><p>{active.choose[mode]}</p></div>
              <div className="optimization-branches"><div><span>GATE PASSES</span><p>{active.ifYes}</p></div><div><span>GATE FAILS</span><p>{active.ifNo}</p></div></div>
              <div className="optimization-artifact"><span>SAVE</span><code>{active.artifact}</code></div>
              <a className="optimization-source" href={active.source.href}>Open {active.source.label} ↗</a>
            </article>
          </div>
        </section>

        <section id="code" className="code-section-transformer">
          <div className="transformer-section-heading light"><span>03 / CODE PATH</span><h2>Follow one<br/>hot projection.</h2><p>Stay at the highest layer that explains the bottleneck. Descend only when a minimized operation proves the lower layer is responsible.</p></div>
          <div className="code-flow">
            {codeLayers.map((layer, index) => <div className="code-flow-cell" key={layer.id}><a href={layer.href}><span>{layer.id} / {layer.role}</span><b>{layer.title}</b><p>{layer.detail}</p><i>Open source ↗</i></a>{index < codeLayers.length - 1 && <em aria-hidden="true">↓</em>}</div>)}
          </div>
          <div className="kernel-triptych">
            <div><span>BRISC / DM</span><b>Reader</b><p>Moves Q/K/V, page-table data and scalars into circular buffers.</p><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/transformer/sdpa_decode/device/kernels/dataflow/reader_decode_all.cpp`}>reader_decode_all.cpp ↗</a></div>
            <div><span>TRISC</span><b>Compute</b><p>Runs tiled QK, softmax/statistics and value accumulation work.</p><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/transformer/sdpa_decode/device/kernels/compute/sdpa_flash_decode.cpp`}>sdpa_flash_decode.cpp ↗</a></div>
            <div><span>NCRISC / DM</span><b>Writer</b><p>Coordinates reduction/output ownership and writes the result tensor.</p><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/transformer/sdpa_decode/device/kernels/dataflow/writer_decode_all.cpp`}>writer_decode_all.cpp ↗</a></div>
          </div>
          <p className="kernel-note"><b>Synchronization is structural.</b> The SDPA descriptor builds circular buffers, reducer/output/K-multicast semaphores, compile-time arguments and per-core runtime bindings together. “Remove a wait” is valid only after producer/consumer ownership remains proven.</p>
        </section>

        <section className="bottleneck-section">
          <div className="transformer-section-heading"><span>04 / ROUTING MATRIX</span><h2>The profile chooses<br/>the editing layer.</h2><p>Do not let familiarity choose the fix. Match the observed signature to the smallest useful intervention.</p></div>
          <div className="routing-grid">
            <article><span>HOST GAPS</span><h3>Dispatch-bound</h3><p>Warm cache, stabilize shapes, capture decode trace, submit non-blocking.</p><b>EDIT: generator/runtime</b></article>
            <article><span>CONVERSION OPS</span><h3>Layout-bound</h3><p>Align producer and consumer memory configs; remove only legal conversions.</p><b>EDIT: model_config + call sites</b></article>
            <article><span>DRAM / NOC</span><h3>Movement-bound</h3><p>Shard, page, retain residency, fuse cache/collective work where supported.</p><b>EDIT: TTNN program config</b></article>
            <article><span>FPU / SFPU</span><h3>Compute-bound</h3><p>Sweep grid, blocking, chunk sizes and fidelity under the quality gate.</p><b>EDIT: op/factory config</b></article>
            <article><span>CB WAIT / STALL</span><h3>Pipeline-bound</h3><p>Minimize the op, inspect reader/compute/writer balance and CB capacity.</p><b>EDIT: program factory/kernel</b></article>
            <article><span>QUALITY FAIL</span><h3>Precision-bound</h3><p>Restore the first failing tensor role instead of abandoning all compression.</p><b>EDIT: DecodersPrecision</b></article>
          </div>
        </section>

        <section id="compiler" className="compiler-section-transformer">
          <div className="transformer-section-heading light"><span>05 / CURRENT COMPILER BRANCH</span><h2>Forge compiles.<br/>TTNN hand-tunes.</h2><p>The official project is <b>TT-Forge</b>, not “tt-force.” Its repository is the umbrella for the end-to-end compiler projects; TT-MLIR is the core middle/backend compiler. This branch complements—not replaces—the pinned handwritten TTNN path above.</p></div>

          <div className="compiler-release-strip"><div><span>LATEST REVIEWED DEV RELEASE · 19 AUG 2026</span><strong>{forgeSnapshot.release}</strong></div><dl><div><dt>TT-XLA</dt><dd>{forgeSnapshot.ttXla}</dd></div><div><dt>TT-MLIR</dt><dd>{forgeSnapshot.ttMlir}</dd></div><div><dt>TT-METAL</dt><dd>{forgeSnapshot.ttMetal}</dd></div></dl><a href={forgeLinks.releases}>Release evidence ↗</a></div>

          <div className="execution-paths">
            <article><header><span>A / HANDWRITTEN MODEL PATH</span><b>Audited in this page</b></header><div><i>PyTorch weights</i><em>↓</em><i><code>models/tt_transformers</code></i><em>↓</em><i>TTNN operations + configs</i><em>↓</em><i>TT-Metal program factories</i><em>↓</em><i>RISC kernels on Blackhole</i></div><p>Use this path when modifying the existing TTNN Transformer, its KV-cache/SDPA calls, layouts, precision policies or trace replay.</p></article>
            <article><header><span>B / CURRENT COMPILER PATH</span><b>Latest upstream architecture</b></header><div><i>PyTorch / JAX</i><em>↓ TT-XLA</em><i>StableHLO</i><em>↓</em><i>TTIR + graph passes</i><em>↓ backend selection</em><i>TTNN-IR / TTKernel-IR / TTMetal-IR</i><em>↓</em><i>TTNN or TT-Metalium</i></div><p>ONNX, TensorFlow and PaddlePaddle enter through TT-Forge-ONNX. The backend IRs are alternatives, not one mandatory serial chain. Use this path when the model is compiler-ingested or the change belongs in fusion, layout, sharding or lowering.</p></article>
          </div>

          <div className="compiler-lever-matrix"><div className="compiler-lever-head"><b>TRANSFORMER LEVER</b><b>TT-FORGE / TT-MLIR RESPONSIBILITY</b><b>TTNN / TT-METAL RESPONSIBILITY</b><b>EVIDENCE GATE</b></div><div><span>01 · KV CACHE + ATTENTION</span><p>For recognized frontend forms, preserve cache/update and SDPA semantics; reject unsupported forms clearly.</p><p>Execute paged cache update, chunked SDPA and reader/compute/writer kernels.</p><p>Exact graph lowers + context-bucket traffic + long-decode token agreement.</p></div><div><span>02 · LAYOUT + SHARDING</span><p>Propagate legal layouts, select op configs and manage spills using the target system description.</p><p>Honor concrete memory configs, core grids, CB capacity and NoC ownership.</p><p>Fewer legal conversions/spills in compiler and device traces.</p></div><div><span>03 · QUANTIZATION</span><p>Preserve Q/DQ and dtype semantics for supported patterns; verify bit width and operator lowering.</p><p>Provide legal storage, math, accumulation, pack/unpack and conversion kernels.</p><p>Exact operator lowers + layer/model quality + measured warm traffic/latency.</p></div><div><span>04 · FUSION + DISPATCH</span><p>Recognize graph patterns and remove materialized intermediates/layout repairs.</p><p>Cache programs, capture stable traces, dispatch and run the fused implementation.</p><p>Reduced dispatch/allocation/bytes—not only a lower IR-op count.</p></div></div>

          <div className="compiler-decision"><span>CHOOSE THE OWNER</span><p><b>Compiler-ingested model?</b> Inspect StableHLO → TTIR → selected backend IR and TT-MLIR passes first. <b>Existing handwritten TTNN model?</b> Profile the TTNN operation/configuration first. <b>Both paths fail at the same minimized operation?</b> Descend to the shared TT-Metal/kernel contract.</p><div><a href={forgeLinks.repo}>Current TT-Forge architecture ↗</a><a href={forgeLinks.docs}>Official Forge overview ↗</a><a href={forgeLinks.mlir}>TT-MLIR repository ↗</a><a href={forgeLinks.mlirDialects}>Dialect definitions ↗</a><a href={forgeLinks.cacheLowering}>Pinned cache lowering ↗</a><a href={forgeLinks.quantLowering}>Pinned Q/DQ lowering ↗</a><a href={forgeLinks.optimizerPipeline}>Pinned optimizer pipeline ↗</a><a href={forgeLinks.optimizer}>TTNN optimizer notes ↗</a></div></div>

          <p className="compiler-capability-warning"><b>Capability boundary.</b> The pinned TT-MLIR source contains cache-update, SDPA and Q/DQ conversion machinery, but a conversion pattern is not a model-support guarantee. Verify that the exact frontend graph matches, inspect emitted IR, pass operation validation, and run the target kernel. The optimizer document’s numerical memory examples are explicitly Wormhole values; use the Blackhole system descriptor and backend for Blackhole budgets.</p>
          <p className="compiler-revision-warning"><b>Revision boundary.</b> The manual path above is audited at <code>tt-metal@{revision.slice(0, 12)}</code>. The reviewed TT-Forge development release pins <code>tt-metal@{forgeSnapshot.ttMetal}</code>. Do not mix those findings into one source claim without re-running the audit at the release-pinned dependency set.</p>
        </section>

        <section id="measure" className="measurement-section">
          <div className="transformer-section-heading light"><span>06 / MEASUREMENT LEDGER</span><h2>No invented<br/>speedup.</h2><p>These cells are intentionally blank. Fill them from the exact model and Blackhole run, one changed variable per row.</p></div>
          <div className="measurement-table" role="table" aria-label="Transformer optimization measurement ledger">
            <div className="measurement-row head" role="row"><b>RUN</b><b>CHANGE</b><b>PREFILL</b><b>DECODE</b><b>QUALITY</b><b>DECISION</b></div>
            {measurementRows.map((row) => <div className="measurement-row" role="row" key={row[0]}>{row.map((cell, index) => index === 0 ? <code key={index}>{cell}</code> : <span key={index}>{cell}</span>)}</div>)}
          </div>
          <div className="measure-command"><span>PROFILE THE WARM PATH</span><pre><code>{`cd ~/src/tt-metal
source python_env/bin/activate
export HF_MODEL=<org/model-or-local-path>
export MESH_DEVICE=<Blackhole-SKU>

python -m tracy -p -r -v -m pytest \\
  models/tt_transformers/demo/simple_text_demo.py \\
  -k "performance and batch-1"`}</code></pre><p>Save the generated operations report beside the commit, shape distribution and quality result. First-run compilation is a separate metric.</p><a href="https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/tutorials/tutorials/ttnn_visualizer.html">Open TTNN Visualizer guide ↗</a></div>
        </section>

        <section className="review-section-transformer">
          <div className="review-card logic"><span>LOGIC REVIEW</span><h2>Order is a dependency.</h2><ol><li>Correctness before precision.</li><li>Stable shapes before trace.</li><li>Layout chain before isolated op speed.</li><li>Operation proof before custom kernel.</li><li>Hardware data before performance claim.</li></ol></div>
          <div className="review-card code"><span>CODE REVIEW</span><h2>Two paths, one device.</h2><ol><li>Prefill and decode branch throughout the stack.</li><li>TT-Forge routes PyTorch/JAX through TT-XLA and TT-MLIR.</li><li>The handwritten Transformer goes directly through TTNN.</li><li>Both ultimately depend on legal TTNN/TT-Metal operation contracts.</li><li>Release-pinned and local source revisions must not be mixed.</li></ol></div>
        </section>

        <section className="transformer-download">
          <div><span>REPEATABLE RECORD / CHAIN 02</span><h2>The full guide includes both TTNN and TT-Forge/TT-MLIR paths, small Mermaid flows, source anchors, reviews and the blank experiment ledger.</h2></div>
          <div><a href="./DISCUSSION_TRANSFORMER_BLACKHOLE_OPTIMIZATION.md">Read Markdown guide ↗</a><a href="https://github.com/buicongnguyen/tt-sim/blob/main/docs/DISCUSSION_TRANSFORMER_BLACKHOLE_OPTIMIZATION.md">Open source on GitHub ↗</a></div>
        </section>
      </main>

      <footer className="transformer-footer"><div><b>TT•SIM · DISCUSSION CHAIN 02</b><p>Transformer optimization from source-backed decision to measured Blackhole result.</p></div><a href="./discussion-blackhole-bringup.html">← Chain 01</a><a href="./discussion.html">Discussion →</a><a href="./index.html">Book →</a></footer>
    </div>
  );
}

export default TransformerOptimizationApp;
