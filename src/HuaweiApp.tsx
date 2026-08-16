import { useState } from "react";

type Lens = "memory" | "compute" | "software";

const lenses = {
  memory: {
    title: "HBM wins the cited off-chip feed-rate axis. It does not settle the system.",
    summary: "The original Ascend 910 paper reports 32 GB global memory and 1.2 TB/s GM→L1/UB paths. Blackhole p150 publishes 32 GB GDDR6 at 512 GB/s, while exposing 180 MB aggregate SRAM across its workers.",
    question: "Can the compiler keep hot tiles and KV state local enough that SRAM reuse outweighs repeated external-memory traffic?",
  },
  compute: {
    title: "Both are dataflow machines; their scheduling units are different.",
    summary: "Blackhole places work over many Tensix workers and three compute threads. Ascend's AI Core couples or separates Cube and Vector cores, with Scalar queues and MTE engines orchestrating movement.",
    question: "Does the workload map cleanly to independent workers, or benefit from a deep Cube/Vector memory pipeline?",
  },
  software: {
    title: "Visibility changes what an AI-compiler engineer can learn and tune.",
    summary: "Tenstorrent publishes TT-Metal, TT-NN, TT-MLIR/TT-Forge and architecture-specific LLKs. Huawei publishes CANN/Ascend C interfaces and extensive operator documentation, but exposes a different low-level boundary.",
    question: "Do you need to audit and change the compiler-to-LLK path, or deploy inside an established CANN system?",
  },
} as const;

const comparisonRows = [
  ["Compute target", "120 enabled Tensix workers", "AI Core: Cube + Vector + Scalar", "Product / official architecture"],
  ["Movement", "BRISC/NCRISC + explicit NoC", "MTE1/MTE2/MTE3 + FixPipe", "Official programming docs"],
  ["Local hierarchy", "Distributed SRAM + circular buffers", "L1, L0A/B/C, UB, BT, FP", "Official programming docs"],
  ["External memory", "32 GB GDDR6 · 512 GB/s", "Ascend 910 paper: 32 GB GM · ~1.2 TB/s local feed", "Product / Huawei-hosted paper"],
  ["Kernel control", "Reader → TRISC compute → writer", "Scalar queues → MTE/Cube/Vector", "Official programming docs"],
  ["Scale-out", "Ethernet links + TT-Fabric", "HCCS / UnifiedBus / SuperPoD by generation", "System architecture"],
  ["Public source depth", "Compiler through architecture LLKs", "CANN/Ascend C APIs and docs", "Repository / documentation audit"],
] as const;

const architectureQuestions = [
  {
    number: "Q01",
    question: "What can Huawei learn from Tenstorrent's architecture?",
    answer: "Not the basic matrix pipeline—Ascend already has Cube, Vector, Scalar and DMA engines. The stronger lesson is to make data movement, topology and failure evidence more programmable and visible.",
    points: [
      ["Data movement", "Expose producer/consumer queues, peer SRAM movement and multicast as stable compiler primitives."],
      ["Control", "Give irregular, sparse and communication-heavy kernels a more capable software-visible control plane."],
      ["Observability", "Connect graph lowering, tiling, device binaries, DMA queues and device traces in one reproducible simulator workflow."],
    ],
    verdict: "Keep HBM and CANN; add more explicit locality, topology and open low-level contracts.",
  },
  {
    number: "Q02",
    question: "Where is Huawei more advanced in architecture and performance?",
    answer: "Huawei's documented advantage is the system around dense training: higher external-memory feed, a deeply specialized Cube/Vector/MTE hierarchy, tightly coupled scale-up and a mature CANN/HCCL deployment stack.",
    points: [
      ["Memory", "Original Ascend 910 evidence reports ~1.2 TB/s GM→local versus Blackhole p150's 512 GB/s GDDR6: about 2.34× on that narrow axis."],
      ["Scale-up", "Atlas 900 A3 publishes up to 384 NPUs, 48 TB unified device memory, 784 GB/s bidirectional D2D and 200 ns single-hop latency."],
      ["Software", "CANN, HCCL, graph/operator libraries and deployed SuperPoDs give Huawei a more mature large-training system today."],
    ],
    verdict: "Likely stronger for HBM-bound dense training; not proven universally faster per chip, per watt or per dollar.",
  },
] as const;

function HuaweiApp() {
  const [lens, setLens] = useState<Lens>("memory");
  const selected = lenses[lens];

  return (
    <div className="hwa-page">
      <header className="hwa-topbar">
        <a className="hwa-brand" href="./index.html"><span>TT•SIM</span><small>architecture notes</small></a>
        <nav aria-label="Page navigation"><a href="#flows">Data paths</a><a href="#matrix">Matrix</a><a href="#questions">Q&amp;A</a><a href="#compiler">Compiler</a><a href="#sources">Sources</a><a className="back" href="./index.html#generations">← Generation study</a></nav>
      </header>

      <main>
        <section className="hwa-hero">
          <div className="hero-index"><span>FIELD NOTE</span><b>02</b><small>16 AUG 2026</small></div>
          <div className="hero-title"><p>Tenstorrent Blackhole <i>×</i> Huawei Ascend</p><h1>HBM is one axis.<br/><em>Dataflow is the system.</em></h1></div>
          <div className="hero-thesis"><span>REVIEW VERDICT</span><p>Blackhole favors transparent, programmable workers, distributed SRAM and Ethernet scale-out. Ascend favors Cube/Vector engines, staged local buffers and high-bandwidth global memory. Neither memory label decides the workload.</p><a href="./BLACKHOLE_VS_HUAWEI_ASCEND.md">Read the full technical report ↗</a></div>
          <div className="memory-number"><span>CITED OFF-CHIP / GM PATH</span><div><article><small>Blackhole p150</small><strong>512</strong><em>GB/s GDDR6</em></article><i>vs</i><article><small>Original Ascend 910</small><strong>~1.2</strong><em>TB/s GM→local</em></article></div><p>About 2.34× on this narrow cited axis. Not an end-to-end benchmark.</p></div>
        </section>

        <section className="scope-strip"><span>SCOPE CONTROL</span><p>Ascend 910 memory evidence is not silently assigned to 910B/910C. Ascend 950's 144 GB / 4 TB/s HBM is a future vendor roadmap, not a contemporary Blackhole result.</p></section>

        <section id="flows" className="hwa-section">
          <div className="section-number">01</div><div className="section-intro"><span>DATA PATHS</span><h2>Same compiler problem.<br/>Different machine contract.</h2><p>Both designs reward tiling, overlap, fusion and locality. The important difference is which storage levels, engines and synchronization points the compiler must make legal.</p></div>
          <div className="flow-pair">
            <article className="tt-flow"><header><span>BLACKHOLE</span><strong>Tensix worker</strong><small>explicit NoC + circular buffers</small></header><div className="flow-line"><b>GDDR6</b><i>→</i><b>NoC</b><i>→</i><b>SRAM</b></div><div className="compute-rack"><span><small>TRISC 0</small>UNPACK</span><i>→</i><span><small>TRISC 1</small>MATH</span><i>→</i><span><small>TRISC 2</small>PACK</span></div><div className="controllers"><span>BRISC reader</span><span>NCRISC writer</span></div><p>Small RISC-V cores move tiles while matrix/SFPU math consumes and produces circular-buffer pages.</p></article>
            <article className="ascend-flow"><header><span>ASCEND</span><strong>AI Core</strong><small>Scalar queues + MTE hierarchy</small></header><div className="flow-line"><b>HBM / GM</b><i>→</i><b>MTE2</b><i>→</i><b>L1</b></div><div className="compute-rack"><span><small>L0A + L0B</small>CUBE</span><i>→</i><span><small>L0C</small>FIXPIPE</span><i>→</i><span><small>UB</small>VECTOR</span></div><div className="controllers"><span>Scalar scheduler</span><span>MTE3 copy-out</span></div><p>Matrix and vector work issue through independent queues while explicit transfer engines feed the local hierarchy.</p></article>
          </div>
        </section>

        <section className="lens-section" aria-labelledby="lens-title">
          <div className="lens-tabs" role="tablist" aria-label="Comparison lenses">
            {(Object.keys(lenses) as Lens[]).map((item, index) => <button key={item} type="button" role="tab" aria-selected={lens === item} className={lens === item ? "active" : ""} onClick={() => setLens(item)}><span>0{index + 1}</span>{item}</button>)}
          </div>
          <article className="lens-panel" role="tabpanel"><span>ACTIVE LENS</span><h2 id="lens-title">{selected.title}</h2><p>{selected.summary}</p><div><small>Measure next</small><strong>{selected.question}</strong></div></article>
        </section>

        <section id="matrix" className="hwa-section comparison-section">
          <div className="section-number">02</div><div className="section-intro"><span>DECISION MATRIX</span><h2>Compare mechanisms,<br/>not brand labels.</h2><p>Numbers and architectural terms carry their evidence class. “Different” is not automatically “slower,” and a capacity count is not a latency result.</p></div>
          <div className="comparison-table" role="region" aria-label="Blackhole and Ascend architecture comparison" tabIndex={0}><table><thead><tr><th>Axis</th><th>Blackhole p150</th><th>Huawei Ascend</th><th>Evidence class</th></tr></thead><tbody>{comparisonRows.map((row) => <tr key={row[0]}><th>{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td><td><span>{row[3]}</span></td></tr>)}</tbody></table></div>
          <div className="memory-balance"><article><span>BLACKHOLE LOCALITY LEVER</span><strong>180 MB</strong><small>aggregate p150 SRAM</small><p>Keep tiles close to 120 enabled workers; make NoC movement and circular-buffer backpressure explicit.</p></article><div><i>↔</i><strong>cost model</strong><p>reuse · contention · capacity · movement</p></div><article><span>ASCEND BANDWIDTH LEVER</span><strong>~1.2 TB/s</strong><small>Ascend 910 GM→L1/UB in cited paper</small><p>Feed Cube/Vector pipelines through MTE and staged L1/L0/UB buffers.</p></article></div>
        </section>

        <section id="questions" className="qa-section">
          <div className="qa-heading"><span>03 / TWO-WAY REVIEW</span><h2>What should each architecture teach us?</h2><p>These answers separate a useful design lesson from a benchmark claim. Huawei already implements asynchronous dataflow; Tenstorrent already scales beyond one card. The differences are control, memory balance and system integration.</p></div>
          <div className="qa-grid">
            {architectureQuestions.map((item) => <article className="qa-card" key={item.number}><header><span>{item.number}</span><h3>{item.question}</h3></header><p className="qa-answer">{item.answer}</p><div className="qa-points">{item.points.map((point) => <div key={point[0]}><small>{point[0]}</small><p>{point[1]}</p></div>)}</div><footer><small>ANSWER IN ONE LINE</small><strong>{item.verdict}</strong></footer></article>)}
          </div>
          <div className="qa-metrics" aria-label="Evidence boundaries for Huawei and Tenstorrent performance comparison"><article><span>2.34×</span><p>Ascend 910 cited GM feed versus Blackhole p150 external bandwidth—not application speed.</p></article><article><span>384</span><p>NPUs in Huawei's Atlas 900 A3 scale-up domain versus 32 chips in one Blackhole Galaxy.</p></article><article><span>∅</span><p>No public same-model, same-precision, same-power benchmark establishes a universal winner.</p></article></div>
          <a className="qa-report-link" href="./BLACKHOLE_VS_HUAWEI_ASCEND.md">Read both complete answers, reasoning and primary evidence ↗</a>
        </section>

        <section id="compiler" className="compiler-section">
          <div className="compiler-copy"><span>04 / ONE GRAPH, TWO LOWERINGS</span><h2>Y = ReLU(A × B + bias)</h2><p>Fusion is target-independent. Buffer placement, transfer overlap, post-op placement and synchronization are not.</p></div>
          <div className="lowering-grid">
            <article><header><b>BH</b><strong>Blackhole lowering</strong></header><ol><li>Shard matrix tiles across Tensix workers.</li><li>BRISC/NCRISC stage GDDR6 ↔ SRAM.</li><li>TRISC pipeline executes unpack, matrix math and pack.</li><li>Fuse bias/ReLU before a DRAM round trip.</li></ol></article>
            <article><header><b>昇</b><strong>Ascend lowering</strong></header><ol><li>Tile GlobalTensor into L1 and L0A/L0B.</li><li>MTE overlaps copy-in with Cube work.</li><li>Accumulate through L0C; place post-op in FixPipe or Vector/UB.</li><li>MTE3 copies the fused result to GM.</li></ol></article>
          </div>
          <div className="compiler-rule"><span>PORTABLE IR RULE</span><p>Keep `matmul + bias + relu` fusion generic. Attach target capabilities late: legal formats, tile geometry, local spaces, engine count, transfer effects and synchronization.</p></div>
        </section>

        <section className="roadmap-note"><span>FUTURE, NOT COMPARED</span><div><h2>Ascend 950DT: 144 GB / 4 TB/s HBM</h2><p>Huawei announced these as Q4 2026 roadmap specifications. They are useful directionally, but must not be backfilled into Ascend 910C or used as a shipping benchmark on this report date.</p></div><a href="https://www.huawei.com/en/news/2025/9/hc-xu-keynote-speech">Official roadmap ↗</a></section>

        <section id="sources" className="hwa-section sources-section-hwa">
          <div className="section-number">05</div><div className="section-intro"><span>PRIMARY EVIDENCE</span><h2>Trace the claim.<br/>Keep the caveat.</h2><p>Product facts come from official tables; architecture facts come from public programming documentation; the original Ascend 910 memory row is explicitly a Huawei-hosted technical paper.</p></div>
          <div className="hwa-sources">
            <a href="https://tenstorrent.com/en/hardware/cards"><span>01 · PRODUCT</span><strong>Blackhole cards</strong><p>Core, clock, SRAM, GDDR6, bandwidth, BlockFP8, power, links and PCIe.</p><i>↗</i></a>
            <a href="https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.html"><span>02 · ARCHITECTURE</span><strong>Tensix dataflow</strong><p>Compute engines, data movement and the low-level worker pipeline.</p><i>↗</i></a>
            <a href="https://www.hiascend.com/document/detail/en/canncommercial/850/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html"><span>03 · ARCHITECTURE</span><strong>Ascend C hardware guide</strong><p>Cube, Vector, Scalar, MTE and local-memory data paths.</p><i>↗</i></a>
            <a href="https://www.cmc.ca/wp-content/uploads/2020/03/Zhan-Xu-Huawei.pdf"><span>04 · ARCHITECTURE DECK</span><strong>Ascend 910 HBM</strong><p>Huawei Da Vinci presentation identifying the original chip's 32 GB HBM Gen2 interface.</p><i>↗</i></a>
            <a href="https://edu.hicomputing.huawei.com/cloud_resource/edu_public/courseReviewAttachment/1754290511519-Low_Bit_NPUs_and_CPUs_for_HPL_MxP--%E8%8E%B7%E5%A5%96%E8%AE%BA%E6%96%87%EF%BC%88%E8%96%9B%E4%BC%9F%E8%AF%9A%EF%BC%89.pdf"><span>05 · TECHNICAL PAPER</span><strong>Original Ascend 910 memory</strong><p>32 GB GM, 1.2 TB/s local feed, 34 MB cache and tensor-unit context.</p><i>↗</i></a>
            <a href="https://github.com/tenstorrent/tt-metal"><span>06 · SOURCE</span><strong>TT-Metal</strong><p>Host runtime, HAL, firmware, architecture LLKs and technical reports.</p><i>↗</i></a>
            <a href="https://www.hiascend.com/hardware/cluster"><span>07 · SYSTEM</span><strong>Atlas 900 A3</strong><p>384-NPU scale-up, unified memory, D2D bandwidth, latency and FP16 system peak.</p><i>↗</i></a>
            <a href="https://tenstorrent.com/hardware/galaxy"><span>08 · SYSTEM</span><strong>Blackhole Galaxy</strong><p>32-chip server memory, SRAM, fabric and Block-FP8 system peak.</p><i>↗</i></a>
            <a href="https://www.hiascend.com/document/detail/en/CANNCommunityEdition/900/index/index.html"><span>09 · SOFTWARE</span><strong>CANN 9.0</strong><p>Frameworks, operator libraries, HCCL, compiler, profiler and migration surfaces.</p><i>↗</i></a>
            <a href="./BLACKHOLE_VS_HUAWEI_ASCEND.md"><span>10 · REPORT</span><strong>Full comparison record</strong><p>Both Q&amp;As, scope, caveats, compiler implications and decision guide in Markdown.</p><i>↗</i></a>
          </div>
        </section>
      </main>

      <footer className="hwa-footer"><div><span>TT•SIM ARCHITECTURE NOTES</span><p>Independent technical study. Product names belong to their respective owners.</p></div><a href="https://github.com/buicongnguyen/tt-sim">Source on GitHub ↗</a><a href="./index.html">Return to the lab guide →</a></footer>
    </div>
  );
}

export default HuaweiApp;
