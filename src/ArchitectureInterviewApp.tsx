import { useState } from "react";

type Source = { label: string; href: string };
type Option = { name: string; bestWhen: string; benefit: string; cost: string };
type Scenario = {
  id: string;
  short: string;
  question: string;
  opening: string;
  bottleneck: string;
  evidence: readonly string[];
  options: readonly Option[];
  recommendation: string;
  validation: readonly string[];
  followups: readonly string[];
  sources: readonly Source[];
};
type PrepTopic = {
  id: string;
  title: string;
  priority: 2 | 3 | 4 | 5;
  thesis: string;
  learn: string;
  rehearse: string;
  prove: string;
  memory: string;
  href: string;
  linkLabel: string;
};

const commit = "50a82f835593512c4176546b4af68d7e91315a86";
const sourceRoot = `https://github.com/tenstorrent/tt-metal/blob/${commit}`;

const links = {
  profiler: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_program_profiler.html",
  ttnnProfiler: "https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/profiling_ttnn_operations.html",
  tensixDataflow: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.html",
  cards: "https://tenstorrent.com/en/hardware/cards",
  tensor: "https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/tensor.html",
  linear: "https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/api/ttnn.linear.html",
  dataflowApi: `${sourceRoot}/tt_metal/hw/inc/api/dataflow/dataflow_api.h#L1743-L1917`,
  cbApi: `${sourceRoot}/tt_metal/hw/inc/api/dataflow/dataflow_api.h#L832-L1223`,
  types: `${sourceRoot}/tt_metal/api/tt-metalium/tensor/tensor_types.hpp#L26-L40`,
  bhInt8: `${sourceRoot}/tt_metal/tt-llk/tt_llk_blackhole/common/inc/ckernel_defs.h#L279-L284`,
  modelPrecision: `${sourceRoot}/models/tt_transformers/tt/model_config.py#L128-L237`,
  modelConfig: `${sourceRoot}/models/tt_transformers/tt/model_config.py#L528-L680`,
  sdpa: `${sourceRoot}/ttnn/cpp/ttnn/operations/transformer/sdpa_decode/sdpa_decode.cpp#L41-L178`,
  sdpaFactory: `${sourceRoot}/ttnn/cpp/ttnn/operations/transformer/sdpa_decode/device/sdpa_decode_program_factory.cpp#L510-L1035`,
  reader: `${sourceRoot}/ttnn/cpp/ttnn/operations/transformer/sdpa_decode/device/kernels/dataflow/reader_decode_all.cpp`,
  writer: `${sourceRoot}/ttnn/cpp/ttnn/operations/transformer/sdpa_decode/device/kernels/dataflow/writer_decode_all.cpp`,
  compute: `${sourceRoot}/ttnn/cpp/ttnn/operations/transformer/sdpa_decode/device/kernels/compute/sdpa_flash_decode.cpp`,
  cannOperatorGuide: "https://www.hiascend.com/document/detail/en/canncommercial/850/opdevg/Ascendcopdevg/atlas_ascendc_map_10_0004.html",
  cannPerformance: "https://www.hiascend.com/document/detail/en/CANNCommunityEdition/850/opdevg/Ascendcopdevg/atlas_ascendc_best_practices_10_0001.html",
  cannRuntime: "https://www.hiascend.com/document/detail/en/CANNCommunityEdition/850/opdevg/Ascendcopdevg/atlas_ascendc_10_00043.html",
  mindspore: "https://www.mindspore.cn/tutorials/en/stable/beginner/introduction.html",
  portfolio: "https://bui-cong-nguyen-acim.piernd2.chatgpt.site",
  resume: "https://bui-cong-nguyen-acim.piernd2.chatgpt.site/BuiCongNguyen_ResumeEN_202607.pdf",
} as const;

const scenarios: readonly Scenario[] = [
  {
    id: "area",
    short: "Fixed area",
    question: "With fixed silicon area, should I add compute, SRAM or memory bandwidth?",
    opening: "I would not choose from utilization alone. I would freeze the workload mix and service-level objective, build a roofline plus power model, then spend area on the resource that moves the weighted bottleneck without violating package, thermal and cost constraints.",
    bottleneck: "Classify every representative phase as compute-throughput, external-bandwidth, on-chip-bandwidth, capacity, communication, latency or power limited. A single average utilization number can hide a bandwidth-bound decode phase and a compute-bound prefill phase.",
    evidence: [
      "Arithmetic intensity at external memory and at local SRAM—not just FLOP count.",
      "Sustained compute utilization, HBM/GDDR bandwidth, NoC occupancy, SRAM bank conflicts and queue stalls.",
      "Workload weights: prefill/decode mix, batch/context distribution, latency percentile and throughput target.",
      "Iso-area is not enough: record power, die-edge/PHY limits, package pins, yield, verification cost and software programmability.",
    ],
    options: [
      { name: "More compute", bestWhen: "The weighted workload is compute-bound and operands already arrive on time.", benefit: "Raises peak and potentially sustained throughput.", cost: "Consumes area and power; can make the memory wall worse and lowers utilization if feed bandwidth is unchanged." },
      { name: "More SRAM", bestWhen: "Working sets or reusable tiles narrowly miss local capacity, causing repeat external reads.", benefit: "Raises reuse, reduces external traffic and can improve energy/op.", cost: "SRAM macros displace compute; larger structures may add access latency, banking and routing complexity." },
      { name: "More external bandwidth", bestWhen: "Measured bytes/s is near the controller limit and extra reuse cannot remove the traffic.", benefit: "Relieves streaming, weight and KV-cache bandwidth limits.", cost: "PHY and die edge, package, board, memory-device cost and I/O power do not trade like an ordinary compute block." },
      { name: "Better data movement / NoC", bestWhen: "Bandwidth exists but topology, multicast, bank conflicts or synchronization waste it.", benefit: "Improves effective bandwidth without adding raw arithmetic.", cost: "Control, buffering and verification complexity; may shift pressure to another level." },
    ],
    recommendation: "Sweep candidate points under the same area and power envelope. Recommend the smallest balanced change that improves the weighted geometric mean or required SLO. For a mixed LLM target, that is often a package of modest SRAM/bandwidth and reuse improvements—not simply the resource with the lowest headline utilization.",
    validation: ["Per-phase roofline position moves as predicted.", "P50/P99 latency and throughput improve on the frozen workload mix.", "Power, thermals, die/package cost and compiler mapping remain inside constraints."],
    followups: ["What if SRAM reduces compute count?", "How would you value area across six workloads?", "Why can HBM bandwidth be package-limited rather than core-area-limited?"],
    sources: [{ label: "TTNN operation profiling", href: links.ttnnProfiler }, { label: "Device Program Profiler", href: links.profiler }, { label: "Tenstorrent card memory/power table", href: links.cards }],
  },
  {
    id: "matmul",
    short: "GEMM dataflow",
    question: "How would you design matrix-multiplication dataflow?",
    opening: "I would choose a stationary dataflow and tile sizes from M, N, K, datatype, SRAM capacity, array shape and reuse—not assume one loop order. Then I would pipeline reader, compute and writer stages with explicit ownership and the narrowest correct completion barriers.",
    bottleneck: "Determine whether the shape is large-M prefill, small-M decode, batched GEMM or a skinny projection. Measure operand reuse, accumulator lifetime, external bytes, on-chip multicast, compute occupancy and tail tiles. The useful stationary operand changes with shape.",
    evidence: [
      "Tile-capacity inequality including A/B input tiles, wider accumulators, two buffer generations, alignment and circular-buffer metadata.",
      "Reader, compute and writer stage times; steady-state throughput is limited by the slowest stage.",
      "External and NoC bytes per output tile, multicast/fan-out, padding and partial-tile waste.",
      "Correctness under accumulation precision and synchronization—not only a fast microbenchmark.",
    ],
    options: [
      { name: "Output stationary", bestWhen: "An output tile can stay in registers/local storage across K.", benefit: "Avoids repeated partial-sum traffic.", cost: "Accumulator capacity limits M×N blocking and may reduce occupancy." },
      { name: "Weight stationary", bestWhen: "Weights are reused across tokens/batches, especially decode.", benefit: "Amortizes weight movement.", cost: "May increase activation or output movement; capacity limits resident weights." },
      { name: "Activation stationary / multicast", bestWhen: "One activation block feeds many output-channel blocks.", benefit: "Reduces replicated reads and exploits the NoC.", cost: "Fan-out, routing and synchronization can become the new bottleneck." },
      { name: "Double buffering", bestWhen: "Independent transfer and compute engines overlap and SRAM holds two live generations.", benefit: "Steady-state time approaches max(Tread, Tcompute, Twrite).", cost: "Nearly doubles selected buffers; wrong CB credits or barriers create overwrite, stale data or deadlock." },
    ],
    recommendation: "Start from output-stationary accumulation, select blocking by the full SRAM equation, then compare weight/activation reuse for the actual shape distribution. On TT-Metal, express the pipeline as reader → circular buffer → compute → circular buffer → writer; issue transfers early, wait immediately before consumption or reuse, and verify CB credit balance.",
    validation: ["Numerical result matches a wider-precision oracle.", "NoC bytes and external bytes fall as predicted.", "Reader/compute/writer overlap appears in the device timeline.", "Tail shapes and non-multiple-of-32 dimensions remain correct."],
    followups: ["Which loop would you reorder for decode?", "When does double buffering hurt?", "How do accumulator width and tile shape change SRAM demand?"],
    sources: [{ label: "Tensix compute dataflow", href: links.tensixDataflow }, { label: "Circular-buffer API", href: links.cbApi }, { label: "Typed NoC barriers", href: links.dataflowApi }],
  },
  {
    id: "scale",
    short: "7B → 70B",
    question: "A 7B model works well, but a 70B model does not. What do you investigate?",
    opening: "First I would define ‘does not work’: cannot load, out of memory, poor prefill throughput, poor decode latency, or poor multi-chip scaling. Those are different bottlenecks and need different fixes.",
    bottleneck: "Capacity is the first gate. Raw weights alone are about 140 GB at 16-bit, 70 GB at 8-bit and 35 GB at 4-bit for 70B—before scales, padding, runtime buffers and KV cache. Then separate prefill, which is often more compute-friendly, from decode, where weight/KV movement and small-M efficiency can dominate.",
    evidence: [
      "Exact checkpoint: layers, hidden size, attention heads, KV heads/GQA, head dimension and expert structure.",
      "Memory ledger: weights, quantization metadata, KV cache, activations, temporary buffers, program cache and fragmentation.",
      "KV formula: batch × sequence × layers × 2 × KV-heads × head-dim × bytes/value.",
      "Prefill and decode profiles separately: tokens/s, time-to-first-token, inter-token latency, bandwidth, compute and collective time.",
      "Single-chip versus multi-chip trace: bytes and synchronization per layer, link utilization and imbalance.",
    ],
    options: [
      { name: "Weight / KV compression", bestWhen: "Capacity or memory bytes dominate and the quality budget permits it.", benefit: "Reduces storage and transfer volume.", cost: "Calibration, scales/conversions, possible accuracy loss and kernel-support constraints." },
      { name: "Paged or blocked KV management", bestWhen: "Variable-length requests waste reserved cache or fragmentation limits concurrency.", benefit: "Improves usable capacity and batching flexibility.", cost: "Indirection, block management and potentially less regular access." },
      { name: "Tensor parallel", bestWhen: "One layer is too large and fast collectives are available.", benefit: "Splits weight/compute capacity per layer.", cost: "Introduces frequent all-reduce/all-gather traffic and latency sensitivity." },
      { name: "Pipeline parallel", bestWhen: "Layer groups fit per device and enough microbatches hide pipeline stages.", benefit: "Lower per-device model capacity with less intra-layer communication.", cost: "Pipeline bubbles, activation transfers and weaker single-request latency." },
      { name: "Data parallel", bestWhen: "The model already fits and aggregate request throughput is the goal.", benefit: "Simple throughput scaling.", cost: "Does not solve one-replica weight capacity." },
    ],
    recommendation: "Build the memory ledger first. If 70B does not fit, choose a supported precision and shard weights before tuning kernels. If it fits but decode is slow, profile KV/weight bandwidth and small-M kernels. If single-device phases are healthy but scaling is poor, redesign partitioning and collective placement. Keep separate recommendations for prefill and decode.",
    validation: ["The complete model plus worst-case runtime state fits with headroom.", "Quality remains inside a predeclared token/perplexity/task budget.", "Prefill, decode and multi-chip scaling each meet their own SLO.", "Communication/computation overlap is measured, not assumed."],
    followups: ["Why does data parallel not fix capacity?", "How does GQA change KV size?", "When would pipeline parallel beat tensor parallel?"],
    sources: [{ label: "Blackhole Transformer configs", href: links.modelConfig }, { label: "SDPA decode validation", href: links.sdpa }, { label: "SDPA decode program factory", href: links.sdpaFactory }, { label: "Hardware memory capacities", href: links.cards }],
  },
  {
    id: "precision",
    short: "FP8 vs INT8",
    question: "When would you choose FP8 instead of INT8?",
    opening: "I would first name the exact formats and supported kernels. FP8 E4M3/E5M2, INT8 with a scale policy, and Tenstorrent BFLOAT8_B are different numerical contracts. Then I would choose per tensor role using accuracy, range, conversion cost, throughput and memory traffic.",
    bottleneck: "Ask whether the problem is representable range, quantization error, storage/bandwidth, hardware throughput or missing operator support. Dynamic range alone does not decide: scale granularity, activation outliers, accumulator precision and calibration determine the usable error.",
    evidence: [
      "Activation/weight distributions by layer and role, including outliers and calibration coverage.",
      "Per-tensor versus per-channel/group scales, symmetric versus asymmetric mapping and zero-point overhead.",
      "Kernel legality, layout restrictions, conversion/requantization cost and accumulator datatype.",
      "Layer error, logits/tokens and end-task quality plus warm performance and transferred bytes.",
    ],
    options: [
      { name: "FP8 E4M3", bestWhen: "A floating exponent helps activations with variable range and E4M3 precision is adequate.", benefit: "Broader native range than fixed-scale INT8 within a block/tensor.", cost: "Format-specific hardware/software support, scaling and lower integer-like precision near some values." },
      { name: "FP8 E5M2", bestWhen: "Range is more important than mantissa precision, often gradients or extreme activations.", benefit: "More exponent range.", cost: "Only two mantissa bits; often excessive inference error and not universally supported." },
      { name: "INT8", bestWhen: "Per-channel/group scaling captures the distribution and efficient integer kernels exist.", benefit: "Simple 8-bit storage and strong dense arithmetic efficiency on supported paths.", cost: "Outliers, calibration/zero-point complexity, scale traffic and possible INT32/requantization overhead." },
      { name: "Tenstorrent BFLOAT8_B", bestWhen: "The current TTNN/TT-Transformers operator path supports Block Float 8 for the tensor role.", benefit: "Shared exponent amortizes metadata and is a common TT model path.", cost: "Values share an exponent block; it is not IEEE FP8 and can lose small values near block outliers." },
    ],
    recommendation: "For this pinned TT-Metal LLM path, start BF16, move supported roles to BFLOAT8_B, then consider BFLOAT4_B selectively. Treat INT8 or FP8_E4M3 as operation-specific until the exact linear/attention path proves support. In a generic NPU interview, answer FP8 for variable-range activations and INT8 for well-calibrated distributions only after stating the scale and accumulation contracts.",
    validation: ["Every selected operator accepts the format and layout.", "Calibration data represents real prompts and sequence regimes.", "Quality and overflow/saturation metrics pass.", "End-to-end speedup survives conversion and scale overhead."],
    followups: ["Why is BFLOAT8_B not FP8?", "Why can INT8 still need calibration?", "Which tensors should stay BF16?"],
    sources: [{ label: "TTNN datatype enum", href: links.types }, { label: "TTNN tensor/BFP8 documentation", href: links.tensor }, { label: "ttnn.linear dtype contract", href: links.linear }, { label: "TT-Transformers precision policy", href: links.modelPrecision }, { label: "Blackhole INT8 LLK predicate", href: links.bhInt8 }],
  },
  {
    id: "utilization",
    short: "Keep NPU busy",
    question: "How do you keep an NPU busy?",
    opening: "I would treat utilization as a pipeline balance problem, not just launch more work. I would measure reader, compute, writer, synchronization and host gaps, then remove the largest bubble while preserving buffer ownership.",
    bottleneck: "The slowest steady-state stage sets throughput. Low compute occupancy can come from memory stalls, tiny shapes, load imbalance, excessive barriers, launch overhead, bank conflicts or writer backpressure; adding async operations without finding the cause can make the queue longer rather than the chip busier.",
    evidence: [
      "Device timeline for reader/compute/writer and host command gaps.",
      "Per-core work and tail imbalance, CB full/empty waits, NoC outstanding time and barrier scope.",
      "Shape distribution, tile utilization, padding and number of Programs/dispatches.",
      "SRAM occupancy before increasing CB depth or adding another buffer generation.",
    ],
    options: [
      { name: "Async DMA + double buffering", bestWhen: "Transfer and compute are independent and two live buffer generations fit.", benefit: "Overlaps movement with useful computation.", cost: "More SRAM and stricter generation ownership; fill/drain overhead remains." },
      { name: "Fusion / persistent execution", bestWhen: "Dispatch and intermediate materialization dominate.", benefit: "Removes launch gaps and memory round trips.", cost: "Larger kernels, register/SRAM pressure, reduced modularity and compilation complexity." },
      { name: "Better sharding and load balance", bestWhen: "Some cores finish early or tail tiles dominate.", benefit: "Raises useful parallel occupancy.", cost: "More complex partitioning and possible communication/reduction overhead." },
      { name: "Batching / shape specialization", bestWhen: "Work is too small to fill the array.", benefit: "Amortizes launch and increases tile occupancy.", cost: "Queueing latency, more KV/activation memory and more compiled variants." },
      { name: "Narrower barriers", bestWhen: "Global/full waits serialize independent traffic.", benefit: "Lets unrelated transfers and compute overlap.", cost: "Requires proof of transaction, queue, VC and buffer-reuse ordering." },
    ],
    recommendation: "Profile a warm representative run. If Tread is largest, reduce bytes, multicast or prefetch; if Tcompute is largest, improve tile occupancy or add parallel work; if Twrite/backpressure is largest, drain/fuse outputs. Use two-entry CBs first, issue broadly and wait narrowly at the first consumer or reuse boundary, then tune depth from measured burst behavior.",
    validation: ["Steady-state stage overlap increases without new correctness failures.", "CB credits balance and Watcher reports no NoC/CB violations.", "Warm throughput and tail latency improve on real shape distributions.", "Extra SRAM and power are included in the result."],
    followups: ["Why can 100% compute utilization be the wrong goal?", "When is triple buffering justified?", "Where should the NoC barrier sit?"],
    sources: [{ label: "Device Program Profiler", href: links.profiler }, { label: "NoC barrier contracts", href: links.dataflowApi }, { label: "Circular-buffer contracts", href: links.cbApi }, { label: "SDPA reader kernel", href: links.reader }, { label: "SDPA compute kernel", href: links.compute }, { label: "SDPA writer kernel", href: links.writer }],
  },
  {
    id: "power",
    short: "Power over budget",
    question: "Performance meets target, but power exceeds budget. What do you change?",
    opening: "I would optimize energy for the required SLO, not reduce frequency blindly. First attribute power to compute, SRAM, NoC, external memory and leakage, then remove wasted work and movement before applying DVFS or reducing resources.",
    bottleneck: "Separate instantaneous board/chip power, thermal limit and energy per token/request. Determine whether excess power comes from useful arithmetic, low-utilization toggling, external traffic, over-wide precision, communication, or static/leakage during a longer execution.",
    evidence: [
      "Power trace aligned with prefill/decode and device-profiler regions.",
      "Energy/token or energy/request together with P50/P99 latency and throughput.",
      "Bytes moved at every memory level, active/idle core time, precision and clock/voltage state.",
      "Thermal steady state and throttling—not only a short benchmark average.",
    ],
    options: [
      { name: "Reduce data movement", bestWhen: "External/NoC traffic is large or duplicated.", benefit: "Can reduce both energy and latency through reuse, fusion and locality.", cost: "Consumes SRAM/registers and may reduce occupancy or increase scheduling complexity." },
      { name: "Lower precision", bestWhen: "Quality headroom and efficient kernels exist.", benefit: "Reduces storage, bandwidth and often arithmetic energy.", cost: "Calibration/accuracy risk, conversion overhead and possible unsupported paths." },
      { name: "Clock/power gating", bestWhen: "Resources are idle or phases use only part of the machine.", benefit: "Cuts unnecessary dynamic or leakage power.", cost: "Wake-up/control complexity and possible latency jitter." },
      { name: "DVFS", bestWhen: "There is performance headroom and voltage can fall enough to save energy.", benefit: "Dynamic power can fall strongly with voltage and frequency.", cost: "Longer runtime may raise leakage energy or violate tail latency; available states are platform-specific." },
      { name: "Cap concurrency / reshape schedule", bestWhen: "Peak power, not total energy, violates the limit.", benefit: "Reduces simultaneous switching and thermal excursions.", cost: "May lower throughput or increase queueing latency." },
    ],
    recommendation: "Keep the required throughput and tail-latency constraints fixed. Rank changes by joules saved per unit of engineering/quality cost: remove redundant transfers and padding, improve reuse/fusion, narrow supported tensor roles, gate idle resources, then choose the lowest DVFS point that still meets the SLO. Recheck thermal steady state.",
    validation: ["Power and energy both come from the named measurement method.", "Quality, throughput and P99 latency remain inside budget.", "No thermal throttling appears in a sustained run.", "The result includes memory and interconnect power, not only compute-core estimates."],
    followups: ["Why can lowering frequency increase energy/request?", "Would you sacrifice SRAM or compute first?", "How do you reduce peak power without reducing total throughput?"],
    sources: [{ label: "Device Program Profiler", href: links.profiler }, { label: "Tenstorrent board power specifications", href: links.cards }, { label: "TT-Transformers precision controls", href: links.modelPrecision }, { label: "Tensix dataflow and reuse", href: links.tensixDataflow }],
  },
] as const;

const prepTopics: readonly PrepTopic[] = [
  {
    id: "memory",
    title: "NPU architecture + memory hierarchy",
    priority: 5,
    thesis: "Peak TOPS is useful only when operands arrive on time. Model every memory level, the reuse it enables, and the cost of each byte moved.",
    learn: "Draw compute, registers, local SRAM/L1, NoC, device DRAM/HBM and host memory. Explain arithmetic intensity, working-set fit, tiling, prefetch, DMA and two-buffer ownership.",
    rehearse: "Answer: ‘HBM is saturated; what now?’ Separate compulsory bytes from avoidable bytes, then compare fusion, tiling, reuse, compression and workload partitioning.",
    prove: "Use a per-phase roofline, bandwidth counters, compute occupancy, SRAM high-water mark, NoC stalls and end-to-end latency under a frozen workload.",
    memory: "More bandwidth feeds bytes. Reuse removes bytes.",
    href: "#models",
    linkLabel: "Whiteboard models",
  },
  {
    id: "transformer",
    title: "Transformer / LLM optimization",
    priority: 4,
    thesis: "Prefill and decode are different workloads: prefill exposes large GEMMs; decode often exposes weight/KV movement, small-M efficiency and launch overhead.",
    learn: "Trace QKᵀ → online softmax → V, KV-cache growth, MHA/MQA/GQA, FlashAttention-style tiling, paged KV and tensor/pipeline partitioning.",
    rehearse: "For 7B → 70B, define the failure first: capacity, prefill, decode or scale-out. Build the full memory ledger before proposing a kernel optimization.",
    prove: "Report TTFT, inter-token latency, tokens/s, KV and weight bytes, small-M utilization, collective time and task-quality acceptance separately.",
    memory: "Capacity first; then split prefill, decode and communication.",
    href: "./discussion-transformer-blackhole-optimization.html",
    linkLabel: "Transformer chain",
  },
  {
    id: "quantization",
    title: "Quantization",
    priority: 4,
    thesis: "A smaller datatype is not automatically faster or accurate; the decision includes range, scale granularity, accumulation, conversions and supported kernels.",
    learn: "Refresh symmetric/asymmetric affine quantization, scale and zero point, MinMax/percentile calibration, outliers, PTQ/QAT, mixed precision, FP8 and block floating point.",
    rehearse: "Explain why MinMax wastes most INT8 codes when a few activation outliers stretch the range, then compare clipping, percentile calibration, per-channel scales and precision islands.",
    prove: "Keep a float baseline and check layer error, logits/tokens, task quality, transferred bytes, conversion overhead and warm end-to-end performance.",
    memory: "Name the format, scale policy, accumulator and quality gate.",
    href: "./discussion-quantization.html",
    linkLabel: "Quantization guide",
  },
  {
    id: "compiler",
    title: "Compiler flow",
    priority: 4,
    thesis: "Each compiler stage should establish a contract the next stage can consume: legal graph semantics, target-aware layout, executable schedule and bounded memory.",
    learn: "Walk framework/ONNX → graph IR → canonicalization and fusion → quantization → layout/tiling → placement/scheduling → kernel lowering → runtime dispatch.",
    rehearse: "For each pass, say what invariant it preserves, what cost it reduces, which target constraint it exposes, and which artifact proves the decision.",
    prove: "Compare IR, schedule, placement, memory plan, generated kernels and runtime traces while retaining numerical equivalence and a stable workload.",
    memory: "Preserve semantics; expose constraints; lower only after legality.",
    href: "./discussion-presentation.html",
    linkLabel: "Compiler/runtime room",
  },
  {
    id: "fusion",
    title: "Operator fusion",
    priority: 4,
    thesis: "Fusion is a data-movement and dispatch trade, not a universal rule. It wins only when saved traffic exceeds the cost in live state, code size and lost parallelism.",
    learn: "Model MatMul → Add → activation with and without intermediate writeback. Include SRAM capacity, accumulator lifetime, layout compatibility, recomputation and producer/consumer parallelism.",
    rehearse: "Give one win and one loss case. State the precise boundary: which intermediate disappears, which buffer grows and which scheduling freedom is removed.",
    prove: "Check DRAM/NoC bytes, launch count, local-memory pressure, spills, occupancy, code size, numerical equivalence and warm latency.",
    memory: "Fuse to remove a boundary—stop when the fused working set breaks the machine.",
    href: "./discussion-transformer-blackhole-optimization.html#compiler",
    linkLabel: "Fusion evidence",
  },
  {
    id: "scheduling",
    title: "Scheduling, clustering + dataflow",
    priority: 4,
    thesis: "Using every core is not the objective; satisfying the SLO with balanced work, local data and tolerable communication is.",
    learn: "Study core grids, shards, multicast, producer/consumer pipelines, synchronization, tail tiles, load balance, collectives and the distinction between capacity and bandwidth scaling.",
    rehearse: "For 16 cores, sweep core count and explain why insufficient parallel work, bandwidth saturation, synchronization, tails or topology can make fewer cores faster.",
    prove: "Measure per-core work, idle/wait time, link/NoC occupancy, imbalance, barrier cost, bytes moved and end-to-end throughput—not only kernel time.",
    memory: "Parallelism is useful work divided by coordination cost.",
    href: "./discussion-blackhole-synchronization.html",
    linkLabel: "Synchronization field guide",
  },
  {
    id: "tenstorrent",
    title: "Tenstorrent experience boundary",
    priority: 5,
    thesis: "Lead with the contribution you owned: retargeting and validating a Tenstorrent-derived compiler/runtime stack on custom automotive NPU silicon.",
    learn: "Prepare the exact boundaries across model conversion, quantization, dependency-safe scheduling, core-grid/L1 fit, dispatch, NCRISC/BRISC handoff and ARM-host integration.",
    rehearse: "Say what you changed, what public stack concepts informed the work, what remained Tenstorrent-authored, and which employer details or measurements must stay confidential.",
    prove: "Anchor the story in four enabled model families and reproducible public concepts; label current TT-Metal study separately from historical professional use.",
    memory: "Integrated and debugged the stack; do not claim authorship of the platform.",
    href: `${links.portfolio}/#professional-scope`,
    linkLabel: "Portfolio evidence boundary",
  },
  {
    id: "huawei",
    title: "Huawei CANN + MindSpore",
    priority: 3,
    thesis: "Show ecosystem literacy without pretending instant mastery: locate framework, graph/compiler, operator, runtime and hardware boundaries, then map your existing method onto them.",
    learn: "Trace MindSpore or another frontend into CANN graph/operator paths, Ascend C tiling and kernels, runtime streams, device memory and Ascend execution. Learn the nouns and ownership boundaries.",
    rehearse: "Explain how you would bring up one operator: define semantics and shapes, choose tiling, implement kernel/data movement, compile/deploy, run, profile and optimize from evidence.",
    prove: "Use Huawei's current operator-development, runtime and tuning guides; distinguish documented capability from anything not personally measured on Ascend hardware.",
    memory: "Map the stack; run one operator; profile the real boundary.",
    href: links.cannOperatorGuide,
    linkLabel: "Official Ascend C guide",
  },
  {
    id: "performance",
    title: "Performance analysis",
    priority: 5,
    thesis: "‘The model is slow’ is not a diagnosis. Define the SLO and workload, establish a warm baseline, localize the limiting boundary, change one mechanism and remeasure.",
    learn: "Separate host, dispatch, compute, external memory, local memory, NoC/collective, synchronization, allocation and shape-tail costs. Know latency, throughput, utilization and energy boundaries.",
    rehearse: "Practice the same sequence aloud for an unfamiliar operator and for a whole model. Resist proposing HBM, more cores or quantization before evidence.",
    prove: "Retain profiler artifacts, revisions, configuration, correctness gates, repeated measurements, variance and a rollback threshold.",
    memory: "Measure → localize → change one mechanism → prove.",
    href: `${links.portfolio}/performance-method`,
    linkLabel: "My performance method",
  },
  {
    id: "projects",
    title: "Your projects",
    priority: 5,
    thesis: "A principal story is a decision trail: problem and constraint, measured signal, rejected alternatives, chosen change, result and evidence boundary.",
    learn: "Prepare Bos NPU, PIE CUDA/DMA, Cadence routing and Samsung production-vision cases. For each, separate personal ownership, team/platform work and confidential facts.",
    rehearse: "Build a 45-second opening and a five-minute drill-down for each case. Expect ‘why this?’, ‘what counter?’, ‘what failed?’, ‘what trade-off?’ and ‘how did you know?’",
    prove: "Use only résumé-supported outcomes: four NPU model families, real-time acquisition beyond the C# path, 80% routing runtime reduction and shipped vision metrics.",
    memory: "Problem → evidence → decision → measured outcome → boundary.",
    href: `${links.portfolio}/portfolio#work`,
    linkLabel: "Portfolio case studies",
  },
  {
    id: "questions",
    title: "Principal question bank",
    priority: 5,
    thesis: "The answer pattern matters more than memorizing a preferred optimization. Clarify the constraint, branch on evidence and defend a reversible decision.",
    learn: "Use the 17 prompts below to cover bottlenecks, HBM, SRAM, tiling, buffering, fusion, Transformer, quantization, regression, core count, clustering and simulator-only work.",
    rehearse: "Answer each in 45 seconds, then handle two follow-ups for three minutes. Record yourself and remove any claim without a metric, constraint or ownership boundary.",
    prove: "Score every answer on BETRV: bottleneck, evidence, options, trade-offs, recommendation and validation. A complete answer earns six points.",
    memory: "A principal answer makes a falsifiable decision under constraints.",
    href: "#question-bank",
    linkLabel: "Open 17 prompts",
  },
  {
    id: "simulator",
    title: "Simulator vs real hardware",
    priority: 3,
    thesis: "Simulation narrows the design space and proves contracts; hardware establishes latency, bandwidth, contention, thermals, power and system behavior.",
    learn: "Separate functional correctness, architectural sequence, resource accounting and comparative experiments from timing-accurate or silicon-performance claims.",
    rehearse: "Describe a two-gate plan: simulator-backed oracle and fault injection first; then named hardware, counters, power method and acceptance test when access exists.",
    prove: "Pin simulator and TT-Metal revisions, retain golden outputs and negative tests, label simulator time non-silicon, and pre-register the later hardware metrics.",
    memory: "Simulate to shortlist; measure hardware to claim performance.",
    href: "./index.html#experiments",
    linkLabel: "TT-Sim lab path",
  },
  {
    id: "focus",
    title: "Preparation scope + restraint",
    priority: 2,
    thesis: "Depth on transferable architecture reasoning and owned evidence beats shallow recall of every API, instruction format or chip specification.",
    learn: "Know the purpose of CANN, MindSpore, core compiler stages and TT-Metal concepts. Defer obscure APIs, full ISA detail and unverified silicon specifications.",
    rehearse: "Practice saying: ‘I have not measured that platform yet; here is the experiment and the result that would change my recommendation.’",
    prove: "End preparation with sleep, a one-page memory sheet, the portfolio narrative and repeated spoken answers—not another broad reading pass.",
    memory: "Know the boundary; show the method; do not bluff the detail.",
    href: "#study-plan",
    linkLabel: "One-day sequence",
  },
] as const;

const evidenceCases = [
  { tag: "NPU COMPILER / RUNTIME", result: "Enabled four automotive model families", ownership: "Retargeting, conversion/quantization, scheduling and resource-fit analysis, dispatch/L1/RISC debug, and ARM-host integration on a Tenstorrent-derived stack.", href: `${links.portfolio}/#professional-scope` },
  { tag: "REAL-TIME C++ / CUDA", result: "Moved the physical hot path beyond C# throughput", ownership: "Acquisition, DMA, reusable/zero-copy buffers, producer-consumer ownership, CUDA processing and real-hardware validation; confidential production rates omitted.", href: `${links.portfolio}/pie-ndt` },
  { tag: "EDA PERFORMANCE", result: "Reduced routing runtime by 80%", ownership: "Multithreading and a routing-pattern hash cache in a production C++ routing engine; proprietary code and workload data omitted.", href: `${links.portfolio}/portfolio#results` },
  { tag: "PRODUCTION VISION", result: "Shipped measured on-device algorithms", ownership: "Nine years from PC research to Android/JNI delivery, including sub-millisecond localization and real-time tracking constraints.", href: `${links.portfolio}/portfolio#work` },
] as const;

const principalPrompts = [
  ["How would you optimize an NPU with real hardware?", "Freeze SLO + workload; profile phases before choosing a lever."],
  ["How do you prove memory-bound versus compute-bound?", "Use roofline plus sustained bytes/s, compute occupancy and stall attribution."],
  ["Why does HBM help?", "It raises external bandwidth and capacity—not locality or arithmetic intensity."],
  ["Can HBM become the bottleneck?", "Yes; compare required bytes/s with sustained controller bandwidth by phase."],
  ["HBM is saturated. What next?", "Remove avoidable bytes through reuse, fusion, compression or partition changes."],
  ["Why use SRAM/local memory?", "Capture a reusable working set and feed compute at lower latency/energy."],
  ["What is tiling?", "Partition work to fit live data and expose locality/parallelism under target constraints."],
  ["Why does double buffering help?", "Overlap independent stages when two generations fit and ownership is correct."],
  ["When is fusion beneficial?", "When saved traffic/dispatch exceeds added live-state and scheduling cost."],
  ["When can fusion hurt?", "Spills, lower occupancy, lost parallelism, recompute, layout mismatch or code growth."],
  ["How would you optimize Transformer inference?", "Split prefill/decode; then target GEMM, KV/weights, batching and communication."],
  ["How does KV cache affect performance?", "Capacity, bandwidth, fragmentation and concurrency scale with exact KV geometry."],
  ["How does quantization affect performance and accuracy?", "Name format/scales/accumulator, supported kernel, bytes and quality gate."],
  ["How would you debug a regression?", "Bisect boundary and revision with the same warm workload and correctness oracle."],
  ["Should you use more NPU cores?", "Only if useful work outruns bandwidth, tails, synchronization and communication."],
  ["How would you evaluate clustering?", "Compare mapping, locality, traffic, imbalance, SLO, power and programmability."],
  ["What if you only have a simulator?", "Prove correctness/contracts and rank designs; reserve performance claims for hardware."],
] as const;

const studyPlan = [
  ["90 min", "Own the opening", "Portfolio slides 6–10, résumé outcomes, four project stories and the exact Tenstorrent ownership boundary."],
  ["120 min", "Build the machine model", "Memory hierarchy, roofline, tiling, double buffering, fusion and core-count trade-offs on a whiteboard."],
  ["120 min", "Walk the workload", "Transformer prefill/decode, KV ledger, quantization/outliers and compiler flow from graph to runtime."],
  ["60 min", "Map Huawei", "CANN, Ascend C, runtime and MindSpore nouns; rehearse one custom-operator bring-up without claiming hands-on results."],
  ["90 min", "Answer under pressure", "Six deep scenarios plus the 17-prompt bank. Record 45-second answers and one three-minute drill-down each."],
  ["30 min", "Close the loop", "Write one page from memory: BETRV, six formulas, four project outcomes, three honest boundaries and first-day plan."],
] as const;

const framework = [
  ["B", "Bottleneck", "Name the limited resource and the phase where it limits."],
  ["E", "Evidence", "Say which counters, formulas and workload distribution prove it."],
  ["O", "Options", "Offer two or three materially different design levers."],
  ["T", "Trade-offs", "Compare performance, power, area, cost, quality and complexity."],
  ["R", "Recommendation", "Choose one path under explicit constraints."],
  ["V", "Validation", "Define the experiment and pass/fail gates."],
] as const;

const formulas = [
  { tag: "ROOFLINE", formula: "P ≤ min(Ppeak, Bext × Iext, Bsram × Isram, Ppower)", note: "Use separate arithmetic intensity at each memory level." },
  { tag: "GEMM SRAM", formula: "2(Amt×kt + Bkt×nt) + Cmt×nt×accBytes + CB/meta ≤ SRAM", note: "The leading 2 represents two live input-buffer generations." },
  { tag: "MODEL MEMORY", formula: "Mtotal = Mweights + MKV + Mactivations + Mtemporary + Mprogram", note: "Quantization scales, padding and fragmentation are not free." },
  { tag: "KV CACHE", formula: "bytes = batch × tokens × layers × 2 × kvHeads × headDim × bytes/value", note: "Use the exact checkpoint; GQA changes kvHeads." },
  { tag: "PIPELINE", formula: "Tsteady ≈ max(Tread, Tcompute, Twrite)", note: "Sequential time is the sum; fill, drain and synchronization remain." },
  { tag: "ENERGY", formula: "Erequest = ∫P(t)dt; compare E/token under the same SLO", note: "Lower power can still consume more energy if runtime grows." },
] as const;

const decisionDiagram = `flowchart LR
    Q[Clarify objective and constraints] --> W[Freeze workload distribution]
    W --> P[Profile phases and build model]
    P --> B{First limiting resource?}
    B -->|compute| C[Compute or mapping options]
    B -->|memory| M[Capacity, reuse or bandwidth options]
    B -->|communication| N[Partition and NoC/link options]
    B -->|power| E[Energy and activity options]
    C --> T[PPA, cost, quality and software trade-offs]
    M --> T
    N --> T
    E --> T
    T --> R[Recommend one constrained design]
    R --> V[Validate and name rollback gate]`;

const matmulDiagram = `sequenceDiagram
    participant H as External memory
    participant R as Reader / NoC
    participant A as CB generation A
    participant B as CB generation B
    participant C as Compute / accumulators
    participant W as Writer / NoC

    R->>A: Fill tile k
    R->>B: Prefetch tile k+1
    A-->>C: Publish valid pages
    C->>C: Accumulate output tile
    C-->>W: Publish completed output
    W->>H: Async writeback
    Note over R,W: Reuse a generation only after its consumer returns ownership`;

const scaleDiagram = `flowchart TD
    S[7B succeeds; 70B fails] --> F{What does fail mean?}
    F -->|cannot load / OOM| C[Build weight + KV + runtime memory ledger]
    F -->|slow prefill| P[Check GEMM utilization, layout, padding and compute]
    F -->|slow decode| D[Check weight/KV bytes, small-M kernels and batching]
    F -->|poor multi-chip scaling| X[Check partition, collectives, links and imbalance]
    C --> C1[Supported precision + tensor/pipeline partition]
    P --> P1[Shape-specific program and kernel tuning]
    D --> D1[KV management + locality + decode specialization]
    X --> X1[Move or overlap communication; change partition]
    C1 --> V[Validate quality, capacity, TTFT, ITL and tokens/s]
    P1 --> V
    D1 --> V
    X1 --> V`;

const powerDiagram = `flowchart TD
    S[Performance passes; power fails] --> M[Measure power by phase and subsystem]
    M --> Q{Dominant avoidable energy?}
    Q -->|memory / NoC| R[Reuse, fuse and remove redundant bytes]
    Q -->|precision / work| L[Use supported lower precision or remove padding]
    Q -->|idle switching| G[Clock/power gate or rebalance]
    Q -->|performance headroom| D[Select lower DVFS point]
    R --> V[Recheck quality, throughput, P99, energy/token and thermals]
    L --> V
    G --> V
    D --> V`;

const answerTemplate = [
  "Opening: ‘I would first separate ___ from ___.’",
  "Bottleneck: ‘The design is limited by ___ during ___.’",
  "Evidence: ‘I would prove that with ___.’",
  "Options: ‘The credible choices are A, B and C.’",
  "Trade-offs: ‘A improves ___ but costs ___; B does ___.’",
  "Recommendation: ‘Under the stated ___ constraint, I choose ___.’",
  "Validation: ‘I accept it only if ___ while ___ remains within budget.’",
].join("\n");

function ArchitectureInterviewApp() {
  const [activeId, setActiveId] = useState(scenarios[0].id);
  const active = scenarios.find((scenario) => scenario.id === activeId) ?? scenarios[0];

  return (
    <div className="architect-page">
      <header className="architect-topbar">
        <a className="architect-brand" href="./index.html"><b>TT•SIM</b><span>architecture interview workbench</span></a>
        <nav aria-label="Page navigation"><a href="#framework">Framework</a><a href="#prep-map">13-topic plan</a><a href="#evidence">My evidence</a><a href="#scenarios">Scenarios</a><a href="#question-bank">17 prompts</a><a className="architect-back" href="./discussion.html">← Discussion</a></nav>
      </header>

      <main>
        <section className="architect-hero">
          <div className="architect-hero-index"><span>DISCUSSION</span><strong>07</strong><small>NPU<br/>ARCHITECTURE</small></div>
          <article><p>BOTTLENECK → EVIDENCE → OPTIONS → TRADE-OFFS → RECOMMENDATION → VALIDATION</p><h1>Do not guess<br/>the resource.<br/><em>Prove the limit.</em></h1><div className="architect-thesis"><b>Interview thesis</b><p>A strong answer does not list optimizations. It defines the workload and constraint, identifies the first limiting resource, compares real alternatives under PPA/cost/quality, recommends one, and states how the decision will be falsified.</p></div></article>
          <aside><span>SOURCE BASELINE</span><code>{commit.slice(0, 12)}</code><p>General NPU reasoning is mapped to pinned TT-Metal/TTNN contracts. Professional claims are limited to the résumé and portfolio evidence below; product measurements still require a named device and workload.</p><a href="./DISCUSSION_ARCHITECTURE_INTERVIEW.md">Copy complete answers ↗</a><a className="hero-secondary-link" href={links.portfolio}>Open portfolio ↗</a></aside>
        </section>

        <section id="framework" className="architect-section framework-section">
          <header><span>00 / ANSWER CONTRACT</span><h2>Use BETRV.<br/>Make the choice defensible.</h2><p>The original four-part structure is good. Adding evidence and validation prevents a plausible story from masquerading as an architecture decision.</p></header>
          <div className="framework-grid">{framework.map(([letter, title, detail]) => <article key={letter}><b>{letter}</b><small>{title}</small><p>{detail}</p></article>)}</div>
          <pre className="answer-template">{answerTemplate}</pre>
        </section>

        <section id="prep-map" className="architect-section prep-section">
          <header><span>01 / THIRTEEN-TOPIC PLAN</span><h2>Study for transfer.<br/>Recall by decision.</h2><p>Each topic has one thesis, one learning pass, one spoken drill, one proof standard and one memory line. Open a row, explain it without reading, then use its linked evidence.</p></header>
          <div className="prep-grid">
            {prepTopics.map((topic, index) => (
              <details className={`prep-card priority-${topic.priority}`} id={`prep-${topic.id}`} key={topic.id}>
                <summary><span>{String(index + 1).padStart(2, "0")}</span><div><small>{"★".repeat(topic.priority)}{"☆".repeat(5 - topic.priority)}</small><h3>{topic.title}</h3></div><i>OPEN</i></summary>
                <div className="prep-thesis"><b>PRINCIPAL THESIS</b><p>{topic.thesis}</p></div>
                <dl>
                  <div><dt>LEARN</dt><dd>{topic.learn}</dd></div>
                  <div><dt>REHEARSE</dt><dd>{topic.rehearse}</dd></div>
                  <div><dt>PROVE</dt><dd>{topic.prove}</dd></div>
                </dl>
                <blockquote>{topic.memory}</blockquote>
                <a href={topic.href}>{topic.linkLabel} ↗</a>
              </details>
            ))}
          </div>
        </section>

        <section id="evidence" className="architect-section evidence-section">
          <header><span>02 / OWNERSHIP + EVIDENCE</span><h2>Connect the method<br/>to work you own.</h2><p>The strongest interview bridge is not “I know every NPU.” It is a precise record of decisions and results across accelerator software, CUDA pipelines, production algorithms and large C++ systems.</p></header>
          <div className="evidence-grid">
            {evidenceCases.map((item, index) => <article key={item.tag}><span>{String(index + 1).padStart(2, "0")} · {item.tag}</span><h3>{item.result}</h3><p>{item.ownership}</p><a href={item.href}>Open supporting case ↗</a></article>)}
          </div>
          <div className="evidence-boundary"><b>SAY THIS PRECISELY</b><p>“I retargeted and validated a Tenstorrent-derived software stack on our custom NPU platform. My work covered model conversion and quantization, dependency-safe scheduling and resource fit, dispatch/L1/RISC debugging, and ARM-host integration. I do not claim authorship of Tenstorrent’s platform architecture.”</p></div>
          <nav className="profile-links" aria-label="Candidate materials"><a href={links.resume}>Public résumé · Jul 2026 ↗</a><a href={links.portfolio}>Technical portfolio ↗</a><a href={`${links.portfolio}/portfolio`}>Outcome portfolio ↗</a><a href={`${links.portfolio}/performance-method`}>Performance method ↗</a></nav>
        </section>

        <section id="study-plan" className="architect-section study-section">
          <header><span>03 / ONE-DAY EXECUTION</span><h2>Six passes.<br/>One recall sheet.</h2><p>This sequence follows the interview’s likely value: owned project evidence, architecture reasoning and performance analysis first; ecosystem vocabulary after the transferable method is stable.</p></header>
          <ol className="study-timeline">{studyPlan.map(([time, title, task], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><time>{time}</time><h3>{title}</h3><p>{task}</p></li>)}</ol>
          <div className="study-gate"><b>STOP CONDITION</b><p>Preparation is complete when you can answer from a blank page: BETRV, the six whiteboard models, four owned project outcomes, the simulator/hardware boundary and a first-30-days Huawei learning plan.</p></div>
          <nav className="huawei-links" aria-label="Official Huawei study sources"><b>OFFICIAL HUAWEI PATH</b><a href={links.mindspore}>MindSpore stack ↗</a><a href={links.cannOperatorGuide}>Ascend C operator guide ↗</a><a href={links.cannRuntime}>CANN runtime flow ↗</a><a href={links.cannPerformance}>Performance optimization ↗</a></nav>
        </section>

        <section id="scenarios" className="architect-section scenario-section">
          <header><span>04 / SIX DEEP-DIVE CASES</span><h2>Choose the question.<br/>Walk the evidence.</h2><p>Each answer begins with a concise interview opening, then exposes the deeper reasoning an interviewer may probe.</p></header>
          <div className="scenario-tabs" role="tablist" aria-label="Architecture interview scenarios">{scenarios.map((scenario, index) => <button type="button" role="tab" aria-selected={active.id === scenario.id} className={active.id === scenario.id ? "active" : ""} onClick={() => setActiveId(scenario.id)} key={scenario.id}><span>{String(index + 1).padStart(2, "0")}</span>{scenario.short}</button>)}</div>
          <article className="scenario-panel" role="tabpanel">
            <div className="scenario-opening"><span>QUESTION</span><h3>{active.question}</h3><blockquote>{active.opening}</blockquote></div>
            <div className="scenario-bottleneck"><span>BOTTLENECK</span><p>{active.bottleneck}</p></div>
            <div className="scenario-evidence"><span>EVIDENCE TO COLLECT</span><ol>{active.evidence.map((item, index) => <li key={item}><b>{String(index + 1).padStart(2, "0")}</b><p>{item}</p></li>)}</ol></div>
            <div className="option-table"><header><span>OPTION</span><span>USE WHEN</span><span>BENEFIT</span><span>TRADE-OFF</span></header>{active.options.map((option) => <div key={option.name}><b>{option.name}</b><p>{option.bestWhen}</p><p>{option.benefit}</p><p>{option.cost}</p></div>)}</div>
            <div className="scenario-decision"><div><span>RECOMMENDATION</span><p>{active.recommendation}</p></div><div><span>VALIDATION GATES</span><ul>{active.validation.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
            <div className="scenario-followups"><b>LIKELY FOLLOW-UPS</b>{active.followups.map((item) => <span key={item}>{item}</span>)}</div>
            <div className="scenario-sources"><b>SOURCES</b>{active.sources.map((source) => <a href={source.href} key={source.href}>{source.label} ↗</a>)}</div>
          </article>
        </section>

        <section id="question-bank" className="architect-section question-section">
          <header><span>05 / SEVENTEEN RECALL PROMPTS</span><h2>Start with the branch.<br/>Not the buzzword.</h2><p>Cover the answer, speak for 45 seconds, then reveal the first move. Score one point for each BETRV element you make explicit; target six of six.</p></header>
          <ol className="question-grid">{principalPrompts.map(([question, firstMove], index) => <li key={question}><span>{String(index + 1).padStart(2, "0")}</span><h3>{question}</h3><details><summary>Reveal first move</summary><p>{firstMove}</p></details></li>)}</ol>
        </section>

        <section id="models" className="architect-section formula-section">
          <header><span>06 / WHITEBOARD MODELS</span><h2>Put a bound<br/>on the story.</h2><p>These are first-order models, not performance predictions. Their job is to expose the missing input and reject impossible recommendations early.</p></header>
          <div className="formula-grid">{formulas.map((item, index) => <article key={item.tag}><span>{String(index + 1).padStart(2, "0")} · {item.tag}</span><code>{item.formula}</code><p>{item.note}</p></article>)}</div>
          <div className="weight-table"><header><span>RAW WEIGHT LOWER BOUND</span><b>7B</b><b>70B</b><small>EXCLUDES SCALE/METADATA + RUNTIME STATE</small></header>{[["BF16 / 16-bit", "14 GB", "140 GB"], ["8-bit", "7 GB", "70 GB"], ["4-bit", "3.5 GB", "35 GB"]].map(([format, seven, seventy]) => <div key={format}><b>{format}</b><span>{seven}</span><span>{seventy}</span><small>decimal GB</small></div>)}</div>
        </section>

        <section id="diagrams" className="architect-section diagram-section">
          <header><span>07 / DECISION FLOWS</span><h2>Draw the branch.<br/>Then defend the arrow.</h2><p>Keep interview diagrams small enough to redraw. The long evidence remains in the scenario cards and Markdown reference.</p></header>
          <div className="diagram-grid">
            {[["Architecture decision loop", decisionDiagram], ["Tiled GEMM double buffer", matmulDiagram], ["7B to 70B diagnosis", scaleDiagram], ["Power-over-budget path", powerDiagram]].map(([title, diagram]) => <article key={title}><h3>{title}</h3><div className="architect-mermaid-shell"><pre className="mermaid">{diagram}</pre></div></article>)}
          </div>
        </section>

        <section className="architect-review">
          <div><span>LOGIC REVIEW</span><h2>Six traps to reject.</h2></div>
          <ol><li><b>Low compute utilization ≠ add compute.</b><p>It may prove the opposite: operands cannot feed the existing units.</p></li><li><b>More SRAM ≠ free bandwidth.</b><p>Only reuse or working-set capture turns capacity into fewer external bytes.</p></li><li><b>70B ≠ KV-only problem.</b><p>Raw weight capacity may fail before a KV-cache optimization matters.</p></li><li><b>FP8 ≠ BFLOAT8_B.</b><p>Name exponent/mantissa or block-exponent semantics and the supported operator.</p></li><li><b>Async ≠ overlap.</b><p>Independent engines, sufficient buffering and correct ownership are all required.</p></li><li><b>Lower watts ≠ lower energy.</b><p>A slower run can integrate to more joules and miss the latency SLO.</p></li></ol>
        </section>
      </main>

      <footer className="architect-footer"><div><b>TT•SIM · DISCUSSION SUBPAGE 07</b><p>Principal-level NPU interview plan from owned evidence to falsifiable decisions.</p></div><a href={links.portfolio}>Portfolio ↗</a><a href={links.resume}>Public résumé ↗</a><a href="./discussion-presentation.html">Presentation room →</a><a href="./discussion-transformer-blackhole-optimization.html">Transformer chain →</a><a href="./discussion-quantization.html">Quantization →</a><a href="./discussion.html">Discussion →</a></footer>
    </div>
  );
}

export default ArchitectureInterviewApp;
