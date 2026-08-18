import { useMemo, useState } from "react";

type Evidence = "VERIFIED" | "PERSONALIZE" | "MEASURE";

type ReferenceLink = { label: string; href: string };

type Slide = {
  id: string;
  minutes: number;
  section: string;
  title: string;
  headline: string;
  bullets: readonly string[];
  speakerNote: string;
  evidence: Evidence;
  sources: readonly ReferenceLink[];
};

const revision = "50a82f835593512c4176546b4af68d7e91315a86";
const sourceRoot = `https://github.com/tenstorrent/tt-metal/blob/${revision}`;
const officialDocs = {
  gettingStarted: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/get_started/get_started.html",
  tools: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/index.html",
  computeDataflow: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.html",
  linear: "https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/api/ttnn.linear.html",
} as const;

const slides: readonly Slide[] = [
  {
    id: "S01",
    minutes: 1,
    section: "OPEN",
    title: "Self-introduction — optional",
    headline: "I work at the boundary between compiler decisions, runtime control and device behavior.",
    bullets: [
      "[Name · current role · years/area of experience]",
      "Focus: NPU compiler/runtime, low-level kernels and systematic bring-up",
      "Today: one debugging case, one model-optimization project, and the engineering method behind both",
    ],
    speakerNote: "Keep this to identity, technical scope and the promise of the talk. If the panel already knows you, skip it and move the minute to Q&A.",
    evidence: "PERSONALIZE",
    sources: [
      { label: "TT-Metalium stack overview", href: officialDocs.gettingStarted },
    ],
  },
  {
    id: "S02",
    minutes: 2,
    section: "RESEARCH",
    title: "Research overview",
    headline: "My question is not only ‘is it fast?’—it is ‘which contract failed, and at which layer?’",
    bullets: [
      "Trace one operation from model graph → TTNN → TT-Metal program → RISC firmware → device kernel",
      "Turn a hang or regression into the first observable broken boundary",
      "Accept an optimization only when correctness, warm performance and reproducibility pass together",
    ],
    speakerNote: "State the research method first. It gives the audience a map for every later technical detail.",
    evidence: "VERIFIED",
    sources: [
      { label: "Host-to-RISC guide", href: "./firmware-flow.html" },
      { label: "TT-Metalium programming model", href: officialDocs.gettingStarted },
    ],
  },
  {
    id: "S03",
    minutes: 3,
    section: "RESEARCH",
    title: "System mental model",
    headline: "Cold firmware initialization and warm operation launch are different flows.",
    bullets: [
      "The host builds and places separate firmware images for the selected RISC roles",
      "BRISC programs subordinate reset PCs and releases NCRISC/TRISC initialization",
      "For an operation, dispatch delivers binaries/configuration/launch state; BRISC coordinates DM1 and TRISC starts",
    ],
    speakerNote: "Do not describe NCRISC as forwarding firmware to BRISC. The host places the images; BRISC is the coordinating firmware on the Tensix core.",
    evidence: "VERIFIED",
    sources: [
      { label: "Firmware initializer", href: `${sourceRoot}/tt_metal/impl/device/firmware/risc_firmware_initializer.cpp#L1143-L1199` },
      { label: "BRISC release sequence", href: `${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L181-L275` },
      { label: "Operation dispatch", href: `${sourceRoot}/tt_metal/impl/program/dispatch.cpp#L2355-L2422` },
    ],
  },
  {
    id: "S04",
    minutes: 3,
    section: "ACHIEVEMENT 01 · S/T",
    title: "Blackhole bring-up: situation and task",
    headline: "A mixed BRISC/NCRISC unit test hangs; the last symptom is not yet the root cause.",
    bullets: [
      "Situation: host launch succeeds, but one data-movement path does not complete",
      "Task: find the first broken boundary—build, load, launch handshake, entry, kernel body or completion",
      "Constraint: separate a remembered compiler suspicion from evidence available in current artifacts",
    ],
    speakerNote: "Use STAR language. If this is your historical project, replace the generic symptom with the exact test, board revision, compiler build and first failing waypoint.",
    evidence: "PERSONALIZE",
    sources: [
      { label: "Bring-up case and decision tree", href: "./discussion-blackhole-bringup.html" },
      { label: "Official debugging tools index", href: officialDocs.tools },
    ],
  },
  {
    id: "S05",
    minutes: 4,
    section: "ACHIEVEMENT 01 · A",
    title: "Action: isolate one boundary at a time",
    headline: "Compile success → ELF structure → delivered bytes → launch words → entry waypoint → completion.",
    bullets: [
      "Run DM0-only, DM1-only and combined one-core tests before the full workload",
      "Record Watcher waypoints and distinguish subordinate DM1 LOAD/GO from the launch-level GO mailbox",
      "Compare matched compiler A/B builds with identical preprocessed input, linker script and runtime state",
      "Inspect ELF headers, symbols/disassembly, load spans and device readback before blaming generated instructions",
    ],
    speakerNote: "The strength of the method is the stop condition at every rung. Each experiment must eliminate a class of causes, not merely add more logs.",
    evidence: "VERIFIED",
    sources: [
      { label: "BRISC operation flow", href: `${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L439-L488` },
      { label: "NCRISC operation flow", href: `${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/ncrisc.cc#L77-L192` },
      { label: "Watcher, DPRINT, Tracy and profiler", href: officialDocs.tools },
    ],
  },
  {
    id: "S06",
    minutes: 3,
    section: "ACHIEVEMENT 01 · R/L",
    title: "Result and learning",
    headline: "The durable result is an auditable diagnosis, not a confident guess about the compiler.",
    bullets: [
      "Delivered: a repeatable isolation ladder, binary evidence bundle and source-linked launch model",
      "Closure gate: the failing build diverges at a named boundary and the fixed build passes the same test matrix",
      "Learning: R without K and K without KD indicate different intervals; build success proves neither delivery nor entry",
    ],
    speakerNote: "Current repository evidence does not prove the historical third-party compiler root cause. Present that claim only after inserting your old/new binaries, compiler hashes, disassembly delta and regression result.",
    evidence: "PERSONALIZE",
    sources: [
      { label: "NCRISC wait and entry", href: `${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/ncrisc.cc#L77-L192` },
      { label: "Operation wrapper and kernel_main", href: `${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/ncrisck.cc#L38-L95` },
      { label: "Evidence bundle checklist", href: "./DISCUSSION_BLACKHOLE_BRINGUP.md" },
    ],
  },
  {
    id: "S07",
    minutes: 3,
    section: "ACHIEVEMENT 02 · S/T",
    title: "Transformer optimization: situation and task",
    headline: "The model runs, but ‘optimize the Transformer’ is too broad to be an executable task.",
    bullets: [
      "Situation: prefill and decode have different shapes, bottlenecks and service-level metrics",
      "Task: improve TTFT, prompt throughput or ms/token without crossing the quality budget",
      "Constraint: every proposed kernel change must first survive model-, layout- and runtime-level alternatives",
    ],
    speakerNote: "Name one real model, Blackhole SKU/mesh, prompt distribution and quality threshold here. Otherwise the result cannot be reproduced.",
    evidence: "PERSONALIZE",
    sources: [
      { label: "Transformer optimization chain", href: "./discussion-transformer-blackhole-optimization.html" },
      { label: "TTNN linear contract", href: officialDocs.linear },
    ],
  },
  {
    id: "S08",
    minutes: 4,
    section: "ACHIEVEMENT 02 · A",
    title: "Action: profile, route, then change",
    headline: "Correctness → warm profile → shapes → layouts → attention/MLP → precision → trace → kernel.",
    bullets: [
      "Prove one decoder block and separate warm prefill from warm decode",
      "Use the profile signature to choose host/runtime, memory layout, program config or kernel work",
      "Apply precision by tensor role: BF16 baseline, BFP8 attention/KV/weights, selected BFP4 MLP weights",
      "Change one variable per run and preserve an uncaptured fallback for unstable shapes",
    ],
    speakerNote: "Explain one rejected branch. A good optimization story includes why a tempting change was not the highest-leverage or safest intervention.",
    evidence: "VERIFIED",
    sources: [
      { label: "TT-Transformers precision policy", href: `${sourceRoot}/models/tt_transformers/tt/model_config.py#L128-L237` },
      { label: "Tensix compute dataflow", href: officialDocs.computeDataflow },
      { label: "Profiler and debugging tools", href: officialDocs.tools },
    ],
  },
  {
    id: "S09",
    minutes: 3,
    section: "ACHIEVEMENT 02 · R/L",
    title: "Result and learning",
    headline: "A speedup is credible only with a paired quality result and a warm end-to-end measurement.",
    bullets: [
      "[Insert baseline → final TTFT, prompt tokens/s, ms/token and user/aggregate tokens/s]",
      "[Insert quality gate: layer PCC, logits/token agreement and perplexity or task metric]",
      "[Insert causal evidence: reduced conversion/dispatch/DRAM traffic or improved hot-op time]",
      "Learning: smaller storage is an opportunity; only the measured system result is an achievement",
    ],
    speakerNote: "The repository intentionally leaves performance cells open. Replace every bracketed field with a run ID and exact configuration before presenting this as a completed speedup.",
    evidence: "MEASURE",
    sources: [
      { label: "Quantization decision page", href: "./discussion-quantization.html" },
      { label: "Device profiler reference", href: officialDocs.tools },
      { label: "BFP tile storage constants", href: `${sourceRoot}/tt_metal/api/tt-metalium/constants.hpp#L13-L21` },
    ],
  },
  {
    id: "S10",
    minutes: 1,
    section: "CLOSE",
    title: "What I contribute",
    headline: "I turn opaque accelerator failures into small, falsifiable experiments—and carry the evidence back up to model results.",
    bullets: [
      "Cross-layer ownership: compiler, runtime, firmware and kernel",
      "Evidence discipline: exact revision, artifact hashes, code anchors and regression gates",
      "Team impact: a diagnosis or optimization becomes repeatable by the next engineer",
    ],
    speakerNote: "End with the engineering value, not a list of tools. Then invite questions at the layer the interviewer cares about.",
    evidence: "PERSONALIZE",
    sources: [
      { label: "TT-Metalium stack and workflow", href: officialDocs.gettingStarted },
      { label: "Full presentation evidence note", href: "./DISCUSSION_PRESENTATION_30_MIN.md" },
    ],
  },
  {
    id: "S11",
    minutes: 3,
    section: "Q&A",
    title: "Reserve and route questions",
    headline: "Answer with: claim → evidence → limitation → next experiment.",
    bullets: [
      "Architecture question: draw the two launch flows and name the owning firmware/message",
      "Debug question: identify the first divergent waypoint and the artifact that proves it",
      "Performance question: state workload, warm-up, metric, quality gate and changed variable",
    ],
    speakerNote: "If self-introduction is skipped, use four minutes here. Keep each first answer under 45 seconds, then offer the deeper source path.",
    evidence: "VERIFIED",
    sources: [
      { label: "Firmware flow references", href: "./firmware-flow.html" },
      { label: "Official tools reference", href: officialDocs.tools },
      { label: "Official ttnn.linear reference", href: officialDocs.linear },
    ],
  },
] as const;

const questions = [
  ["Why do you say NCRISC does not call BRISC?", "They are independent RISC firmware loops. BRISC writes the shared subordinate DM1 LOAD/GO state; NCRISC polls it, prepares its operation kernel, executes it and writes DONE.", { label: "BRISC/NCRISC handshake", href: `${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L439-L488` }],
  ["What does R without K mean?", "R is a firmware waypoint before the operation wrapper. If K is absent, inspect the launch-level GO, entry PC/ELF and wrapper prologue. K without KD moves the search inside kernel_main or its waits.", { label: "NCRISC wrapper entry", href: `${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/ncrisck.cc#L38-L95` }],
  ["How would you prove a compiler root cause?", "Hold source, preprocessed input, linker script, runtime and device constant; change only compiler build. Compare ELF headers, disassembly and delivered bytes, then show the first runtime divergence and a regression pass after the fix.", { label: "Compiler A/B evidence plan", href: "./discussion-blackhole-bringup.html" }],
  ["Why not start with DPRINT everywhere?", "Watcher classifies the stalled RISC cheaply. DPRINT perturbs timing and can block. Add a small DPRINT only after the failing interval is known; use Tracy for timing and JTAG/GDB only when supported and necessary.", { label: "Official debugging tools", href: officialDocs.tools }],
  ["Why separate cold boot from operation launch?", "Cold boot installs persistent firmware and initializes cores. Operation launch delivers per-program binaries/configuration and a launch message. Mixing them leads to incorrect ownership and timing assumptions.", { label: "Host-to-RISC flow", href: "./firmware-flow.html" }],
  ["Why is BFP8 common instead of INT8 for the LLM path?", "The pinned TTNN linear contract directly supports BF16, BFP8_B, BFP4_B and FP32 tile tensors. INT8 exists lower in the stack, but generic linear does not expose it as a supported input contract.", { label: "Official ttnn.linear contract", href: officialDocs.linear }],
  ["What is the biggest quantization risk?", "Applying one dtype globally. Attention, KV cache, residual paths, MLP weights and accumulations have different error sensitivity, so the sweep and rollback unit must be a tensor role.", { label: "Per-role precision policy", href: `${sourceRoot}/models/tt_transformers/tt/model_config.py#L128-L237` }],
  ["How do you know a speedup is real?", "Same model, inputs, mesh, software revision, warm-up and quality gate; one changed variable; repeated warm measurements; and a profiler signature that explains the delta.", { label: "Device profiler reference", href: officialDocs.tools }],
] as const;

function formatSlide(slide: Slide) {
  return [
    `${slide.id} · ${slide.title} · ${slide.minutes} min`,
    slide.headline,
    "",
    ...slide.bullets.map((item) => `• ${item}`),
    "",
    `Speaker note: ${slide.speakerNote}`,
    `Evidence status: ${slide.evidence}`,
    "Backup / references:",
    ...slide.sources.map((source) => `- ${source.label}: ${source.href}`),
  ].filter(Boolean).join("\n");
}

function PresentationApp() {
  const [activeId, setActiveId] = useState("S01");
  const [copied, setCopied] = useState<string | null>(null);
  const active = useMemo(() => slides.find((slide) => slide.id === activeId) ?? slides[0], [activeId]);
  const totalMinutes = slides.reduce((sum, slide) => sum + slide.minutes, 0);

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1400);
  }

  return (
    <div className="deck-page">
      <header className="deck-topbar">
        <a className="deck-brand" href="./index.html"><b>TT•SIM</b><span>presentation room</span></a>
        <nav aria-label="Page navigation"><a href="#deck">Deck</a><a href="#boot">Boot flow</a><a href="#questions">Q&amp;A</a><a href="#review">Review</a><a className="deck-back" href="./discussion.html">← Discussion</a></nav>
      </header>

      <main>
        <section className="deck-hero">
          <div className="deck-hero-code"><span>DISCUSSION / 04</span><strong>30</strong><small>MINUTES</small></div>
          <div className="deck-hero-copy"><p>RESEARCH × ACHIEVEMENT × DEFENSIBLE Q&amp;A</p><h1>A talk you can<br/><em>defend</em><br/>from source.</h1><div><b>{slides.length} slides</b><b>{totalMinutes} minutes</b><b>2 project stories</b></div></div>
          <aside className="deck-hero-rule"><span>HONESTY GATE</span><h2>Verified facts stay.<br/>Personal claims get evidence.</h2><p>The current source proves the architecture and method. Bracketed personal results must be replaced with your artifacts and measurements.</p><a href="./DISCUSSION_PRESENTATION_30_MIN.md">Open copy-ready Markdown ↗</a></aside>
        </section>

        <section className="deck-thesis"><span>ONE-SENTENCE THESIS</span><p>I connect model-level goals to runtime and firmware evidence, then reduce an opaque NPU problem to the first falsifiable boundary.</p></section>

        <section id="deck" className="deck-section">
          <div className="deck-heading"><span>01 / RUN OF SHOW</span><h2>Copy a slide.<br/>Keep the proof.</h2><p>The timing includes a three-minute Q&amp;A reserve. Select any slide to copy its title, bullets, speaker note and evidence status into PowerPoint.</p></div>
          <div className="deck-workbench">
            <div className="deck-rail" role="tablist" aria-label="Presentation slides">
              {slides.map((slide) => <button key={slide.id} type="button" role="tab" aria-selected={slide.id === active.id} className={slide.id === active.id ? "active" : ""} onClick={() => setActiveId(slide.id)}><code>{slide.id}</code><span><b>{slide.title}</b><small>{slide.section}</small></span><i>{slide.minutes}m</i></button>)}
            </div>
            <article className="deck-slide-preview">
              <header><span>{active.section}</span><code>{active.evidence}</code></header>
              <small>{active.id} · {active.minutes} MIN</small>
              <h3>{active.title}</h3>
              <h4>{active.headline}</h4>
              <ul>{active.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
              <div className="deck-speaker"><b>SPEAKER NOTE</b><p>{active.speakerNote}</p></div>
              <div className="deck-sources"><b>BACKUP / REFERENCES</b><div>{active.sources.map((source) => <a key={source.href} href={source.href}>{source.label} ↗</a>)}</div></div>
              <footer><span>{active.sources.length} linked reference{active.sources.length === 1 ? "" : "s"}</span><button type="button" onClick={() => copy(formatSlide(active), active.id)}>{copied === active.id ? "COPIED" : "COPY SLIDE"}</button></footer>
            </article>
          </div>
          <button className="copy-all" type="button" onClick={() => copy(slides.map(formatSlide).join("\n\n---\n\n"), "ALL")}>{copied === "ALL" ? "DECK COPIED" : "COPY ALL SLIDES + NOTES"}</button>
        </section>

        <section id="boot" className="boot-section-deck">
          <div className="deck-heading light"><span>02 / TECHNICAL DIAGRAM</span><h2>Two flows,<br/>not one relay.</h2><p>Use the first row for cold initialization and the second for an operation. The diagrams are intentionally small enough for one slide.</p></div>
          <div className="boot-pair">
            <article><header><span>A</span><div><b>COLD FIRMWARE INITIALIZATION</b><p>Persistent setup · once per device/open</p></div></header><div className="boot-flow"><div><small>HOST</small><b>Build per-RISC firmware</b></div><i>→</i><div><small>HOST</small><b>Place images + INIT state</b></div><i>→</i><div><small>BRISC</small><b>Set PCs + release subordinates</b></div><i>→</i><div><small>ALL RISCs</small><b>Initialize + report done</b></div></div><footer><a href={`${sourceRoot}/tt_metal/jit_build/build_env_manager.cpp#L340-L383`}>Build ↗</a><a href={`${sourceRoot}/tt_metal/impl/device/firmware/risc_firmware_initializer.cpp#L1143-L1199`}>Place ↗</a><a href={`${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L181-L275`}>Release ↗</a><a href={`${sourceRoot}/tt_metal/impl/device/firmware/risc_firmware_initializer.cpp#L1500-L1532`}>Wait ↗</a></footer></article>
            <article><header><span>B</span><div><b>OPERATION LAUNCH</b><p>Per program · cached binaries may be reused</p></div></header><div className="boot-flow"><div><small>DISPATCH</small><b>Config + binaries + launch + GO</b></div><i>→</i><div><small>BRISC</small><b>DM1 LOAD + config</b></div><i>→</i><div><small>NCRISC / TRISC</small><b>Prepare, then GO</b></div><i>→</i><div><small>5 RISCs</small><b>Run kernels + DONE</b></div></div><footer><a href={`${sourceRoot}/tt_metal/impl/program/dispatch.cpp#L2355-L2422`}>Dispatch ↗</a><a href={`${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L439-L488`}>BRISC ↗</a><a href={`${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/ncrisc.cc#L77-L192`}>NCRISC ↗</a><a href={`${sourceRoot}/tt_metal/hw/firmware/src/tt-1xx/ncrisck.cc#L38-L95`}>Kernel wrapper ↗</a></footer></article>
          </div>
          <div className="boot-correction"><b>Say this:</b><p>“The host places separate images. BRISC coordinates shared launch state; NCRISC does not forward firmware to BRISC.”</p></div>
        </section>

        <section id="questions" className="question-section-deck">
          <div className="deck-heading"><span>03 / QUESTION BANK</span><h2>Short first answer.<br/>Deep proof ready.</h2><p>Lead with the conclusion, cite the boundary that proves it, state the limitation, and offer the next experiment.</p></div>
          <div className="question-grid-deck">{questions.map(([question, answer, source], index) => <article key={question}><span>Q{String(index + 1).padStart(2, "0")}</span><h3>{question}</h3><p>{answer}</p><a href={source.href}>{source.label} ↗</a></article>)}</div>
        </section>

        <section id="review" className="review-section-deck">
          <div className="deck-heading light"><span>04 / LOGIC REVIEW</span><h2>Five gates before<br/>you present.</h2><p>A technically correct slide can still fail if it overclaims ownership, causality or measured impact.</p></div>
          <div className="review-gates">
            <article><b>01 · OWNERSHIP</b><p>Replace “we” with your exact contribution and name the team-owned parts.</p></article>
            <article><b>02 · CAUSALITY</b><p>A changed compiler plus a passing test is correlation until the first divergent artifact or instruction is shown.</p></article>
            <article><b>03 · MEASUREMENT</b><p>Give workload, warm-up, repetitions, metric, quality gate and software/device revision.</p></article>
            <article><b>04 · ARCHITECTURE</b><p>Do not merge cold firmware initialization, persistent dispatch and per-operation execution.</p></article>
            <article><b>05 · TIME</b><p>Rehearse to 27 minutes and protect the three-minute question reserve.</p></article>
          </div>
          <div className="review-source"><span>PINNED SOURCE</span><code>{revision}</code><p>All TT-Metal anchors on this page were reviewed against the WSL checkout at this commit.</p></div>
        </section>
      </main>

      <footer className="deck-footer"><div><b>TT•SIM · DISCUSSION SUBPAGE 04</b><p>Source-backed 30-minute research and achievement presentation.</p></div><a href="./discussion-blackhole-bringup.html">Bring-up case →</a><a href="./discussion-transformer-blackhole-optimization.html">Transformer case →</a><a href="./discussion-quantization.html">Quantization →</a><a href="./discussion.html">Discussion →</a></footer>
    </div>
  );
}

export default PresentationApp;
