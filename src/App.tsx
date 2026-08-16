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
      { id: "sequences", number: "02B", title: "Simulation sequences", note: "Blackhole + Quasar" },
      { id: "architecture", number: "02C", title: "Quasar cluster anatomy", note: "Cluster ≠ device mesh" },
      { id: "generations", number: "02D", title: "Three generations", note: "Code-backed comparison" },
      { id: "experiments", number: "03", title: "Six experiments", note: "Learn by changing" },
      { id: "capstone", number: "03A", title: "Compiler/runtime capstone", note: "Eight experiments" },
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

type SequencePhase = "setup" | "runtime" | "data" | "verify" | "warning";
type SequenceEvent = {
  from: number;
  to: number;
  title: string;
  detail: string;
  phase: SequencePhase;
};

const blackholeActors = ["WSL Bash", "Host example", "TT-Metal runtime", "UMD + libttsim_bh", "Virtual DRAM / L1", "BRISC RISC-V", "Host verifier"];
const blackholeSequence: SequenceEvent[] = [
  { from: 0, to: 1, phase: "setup", title: "Launch the example", detail: "Environment selects libttsim_bh.so, Blackhole descriptor and slow dispatch." },
  { from: 1, to: 2, phase: "runtime", title: "Create UnitMesh(0)", detail: "The host asks for one logical device and obtains its FIFO mesh command queue." },
  { from: 2, to: 3, phase: "runtime", title: "Open simulation driver", detail: "TT-Metal chooses UMD's emulation path instead of a physical /dev/tenstorrent device." },
  { from: 3, to: 2, phase: "verify", title: "Identify virtual Blackhole", detail: "The observed device_id=0xb140 confirms that the Blackhole library and descriptor agree." },
  { from: 1, to: 4, phase: "data", title: "Allocate six 4-byte buffers", detail: "Three interleaved DRAM buffers plus three L1 staging buffers hold src0, src1 and dst." },
  { from: 1, to: 2, phase: "data", title: "Enqueue inputs 14 and 7", detail: "Two non-blocking writes enter the same FIFO command queue before the program." },
  { from: 1, to: 2, phase: "setup", title: "Create BRISC kernel", detail: "RISCV_0 on core (0,0) receives six runtime addresses: DRAM and L1 for both inputs and output." },
  { from: 2, to: 3, phase: "runtime", title: "JIT + enqueue workload", detail: "Firmware and kernel artifacts are compiled or reused, then slow dispatch submits the program." },
  { from: 3, to: 5, phase: "runtime", title: "Start BRISC kernel_main", detail: "The simulator advances virtual device state and executes the RISC-V data-movement kernel." },
  { from: 5, to: 4, phase: "data", title: "NoC read DRAM → L1", detail: "Both four-byte operands move into local L1; noc_async_read_barrier makes them usable." },
  { from: 4, to: 5, phase: "data", title: "Return operands 14 and 7", detail: "BRISC dereferences the two L1 addresses and performs ordinary RISC-V integer addition." },
  { from: 5, to: 4, phase: "data", title: "Store 21; publish to DRAM", detail: "load_blocking orders the L1 store, then NoC write plus barrier makes the result visible in DRAM." },
  { from: 1, to: 2, phase: "verify", title: "Blocking destination read", detail: "FIFO order guarantees the host read executes after the previously enqueued workload finishes." },
  { from: 4, to: 6, phase: "verify", title: "Return one uint32_t: 21", detail: "The verifier checks vector size == 1 and value == 21." },
  { from: 6, to: 3, phase: "verify", title: "PASS, then close", detail: "The host prints Success: Result is 21; UMD closes devices and TT-Sim reports throughput." },
];

const quasarActors = ["WSL Bash", "GoogleTest fixture", "TT-Metal / Metal 2", "UMD + libttsim_qsr", "DM + TRISC firmware", "L1D / L2 / TL1", "Assertion"];
const quasarSequence: SequenceEvent[] = [
  { from: 0, to: 1, phase: "setup", title: "Launch one filtered test", detail: "The shell selects libttsim_qsr.so, quasar_32_arch.yaml, slow dispatch and DPRINT core 0,0." },
  { from: 1, to: 2, phase: "runtime", title: "Request Quasar single-card fixture", detail: "The fixture creates one simulated mesh device because TT_METAL_SIMULATOR is present." },
  { from: 2, to: 3, phase: "runtime", title: "Open Quasar simulation", detail: "UMD creates TTSimTTDevice; observed device_id=0xfeed distinguishes this pre-silicon target." },
  { from: 3, to: 2, phase: "runtime", title: "Build 1×1 control plane", detail: "Auto-discovery produces a one-device mesh with no inter-mesh or intra-mesh links." },
  { from: 2, to: 4, phase: "setup", title: "JIT Quasar artifacts", detail: "A fresh cache compiles seven artifacts with legacy NOC V1 MMIO because NOC_API_V2 is disabled." },
  { from: 3, to: 4, phase: "runtime", title: "Release firmware from reset", detail: "DM0–DM7 initialize; sixteen TRISC hart IDs initialize across N0–N3." },
  { from: 4, to: 2, phase: "runtime", title: "Firmware waits for GO", detail: "DM0 reports readiness while TT-Metal finishes constructing the workload and runtime arguments." },
  { from: 1, to: 5, phase: "data", title: "Seed unreserved L1 with 0", detail: "WriteToDeviceL1 initializes four bytes at the HAL-selected address before kernel execution." },
  { from: 1, to: 2, phase: "setup", title: "Build ProgramSpec", detail: "simple_l1_write.cpp targets node (0,0), uses two DM threads, and binds address plus value 0x12345678." },
  { from: 2, to: 4, phase: "runtime", title: "Enqueue blocking workload", detail: "The command queue sends GO; the test waits until device execution completes." },
  { from: 4, to: 5, phase: "data", title: "CoreLocalMem store", detail: "The DM kernel writes 0x12345678 to the cacheable Quasar L1 address." },
  { from: 4, to: 5, phase: "data", title: "Flush L2 cache line", detail: "fence → write L2_FLUSH64 MMIO register → fence; dirty data becomes visible in TL1 node memory." },
  { from: 1, to: 5, phase: "verify", title: "Read four bytes from L1/TL1", detail: "ReadFromDeviceL1 fetches the same address after the blocking workload has completed." },
  { from: 5, to: 6, phase: "verify", title: "Return 0x12345678", detail: "ASSERT_EQ compares the observed uint32_t with the kernel argument." },
  { from: 6, to: 3, phase: "verify", title: "PASS, detach, close", detail: "GoogleTest reports one pass in 2329 ms; DPRINT detaches and UMD shuts down cleanly." },
];

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

const capstoneExperiments = [
  { number: "01", title: "DRAM loopback", layer: "Memory + NoC", scope: "Blackhole first", build: "Verified DRAM → L1 → DRAM copy with byte-for-byte host checking.", proof: "A corrupted byte fails; the trace names buffers, sizes and command order." },
  { number: "02", title: "Compute kernel", layer: "One compute target", scope: "Blackhole / supported Quasar", build: "One-tile elementwise add, then ReLU with negative, zero and positive inputs.", proof: "Every element matches a deterministic host oracle." },
  { number: "03", title: "Streaming pipeline", layer: "Reader → compute → writer", scope: "Blackhole runtime", build: "Three kernels joined by circular buffers with explicit reserve, wait, push and pop.", proof: "Producer and consumer tile counts balance at every boundary." },
  { number: "04", title: "Tiling explorer", layer: "Shape + layout", scope: "Target-aware planning", build: "Compare aligned, rectangular and padded M/N shapes without changing the operation.", proof: "Report logical/padded shapes, tile count, bytes moved and local-memory peak." },
  { number: "05", title: "Runtime executor", layer: "Allocation + dispatch", scope: "Blackhole runtime", build: "Typed buffers, a program-cache key and asynchronous enqueue dependencies.", proof: "The second run reuses the program while updating runtime arguments safely." },
  { number: "06", title: "MLIR fusion pass", layer: "Graph rewrite", scope: "Offline on any host", build: "Rewrite relu(add_bias(matmul(A, B), bias)) into fused_linear_relu.", proof: "Positive and negative IR tests cover shapes, types, bias and extra users." },
  { number: "07", title: "Memory planner", layer: "Bufferization", scope: "Offline + target model", build: "Linear-scan allocation from tensor lifetime intervals and target capacity.", proof: "No live buffers overlap; violations report peak bytes and the failed value." },
  { number: "08", title: "End-to-end compiler", layer: "Complete stack", scope: "Blackhole, then Quasar", build: "Graph → verified IR → fusion → layout → memory plan → Metalium execution.", proof: "One artifact directory proves correctness and counts allocations, dispatches and bytes." },
] as const;

const capstoneTargets = {
  blackhole: {
    label: "Blackhole",
    eyebrow: "Recommended runtime lane",
    title: "Exercise the complete host → kernel → oracle loop.",
    description: "Blackhole ttsim has the broader public execution surface. Start with official Metalium examples, preserve one passing baseline, then replace one mechanism at a time.",
    gate: "Advance: loopback passes byte-for-byte before adding compute.",
    command: "cd ~/src/tt-metal\nexport TT_METAL_SIMULATOR=~/sim/libttsim_bh.so\nexport TT_METAL_SLOW_DISPATCH_MODE=1\ncp tt_metal/soc_descriptors/blackhole_140_arch.yaml \\\n  ~/sim/soc_descriptor.yaml\n./build/programming_examples/metal_example_loopback",
  },
  quasar: {
    label: "Quasar",
    eyebrow: "Pre-silicon bring-up lane",
    title: "Prove memory and data movement before asking for matmul.",
    description: "Use the supported single-DM L1 write baseline, then vary byte patterns, addresses and transfer sizes. Keep MLIR fusion and lifetime analysis offline until the required target lowering and runtime features are public.",
    gate: "Hold: a parsed or fused graph does not prove Quasar device execution.",
    command: "cd ~/src/tt-metal\nexport TT_METAL_SIMULATOR=~/sim/libttsim_qsr.so\nexport TT_METAL_SLOW_DISPATCH_MODE=1\ncp tt_metal/soc_descriptors/quasar_32_arch.yaml \\\n  ~/sim/soc_descriptor.yaml\n./build/test/tt_metal/unit_tests_legacy \\\n  --gtest_filter=QuasarMeshDeviceSingleCardFixture.SingleDmL1Write",
  },
} as const;

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

const observabilityStatus = [
  {
    tone: "repair",
    badge: "FIX FIRST",
    title: "VS Code + GDB",
    evidence: "Ubuntu reports “gdb: command not found”. The active TT-Metal build is Release and has no DWARF line tables.",
    next: "Install GDB inside WSL and build tests into build-debug before setting host breakpoints.",
  },
  {
    tone: "verified",
    badge: "BH VERIFIED",
    title: "Watcher",
    evidence: "Blackhole attached, polled, wrote watcher.log and returned 21. Quasar stops at an unimplemented rv64_custom_0 instruction.",
    next: "Practice waypoints and hang diagnosis on Blackhole; keep Quasar on DPRINT for this pinned pair.",
  },
  {
    tone: "partial",
    badge: "PARTIAL",
    title: "Device Profiler",
    evidence: "Blackhole test_full_buffer passed, but profile_log_device.csv held two header lines and no TEST-FULL zones.",
    next: "Use Tracy for the ttsim host timeline; re-test device scopes on hardware or after upgrading the pair.",
  },
] as const;

const agentHostDeviceFlow = [
  { number: "01", boundary: "WSL agent", tool: "Codex / Claude", proof: "command -v resolves inside /home/n, not /mnt/c" },
  { number: "02", boundary: "Host test", tool: "GDB", proof: "backtrace, arguments, buffers and enqueue order" },
  { number: "03", boundary: "RTA + CRTA", tool: "GDB", proof: "serialized runtime and compile-time argument words" },
  { number: "04", boundary: "ELF → XIP pages", tool: "GDB + readelf", proof: "path, destination, length and binaries_data" },
  { number: "05", boundary: "Simulator startup", tool: "objdump + addr2line", proof: "PC, raw instruction, disassembly and source line" },
  { number: "06", boundary: "kernel_main", tool: "DPRINT", proof: "K0 → K3 breadcrumbs around the suspect operation" },
] as const;

const debugLayers = [
  {
    number: "01",
    title: "Host creates the experiment",
    processor: "Host C++ · before dispatch",
    tool: "GDB + Inspector",
    question: "Were buffers, kernels, core ranges and runtime arguments assembled correctly?",
    observe: "GDB can step only the Linux host process. On this machine it is currently absent, and the Release binary has no DWARF line tables; fix both before judging VS Code.",
    lookFor: "A WSL window, /usr/bin/gdb, a build-debug executable, bound host breakpoints, then wrong buffers, arguments or enqueue order.",
    command: "sudo apt update\nsudo apt install -y gdb\nCMAKE_BUILD_PARALLEL_LEVEL=8 ./build_metal.sh \\\n  --debug --build-dir build-debug \\\n  --build-metal-tests --build-programming-examples\nreadelf -S build-debug/test/tt_metal/unit_tests_legacy \\\n  | grep -E 'debug_info|debug_line'",
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
    command: "export TT_METAL_CHECKPOINT=1\nexport TT_METAL_DPRINT_CORES=0,0\nexport TT_METAL_CACHE=~/ttsim-cache/checkpoint-pass-01\n# Add DEBUG_CHECKPOINT(\"after_read\") to every active kernel.",
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
    observe: "Verified on Blackhole: Watcher attaches, polls, writes generated/watcher/watcher.log and the smoke example returns 21. The same Quasar pass currently reaches rv64_custom_0 and stops.",
    lookFor: "Last four-character waypoint, active kernel IDs, invalid NoC coordinates, CB out-of-bounds access or mutually waiting RISCs.",
    command: "unset TT_METAL_DPRINT_CORES TT_METAL_DPRINT_RISCVS\nunset TT_METAL_DEVICE_PROFILER TT_METAL_NOC_DEBUG_DUMP\nexport TT_METAL_WATCHER=10\ncp tt_metal/soc_descriptors/blackhole_140_arch.yaml \\\n  ~/sim/soc_descriptor.yaml\nexport TT_METAL_SIMULATOR=~/sim/libttsim_bh.so\n./build/programming_examples/metal_example_add_2_integers_in_riscv\nless generated/watcher/watcher.log",
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
    observe: "The official Blackhole profiler example passes here, but the CSV contains only headers; Quasar hits an unimplemented instruction. Host Tracy capture remains the useful ttsim visualization.",
    lookFor: "Host JIT, construction, dispatch and wait order. A CSV header without TEST-FULL rows is not a successful device-profile capture.",
    command: "unset TT_METAL_DPRINT_CORES TT_METAL_DPRINT_RISCVS\nunset TT_METAL_WATCHER TT_METAL_NOC_DEBUG_DUMP\ncp tt_metal/soc_descriptors/blackhole_140_arch.yaml \\\n  ~/sim/soc_descriptor.yaml\nexport TT_METAL_SIMULATOR=~/sim/libttsim_bh.so\nTT_METAL_DEVICE_PROFILER=1 \\\n  ./build/programming_examples/profiler/test_full_buffer\nwc -l generated/profiler/.logs/profile_log_device.csv\n# Expected on this pair: 2 lines, no TEST-FULL zones.",
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

function SequenceDiagram({ title, actors, events }: { title: string; actors: readonly string[]; events: readonly SequenceEvent[] }) {
  const width = 1220;
  const headerHeight = 104;
  const rowHeight = 84;
  const height = headerHeight + events.length * rowHeight + 28;
  const left = 84;
  const right = width - 84;
  const actorX = actors.map((_, index) => left + (index * (right - left)) / (actors.length - 1));
  const markerId = `arrow-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const summary = events.map((event, index) => `${index + 1}. ${actors[event.from]} to ${actors[event.to]}: ${event.title}. ${event.detail}`).join(" ");

  return (
    <div className="sequence-scroll">
      <svg className="sequence-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${markerId}-title ${markerId}-desc`}>
        <title id={`${markerId}-title`}>{title}</title>
        <desc id={`${markerId}-desc`}>{summary}</desc>
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,4 L0,8 z" className="sequence-arrow-head" />
          </marker>
        </defs>
        {events.map((event, index) => <rect key={`row-${index}`} x="0" y={headerHeight + index * rowHeight} width={width} height={rowHeight} className={`sequence-row-bg ${event.phase}`} />)}
        {actors.map((actor, index) => (
          <g key={actor}>
            <line x1={actorX[index]} x2={actorX[index]} y1="76" y2={height - 20} className="sequence-lifeline" />
            <rect x={actorX[index] - 67} y="15" width="134" height="54" rx="3" className="sequence-actor" />
            <foreignObject x={actorX[index] - 61} y="21" width="122" height="42">
              <div className="sequence-actor-label">{actor}</div>
            </foreignObject>
          </g>
        ))}
        {events.map((event, index) => {
          const y = headerHeight + index * rowHeight + 43;
          const x1 = actorX[event.from];
          const x2 = actorX[event.to];
          const center = (x1 + x2) / 2;
          const labelX = Math.max(54, Math.min(width - 318, center - 132));
          return (
            <g key={`${event.title}-${index}`} className={`sequence-event ${event.phase}`}>
              <circle cx="25" cy={y} r="13" className="sequence-step" />
              <text x="25" y={y + 4} textAnchor="middle" className="sequence-step-label">{index + 1}</text>
              <line x1={x1} x2={x2} y1={y} y2={y} markerEnd={`url(#${markerId})`} className="sequence-arrow" />
              <circle cx={x1} cy={y} r="4" className="sequence-origin" />
              <foreignObject x={labelX} y={y - 34} width="264" height="68">
                <div className="sequence-message-card"><strong>{event.title}</strong><span>{event.detail}</span></div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
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
  const [activeSequence, setActiveSequence] = useState<"blackhole" | "quasar" | "detour">("blackhole");
  const [activeCapstoneTarget, setActiveCapstoneTarget] = useState<keyof typeof capstoneTargets>("blackhole");
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
  const capstoneTarget = capstoneTargets[activeCapstoneTarget];
  const debugLayer = debugLayers[activeDebugLayer];
  const docTrack = docTracks[activeDocTrack];
  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="TT Sim Lab home"><span>TT</span><i>•</i>SIM LAB</a>
        <button className="chapters-button" type="button" onClick={() => setChaptersOpen(!chaptersOpen)} aria-expanded={chaptersOpen} aria-controls="book-sidebar"><span aria-hidden="true">☰</span> Chapters</button>
        <button className="menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>Index</button>
        <nav className={menuOpen ? "topnav open" : "topnav"} aria-label="Primary">
          <a href="#machine">Machine</a><a href="#setup">Setup</a><a href="#architecture">Architecture</a><a href="#generations">Generations</a><a href="#experiments">Experiments</a><a href="#capstone">Capstone</a><a href="#debug">Debug</a><a href="#docs">Docs</a>
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
          <div className="sidebar-shelf"><span>Keep beside the terminal</span><a href="./huawei.html">Blackhole vs Huawei <i>↗</i></a><a href="./TENSTORRENT_GENERATION_COMPARISON.md">Generation report <i>↗</i></a><a href="./COMPILER_RUNTIME_CAPSTONE.md">Compiler capstone <i>↗</i></a><a href="./QUASAR_CLUSTER_LAB.md">Quasar cluster lab <i>↗</i></a><a href="./WSL_AGENT_HOST_DEVICE_DEBUGGING.md">WSL host/device trace <i>↗</i></a><a href="./TTSIM_DEBUGGING_PATH.md">Debugging playbook <i>↗</i></a></div>
        </aside>

        <main>
        <section id="top" className="hero section-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span>Field guide 001</span><span>Updated 16 Aug 2026</span></p>
            <h1>Build a chip lab.<br/><em>Skip the chip.</em></h1>
            <p className="lede">A machine-specific path from Windows to your first Tenstorrent kernel—using the official <code>ttsim</code>, Ubuntu 22.04 on WSL2, and no accelerator hardware.</p>
            <div className="hero-actions"><a className="button primary" href="#setup">Start the setup</a><a className="button secondary" href="#experiments">See the labs</a></div>
            <div className="hero-meta"><span>6 warm-ups + 8-stage capstone</span><span>~60–90 min setup</span><span>Hardware: none</span></div>
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
            <article className="step"><div className="step-index">C</div><div className="step-body"><p className="eyebrow">ttsim · 5 min</p><h3>Stage the official simulator libraries</h3><p>Version <code>v1.10.1</code> is the pinned research baseline. Pin it for reproducibility; if TT-Metal reports an ABI mismatch, use the simulator version required by that TT-Metal revision.</p><Command code="cd ~/sim\nTTSIM_VERSION=v1.10.1\nwget https://github.com/tenstorrent/ttsim/releases/download/${TTSIM_VERSION}/libttsim_wh.so\nwget https://github.com/tenstorrent/ttsim/releases/download/${TTSIM_VERSION}/libttsim_bh.so\nwget https://github.com/tenstorrent/ttsim/releases/download/${TTSIM_VERSION}/libttsim_qsr.so\ncp $TT_METAL_HOME/tt_metal/soc_descriptors/wormhole_b0_80_arch.yaml soc_descriptor.yaml\nsha256sum libttsim_qsr.so" /><label className="check"><input type="checkbox" checked={!!done["m-sim"]} onChange={() => toggle("m-sim")} /><span>Simulator libraries staged</span></label></div></article>
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

        <section id="sequences" className="content-section sequence-section">
          <div className="section-heading"><span>02B / Simulation sequences</span><h2>Same bridge. Different device mechanisms.</h2><p>Start with the shared host-to-simulator route, then open either verified run. The arrows show control or data movement; they do not represent performance or elapsed time.</p></div>

          <div className="sequence-overview" aria-label="Shared TT-Sim execution pipeline">
            <div className="overview-track">
              <article><span>01</span><strong>WSL Bash</strong><small>environment + command</small></article><i>→</i>
              <article><span>02</span><strong>Host process</strong><small>example or GoogleTest</small></article><i>→</i>
              <article><span>03</span><strong>TT-Metal</strong><small>mesh + command queue</small></article><i>→</i>
              <article><span>04</span><strong>UMD</strong><small>simulation driver</small></article><i>→</i>
              <article className="overview-split"><span>05</span><strong>libttsim</strong><small><b>BH</b> 0xb140 · <b>QSR</b> 0xfeed</small></article><i>→</i>
              <article><span>06</span><strong>JIT artifacts</strong><small>firmware + kernel</small></article><i>→</i>
              <article><span>07</span><strong>Virtual cores</strong><small>BRISC or DM/TRISC</small></article><i>→</i>
              <article><span>08</span><strong>Host verdict</strong><small>21 or 0x12345678</small></article>
            </div>
            <div className="overview-legend"><span><i className="legend-control" /> control / lifecycle</span><span><i className="legend-data" /> data visibility</span><span><i className="legend-pass" /> observed proof</span></div>
          </div>

          <div className="architecture-compare">
            <article><div><span>BLACKHOLE</span><strong>14 + 7 → 21</strong></div><p>A host example allocates DRAM and L1 buffers, runs one BRISC data-movement kernel, performs two NoC reads, adds in RISC-V, and writes the result back to DRAM.</p><dl><div><dt>Virtual ID</dt><dd>0xb140</dd></div><div><dt>Device worker</dt><dd>RISCV_0 / BRISC</dd></div><div><dt>Proof</dt><dd>Success: Result is 21</dd></div></dl></article>
            <article><div><span>QUASAR</span><strong>0 → 0x12345678</strong></div><p>A GoogleTest fixture starts Quasar firmware, writes a value through a two-thread DM kernel, flushes the Quasar cache hierarchy to TL1, then reads the same four bytes from the host.</p><dl><div><dt>Virtual ID</dt><dd>0xfeed</dd></div><div><dt>Device workers</dt><dd>DM0–DM7 + TRISCs</dd></div><div><dt>Proof</dt><dd>[ PASSED ] 1 test</dd></div></dl></article>
          </div>

          <div className="sequence-detail">
            <div className="sequence-tabs" role="tablist" aria-label="Detailed simulation sequences">
              <button type="button" role="tab" aria-selected={activeSequence === "blackhole"} className={activeSequence === "blackhole" ? "active" : ""} onClick={() => setActiveSequence("blackhole")}><span>01</span><div><strong>Blackhole success</strong><small>15 messages · BRISC + NoC</small></div></button>
              <button type="button" role="tab" aria-selected={activeSequence === "quasar"} className={activeSequence === "quasar" ? "active" : ""} onClick={() => setActiveSequence("quasar")}><span>02</span><div><strong>Quasar success</strong><small>15 messages · DM + cache</small></div></button>
              <button type="button" role="tab" aria-selected={activeSequence === "detour"} className={activeSequence === "detour" ? "active" : ""} onClick={() => setActiveSequence("detour")}><span>03</span><div><strong>Quasar V2 detour</strong><small>failure → supported path</small></div></button>
            </div>

            <div className="sequence-panel" role="tabpanel">
              {activeSequence === "blackhole" && <><div className="sequence-panel-head"><div><p className="eyebrow">Verified 16 August 2026</p><h3>Blackhole: host buffers → BRISC → host result</h3></div><span>Read top to bottom</span></div><SequenceDiagram title="Blackhole TT-Sim successful execution sequence" actors={blackholeActors} events={blackholeSequence} /><div className="sequence-takeaway"><b>The ordering hinge:</b> asynchronous host writes, the workload and the blocking read share one FIFO command queue. Inside the kernel, NoC barriers and <code>load_blocking</code> make each memory boundary explicit.</div></>}
              {activeSequence === "quasar" && <><div className="sequence-panel-head"><div><p className="eyebrow">Verified 16 August 2026</p><h3>Quasar: fixture → DM cache hierarchy → assertion</h3></div><span>Read top to bottom</span></div><SequenceDiagram title="Quasar TT-Sim successful execution sequence" actors={quasarActors} events={quasarSequence} /><div className="quasar-memory-path"><span>DM core store</span><i>→</i><span>private L1D cache</span><i>→</i><span>shared L2 cache</span><i>→</i><span>TL1 node memory</span><i>→</i><span>host read</span><p><code>flush_l2_cache_line(address)</code> performs fence → L2 flush-register write → fence, allowing the host-side read to observe <code>0x12345678</code>.</p></div></>}
              {activeSequence === "detour" && <div className="detour-panel"><div className="sequence-panel-head"><div><p className="eyebrow">Known simulator boundary</p><h3>Why the first Quasar attempt stopped—and why V1 passed</h3></div><span>Not a WSL failure</span></div><div className="detour-flow"><article><span>DEFAULT SOURCE</span><strong><code>#define NOC_API_V2</code></strong><p>Quasar selects the RoCC custom-instruction command-buffer path.</p></article><i>→</i><article><span>JIT OUTPUT</span><strong><code>tt.rocc.cmdbuf_wr_reg</code></strong><p>Startup programs command buffer 0, register index 32.</p></article><i>→</i><article className="failed"><span>TT-SIM EXIT</span><strong><code>rv64_custom_0</code></strong><p><code>UnimplementedFunctionality</code>: funct3=2, reg_index=32, cmd_buf=0.</p></article></div><div className="detour-branch"><span>SUPPORTED DETOUR</span><div><code>// #define NOC_API_V2</code><i>→</i><code>noc_nonblocking_api_v1.h</code><i>→</i><code>legacy MMIO NOC registers</code><i>→</i><strong>test passes</strong></div><p>The change affects JIT-compiled device firmware and kernels, not the host GoogleTest binary. A fresh <code>TT_METAL_CACHE</code> guarantees that stale V2 artifacts are not reused.</p></div><div className="note danger"><b>Scope:</b> this is a documented bring-up workaround for the current binary-only Quasar simulator. It is not a recommendation to use NOC V1 for production Quasar software.</div></div>}
            </div>
          </div>

          <div className="sequence-sources"><span>Trace every arrow</span><div><a href="https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/programming_examples/add_2_integers_in_riscv/add_2_integers_in_riscv.cpp">Blackhole host example ↗</a><a href="https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/programming_examples/add_2_integers_in_riscv/kernels/reader_writer_add_in_riscv.cpp">Blackhole BRISC kernel ↗</a><a href="https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/test_single_dm_l1_write.cpp">Quasar host test ↗</a><a href="https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/test_kernels/dataflow/simple_l1_write.cpp">Quasar DM kernel ↗</a><a href="https://github.com/tenstorrent/ttsim#known-issues">Quasar known issues ↗</a><a href="./SIMULATION_SEQUENCE.md">Mermaid sequence record ↗</a></div></div>
        </section>

        <section id="architecture" className="content-section architecture-section">
          <div className="section-heading"><span>02C / Architecture study</span><h2>Yes: Quasar targets clusters. No: that is not the device mesh.</h2><p>Public Quasar APIs introduce an on-chip worker cluster as the unit that host code targets. TT-Metal’s <code>MeshDevice</code> sits above the chip and applies to Blackhole too—even one device is represented as a 1×1 mesh.</p></div>

          <div className="cluster-verdict">
            <div><span>THE PRECISE ANSWER</span><strong>Quasar is cluster-oriented <em>inside each chip.</em></strong></div>
            <p>One current Quasar worker cluster contains <b>8 DM cores</b>, <b>4 Tensix Neo engines × 4 TRISCs</b>, and <b>4 MiB shared SRAM</b>. DM0–DM1 are reserved on worker clusters, so user data-movement kernels currently receive up to six DM cores. One compute kernel may occupy one to four Neo engines.</p>
          </div>

          <div className="cluster-levels" aria-label="Three different architecture levels that are often called a cluster">
            <article><span>LEVEL 03</span><strong>System mesh</strong><p>One or more chips. TT-Metal models even one chip as a 1×1 <code>MeshDevice</code>.</p><small>Quasar and Blackhole</small></article>
            <i>contains</i>
            <article><span>LEVEL 02</span><strong>On-chip NoC grid</strong><p>The current QSR simulator exposes an 8×4 rectangle of 32 functional worker nodes.</p><small>Simulator descriptor</small></article>
            <i>contains</i>
            <article className="hot"><span>LEVEL 01</span><strong>Quasar worker cluster</strong><p>One NoC-addressed target with data-movement and compute parallelism inside it.</p><small>Kernel target</small></article>
          </div>

          <div className="cluster-anatomy">
            <div className="cluster-anatomy-head"><div><p className="eyebrow">One Quasar worker cluster</p><h3>Parallelism exists both across clusters and within one cluster.</h3></div><span>Shared address space · 4 MiB</span></div>
            <div className="cluster-hardware">
              <div className="dm-bank"><small>Data movement</small><strong>8 × DM</strong><div>{Array.from({length: 8}, (_, index) => <span key={index} className={index < 2 ? "reserved" : "user"}>DM{index}<i>{index < 2 ? "runtime" : "user"}</i></span>)}</div></div>
              <div className="shared-sram"><span>shared</span><strong>4 MiB SRAM</strong><small>all DM cores + Neo engines</small></div>
              <div className="neo-bank"><small>Compute</small><strong>4 × Tensix Neo</strong><div>{Array.from({length: 4}, (_, engine) => <article key={engine}><b>NEO {engine}</b><span>TR0</span><span>TR1</span><span>TR2</span><span>TR3</span></article>)}</div></div>
            </div>
          </div>

          <div className="architecture-table-wrap">
            <table className="architecture-table">
              <caption>Current public software model—not a final Quasar silicon specification</caption>
              <thead><tr><th>Compiler/runtime concern</th><th>Quasar</th><th>Blackhole</th><th>Evidence</th></tr></thead>
              <tbody>
                <tr><th>Host scheduling target</th><td>Worker cluster</td><td>Tensix worker core</td><td>Host API / HAL</td></tr>
                <tr><th>DM resources per target</th><td>8 DM; 6 user-available</td><td>BRISC + NCRISC</td><td>Host API / HAL</td></tr>
                <tr><th>Compute resources</th><td>4 Neo × 4 TRISCs</td><td>TRISC0–2</td><td>HAL</td></tr>
                <tr><th>Shared worker SRAM</th><td>4 MiB</td><td>1.5 MiB</td><td>Simulator descriptor</td></tr>
                <tr><th>Functional workers</th><td>32 · 8×4 rectangle</td><td>140 unharvested</td><td>Simulator descriptor</td></tr>
                <tr><th>NoC coordinate extent</th><td>10×8</td><td>17×12</td><td>Simulator descriptor</td></tr>
                <tr><th>Local-memory contract</th><td>DM caches → L2 → TL1 visibility</td><td>Explicit SRAM scratchpad</td><td>Tests / Metalium docs</td></tr>
                <tr><th>Public simulator status</th><td>Early bring-up · binary-only</td><td>Near feature complete · source</td><td>ttsim README</td></tr>
              </tbody>
            </table>
          </div>

          <div className="compiler-consequences">
            <article><span>01</span><h3>Schedule two levels</h3><p>First place work over the 8×4 cluster grid; then choose DM threads and Neo engines inside each selected cluster.</p></article>
            <article><span>02</span><h3>Lower capabilities, not names</h3><p>Keep fusion target-independent. Add SRAM size, engine count and legal memory effects only during architecture lowering.</p></article>
            <article><span>03</span><h3>Model visibility</h3><p>A Quasar DM store is not automatically host-visible. Make cache flushes and dependencies explicit in runtime IR.</p></article>
            <article><span>04</span><h3>Validate resource legality</h3><p>Reject seven user DMs, five Neo engines or two compute kernels assigned to the same cluster.</p></article>
          </div>

          <div className="repeat-lab">
            <div><p className="eyebrow">Repeatable evidence lab</p><h3>Audit first. Run second. Keep every artifact.</h3><p>The checked-in script compares both descriptors, records the exact TT-Metal commit and simulator checksum, then optionally runs the supported Quasar single-DM L1 write test with an isolated JIT cache.</p></div>
            <Command label="Run from the cloned tt-sim guide in WSL" code="export TT_METAL_HOME=~/src/tt-metal\nexport TT_METAL_SIMULATOR=~/sim/libttsim_qsr.so\nchmod +x scripts/03-quasar-cluster-lab.sh\n./scripts/03-quasar-cluster-lab.sh inspect\n./scripts/03-quasar-cluster-lab.sh run" />
            <div className="repeat-links"><a href="./QUASAR_CLUSTER_LAB.md">Open the full lab record ↗</a><a href="https://github.com/buicongnguyen/tt-sim/blob/main/scripts/03-quasar-cluster-lab.sh">Inspect the script ↗</a></div>
          </div>

          <div className="architecture-sources"><span>Primary evidence</span><div><a href="https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/host_api/temp_quasar_api.hpp">Quasar cluster API ↗</a><a href="https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/hal/tt-2xx/quasar/qa_hal_tensix.cpp">Quasar HAL ↗</a><a href="https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/hal/tt-1xx/blackhole/bh_hal_tensix.cpp">Blackhole HAL ↗</a><a href="https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/soc_descriptors/quasar_32_arch.yaml">Quasar descriptor ↗</a><a href="https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/examples/dram_loopback.html">MeshDevice + SRAM model ↗</a></div></div>
        </section>

        <section id="generations" className="content-section generation-section">
          <div className="section-heading"><span>02D / Three generations</span><h2>Better is a vector, not a verdict.</h2><p>Shipping-card facts, pinned source and simulator-model evidence answer different questions. This review keeps them separate so a resource count never masquerades as measured speed.</p></div>

          <div className="generation-verdict">
            <article><span>PROVEN PRODUCT STEP</span><strong>Blackhole raises multiple card-level ceilings.</strong><p>Against the single-chip Wormhole n150, Blackhole p150 has 1.67× enabled Tensix cores and SRAM, 1.78× memory bandwidth and 4.49× matching-format BlockFP8 peak—inside a 1.88× board-power envelope.</p></article>
            <article className="direction"><span>ARCHITECTURAL DIRECTION</span><strong>Quasar exposes more parallelism inside one target.</strong><p>Eight DMs, four Neo engines × four TRISCs and 4 MiB shared SRAM can improve overlap and reuse <em>if scheduled well</em>. Public evidence does not yet prove performance.</p></article>
          </div>

          <div className="card-metric-table" role="region" aria-label="Wormhole n150 and Blackhole p150 card metrics" tabIndex={0}>
            <div className="metric-head"><span>Card fact</span><b>Wormhole n150</b><b>Blackhole p150</b><em>Change</em></div>
            {[
              ["Enabled Tensix", "72", "120", "1.67×"],
              ["AI clock", "1.0 GHz", "1.35 GHz", "1.35×"],
              ["SRAM", "108 MB", "180 MB", "1.67×"],
              ["GDDR6", "12 GB", "32 GB", "2.67×"],
              ["Memory bandwidth", "288 GB/s", "512 GB/s", "1.78×"],
              ["BlockFP8", "148 TFLOPS", "664 TFLOPS", "4.49×"],
              ["Board power", "160 W", "300 W", "1.88×"],
              ["Host interface", "PCIe 4 ×16", "PCIe 5 ×16", "generation"],
            ].map((row) => <div className="metric-row" key={row[0]}><span>{row[0]}</span><b>{row[1]}</b><b>{row[2]}</b><em>{row[3]}</em></div>)}
          </div>

          <div className="kernel-evolution" aria-label="Low-level kernel architecture evolution">
            <article><span>WH</span><div><small>Stable pipeline</small><strong>BRISC + NCRISC</strong><p>TRISC0 unpack → TRISC1 math → TRISC2 pack</p></div></article><i>→</i>
            <article><span>BH</span><div><small>Wider system + tuned surface</small><strong>Same three TRISC roles</strong><p>More architecture-specific LLKs and an 8-bit-aware pack contract</p></div></article><i>→</i>
            <article className="hot"><span>QSR</span><div><small>New scheduling unit</small><strong>Worker cluster</strong><p>8 DM + 4 Neo × 4 TRISC around 4 MiB shared SRAM</p></div></article>
          </div>

          <div className="claim-ledger">
            <article><span className="evidence-tag product">PRODUCT</span><h3>Why Blackhole improves</h3><p>Higher core/clock/memory ceilings, faster NoC, PCIe 5, much larger card-link capacity and additional integrated RISC-V cores are stated in official product material.</p></article>
            <article><span className="evidence-tag code">CODE</span><h3>What LLK proves</h3><p>The pinned Blackhole tree adds 28 files absent from Wormhole, including fast tilize, face-compressed matmul, RMSNorm, sampling and top-k paths. That proves software specialization—not speed.</p></article>
            <article><span className="evidence-tag counter">COUNTEREXAMPLE</span><h3>Newer is not “more everything”</h3><p>Official profiling docs report four Wormhole packer engines but <code>PACK_COUNT=1</code> on Blackhole; Blackhole instead exposes deeper L1 mux visibility.</p></article>
            <article><span className="evidence-tag unknown">UNKNOWN</span><h3>What Quasar cannot prove</h3><p>Quasar is pre-silicon, binary-only in public ttsim and in early bring-up. No public final-product throughput, power or scaling comparison is defensible.</p></article>
          </div>

          <div className="generation-guardrail"><span>LOGIC REVIEW</span><p><b>Supported:</b> Blackhole improves named card-level ceilings. <b>Supported as direction:</b> Quasar can expose more internal overlap and shared reuse. <b>Rejected:</b> “Quasar is faster/better than Blackhole” until matching silicon evidence exists.</p></div>

          <div className="generation-actions"><a className="button primary" href="./TENSTORRENT_GENERATION_COMPARISON.md">Read the full source audit</a><a className="button secondary" href="./huawei.html">Compare Blackhole with Huawei Ascend</a></div>

          <div className="architecture-sources"><span>Primary evidence</span><div><a href="https://tenstorrent.com/en/hardware/cards">Blackhole card table ↗</a><a href="https://docs.tenstorrent.com/aibs/wormhole/specifications.html">Wormhole specifications ↗</a><a href="https://github.com/tenstorrent/ttsim">ttsim maturity ↗</a><a href="https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/profiling_ttnn_operations.html">Architecture counters ↗</a><a href="https://github.com/buicongnguyen/tt-sim/blob/main/scripts/05-architecture-evidence.sh">Evidence script ↗</a></div></div>
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

        <section id="capstone" className="content-section capstone-section">
          <div className="section-heading"><span>03A / Compiler + runtime</span><h2>Build one fused graph from bytes to IR.</h2><p>Keep the workload fixed while you climb the stack. Every experiment must leave an artifact that the next layer can consume or verify.</p></div>

          <div className="capstone-hero">
            <div><p className="eyebrow">The capstone equation</p><strong>Y = ReLU(A × B + bias)</strong><p>Small enough to understand completely; rich enough to exercise tiling, data movement, fusion, lifetime analysis and runtime execution.</p></div>
            <div className="capstone-flow" aria-label="End-to-end compiler flow"><span>Graph</span><i>→</i><span>MLIR</span><i>→</i><span>Fusion</span><i>→</i><span>Memory plan</span><i>→</i><span>Metalium</span><i>→</i><span>Oracle</span></div>
          </div>

          <div className="capstone-boundary"><span>SUPPORT BOUNDARY</span><p><b>Blackhole is the runtime learning lane.</b> <b>Quasar is the current bring-up lane.</b> MLIR parsing, verification, fusion and lifetime analysis are target-independent and can run offline. Simulator wall time is never a silicon benchmark.</p></div>

          <div className="capstone-roadmap" aria-label="Eight compiler and runtime experiments">
            {capstoneExperiments.map((item) => <article key={item.number}>
              <div className="capstone-card-head"><span>{item.number}</span><small>{item.layer}</small></div>
              <h3>{item.title}</h3><em>{item.scope}</em><p>{item.build}</p>
              <div><small>Exit proof</small><p>{item.proof}</p></div>
              <label className="check"><input type="checkbox" checked={!!done[`capstone-${item.number}`]} onChange={() => toggle(`capstone-${item.number}`)} /><span>Evidence saved</span></label>
            </article>)}
          </div>

          <div className="target-workbench">
            <div className="target-tabs" role="tablist" aria-label="Capstone target lanes">
              {(Object.keys(capstoneTargets) as Array<keyof typeof capstoneTargets>).map((target) => <button key={target} type="button" role="tab" aria-selected={activeCapstoneTarget === target} className={activeCapstoneTarget === target ? "active" : ""} onClick={() => setActiveCapstoneTarget(target)}><span>{target === "blackhole" ? "BH" : "QSR"}</span><strong>{capstoneTargets[target].label}</strong></button>)}
            </div>
            <article className="target-panel" role="tabpanel">
              <div><p className="eyebrow">{capstoneTarget.eyebrow}</p><h3>{capstoneTarget.title}</h3><p>{capstoneTarget.description}</p></div>
              <Command code={capstoneTarget.command} label={`${capstoneTarget.label} baseline · WSL Ubuntu`} />
              <p className="target-gate">{capstoneTarget.gate}</p>
            </article>
          </div>

          <div className="fusion-workbench">
            <div className="fusion-copy"><p className="eyebrow">Experiment 06 · first compiler pass</p><h3>Recognize the DAG, then earn the fusion.</h3><p>Start with generic quoted operations, define a real dialect, then implement a rewrite pattern. Reject invalid dimensions, types, bias shapes and unsafe extra uses before replacing the graph.</p><a href="https://github.com/buicongnguyen/tt-sim/tree/main/experiments/fused-linear-relu">Open the starter fixtures on GitHub ↗</a></div>
            <div className="fusion-ir">
              <div><span>BEFORE · 3 OPS</span><code>matmul(A, B)</code><i>↓</i><code>add_bias(…, bias)</code><i>↓</i><code>relu(…)</code></div>
              <b>→</b>
              <div className="fused"><span>AFTER · 1 OP</span><code>fused_linear_relu(A, B, bias)</code><small>Only after verification succeeds</small></div>
            </div>
          </div>

          <div className="capstone-acceptance">
            <article><span>01</span><h3>Numerical gate</h3><p>Fixed-seed NumPy oracle; valid and invalid shapes; identical logical outputs before and after fusion.</p></article>
            <article><span>02</span><h3>Resource gate</h3><p>Machine-readable logical/padded shapes, allocated bytes, lifetime intervals and local-memory high-water mark.</p></article>
            <article><span>03</span><h3>Runtime gate</h3><p>Trace writes, dispatches and reads. Count reductions only after the implementation produces them.</p></article>
          </div>

          <div className="capstone-download"><div><p className="eyebrow">Repeat the complete study</p><h3>Commands, exit gates, fixtures and portfolio checklist.</h3></div><a href="./COMPILER_RUNTIME_CAPSTONE.md">Open the standalone capstone guide ↗</a></div>

          <div className="architecture-sources"><span>Primary evidence</span><div><a href="https://github.com/tenstorrent/tt-metal/blob/main/METALIUM_GUIDE.md">Metalium guide ↗</a><a href="https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/examples/dram_loopback.html">DRAM loopback ↗</a><a href="https://docs.tenstorrent.com/tt-mlir/overview.html">TT-MLIR architecture ↗</a><a href="https://docs.tenstorrent.com/tt-mlir/tools.html">ttmlir-opt tools ↗</a><a href="https://mlir.llvm.org/docs/PatternRewriter/">MLIR rewriting ↗</a></div></div>
        </section>

        <section id="debug" className="content-section debug-section">
          <div className="section-heading"><span>04 / Mechanism debugger</span><h2>Follow one value through the machine.</h2><p>Start at the host and move down only after the current boundary is correct. Each pass instruments one mechanism, one core and one RISC role.</p></div>
          <div className="debug-guardrails"><div><span>01</span><p><b>Baseline first.</b> Save one uninstrumented passing or failing run before adding any tool.</p></div><div><span>02</span><p><b>One observer.</b> DPRINT, Watcher, Device Profiler and NoC dump must not be combined.</p></div><div><span>03</span><p><b>Sequence, not speed.</b> Instrumentation changes the kernel; ttsim timing is not silicon timing.</p></div></div>
          <div className="agent-debug-workbench">
            <div className="agent-debug-copy">
              <p className="eyebrow">WSL coding-agent lane</p>
              <h3>Native agents, one Linux toolchain.</h3>
              <p>Run Codex or Claude Code, Git, CMake, GDB and TT-Metal from the same Ubuntu filesystem. VS Code is the window; the WSL extension owns the terminal and debugger.</p>
              <div className="agent-debug-facts"><div><small>Repository</small><strong>/home/n/src/tt-metal</strong></div><div><small>Host debugger</small><strong>/usr/bin/gdb</strong></div><div><small>Device evidence</small><strong>DPRINT + ELF tools</strong></div></div>
              <a href="./WSL_AGENT_HOST_DEVICE_DEBUGGING.md">Open the reviewed setup and trace plan ↗</a>
            </div>
            <Command label="Install and verify inside Ubuntu" code={'sudo apt update\nsudo apt install -y gdb gdb-multiarch binutils-riscv64-linux-gnu\ncurl -fsSL https://chatgpt.com/codex/install.sh | sh\ncurl -fsSL https://claude.ai/install.sh | bash\ntype -a codex claude gdb node npm\ncd ~/src/tt-metal && code .'} />
          </div>
          <div className="host-device-trace" aria-label="Evidence-gated host to device trace">
            {agentHostDeviceFlow.map((item) => <article key={item.number}><div><span>{item.number}</span><small>{item.tool}</small></div><h3>{item.boundary}</h3><p>{item.proof}</p></article>)}
          </div>
          <div className="trace-rule"><article><span>HOST STACK</span><h3>GDB follows x86-64 only.</h3><p>Break at program creation, runtime-argument serialization, ELF loading and dispatch-page packing. Save <code>bt</code>, <code>info args</code> and the exact vectors at every boundary.</p></article><article><span>DEVICE STARTUP</span><h3>Disassemble before instrumenting.</h3><p>Map a failing simulator PC to the raw RISC-V word, symbol and TT-Metal source line. The current Quasar stop is <code>0x400254: 0x4005a00b</code>, before user <code>kernel_main</code>.</p></article><article><span>DEVICE FLOW</span><h3>DPRINT proves reached states.</h3><p>Add four short breadcrumbs around one suspect operation, filter to one core and one RISC, and use a fresh <code>TT_METAL_CACHE</code> for every instrumented build.</p></article></div>
          <div className="observability-status" aria-label="Verified observability status on this WSL machine">
            {observabilityStatus.map((item) => <article className={`observability-card ${item.tone}`} key={item.title}><div><span>{item.badge}</span><h3>{item.title}</h3></div><p>{item.evidence}</p><small>{item.next}</small></article>)}
          </div>
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
          <div className="debug-verdicts">
            <article><span>WATCHER · VERIFIED BH</span><h3>Waypoints answer “where did it stop?”</h3><p>Use four-character markers around a wait, then read the last marker and active kernel IDs in <code>generated/watcher/watcher.log</code>. In a stopped GDB session, call <code>tt::watcher::dump(stderr, true)</code>.</p></article>
            <article><span>PROFILER · VERIFY THE DATA</span><h3>A created CSV can still be empty.</h3><p>Look for named begin/end rows, not only a file. The pinned Blackhole simulator run produced the two CSV headers but no <code>TEST-FULL</code> scopes; Quasar stopped earlier.</p></article>
            <article><span>GDB · HOST ONLY</span><h3>A kernel breakpoint is the wrong mental model.</h3><p>Break in <code>test_single_dm_l1_write.cpp</code> to inspect the host. Instrument <code>simple_l1_write.cpp</code> with DPRINT or a supported device tool.</p></article>
          </div>
          <div className="debug-playbook"><p><b>Machine-specific result:</b> install GDB and build <code>build-debug</code> before using VS Code. Use Watcher on the verified Blackhole lane, DPRINT on Quasar, and Tracy for ttsim host chronology. Re-test device profiling after each TT-Metal/ttsim upgrade.</p><a href="./TTSIM_DEBUGGING_PATH.md">Open commands, launch.json and observed logs ↗</a></div>
        </section>

        <section id="notebook" className="content-section notebook-section">
          <div className="section-heading"><span>05 / Evidence</span><h2>Keep a lab notebook Git can diff.</h2><p>One Markdown file per experiment is enough. The template forces the useful details without turning learning into paperwork.</p></div>
          <Command label="notes/01-riscv-smoke.md" code="# Experiment 01 — virtual BRISC\n\n- Date:\n- TT-Metal commit: `git rev-parse HEAD`\n- ttsim version: v1.10.1\n- Architecture: Wormhole\n- Hypothesis:\n- Command:\n- Observed output:\n- One controlled change:\n- Result vs prediction:\n- What I think happened:\n- Next question:" />
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
      <footer><a className="brand" href="#top"><span>TT</span><i>•</i>SIM LAB</a><p>Independent learning guide. Tenstorrent, Wormhole, Blackhole and Quasar are referenced for educational purposes.</p><a href="https://github.com/buicongnguyen/tt-sim">Page source on GitHub ↗</a></footer>
    </div>
  );
}

export default App;
