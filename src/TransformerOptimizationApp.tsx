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
          <a href="#decision">Decisions</a><a href="#code">TTNN → Metal</a><a href="#measure">Measurements</a>
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

        <section id="measure" className="measurement-section">
          <div className="transformer-section-heading light"><span>05 / MEASUREMENT LEDGER</span><h2>No invented<br/>speedup.</h2><p>These cells are intentionally blank. Fill them from the exact model and Blackhole run, one changed variable per row.</p></div>
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
          <div className="review-card code"><span>CODE REVIEW</span><h2>The source already optimizes.</h2><ol><li>Prefill and decode branch throughout the stack.</li><li>QKV, activation×multiply and cache update have fused paths.</li><li>Blackhole-specific cutoffs, grids and sharding are explicit.</li><li>Program configs alter cores, CBs, multicast and runtime args.</li><li>FIXMEs and SKU workarounds are not universal specifications.</li></ol></div>
        </section>

        <section className="transformer-download">
          <div><span>REPEATABLE RECORD / CHAIN 02</span><h2>The full guide includes commands, nine small Mermaid flows, source anchors, logic review, code review and the blank experiment ledger.</h2></div>
          <div><a href="./DISCUSSION_TRANSFORMER_BLACKHOLE_OPTIMIZATION.md">Read Markdown guide ↗</a><a href="https://github.com/buicongnguyen/tt-sim/blob/main/docs/DISCUSSION_TRANSFORMER_BLACKHOLE_OPTIMIZATION.md">Open source on GitHub ↗</a></div>
        </section>
      </main>

      <footer className="transformer-footer"><div><b>TT•SIM · DISCUSSION CHAIN 02</b><p>Transformer optimization from source-backed decision to measured Blackhole result.</p></div><a href="./discussion-blackhole-bringup.html">← Chain 01</a><a href="./discussion.html">Discussion →</a><a href="./index.html">Book →</a></footer>
    </div>
  );
}

export default TransformerOptimizationApp;
