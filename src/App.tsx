import { useEffect, useMemo, useState } from "react";

type CommandProps = { code: string; label?: string; shell?: "PowerShell" | "Ubuntu" };
type Theme = "dark" | "light";

const milestones = [
  ["m-wsl", "Open Ubuntu 22.04 in WSL2"],
  ["m-tools", "Install the build prerequisites"],
  ["m-metal", "Build TT-Metalium from source"],
  ["m-sim", "Stage the Wormhole simulator"],
  ["m-smoke", "Pass the RISC-V smoke test"],
  ["m-notes", "Record the first experiment"],
] as const;

const chapterGroups = [
  {
    label: "Orientation",
    chapters: [
      { id: "top", number: "00", title: "Cover & execution path", note: "Start here" },
      { id: "machine", number: "01", title: "Machine audit", note: "Check the runway" },
    ],
  },
  {
    label: "Build the lab",
    chapters: [
      { id: "setup", number: "02", title: "Deployment plan", note: "Install and verify" },
      { id: "verified", number: "02A", title: "Verified Blackhole run", note: "Read the real log" },
      { id: "experiments", number: "03", title: "Six experiments", note: "Learn by changing" },
    ],
  },
  {
    label: "Observe the machine",
    chapters: [
      { id: "debug", number: "04", title: "Mechanism debugger", note: "Follow one value" },
      { id: "notebook", number: "05", title: "Evidence notebook", note: "Record each result" },
    ],
  },
  {
    label: "Reference shelf",
    chapters: [
      { id: "docs", number: "06", title: "Documentation", note: "Read in order" },
      { id: "sources", number: "07", title: "Source map", note: "Verify upstream" },
    ],
  },
] as const;

const chapterIds = chapterGroups.flatMap((group) => group.chapters.map((chapter) => chapter.id));

const blackholeSignals = [
  { kind: "pass", label: "PASS", signal: "TTSimTTDevice … device_id=0xb140", meaning: "TT-Metal loaded the Blackhole simulator and identified the virtual device." },
  { kind: "expected", label: "EXPECTED", signal: "Disabling multi-erisc mode with simulator/emule target device", meaning: "The simulator intentionally uses one Ethernet RISC instead of Blackhole dual-ERISC mode." },
  { kind: "benign", label: "BENIGN", signal: "Board unknown expects 0 units … mask indicates 2 units", meaning: "UMD cannot assign a physical board type to the simulated chip; the selected Blackhole descriptor is still correct." },
  { kind: "expected", label: "EXPECTED", signal: "Dispatch telemetry SMC buffer unavailable", meaning: "A simulator has no physical firmware information provider or SMC telemetry buffer." },
  { kind: "pass", label: "PASS", signal: "Success: Result is 21", meaning: "Host dispatch, JIT compilation, BRISC execution and the returned value all passed." },
  { kind: "info", label: "INFO", signal: "JIT cache stats: 0/9 hits", meaning: "The first run compiled nine artifacts. Later identical runs may reuse the cache." },
  { kind: "info", label: "INFO", signal: "[6669] 0.3 seconds (24.6 KHz)", meaning: "Simulator throughput only—never interpret it as Blackhole silicon performance." },
] as const;

const labs = [
  {
    id: "lab-1",
    number: "01",
    title: "Boot the virtual BRISC",
    level: "10 min · first signal",
    idea: "Prove the host program, dispatch path, RISC-V kernel and simulated device all agree on one result.",
    hypothesis: "The simulator will return 21 without any /dev/tenstorrent device.",
    command: "./build/programming_examples/metal_example_add_2_integers_in_riscv",
    expected: "Success: Result is 21",
    variation: "Find the example source, change one input constant, rebuild only that target, and predict the new result before running it.",
  },
  {
    id: "lab-2",
    number: "02",
    title: "Talk to a compute core",
    level: "15 min · core roles",
    idea: "Separate the data-movement RISC-V path from the TRISC compute path.",
    hypothesis: "A compute kernel will announce core (0,0), then the host will acknowledge completion.",
    command: "./build/programming_examples/metal_example_hello_world_compute_kernel",
    expected: "Hello, Core (0, 0) on Device 0 … completed task.",
    variation: "Run the data-movement hello-world example next. Note which RISC-V role changed and which host code stayed the same.",
  },
  {
    id: "lab-3",
    number: "03",
    title: "Operate on a tile",
    level: "20 min · data layout",
    idea: "A Tenstorrent tile contains 32×32 values—1,024 values moving as one unit.",
    hypothesis: "Elementwise binary math will pass for every element in one tile.",
    command: "./build/programming_examples/metal_example_eltwise_binary",
    expected: "Test Passed",
    variation: "Trace the tensor shape and data format. Sketch where host memory, DRAM, circular buffers and the compute engine participate.",
  },
  {
    id: "lab-4",
    number: "04",
    title: "Run one-core matmul",
    level: "25 min · transformer primitive",
    idea: "Connect tile movement to the matrix multiplication at the center of transformer inference.",
    hypothesis: "The golden comparison will clear its correlation threshold and the test will pass.",
    command: "./build/programming_examples/metal_example_matmul_single_core",
    expected: "Metalium vs Golden — PCC reported; Test Passed",
    variation: "Change only one matrix dimension. Record build time, simulator time and output size—but do not treat simulator time as silicon performance.",
  },
  {
    id: "lab-5",
    number: "05",
    title: "Observe the observer effect",
    level: "20 min · debug instrumentation",
    idea: "Device print is selected at kernel compile time, so observing a kernel changes the binary being tested.",
    hypothesis: "The second run prints from BRISC; the first run does not.",
    command: "./build/programming_examples/metal_example_hello_world_datamovement_kernel\nexport TT_METAL_DPRINT_CORES=0,0\nexport TT_METAL_DPRINT_RISCVS=BR\n./build/programming_examples/metal_example_hello_world_datamovement_kernel",
    expected: "Extra device-side output appears only after DPRINT is enabled.",
    variation: "Unset the variables, then target a different RISC-V role. Write down exactly when a rebuild happens.",
  },
  {
    id: "lab-6",
    number: "06",
    title: "Switch the virtual chip",
    level: "20 min · architecture contrast",
    idea: "Run the same host program against Blackhole by swapping the simulator library and matching SoC descriptor.",
    hypothesis: "The same simple RISC-V example passes on both architecture models.",
    command: "cp $TT_METAL_HOME/tt_metal/soc_descriptors/blackhole_140_arch.yaml ~/sim/soc_descriptor.yaml\nexport TT_METAL_SIMULATOR=~/sim/libttsim_bh.so\n./build/programming_examples/metal_example_add_2_integers_in_riscv",
    expected: "Success on Blackhole; no source change to the host example.",
    variation: "Diff the Wormhole and Blackhole SoC descriptors. List three topology differences before moving to architecture-specific kernels.",
  },
] as const;

const docTracks = [
  {
    id: "start",
    label: "Start here",
    eyebrow: "Orientation",
    title: "Understand the simulator before changing code.",
    items: [
      { title: "ttsim README", source: "tenstorrent/ttsim", tag: "Setup", description: "Supported hosts and architectures, release libraries, source builds and TT-Metal integration.", url: "https://github.com/tenstorrent/ttsim" },
      { title: "Latest ttsim release", source: "GitHub Releases", tag: "Versions", description: "Download current architecture-specific libraries and read release notes before choosing a pin.", url: "https://github.com/tenstorrent/ttsim/releases/latest" },
      { title: "Simulator FAQ", source: "Tenstorrent Lessons", tag: "Limits", description: "What ttsim is good for—and why simulator runtime is not a silicon performance result.", url: "https://docs.tenstorrent.com/tt-vscode-toolkit/faq/" },
      { title: "Twenty-and-Ten experiments", source: "Tenstorrent Lessons", tag: "Hands-on", description: "A broad official catalog of small tests, debug features and architecture explorations.", url: "https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/ttsim-twenty-and-ten/" },
    ],
  },
  {
    id: "build",
    label: "Build & test",
    eyebrow: "Kernel practice",
    title: "Move from examples to controlled experiments.",
    items: [
      { title: "TT-Metalium getting started", source: "TT-Metal docs", tag: "Concepts", description: "The host-to-device pipeline and the reader, compute and writer kernel roles.", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/get_started/get_started.html" },
      { title: "Programming examples", source: "TT-Metal docs", tag: "Examples", description: "DRAM loopback, elementwise operations, SFPU work and single- or multi-core matmul.", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/examples/index.html" },
      { title: "Metalium lab exercises", source: "TT-Metal docs", tag: "Labs", description: "Guided matmul, multicast, DPRINT, debugging and profiling exercises to adapt for ttsim.", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/index.html" },
      { title: "Explore TT-Metalium", source: "Tenstorrent Lessons", tag: "Map", description: "A tour of the example levels and the source tree when you are ready to leave the happy path.", url: "https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/explore-metalium/" },
    ],
  },
  {
    id: "debug",
    label: "Debug closely",
    eyebrow: "Mechanism tracing",
    title: "Observe one boundary at a time.",
    items: [
      { title: "Debug facilities lab", source: "TT-Metal docs", tag: "Workflow", description: "Host GDB, kernel DPRINT, hang diagnosis and profiling in one guided Metalium lab.", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/matmul/lab1/lab1.html" },
      { title: "Device Debug Print", source: "TT-Metal tools", tag: "Kernel", description: "Filter one logical core and RISC, then print variables, addresses and circular-buffer data.", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_print.html" },
      { title: "Debug Checkpoints", source: "TT-Metal tools", tag: "Pipeline", description: "Synchronize active RISCs and inspect a consistent snapshot of CB pointers, L1 and destination data.", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/checkpoint.html" },
      { title: "Watcher", source: "TT-Metal tools", tag: "Hangs", description: "Waypoints, assertions, NoC sanitization and per-RISC state for locating a stalled mechanism.", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/watcher.html" },
      { title: "NOC Debug Dump", source: "TT-Metal tools", tag: "Ordering", description: "Experimental transaction tracing for issues such as a missing asynchronous write barrier.", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/noc_debug_dump.html" },
      { title: "ttsim error handling", source: "ttsim docs", tag: "Failures", description: "Interpret strict simulator exits and isolate experiments so one failure does not stop the full test run.", url: "https://github.com/tenstorrent/ttsim/blob/main/docs/sim_error_handling.md" },
    ],
  },
  {
    id: "internals",
    label: "Go deeper",
    eyebrow: "Simulator internals",
    title: "Learn the boundaries behind the virtual device.",
    items: [
      { title: "libttsim API and ABI", source: "ttsim docs", tag: "Contract", description: "Lifecycle, DMA callbacks, PCI configuration, BAR memory, clocks and compatibility policy.", url: "https://github.com/tenstorrent/ttsim/blob/main/docs/libttsim_api.md" },
      { title: "Simulator error handling", source: "ttsim docs", tag: "Debug", description: "How strict simulator failures are classified, why processes terminate, and how to isolate tests.", url: "https://github.com/tenstorrent/ttsim/blob/main/docs/sim_error_handling.md" },
      { title: "Unsupported functionality", source: "ttsim docs", tag: "Scope", description: "The upstream record of deliberately unsupported behavior and where to check before filing a bug.", url: "https://github.com/tenstorrent/ttsim/blob/main/docs/unsupported_functionality.md" },
      { title: "Metalium advanced topics", source: "TT-Metal docs", tag: "Architecture", description: "Tiles, NoC memory addressing, Tensix compute engines, data flow and FP32 accuracy.", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/index.html" },
      { title: "Wormhole and Blackhole ISA", source: "tt-isa-documentation", tag: "Low level", description: "Architecture-specific instruction references; never assume the two instruction sets are identical.", url: "https://github.com/tenstorrent/tt-isa-documentation" },
      { title: "ttsim QEMU Bridge", source: "Tenstorrent Lessons", tag: "Advanced", description: "Add the kernel-driver boundary after the shared-library workflow is familiar.", url: "https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/ttsim-qemu-bridge/" },
    ],
  },
] as const;

const debugLayers = [
  {
    number: "01",
    title: "Host creates the experiment",
    processor: "Host C++ · before dispatch",
    tool: "GDB + Inspector",
    question: "Were buffers, kernels, core ranges and runtime arguments assembled correctly?",
    observe: "Step through host-side program construction and enqueue calls. Inspector records host-runtime facts that can remain available after the process exits.",
    lookFor: "Wrong buffer sizes, stale compile-time arguments, incorrect core selection, or a missing synchronization call on the host.",
    command: "./build_metal.sh --build-type Debug\ngdb --args ./build/programming_examples/metal_example_eltwise_binary",
    references: [
      { kind: "Read first", label: "Single-core matmul debugging lab", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/matmul/lab1/lab1.html" },
      { kind: "Host state", label: "Inspector", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/inspector.html" },
      { kind: "After failure", label: "tt-triage", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/triage.html" },
    ],
  },
  {
    number: "02",
    title: "Reader moves input",
    processor: "BRISC / NCRISC · data movement",
    tool: "DPRINT one RISC",
    question: "Did the data-movement kernel receive the right addresses and move the expected number of bytes?",
    observe: "Select one logical core and one RISC. Print runtime arguments, NoC addresses, transfer sizes and phase markers around reserve, transfer, barrier and push calls.",
    lookFor: "A bad address, wrong byte count, missing NoC barrier, or circular-buffer production that never becomes visible to compute.",
    command: "export TT_METAL_DPRINT_CORES=0,0\nexport TT_METAL_DPRINT_RISCVS=BR\nexport TT_METAL_DPRINT_ONE_FILE_PER_RISC=1\n./build/programming_examples/metal_example_eltwise_binary",
    references: [
      { kind: "Read first", label: "Device Debug Print", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_print.html" },
      { kind: "ttsim example", label: "Twenty-and-Ten: DPRINT experiment", url: "https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/ttsim-twenty-and-ten/#the-kernel-that-runs-when-you-re-watching-is-not-the-kernel-that-runs-when-you-re-not" },
      { kind: "RISC-V map", label: "Tenstorrent RISC-V guide", url: "https://docs.tenstorrent.com/tt-vscode-toolkit/riscv-guide/" },
    ],
  },
  {
    number: "03",
    title: "Circular buffer hands data across",
    processor: "CB + L1 · pipeline boundary",
    tool: "Checkpoint + dump",
    question: "Do producer and consumer RISCs agree on read pointers, write pointers and tile counts at the same instant?",
    observe: "Place the same named checkpoint in every active kernel on the core. The barrier stops all participating RISCs, then reports CB metadata before allowing them to continue.",
    lookFor: "A write pointer that did not advance, a read pointer that advanced too early, or mismatched tiles received and acknowledged.",
    command: "export TT_METAL_CHECKPOINT=1\nexport TT_METAL_DPRINT_CORES=0,0\nrm -rf ~/.cache/tt-metal-cache\n# Add DEBUG_CHECKPOINT(\"after_read\") to every active kernel.",
    references: [
      { kind: "Read first", label: "Debug Checkpoints", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/checkpoint.html" },
      { kind: "Memory model", label: "Memory for kernel developers", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/memory_for_kernel_developers.html" },
      { kind: "Data layout", label: "Tiles", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/tiles.html" },
    ],
  },
  {
    number: "04",
    title: "Unpack, math and pack transform it",
    processor: "TRISC0 → TRISC1 → TRISC2",
    tool: "DPRINT by compute role",
    question: "At which compute stage does the first incorrect value appear?",
    observe: "Run three separate instrumented passes: TR0 for unpack, TR1 for math and TR2 for pack. Compare a tiny slice rather than printing a full tile.",
    lookFor: "The last correct stage. That boundary narrows the bug to data format/unpack, the math operation, or packing/output layout.",
    command: "export TT_METAL_DPRINT_CORES=0,0\nexport TT_METAL_DPRINT_RISCVS=TR0  # repeat with TR1, then TR2\n./build/programming_examples/metal_example_eltwise_binary",
    references: [
      { kind: "Read first", label: "Compute engines and Tensix data flow", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.html" },
      { kind: "Observe values", label: "Device Debug Print", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_print.html" },
      { kind: "Low level", label: "Wormhole and Blackhole ISA docs", url: "https://github.com/tenstorrent/tt-isa-documentation" },
    ],
  },
  {
    number: "05",
    title: "NoC ordering either completes or hangs",
    processor: "NoC + barriers · synchronization",
    tool: "Simulator errors → Watcher",
    question: "Is a RISC waiting for data that was never published, or issuing an invalid transaction?",
    observe: "Start with ttsim’s strict error and DPRINT trail. If supported by the current TT-Metal/ttsim pair, use Watcher waypoints or a separate NOC Debug Dump run.",
    lookFor: "Missing read/write barriers, invalid coordinates, circular-buffer overflow, or two RISCs waiting on each other.",
    command: "unset TT_METAL_DPRINT_CORES TT_METAL_DEVICE_PROFILER\nexport TT_METAL_WATCHER=120\n./build/programming_examples/metal_example_eltwise_binary\n# Run NOC Debug Dump separately; do not combine the tools.",
    references: [
      { kind: "Read first", label: "Watcher", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/watcher.html" },
      { kind: "NoC ordering", label: "NOC Debug Dump", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/noc_debug_dump.html" },
      { kind: "Simulator exit", label: "ttsim error handling", url: "https://github.com/tenstorrent/ttsim/blob/main/docs/sim_error_handling.md" },
    ],
  },
  {
    number: "06",
    title: "Timeline explains the sequence",
    processor: "Host + device scopes · chronology",
    tool: "Device Profiler / Tracy",
    question: "Which mechanism began, waited and completed—and in what order?",
    observe: "Add a small number of named device zones and view their chronology beside host scopes. Disable DPRINT, Watcher and NoC dump first because the tools compete for kernel resources.",
    lookFor: "Unexpected gaps, repeated launches, or scope ordering. Never interpret ttsim wall time or cycle timing as silicon performance.",
    command: "unset TT_METAL_DPRINT_CORES TT_METAL_WATCHER TT_METAL_NOC_DEBUG_DUMP\nTT_METAL_DEVICE_PROFILER=1 ./build/programming_examples/metal_example_eltwise_binary",
    references: [
      { kind: "Read first", label: "Device Program Profiler", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_program_profiler.html" },
      { kind: "Host timeline", label: "Tracy Profiler", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/tracy_profiler.html" },
      { kind: "All tools", label: "TT-Metalium debugging tools index", url: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/index.html" },
    ],
  },
] as const;

function Command({ code, label, shell = "Ubuntu" }: CommandProps) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div className="command">
      <div className="command-head">
        <span>{label ?? shell}</span>
        <button type="button" onClick={copy} aria-label={`Copy ${label ?? shell} command`}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function App() {
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("ttsim-progress") ?? "{}"); } catch { return {}; }
  });
  const [activeLab, setActiveLab] = useState(0);
  const [activeDebugLayer, setActiveDebugLayer] = useState(0);
  const [activeDocTrack, setActiveDocTrack] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [activeChapter, setActiveChapter] = useState("top");
  const [readingProgress, setReadingProgress] = useState(0);
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === "light" ? "light" : "dark");

  useEffect(() => localStorage.setItem("ttsim-progress", JSON.stringify(done)), [done]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ttsim-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#07110f" : "#f7f3e8");
  }, [theme]);
  useEffect(() => {
    const sections = chapterIds.map((id) => document.getElementById(id)).filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]?.target.id) setActiveChapter(visible[0].target.id);
    }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.1, 0.35] });
    sections.forEach((section) => observer.observe(section));
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setReadingProgress(scrollable > 0 ? Math.min(100, Math.max(0, Math.round((window.scrollY / scrollable) * 100))) : 0);
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);
  const complete = useMemo(() => milestones.filter(([id]) => done[id]).length, [done]);
  const progress = Math.round((complete / milestones.length) * 100);

  function toggle(id: string) {
    setDone((current) => ({ ...current, [id]: !current[id] }));
  }

  const lab = labs[activeLab];
  const debugLayer = debugLayers[activeDebugLayer];
  const docTrack = docTracks[activeDocTrack];
  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="TT Sim Lab home"><span>TT</span><i>•</i>SIM LAB</a>
        <button className="chapters-button" type="button" onClick={() => setChaptersOpen(!chaptersOpen)} aria-expanded={chaptersOpen} aria-controls="book-sidebar"><span aria-hidden="true">☰</span> Chapters</button>
        <button className="menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>Index</button>
        <nav className={menuOpen ? "topnav open" : "topnav"} aria-label="Primary">
          <a href="#machine">Machine</a><a href="#setup">Setup</a><a href="#experiments">Experiments</a><a href="#debug">Debug</a><a href="#docs">Docs</a>
          <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-pressed={theme === "light"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><span aria-hidden="true">◐</span><small>{theme === "dark" ? "Light" : "Dark"}</small></button>
          <a className="repo-link" href="https://github.com/buicongnguyen/tt-sim">GitHub ↗</a>
        </nav>
      </header>

      <div className={chaptersOpen ? "book-layout chapters-open" : "book-layout"}>
        <button className="chapter-scrim" type="button" aria-label="Close chapter navigation" onClick={() => setChaptersOpen(false)} />
        <aside className="book-sidebar" id="book-sidebar" aria-label="TT Sim Lab chapters">
          <div className="book-sidebar-head">
            <p className="eyebrow">TT•SIM field guide</p>
            <h2>Build, observe,<br/>understand.</h2>
            <p>Follow the chapters in order, or jump back to the mechanism you are testing.</p>
          </div>
          <div className="book-progress" aria-label={`${readingProgress}% of guide read`}><div><span>Reading progress</span><strong>{readingProgress}%</strong></div><div><i style={{width: `${readingProgress}%`}} /></div></div>
          <nav className="chapter-nav" aria-label="Book contents">
            {chapterGroups.map((group) => <div className="chapter-group" key={group.label}><h3>{group.label}</h3>{group.chapters.map((chapter) => <a key={chapter.id} href={`#${chapter.id}`} className={activeChapter === chapter.id ? "active" : ""} aria-current={activeChapter === chapter.id ? "location" : undefined} onClick={() => setChaptersOpen(false)}><span>{chapter.number}</span><div><strong>{chapter.title}</strong><small>{chapter.note}</small></div></a>)}</div>)}
          </nav>
          <div className="sidebar-shelf"><span>Keep beside the terminal</span><a href="./TTSIM_DEBUGGING_PATH.md">Debugging playbook <i>↗</i></a><a href="./TTSIM_READING_PATH.md">Reading path <i>↗</i></a></div>
        </aside>

        <main>
        <section id="top" className="hero section-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span>Field guide 001</span><span>Updated 16 Aug 2026</span></p>
            <h1>Build a chip lab.<br/><em>Skip the chip.</em></h1>
            <p className="lede">A machine-specific path from Windows to your first Tenstorrent kernel—using the official <code>ttsim</code>, Ubuntu 22.04 on WSL2, and no accelerator hardware.</p>
            <div className="hero-actions"><a className="button primary" href="#setup">Start the setup</a><a className="button secondary" href="#experiments">See the labs</a></div>
            <div className="hero-meta"><span>6 focused experiments</span><span>~60–90 min setup</span><span>Hardware: none</span></div>
          </div>
          <div className="signal-card" aria-label="Execution path from Windows host to virtual Tenstorrent chip">
            <div className="signal-head"><span>Execution path</span><span className="live-dot">planned</span></div>
            <div className="signal-flow">
              <div><b>01</b><strong>Windows 11</strong><small>host</small></div><i>→</i>
              <div><b>02</b><strong>WSL2</strong><small>Ubuntu 22.04</small></div><i>→</i>
              <div><b>03</b><strong>TT-Metal</strong><small>host + kernels</small></div><i>→</i>
              <div className="hot"><b>04</b><strong>libttsim</strong><small>virtual Wormhole</small></div>
            </div>
            <div className="chip-grid" aria-hidden="true">{Array.from({length: 24}, (_, i) => <span key={i} className={i === 9 || i === 10 || i === 15 ? "active" : ""} />)}</div>
            <p><span>Target</span><code>metal_example_add_2_integers_in_riscv</code></p>
          </div>
        </section>

        <section className="clarifier band">
          <span className="band-number">00</span>
          <div><p className="eyebrow">Name collision, resolved</p><h2>This guide uses <code>tenstorrent/ttsim</code>.</h2></div>
          <p>Tenstorrent’s official C++ full-system simulator loads into TT-Metalium as a shared library. The similarly named <code>mesham/tt-sim</code> is a useful community Python simulator, but it is a different project and workflow.</p>
        </section>

        <section id="machine" className="content-section">
          <div className="section-heading"><span>01 / Machine audit</span><h2>Your WSL runway is already here.</h2><p>Read-only checks on this PC found a capable base. The missing compiler tools are expected and are installed during setup.</p></div>
          <div className="machine-grid">
            <article><small>Distro</small><strong>Ubuntu 22.04.5 LTS</strong><span className="status good">installed</span></article>
            <article><small>Virtualization</small><strong>WSL2 · x86_64</strong><span className="status good">correct target</span></article>
            <article><small>Compute</small><strong>28 logical CPUs</strong><span>good build parallelism</span></article>
            <article><small>Memory</small><strong>15 GiB + 4 GiB swap</strong><span>workable; avoid other heavy jobs</span></article>
            <article><small>WSL disk</small><strong>942 GiB free</strong><span className="status good">ample headroom</span></article>
            <article><small>Toolchain</small><strong>TT-Metal built</strong><span className="status good">Blackhole smoke test passed</span></article>
          </div>
          <div className="note machine-note"><b>One Windows fix:</b> Docker Desktop is currently the default WSL distro. Make Ubuntu the default so plain <code>wsl</code> opens the lab environment.</div>
          <Command shell="PowerShell" code="wsl --set-default Ubuntu-22.04\nwsl -d Ubuntu-22.04" />
        </section>

        <section id="setup" className="content-section setup-section">
          <div className="section-heading"><span>02 / Deployment plan</span><h2>Four layers. One known-good signal.</h2><p>Run Windows commands in PowerShell and everything else inside Ubuntu. Keep repositories in the WSL filesystem (<code>~/src</code>), not under <code>/mnt/c</code>, for better build performance.</p></div>
          <div className="steps">
            <article className="step"><div className="step-index">A</div><div className="step-body"><p className="eyebrow">Preflight · 5 min</p><h3>Prepare Ubuntu and basic build tools</h3><p>Update packages and install the small toolchain needed before Tenstorrent’s own dependency script takes over.</p><Command code="sudo apt update\nsudo apt install -y build-essential git git-lfs cmake ninja-build python3-venv wget ccache\ngit lfs install\nmkdir -p ~/src ~/sim" /><label className="check"><input type="checkbox" checked={!!done["m-tools"]} onChange={() => toggle("m-tools")} /><span>Prerequisites installed</span></label></div></article>
            <article className="step"><div className="step-index">B</div><div className="step-body"><p className="eyebrow">TT-Metalium · 30–60+ min</p><h3>Clone with SSH, then build from source</h3><p>The source path is required for kernel examples. This machine’s GitHub SSH key is already authenticated as <code>buicongnguyen</code>. Limit parallel compilation because WSL exposes 28 CPUs but has 15 GiB RAM.</p><Command code="cd ~/src\ngit clone --recurse-submodules git@github.com:tenstorrent/tt-metal.git\ncd tt-metal\nsudo ./install_dependencies.sh\nCMAKE_BUILD_PARALLEL_LEVEL=8 ./build_metal.sh \\\n  --enable-ccache \\\n  --build-programming-examples \\\n  --without-distributed\nexport TT_METAL_HOME=$PWD" /><div className="note"><b>Checkpoint:</b> stay on one TT-Metal commit while learning. Record <code>git rev-parse HEAD</code> in your lab notes so results are reproducible. If compilation is killed for memory pressure, repeat with <code>CMAKE_BUILD_PARALLEL_LEVEL=4</code>.</div><label className="check"><input type="checkbox" checked={!!done["m-metal"]} onChange={() => toggle("m-metal")} /><span>TT-Metalium build completed</span></label></div></article>
            <article className="step"><div className="step-index">C</div><div className="step-body"><p className="eyebrow">ttsim · 5 min</p><h3>Stage the official simulator libraries</h3><p>Version <code>v1.10.0</code> was the latest release at research time. Pin it for reproducibility; if TT-Metal reports an ABI mismatch, use the simulator version required by that TT-Metal revision.</p><Command code="cd ~/sim\nTTSIM_VERSION=v1.10.0\nwget https://github.com/tenstorrent/ttsim/releases/download/${TTSIM_VERSION}/libttsim_wh.so\nwget https://github.com/tenstorrent/ttsim/releases/download/${TTSIM_VERSION}/libttsim_bh.so\ncp $TT_METAL_HOME/tt_metal/soc_descriptors/wormhole_b0_80_arch.yaml soc_descriptor.yaml\nfile libttsim_wh.so" /><label className="check"><input type="checkbox" checked={!!done["m-sim"]} onChange={() => toggle("m-sim")} /><span>Simulator libraries staged</span></label></div></article>
            <article className="step"><div className="step-index">D</div><div className="step-body"><p className="eyebrow">Activate + verify · 5 min</p><h3>Route TT-Metal into virtual Wormhole</h3><p>Slow dispatch is the recommended simulator path. SFPLOADMACRO is not supported, so disable it before running kernels.</p><Command code="export TT_METAL_SIMULATOR=~/sim/libttsim_wh.so\nexport TT_METAL_SLOW_DISPATCH_MODE=1\nexport TT_METAL_DISABLE_SFPLOADMACRO=1\ncd $TT_METAL_HOME\n./build/programming_examples/metal_example_add_2_integers_in_riscv" /><div className="expected"><small>Expected terminal signal</small><code>Success: Result is 21</code></div><label className="check"><input type="checkbox" checked={!!done["m-smoke"]} onChange={() => toggle("m-smoke")} /><span>Smoke test returned 21</span></label></div></article>
          </div>
        </section>

        <section id="verified" className="content-section verification-section">
          <div className="section-heading"><span>02A / Verified run</span><h2>A noisy terminal can still be a clean pass.</h2><p>This Blackhole smoke test ran successfully on this WSL2 machine on 16 August 2026. Treat the result line and clean shutdown as the verdict; classify simulator-only warnings instead of guessing.</p></div>
          <div className="verification-summary">
            <div className="verification-verdict"><span>Observed result</span><strong>PASS</strong><code>Success: Result is 21</code></div>
            <dl><div><dt>Architecture</dt><dd>Blackhole · device 0xb140</dd></div><div><dt>TT-Metal</dt><dd>50a82f83559</dd></div><div><dt>Revision</dt><dd>v0.77.0-dev20260815-5</dd></div><div><dt>UMD</dt><dd>9bbe7bc9</dd></div><div><dt>Host</dt><dd>WSL2 · Ubuntu 22.04.5 · x86_64</dd></div><div><dt>Descriptor</dt><dd>Exact blackhole_140_arch.yaml match</dd></div></dl>
          </div>
          <div className="verified-command"><Command label="Repeat the verified Blackhole run" code="cp $TT_METAL_HOME/tt_metal/soc_descriptors/blackhole_140_arch.yaml ~/sim/soc_descriptor.yaml\nexport TT_METAL_SIMULATOR=~/sim/libttsim_bh.so\nexport TT_METAL_SLOW_DISPATCH_MODE=1\nexport TT_METAL_DISABLE_SFPLOADMACRO=1\nexport TT_METAL_DPRINT_CORES=0,0  # optional kernel output\ncd $TT_METAL_HOME\n./build/programming_examples/metal_example_add_2_integers_in_riscv" /></div>
          <div className="signal-ledger" aria-label="Blackhole smoke test signal interpretation">
            {blackholeSignals.map((item) => <article key={item.signal} className={`signal-row ${item.kind}`}><span>{item.label}</span><code>{item.signal}</code><p>{item.meaning}</p></article>)}
          </div>
          <div className="verification-proof"><div><span>01</span><p><b>Library loaded.</b> TT-Metal opened a simulation device instead of searching for <code>/dev/tenstorrent</code>.</p></div><div><span>02</span><p><b>Correct architecture.</b> Device ID <code>0xb140</code> identifies the virtual Blackhole target.</p></div><div><span>03</span><p><b>Kernel executed.</b> The BRISC path returned the expected integer result.</p></div><div><span>04</span><p><b>Shutdown completed.</b> UMD closed the device and simulator without a fatal error.</p></div></div>
          <div className="verification-links"><p><b>Guide correction:</b> DPRINT, multi-ERISC, harvesting and SMC messages above are annotations—not failed assertions. The trailing KHz line is simulator throughput, not a silicon benchmark.</p><a href="./BLACKHOLE_SMOKE_TEST.md">Open the complete test record ↗</a></div>
        </section>

        <section className="content-section progress-section">
          <div className="progress-card"><div><p className="eyebrow">Local progress</p><strong>{progress}%</strong><span>{complete} of {milestones.length} milestones</span></div><div className="progress-track"><i style={{width: `${progress}%`}} /></div><div className="milestone-list">{milestones.map(([id, text]) => <label key={id} className="check"><input type="checkbox" checked={!!done[id]} onChange={() => toggle(id)} /><span>{text}</span></label>)}</div><button type="button" className="reset" onClick={() => setDone({})}>Reset progress</button></div>
          <div className="rules"><p className="eyebrow">Lab discipline</p><h3>Change one thing.</h3><ol><li>Write a prediction before the run.</li><li>Capture the exact commit, simulator version and command.</li><li>Change one variable only.</li><li>Compare output—not wall-clock speed.</li><li>Explain the result in your own words.</li></ol><div className="note danger"><b>Do not benchmark ttsim.</b> It is a correctness and learning model, not a silicon performance model.</div></div>
        </section>

        <section id="experiments" className="content-section labs-section">
          <div className="section-heading"><span>03 / Learn by doing</span><h2>Six experiments, increasing altitude.</h2><p>Each lab asks for a prediction, an observable result and one controlled variation. Your progress stays in this browser.</p></div>
          <div className="lab-layout">
            <div className="lab-tabs" role="tablist" aria-label="Experiments">{labs.map((item, index) => <button key={item.id} type="button" role="tab" aria-selected={activeLab === index} className={activeLab === index ? "active" : ""} onClick={() => setActiveLab(index)}><span>{item.number}</span><div><strong>{item.title}</strong><small>{item.level}</small></div></button>)}</div>
            <article className="lab-panel" role="tabpanel">
              <div className="lab-title"><span>{lab.number}</span><div><p className="eyebrow">{lab.level}</p><h3>{lab.title}</h3></div></div>
              <p className="lab-idea">{lab.idea}</p>
              <div className="experiment-grid"><div><small>Hypothesis</small><p>{lab.hypothesis}</p></div><div><small>Expected</small><p>{lab.expected}</p></div></div>
              <Command code={lab.command} label="Run from $TT_METAL_HOME" />
              <div className="variation"><small>Controlled variation</small><p>{lab.variation}</p></div>
              <label className="check lab-check"><input type="checkbox" checked={!!done[lab.id]} onChange={() => toggle(lab.id)} /><span>Experiment complete + notes recorded</span></label>
            </article>
          </div>
        </section>

        <section id="debug" className="content-section debug-section">
          <div className="section-heading"><span>04 / Mechanism debugger</span><h2>Follow one value through the machine.</h2><p>Start at the host and move down only after the current boundary is correct. Each pass instruments one mechanism, one core and one RISC role.</p></div>
          <div className="debug-guardrails"><div><span>01</span><p><b>Baseline first.</b> Save one uninstrumented passing or failing run before adding any tool.</p></div><div><span>02</span><p><b>One observer.</b> DPRINT, Watcher, Device Profiler and NoC dump must not be combined.</p></div><div><span>03</span><p><b>Sequence, not speed.</b> Instrumentation changes the kernel; ttsim timing is not silicon timing.</p></div></div>
          <div className="debug-layout">
            <div className="debug-tabs" role="tablist" aria-label="Debugging mechanisms">{debugLayers.map((item, index) => <button key={item.number} type="button" role="tab" aria-selected={activeDebugLayer === index} className={activeDebugLayer === index ? "active" : ""} onClick={() => setActiveDebugLayer(index)}><span>{item.number}</span><div><strong>{item.title}</strong><small>{item.processor}</small></div></button>)}</div>
            <article className="debug-panel" role="tabpanel">
              <div className="debug-title"><span>{debugLayer.number}</span><div><p className="eyebrow">{debugLayer.tool}</p><h3>{debugLayer.title}</h3><small>{debugLayer.processor}</small></div></div>
              <p className="debug-question">{debugLayer.question}</p>
              <div className="debug-evidence"><div><small>Observe</small><p>{debugLayer.observe}</p></div><div><small>Look for</small><p>{debugLayer.lookFor}</p></div></div>
              <Command code={debugLayer.command} label="Focused debug pass" />
              <div className="debug-references" aria-label={`References for ${debugLayer.title}`}><span>Read and follow</span><div>{debugLayer.references.map((reference, index) => <a key={reference.url} className={index === 0 ? "primary" : ""} href={reference.url}><small>{reference.kind}</small><strong>{reference.label}</strong><i>↗</i></a>)}</div></div>
            </article>
          </div>
          <div className="debug-playbook"><p><b>Important ttsim boundary:</b> use GDB for the host process. Device kernels are not ordinary host threads; follow them with DPRINT, checkpoints, asserts and state dumps. Support for hardware-oriented tools such as Watcher or NoC dump can vary with the TT-Metal and ttsim revision.</p><a href="./TTSIM_DEBUGGING_PATH.md">Open the complete debugging playbook ↗</a></div>
        </section>

        <section id="notebook" className="content-section notebook-section">
          <div className="section-heading"><span>05 / Evidence</span><h2>Keep a lab notebook Git can diff.</h2><p>One Markdown file per experiment is enough. The template forces the useful details without turning learning into paperwork.</p></div>
          <Command label="notes/01-riscv-smoke.md" code="# Experiment 01 — virtual BRISC\n\n- Date:\n- TT-Metal commit: `git rev-parse HEAD`\n- ttsim version: v1.10.0\n- Architecture: Wormhole\n- Hypothesis:\n- Command:\n- Observed output:\n- One controlled change:\n- Result vs prediction:\n- What I think happened:\n- Next question:" />
          <label className="check"><input type="checkbox" checked={!!done["m-notes"]} onChange={() => toggle("m-notes")} /><span>First lab note committed</span></label>
        </section>

        <section id="docs" className="content-section docs-section">
          <div className="section-heading"><span>06 / Documentation</span><h2>A reading path, not a link dump.</h2><p>These first-party references answer the questions that appear after the smoke test. Choose one track to keep the library compact.</p></div>
          <div className="reading-order" aria-label="Recommended documentation order"><span>Recommended order</span><ol><li>Run the smoke test</li><li>Read the API boundary</li><li>Adapt one Metalium lab</li><li>Open the ISA only when needed</li></ol></div>
          <div className="doc-library">
            <div className="doc-tabs" role="tablist" aria-label="Documentation tracks">
              {docTracks.map((track, index) => <button key={track.id} type="button" role="tab" aria-selected={activeDocTrack === index} className={activeDocTrack === index ? "active" : ""} onClick={() => setActiveDocTrack(index)}><span>0{index + 1}</span><strong>{track.label}</strong></button>)}
            </div>
            <div className="doc-panel" role="tabpanel">
              <div className="doc-panel-head"><div><p className="eyebrow">{docTrack.eyebrow}</p><h3>{docTrack.title}</h3></div><span>{docTrack.items.length} official references</span></div>
              <div className="doc-grid">
                {docTrack.items.map((item) => <a className="doc-card" key={item.title} href={item.url}><div><span>{item.tag}</span><i>↗</i></div><strong>{item.title}</strong><small>{item.source}</small><p>{item.description}</p></a>)}
              </div>
            </div>
          </div>
          <p className="offline-doc">Prefer a checklist? Open the <a href="./TTSIM_READING_PATH.md">standalone reading path ↗</a>.</p>
        </section>

        <section id="sources" className="content-section sources-section">
          <div className="section-heading"><span>07 / Source map</span><h2>Primary sources, not folklore.</h2><p>Commands, constraints and the verified Blackhole log were checked against upstream material on 16 August 2026. Follow upstream first when versions change.</p></div>
          <div className="source-grid">
            <a href="https://github.com/tenstorrent/ttsim"><span>01</span><div><strong>tenstorrent/ttsim</strong><p>Official source, builds, environment variables and known limitations.</p></div><i>↗</i></a>
            <a href="https://github.com/tenstorrent/ttsim/releases/latest"><span>02</span><div><strong>Latest ttsim release</strong><p>Prebuilt Wormhole, Blackhole and mesh libraries.</p></div><i>↗</i></a>
            <a href="https://github.com/tenstorrent/tt-metal"><span>03</span><div><strong>tenstorrent/tt-metal</strong><p>TT-Metalium host API, kernels, examples and build system.</p></div><i>↗</i></a>
            <a href="https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/ttsim-twenty-and-ten/"><span>04</span><div><strong>Twenty-and-Ten ttsim labs</strong><p>Official lesson with a broad catalog of simulator experiments.</p></div><i>↗</i></a>
            <a href="https://github.com/mesham/tt-sim"><span>05</span><div><strong>mesham/tt-sim</strong><p>The separate community Python architecture simulator, for comparison.</p></div><i>↗</i></a>
          </div>
        </section>
        </main>
      </div>
      <footer><a className="brand" href="#top"><span>TT</span><i>•</i>SIM LAB</a><p>Independent learning guide. Tenstorrent, Wormhole and Blackhole are referenced for educational purposes.</p><a href="https://github.com/buicongnguyen/tt-sim">Page source on GitHub ↗</a></footer>
    </div>
  );
}

export default App;
