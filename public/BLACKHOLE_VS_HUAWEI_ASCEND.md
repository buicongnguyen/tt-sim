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
