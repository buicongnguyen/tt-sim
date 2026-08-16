# Tenstorrent Blackhole versus Huawei Ascend

Research date: **16 August 2026**

## Scope and verdict

This comparison uses the shipping Blackhole p150 card and the original Huawei
Ascend 910/Da Vinci architecture where public memory data exists. It does not
invent 910B or 910C chip specifications. Huawei's announced Ascend 950 memory is
shown only as a future-roadmap note.

There is no architecture-only winner. Blackhole emphasizes many programmable
Tensix workers, large distributed SRAM, explicit dataflow, an open compiler-to-
kernel stack and Ethernet scale-out without HBM. Ascend emphasizes Cube/Vector
engines fed through a deep local-memory hierarchy and MTE movement, with the
original Ascend 910 using high-bandwidth global memory.

## The two data paths

```text
Blackhole Tensix
GDDR6 → NoC → local SRAM/circular buffers
       → unpack → matrix/SFPU → pack
       → local SRAM → NoC → GDDR6
       controlled by BRISC/NCRISC + three TRISCs

Huawei Ascend AI Core
HBM/global memory → MTE2 → L1 → L0A/L0B
                  → Cube → L0C → FixPipe → GM/L1
vector path: GM → MTE2 → UB → Vector → UB → MTE3 → GM
                  controlled by Scalar instruction queues
```

Huawei's official [Ascend C architecture guide](https://www.hiascend.com/document/detail/en/canncommercial/850/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html)
documents Cube, Vector, Scalar, MTE1/2/3, L1, L0A/B/C, Unified Buffer and
FixPipe, including the exact flows above. Tenstorrent's
[compute-engine guide](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.html)
documents the corresponding unpack/math/pack dataflow and programmable RISC-V
roles.

## Comparison by design decision

| Axis | Blackhole p150 | Huawei Ascend 910 / Da Vinci | Consequence, not marketing verdict |
|---|---|---|---|
| Compute organization | 120 enabled Tensix workers; matrix/vector math plus small RISC-V controllers | AI Cores with Cube, Vector and Scalar; later A2/A3 products separate AIC/AIV | Both overlap movement and compute, but scheduling granularity and memory contracts differ |
| Local memory | 180 MB aggregate SRAM on p150 | L1, L0A/B/C, UB and caches; a Huawei-hosted paper reports 34 MB on-chip cache for Ascend 910 | Blackhole exposes more aggregate on-card SRAM; the values are not like-for-like address spaces |
| External memory | 32 GB GDDR6, 512 GB/s | Architecture material identifies 32 GB HBM Gen2; paper reports about 1.2 TB/s GM→L1/UB for Ascend 910 | Ascend 910 has about 2.34× the cited global-memory feed rate; Blackhole relies more on SRAM locality and explicit movement |
| Kernel model | TT-Metal/LLK reader-compute-writer kernels and circular buffers | Ascend C kernels with GlobalTensor/LocalTensor, queues and MTE copy-in/out | Both demand tiling and pipelining; APIs expose different machine abstractions |
| Openness | TT-Metal, TT-NN, TT-MLIR/TT-Forge and LLKs are public | CANN/Ascend C documentation and community interfaces are public; low-level silicon implementation visibility differs | Blackhole is easier to audit from compiler to architecture-specific LLK source |
| Scale-out | Direct Ethernet links and TT-Fabric; Galaxy uses 32 ASICs | HCCS/UnifiedBus/SuperPoD system organization depends on Ascend generation | Compare deployed systems and collective workloads, not a single link label |
| Memory philosophy | Tenstorrent explicitly markets an HBM-free design | Ascend 910 uses HBM-class global memory; 950 roadmap announces proprietary HBM | HBM raises off-chip bandwidth; SRAM reuse, interconnect and software can still decide end-to-end performance |

Memory evidence: Tenstorrent's [Blackhole card table](https://tenstorrent.com/en/hardware/cards),
a [Huawei Da Vinci presentation](https://www.cmc.ca/wp-content/uploads/2020/03/Zhan-Xu-Huawei.pdf)
that identifies 32 GB HBM Gen2, and a [Huawei-hosted technical paper](https://edu.hicomputing.huawei.com/cloud_resource/edu_public/courseReviewAttachment/1754290511519-Low_Bit_NPUs_and_CPUs_for_HPL_MxP--%E8%8E%B7%E5%A5%96%E8%AE%BA%E6%96%87%EF%BC%88%E8%96%9B%E4%BC%9F%E8%AF%9A%EF%BC%89.pdf),
which reports 32 GB global memory, 1.2 TB/s GM-to-local paths, 34 MB on-chip
cache, a 16×16×16 tensor unit and 256 TFLOPS for Ascend 910. The paper is
technical evidence hosted by Huawei, not a current 910B/910C product sheet.

## Question 1: What can Huawei learn from Tenstorrent?

### Short answer

Huawei does not need to learn the basic idea of an asynchronous AI pipeline.
Ascend already has Cube, Vector and Scalar units, local memory and independent
MTE copy engines. The more useful Tenstorrent lesson is to make **locality,
communication and failure evidence more programmable and visible**.

### 1. Treat data movement as part of the algorithm

TT-Metal exposes reader and writer kernels, circular buffers, NoC operations,
semaphores and multicast. A kernel developer can describe not only the math,
but where a tile lives, who produces it and when a consumer may proceed. The
[Metalium programming model](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/get_started/get_started.html)
formalizes the reader → compute → writer pipeline, while the
[multicast matmul lab](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/matmul/lab3/lab3.html)
shows one DRAM read feeding several workers through on-chip multicast.

Ascend already exposes `GlobalTensor`, `LocalTensor`, queues and MTE movement.
The lesson is to make peer-local-memory movement, multicast, queue occupancy and
topology costs equally stable compiler primitives. That would help a compiler
reason about:

- one HBM read feeding several AI Cores;
- Cube/Vector handoff without avoidable global-memory traffic;
- producer/consumer backpressure;
- communication and compute overlap;
- the local-memory high-water mark.

### 2. Strengthen the software-visible control plane

Huawei describes the Scalar unit as a small controller that calculates
addresses, controls loops and issues Cube, Vector, transfer and synchronization
instructions. Tenstorrent gives each worker several programmable RISC-V roles
around its matrix and vector engines.

More general local control can help Huawei with irregular work that does not map
perfectly to a dense pipeline:

- sparse tensors and Mixture-of-Experts routing;
- dynamic load balancing;
- fragmented or discontinuous memory accesses;
- custom collectives;
- graph and signal-processing kernels with nonuniform control flow.

Huawei's newer Ascend C SIMT interfaces already move in this direction, so this
is an evolution rather than a missing capability.

### 3. Make cluster-local reuse complement HBM

The lesson is not to replace HBM with GDDR6. HBM is one of Huawei's real
advantages. Instead, combine high external bandwidth with more compiler-visible
reuse:

```text
HBM / global memory
        ↓ read once
cluster-local buffer or multicast source
        ↓ distribute on-chip
Cube / Vector consumers
        ↓ reuse many times
write the fused result once
```

A Quasar-like cluster direction is interesting here because hierarchical shared
SRAM can reduce off-cluster traffic. Quasar is pre-silicon, however, so it is a
design hypothesis—not evidence that it outperforms Ascend or Blackhole.

### 4. Publish a continuous compiler-to-binary evidence path

Tenstorrent developers can inspect TT-MLIR/TT-Forge, TT-NN, TT-Metal, HAL code,
firmware, architecture LLKs, generated RISC-V ELF files and simulator behavior.
Huawei provides extensive Ascend C and CANN interfaces, but could make more of
the lowering and binary contract reproducible:

```text
framework graph
  → compiler IR and fusion decision
  → tiling and memory plan
  → generated device binary
  → MTE/Cube/Vector queues
  → HCCL communication
  → device trace and numerical result
```

The most useful simulator would preserve this entire chain and allow a failing
device PC to be mapped back to the generated operation and source decision.

### 5. Expose topology to the compiler

Tenstorrent treats NoC and Ethernet movement as part of the programming model.
Huawei already has HCCL and large scale-up domains; the lesson is to make route,
placement and congestion costs more explicit to graph compilation. Operator
placement, tensor placement and collective scheduling should share one cost
model rather than becoming separate optimization passes with incomplete
information.

### Answer in one line

> Huawei should keep its HBM and mature CANN system, while adopting more
> explicit locality, programmable communication, open lowering contracts and
> simulator-level observability from the Tenstorrent approach.

## Question 2: Where is Huawei more advanced than Tenstorrent in architecture and performance?

### Short answer

Huawei's documented advantages are **external-memory bandwidth, specialized
dense-compute pipelines, tightly integrated scale-up and production training
software**. Public evidence does not establish that Huawei is universally
faster per chip, per watt or per dollar.

### 1. Higher cited external-memory feed

The original Ascend 910 evidence reports 32 GB of global memory and about
1.2 TB/s for GM → L1/UB paths. Blackhole p150 publishes 32 GB GDDR6 at
512 GB/s. On this deliberately narrow axis:

```text
1.2 TB/s ÷ 0.512 TB/s ≈ 2.34×
```

That gives Ascend a higher ceiling for large-batch training, long-context
attention, embeddings and other operations that repeatedly reach external
memory. It is not a prediction that every application is 2.34× faster.
Blackhole counters with 180 MB of distributed SRAM and explicit reuse; the
Ascend cache and Blackhole SRAM totals are not like-for-like address spaces.

### 2. A deeply specialized dense-compute hierarchy

Huawei's public architecture defines Scalar issue and synchronization, Cube
matrix execution, Vector execution, MTE1/2/3 movement, L1, L0A/B/C, Unified
Buffer and FixPipe. The separated architecture can schedule AIC and AIV
resources independently under system-software control. See the official
[Ascend C architecture guide](https://www.hiascend.com/document/detail/en/canncommercial/850/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html).

For a well-optimized dense kernel, this specialization can keep transfer,
matrix, post-processing and copy-out engines busy concurrently. Its tradeoff is
less general control and, in the separated design, some AIC/AIV exchange through
global memory.

### 3. A larger tightly coupled scale-up domain

Huawei's official [Atlas 900 A3 page](https://www.hiascend.com/hardware/cluster)
publishes:

- up to 384 interconnected Ascend NPUs;
- 48 TB of unified-addressed device memory;
- 784 GB/s bidirectional device-to-device bandwidth;
- 200 ns single-hop communication latency;
- 307.2/288.7 PFLOPS FP16 system peak, depending on configuration.

Tenstorrent's [Blackhole Galaxy page](https://tenstorrent.com/hardware/galaxy)
publishes a different-sized unit:

- 32 Blackhole chips;
- 1 TB aggregate GDDR6 and 6.2 GB aggregate SRAM;
- 23 PFLOPS Block-FP8 peak;
- 32 TB/s accelerator fabric, plus Ethernet scale-out to multiple Galaxies.

Huawei is more advanced in presenting hundreds of NPUs as one tightly
integrated scale-up machine. Tenstorrent emphasizes smaller modular units and
programmable Ethernet scale-out. The peak numbers cannot rank them because the
chip count, precision and system boundary differ.

### 4. A more mature large-training software system

[CANN 9.0 documentation](https://www.hiascend.com/document/detail/en/CANNCommunityEdition/900/index/index.html)
lists PyTorch, TensorFlow and MindSpore integration, graph and operator APIs,
HCCL collectives, transformer acceleration, automatic optimization, profiling,
precision debugging and migration tools. Huawei also reports production
deployment of Atlas 900 A3 SuperPoDs.

TT-NN, TT-Forge/TT-MLIR and TT-Fabric are open and improving quickly, but the
Blackhole production ecosystem is younger. For a large training installation,
collective reliability, framework coverage and operational tooling can matter
as much as a chip's arithmetic peak.

### What the performance evidence supports

Huawei is likely advantaged when the chosen product and software version are
well optimized for:

- large distributed FP16/BF16 training;
- dense matrix workloads;
- HBM/global-memory-bound operators;
- large scale-up collectives;
- applications already covered by CANN/HCCL libraries.

Tenstorrent can remain attractive for explicit dataflow research, custom and
irregular kernels, software-controlled SRAM reuse, open compiler work and
modular Ethernet-based inference.

### What the evidence does not support

No trustworthy public apples-to-apples benchmark holds all of these constant:

```text
same model + same precision + same batch
+ same compiler maturity + same power boundary
+ same number of chips + same latency target
```

FP16 Atlas 900 A3 totals cannot be ranked directly against Block-FP8 Galaxy
totals. Vendor demonstrations using different models or configurations also do
not establish per-chip performance, performance per watt or cost per token.

### Answer in one line

> Huawei is ahead in HBM-fed dense training and tightly integrated scale-up;
> Tenstorrent is ahead in open low-level programmability and explicit dataflow,
> and controlled measurements are still required for an end-to-end winner.

## Does Huawei “use HBM”?

**Yes for the original Ascend 910 evidence used here:** the cited architecture
presentation specifies 32 GB HBM Gen2, and a recent peer-reviewed
[Ascend performance-model paper](https://doi.org/10.1145/3820380) describes the
off-chip HBM/L2-to-local path. That answer must not be generalized to
undocumented variants. Memory packaging changes by product and generation.
Public discussions often mix Ascend 910, 910B, 910C and future 950
specifications; this report does not.

Huawei's official [2025 roadmap announcement](https://www.huawei.com/en/news/2025/9/hc-xu-keynote-speech)
says Ascend 950DT will use 144 GB HiZQ 2.0 HBM at 4 TB/s and targets Q4 2026.
As of this report date, that is a future vendor roadmap, not a shipping
Blackhole comparison and not evidence about 910C.

## Compiler/runtime implications

For `Y = ReLU(A × B + bias)`:

- **Blackhole:** place tiles across Tensix workers, stage through distributed
  SRAM/circular buffers, run matrix math, then fuse bias/ReLU to avoid an
  intermediate DRAM trip. TT-Metal makes NoC movement and synchronization
  explicit.
- **Ascend:** tile global tensors into L1/L0A/L0B for Cube, accumulate in L0C,
  then use FixPipe or Vector/UB for post-processing before MTE copy-out. On a
  separated AIC/AIV design, system software must coordinate matrix and vector
  cores and their global-memory exchange.

The same compiler questions remain—tiling, legal formats, lifetimes, overlap,
fusion and synchronization—but the target cost model must be different.

## Decision guide

Prefer Blackhole as a learning/research target when you need end-to-end public
source, direct LLK inspection, explicit dataflow control, large distributed SRAM
and Ethernet-oriented scaling. Prefer Ascend when deployment is already inside
the CANN/Ascend ecosystem or when the chosen product's verified HBM/global-
memory behavior best matches the workload. Validate both with the real model;
memory technology and peak arithmetic alone are insufficient.

## Evidence limits

- The Ascend memory/cache numbers describe original Ascend 910 in the cited
  paper, not 910B/910C.
- Blackhole and Ascend “on-chip memory” totals have different bank structures,
  visibility and semantics.
- Peak TFLOPS across different formats or sparsity definitions are not ranked.
- Quasar is intentionally absent: it has no public final-product specification.
