import { useMemo, useState } from "react";

type Track = "debugging" | "optimization";
type Status = "inbox" | "experiment" | "evidence" | "ready";
type TrackFilter = "all" | Track;
type StatusFilter = "all" | Status;

type DiscussionTopic = {
  id: string;
  track: Track;
  status: Status;
  title: string;
  question: string;
  hypothesis: string;
  evidence: string;
  next: string;
  destination: string;
  page?: string;
};

const topics: readonly DiscussionTopic[] = [
  {
    id: "DBG-01",
    track: "debugging",
    status: "experiment",
    title: "Build a host-to-device stack trace recipe",
    question: "Which host frames connect Program creation, binary packing, command generation and worker GO?",
    hypothesis: "A small stable breakpoint set can explain most slow-dispatch launches without stepping through every wrapper.",
    evidence: "Cold and cached GDB backtraces with the exact TT-Metal revision and launch inputs.",
    next: "Run one reader/compute/writer Program twice and compare the captured boundaries.",
    destination: "WSL host/device debugging",
  },
  {
    id: "DBG-02",
    track: "debugging",
    status: "evidence",
    title: "Debug Blackhole BRISC/NCRISC bring-up",
    question: "How do we distinguish a shared launch failure, operation-entry fault and real compiler miscompile?",
    hypothesis: "Paired waypoints, ELF readback and a controlled compiler A/B can isolate the first broken boundary.",
    evidence: "Pinned control-flow sources and an eight-stage decision plan; the historical compiler artifacts remain open.",
    next: "Recover the failing/passing compiler hashes, paired waypoints, failing PC and minimized valid input.",
    destination: "Firmware-to-kernel flow",
    page: "./discussion-blackhole-bringup.html",
  },
  {
    id: "DBG-03",
    track: "debugging",
    status: "inbox",
    title: "Identify the exact binary executed by each RISC",
    question: "How do we map a simulator PC to firmware ELF, operation ELF, symbol and source line?",
    hypothesis: "JIT metadata and RISC load addresses can automate the mapping with readelf, objdump and addr2line.",
    evidence: "A script resolving at least one BRISC, NCRISC and TRISC address from a real build.",
    next: "Inventory the JIT cache and linker maps after the Blackhole smoke test.",
    destination: "TTSim debugging path",
  },
  {
    id: "DBG-04",
    track: "debugging",
    status: "experiment",
    title: "Classify simulator unsupported-instruction failures",
    question: "Was the unsupported instruction reached in firmware, dispatch setup or the user kernel?",
    hypothesis: "The failing PC, active RISC and latest launch waypoint are enough to route the issue correctly.",
    evidence: "Disassembly around the PC plus a reproduction stripped of unrelated kernels.",
    next: "Apply the classifier to the recorded Quasar rv64_custom_0 failure.",
    destination: "TTSim debugging path",
  },
  {
    id: "DBG-05",
    track: "debugging",
    status: "evidence",
    title: "Select and debug Blackhole synchronization",
    question: "Which fence, semaphore, barrier or hardware wait enforces the dependency that actually failed?",
    hypothesis: "Separating compiler, local RISC, NoC, cross-core readiness, CB ownership and Tensix pipeline domains prevents false fixes.",
    evidence: "Pinned implementations, paired Watcher waypoints, checkpoint flow, delay A/B and four repeatable labs.",
    next: "Run the data-before-signal lab with targeted write delay and preserve the NoC timeline separately.",
    destination: "Async kernels and debugging chapters",
    page: "./discussion-blackhole-synchronization.html",
  },
  {
    id: "DBG-06",
    track: "debugging",
    status: "evidence",
    title: "Trace the low-level kernel boundary",
    question: "Which host, firmware, wrapper or kernel_main boundary failed first?",
    hypothesis: "A source-linked Mermaid sequence plus W/R/K/KD/D waypoints can select one short interval before intrusive debugging.",
    evidence: "Six consolidated diagrams pin cold boot, Program launch, NCRISC handoff, waypoint routing, observer selection and DPRINT mechanics.",
    next: "Capture one real failing waypoint pair and attach the matching ELF, PC and bounded DPRINT evidence.",
    destination: "Firmware-to-kernel and bring-up chapters",
    page: "./debug-low-level-kernel-flow.html",
  },
  {
    id: "OPT-01",
    track: "optimization",
    status: "experiment",
    title: "Measure cold versus warm Program traffic",
    question: "Which binary and configuration writes disappear after a Program becomes committed?",
    hypothesis: "Warm launch reuses operation binaries but still carries arguments, launch state and GO.",
    evidence: "Command types and transferred-byte counts for launch one and launch two.",
    next: "Enqueue one Program twice with controlled runtime-argument changes.",
    destination: "Firmware-to-kernel flow",
  },
  {
    id: "OPT-02",
    track: "optimization",
    status: "inbox",
    title: "Move NoC barriers to the first real dependency",
    question: "Where can kernels overlap transfers without breaking signalling or buffer reuse?",
    hypothesis: "Several transfers can precede one typed barrier while circular-buffer ownership remains valid.",
    evidence: "Before/after command order, barrier count, output check and Watcher state.",
    next: "Start with two reads and move only the first consumption boundary.",
    destination: "Async kernels and matrix granularity",
  },
  {
    id: "OPT-03",
    track: "optimization",
    status: "inbox",
    title: "Choose circular-buffer depth from pipeline behavior",
    question: "When does another CB page improve overlap instead of only consuming L1?",
    hypothesis: "Useful depth follows burst size and the slowest stage, not a universal double-buffer rule.",
    evidence: "CB pointer traces and L1 peak for depths one through four.",
    next: "Sweep depth with the same tensor shape and command schedule.",
    destination: "Compiler/runtime capstone",
  },
  {
    id: "OPT-04",
    track: "optimization",
    status: "inbox",
    title: "Compare fusion by memory traffic",
    question: "When does matmul + bias + relu fusion reduce dispatches, allocations or transfers?",
    hypothesis: "The useful gain comes from removing materialized intermediates, not merely reducing IR operation count.",
    evidence: "Allocation lifetimes, dispatch count, estimated bytes and identical NumPy-oracle output.",
    next: "Record fused and unfused plans for one fixed shape and data format.",
    destination: "Compiler/runtime capstone",
  },
  {
    id: "OPT-05",
    track: "optimization",
    status: "inbox",
    title: "Select BFP8, MXFP4 or wider formats by error budget",
    question: "Which tensor roles tolerate reduced precision on each architecture?",
    hypothesis: "Format choice must be per tensor role; smallest-format-everywhere will not preserve quality.",
    evidence: "Supported-target matrix, conversion cost, memory traffic and numerical error.",
    next: "Define a correctness threshold before comparing one representative layer.",
    destination: "Future data-format chapter",
  },
  {
    id: "OPT-06",
    track: "optimization",
    status: "experiment",
    title: "Optimize a Transformer on Blackhole",
    question: "How do prefill and decode decisions flow through either handwritten TTNN or the current TT-Forge/TT-MLIR compiler route into TT-Metal kernels?",
    hypothesis: "Separating the two entry routes, stabilizing layouts and profiling each source layer will expose a smaller useful tuning surface than rewriting kernels first.",
    evidence: "Pinned TT-Transformers, matmul and SDPA paths plus the current TT-Forge/TT-MLIR architecture and release dependency boundary.",
    next: "Choose one pinned entry route, run accuracy and warm performance baselines, then profile prefill and decode separately.",
    destination: "Transformer optimization chapter",
    page: "./discussion-transformer-blackhole-optimization.html",
  },
  {
    id: "OPT-07",
    track: "optimization",
    status: "evidence",
    title: "Apply mixed precision and quantization to an LLM",
    question: "Which TTNN/TT-Metal datatype is actually legal and useful for each LLM tensor role?",
    hypothesis: "The source-supported path is BF16 baseline → BFP8 by role → selective BFP4, while INT8/MX require narrower operation-level proof.",
    evidence: "Pinned datatype, linear, quantization, TT-Transformers precision-policy and Blackhole LLK sources.",
    next: "Run the accuracy/performance presets, then sweep FF1/FF3 BFP4 in one decoder under model-quality and warm-performance gates.",
    destination: "Quantization and mixed-precision chapter",
    page: "./discussion-quantization.html",
  },
  {
    id: "OPT-08",
    track: "optimization",
    status: "evidence",
    title: "Answer NPU architecture trade-off questions",
    question: "How do fixed area, GEMM dataflow, model scale, precision, utilization and power decisions become defensible recommendations?",
    hypothesis: "Adding evidence and validation to bottleneck/options/trade-offs/recommendation exposes weak assumptions before an interview answer becomes a design claim.",
    evidence: "Thirteen topic plans, résumé/portfolio ownership boundaries, six detailed cases, 17 recall prompts, first-order models and pinned TT-Metal/TTNN contracts.",
    next: "Run the one-day sequence, rehearse each 45-second opening, then defend one follow-up with a formula, counter and rollback gate.",
    destination: "Architecture interview and presentation appendix",
    page: "./discussion-architecture-interview.html",
  },
];

const lifecycle = [
  { number: "01", status: "INBOX", title: "Capture", detail: "Keep one question and one falsifiable hypothesis." },
  { number: "02", status: "EXPERIMENT", title: "Reproduce", detail: "Save environment, commands, raw output and a correctness gate." },
  { number: "03", status: "EVIDENCE", title: "Bound", detail: "Link source, logs or measurements and review alternatives." },
  { number: "04", status: "READY", title: "Promote", detail: "Move the maintained conclusion into the right chapter." },
] as const;

const statusLabels: Record<Status, string> = {
  inbox: "INBOX",
  experiment: "EXPERIMENT",
  evidence: "EVIDENCE",
  ready: "READY",
};

const promotionRules = [
  "Name the architecture, source revision and simulator library when relevant.",
  "Make the experiment repeatable by another reader.",
  "Link evidence beside the conclusion, not only in a source appendix.",
  "Separate simulator observations from hardware performance claims.",
  "Move a concise conclusion into the book; leave raw exploration here.",
] as const;

function DiscussionApp() {
  const [track, setTrack] = useState<TrackFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const filteredTopics = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return topics.filter((topic) => {
      const matchesTrack = track === "all" || topic.track === track;
      const matchesStatus = status === "all" || topic.status === status;
      const haystack = `${topic.id} ${topic.title} ${topic.question} ${topic.hypothesis} ${topic.destination}`.toLowerCase();
      return matchesTrack && matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [query, status, track]);

  const debuggingCount = topics.filter((topic) => topic.track === "debugging").length;
  const optimizationCount = topics.filter((topic) => topic.track === "optimization").length;
  const evidenceCount = topics.filter((topic) => topic.status === "evidence" || topic.status === "ready").length;

  return (
    <div className="discussion-page">
      <header className="discussion-topbar">
        <a className="discussion-brand" href="./index.html"><b>TT•SIM</b><span>discussion workbench</span></a>
        <nav aria-label="Page navigation"><a href="#workflow">Workflow</a><a href="#topics">Topics</a><a href="#template">Template</a><a href="#promote">Promote</a><a className="discussion-back" href="./index.html">← Book</a></nav>
      </header>

      <main>
        <section className="discussion-hero">
          <div className="discussion-hero-meta"><span>WORKBENCH / 01</span><small>PROVISIONAL · 19 AUG 2026</small></div>
          <div className="discussion-hero-copy">
            <p>DEBUGGING × OPTIMIZATION × OPEN QUESTIONS</p>
            <h1>Loose notes now.<br/><em>Chapters later.</em></h1>
            <div className="discussion-thesis"><strong>Editorial contract</strong><p>This is a staging area, not a source of settled facts. Questions can be incomplete or wrong; status, evidence and the next experiment make that uncertainty visible.</p></div>
          </div>
          <div className="discussion-ledger" aria-label="Discussion topic summary">
            <article><span>DEBUGGING</span><strong>{String(debuggingCount).padStart(2, "0")}</strong><small>active questions</small></article>
            <article><span>OPTIMIZATION</span><strong>{String(optimizationCount).padStart(2, "0")}</strong><small>active questions</small></article>
            <article><span>EVIDENCE+</span><strong>{String(evidenceCount).padStart(2, "0")}</strong><small>promotion candidates</small></article>
          </div>
        </section>

        <section id="workflow" className="discussion-section workflow-section">
          <div className="discussion-heading"><span>00 / ITEM LIFECYCLE</span><h2>Every note needs<br/>a next state.</h2><p>The workbench preserves uncertainty while preventing ideas from becoming unsupported conclusions in the maintained book.</p></div>
          <div className="lifecycle-grid">{lifecycle.map((stage, index) => <article key={stage.number}><span>{stage.number}</span><small>{stage.status}</small><h3>{stage.title}</h3><p>{stage.detail}</p>{index < lifecycle.length - 1 && <i>→</i>}</article>)}</div>
          <p className="workflow-rule"><b>Promotion rule</b> A topic moves because its evidence gate passed—not because the note became long.</p>
        </section>

        <section id="topics" className="discussion-section topics-section">
          <div className="discussion-heading inverse"><span>01 / DISCUSSION QUEUE</span><h2>Filter the questions.<br/>Keep the context.</h2><p>Debugging asks where and why execution failed. Optimization asks what can change while correctness remains intact.</p></div>
          <div className="case-chain-list">
            <a className="case-chain" href="./discussion-blackhole-bringup.html"><span>CASE CHAIN 01 · BLACKHOLE BRING-UP</span><h3>Prove the BRISC/NCRISC boundary before blaming the compiler.</h3><p>Eight decisions connect Watcher waypoints, binary readback, operation entry, compiler A/B and regression closure.</p><i>Open detailed Q&amp;A →</i></a>
            <a className="case-chain transformer" href="./discussion-transformer-blackhole-optimization.html"><span>CASE CHAIN 02 · TRANSFORMER OPTIMIZATION</span><h3>Optimize the path, not the model name.</h3><p>Split prefill and decode; compare handwritten TTNN with TT-Forge/TT-MLIR; follow the measured path into TT-Metal.</p><i>Open detailed Q&amp;A →</i></a>
            <a className="case-chain" href="./discussion-blackhole-synchronization.html"><span>SUBPAGE 03 · BLACKHOLE SYNCHRONIZATION</span><h3>Fence is not one fence.</h3><p>Separate compiler, RISC-V, NoC, L1 semaphore, CB and internal Tensix hardware-wait contracts before debugging a race.</p><i>Open field guide →</i></a>
            <a className="case-chain presentation" href="./discussion-presentation.html"><span>SUBPAGE 04 · 30-MINUTE PRESENTATION</span><h3>Tell the research story without outrunning the evidence.</h3><p>Copy-ready slides, speaker notes, two small boot/launch diagrams and defensible answers to likely technical questions.</p><i>Open presentation room →</i></a>
            <a className="case-chain quantization" href="./discussion-quantization.html"><span>SUBPAGE 05 · LLM QUANTIZATION</span><h3>An enum is not an operator promise.</h3><p>Choose BF16, BFP8, BFP4, integer or MX paths by tensor role, API legality, quality budget and measured traffic.</p><i>Open precision lab →</i></a>
            <a className="case-chain low-level" href="./debug-low-level-kernel-flow.html"><span>SUBPAGE 06 · LOW-LEVEL KERNEL DEBUG FLOW</span><h3>Debug the first missing boundary.</h3><p>Rendered Mermaid connects cold boot, Program launch, NCRISC handoff, W/R/K/KD/D, observer selection and DPRINT.</p><i>Open Mermaid atlas →</i></a>
            <a className="case-chain architecture-interview" href="./discussion-architecture-interview.html"><span>SUBPAGE 07 · PRINCIPAL NPU INTERVIEW</span><h3>Do not guess the resource. Prove the limit.</h3><p>Thirteen study plans, résumé/portfolio evidence, six trade-off cases and 17 recall prompts turn broad preparation into defensible decisions.</p><i>Open architecture workbench →</i></a>
            <a className="case-chain architecture-qa" href="./discussion-architecture-interview-qa.html"><span>SUBPAGE 08 · 50 QUESTION READER</span><h3>Read the answer. Reconstruct the decision.</h3><p>Fifty principal-level questions pair a direct answer with deeper reasoning, a proof gate, memory line and source links.</p><i>Open Q&amp;A reader →</i></a>
          </div>
          <div className="topic-controls">
            <div className="filter-group" role="group" aria-label="Filter by discussion track">
              {(["all", "debugging", "optimization"] as const).map((value) => <button key={value} type="button" className={track === value ? "active" : ""} aria-pressed={track === value} onClick={() => setTrack(value)}>{value}</button>)}
            </div>
            <div className="filter-group status-filter" role="group" aria-label="Filter by evidence status">
              {(["all", "inbox", "experiment", "evidence", "ready"] as const).map((value) => <button key={value} type="button" className={status === value ? "active" : ""} aria-pressed={status === value} onClick={() => setStatus(value)}>{value}</button>)}
            </div>
            <label className="topic-search"><span>SEARCH</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="RISC, NoC, fusion…" /></label>
          </div>
          <div className="topic-result"><span>{String(filteredTopics.length).padStart(2, "0")} SHOWN</span><button type="button" onClick={() => { setTrack("all"); setStatus("all"); setQuery(""); }}>Reset filters</button></div>
          <div className="topic-grid">
            {filteredTopics.map((topic) => <article className={`topic-card ${topic.track}`} key={topic.id}>
              <header><span>{topic.id}</span><small className={`status ${topic.status}`}>{statusLabels[topic.status]}</small></header>
              <p className="topic-track">{topic.track}</p><h3>{topic.title}</h3><p className="topic-question">{topic.question}</p>
              <details><summary>Open working note</summary><dl><div><dt>Hypothesis</dt><dd>{topic.hypothesis}</dd></div><div><dt>Evidence gate</dt><dd>{topic.evidence}</dd></div><div><dt>Next experiment</dt><dd>{topic.next}</dd></div><div><dt>Possible destination</dt><dd>{topic.destination}</dd></div></dl>{topic.page && <a className="topic-deep-link" href={topic.page}>Open detailed Q&amp;A →</a>}</details>
            </article>)}
          </div>
          {filteredTopics.length === 0 && <div className="empty-state"><b>No topics match.</b><p>Clear one filter or search for a broader mechanism.</p></div>}
        </section>

        <section id="template" className="discussion-section template-section">
          <div className="discussion-heading"><span>02 / CAPTURE TEMPLATE</span><h2>Ask a question<br/>small enough to test.</h2><p>Use this structure in the Markdown workbench or ask Codex to add a discussion item with the same fields.</p></div>
          <div className="template-workbench"><ol><li><span>01</span><b>Question</b><p>What exactly do we want to learn?</p></li><li><span>02</span><b>Hypothesis</b><p>What outcome do we currently expect?</p></li><li><span>03</span><b>Evidence gate</b><p>What would prove or disprove it?</p></li><li><span>04</span><b>Next experiment</b><p>One reproducible action, not a research program.</p></li><li><span>05</span><b>Destination</b><p>Where might the verified conclusion belong?</p></li></ol><pre>{`### TRACK-NN — Question-sized title\n\n- Status: INBOX\n- Track: debugging | optimization\n- Question:\n- Hypothesis:\n- Architecture/revision:\n- Evidence already available:\n- Evidence still needed:\n- Next experiment:\n- Correctness gate:\n- Possible destination:`}</pre></div>
          <div className="template-actions"><a href="./DISCUSSION.md">Edit the complete Markdown workbench ↗</a><a href="https://github.com/buicongnguyen/tt-sim/blob/main/docs/DISCUSSION.md">Open it on GitHub ↗</a></div>
        </section>

        <section id="promote" className="promotion-section">
          <div><span>03 / PROMOTION REVIEW</span><h2>Move the conclusion.<br/>Keep the evidence trail.</h2></div>
          <ol>{promotionRules.map((rule, index) => <li key={rule}><span>{String(index + 1).padStart(2, "0")}</span><p>{rule}</p></li>)}</ol>
          <div className="promotion-path"><span>DISCUSSION</span><i>→</i><span>REPRODUCTION</span><i>→</i><span>LOGIC REVIEW</span><i>→</i><span>BOOK CHAPTER</span></div>
        </section>
      </main>

      <footer className="discussion-footer"><div><b>TT•SIM DISCUSSION WORKBENCH</b><p>Provisional questions with explicit evidence gates.</p></div><a href="./DISCUSSION.md">Markdown inbox ↗</a><a href="./firmware-flow.html">Firmware flow →</a><a href="./index.html">Book →</a></footer>
    </div>
  );
}

export default DiscussionApp;
