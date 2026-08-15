# Wormhole → Blackhole → Quasar: code-backed architecture comparison

Research date: **16 August 2026**

TT-Metal snapshot: **`50a82f835593512c4176546b4af68d7e91315a86`**

## Bottom line

Blackhole is a measurable generation step over Wormhole in card density,
clock, SRAM, external-memory bandwidth, BlockFP8 throughput, PCIe and Ethernet
connectivity. It is not better in every microarchitectural counter: official
profiling documentation, for example, exposes four Wormhole packer engines but
one combined Blackhole packer signal.

Quasar is not publicly proven faster than Blackhole. The current TT-Metal code
shows a more ambitious **cluster-oriented scheduling unit**: eight data-movement
cores, four Tensix Neo engines with four TRISCs each, and 4 MiB of shared SRAM.
That organization can improve within-node concurrency and data reuse if the
compiler schedules it well. Quasar is pre-silicon, binary-only in public ttsim,
and still in bring-up, so this is a capability/direction claim—not a benchmark
claim.

## Evidence taxonomy

- **Product fact:** an official shipping-card specification.
- **Code fact:** a value or branch in the pinned TT-Metal source.
- **Simulator-model fact:** a value in a public SoC descriptor.
- **Inference:** a consequence that can follow if software uses the capability.
- **Unknown:** no reliable public evidence; no number is invented.

## Shipping cards: Blackhole p150 versus Wormhole n150

These rows use matching single-chip developer cards and matching BlockFP8
definitions. Product counts stay separate from unharvested simulator descriptors.

| Card-level property | Wormhole n150 | Blackhole p150 | Change | Why it matters |
|---|---:|---:|---:|---|
| Enabled Tensix cores | 72 | 120 | 1.67× | More independent worker placement opportunities |
| AI clock | 1.0 GHz | 1.35 GHz | 1.35× | Higher per-cycle-rate ceiling, workload permitting |
| SRAM | 108 MB | 180 MB | 1.67× | More tiles can remain near compute |
| GDDR6 capacity | 12 GB | 32 GB | 2.67× | Larger weights/KV state per card |
| Memory bandwidth | 288 GB/s | 512 GB/s | 1.78× | Higher off-chip supply ceiling |
| BlockFP8 | 148 TFLOPS | 664 TFLOPS | 4.49× | Large matching-format peak increase |
| Board power | 160 W | 300 W | 1.88× | The absolute gain costs a larger power envelope |
| BlockFP8 per board watt | 0.925 | 2.213 TFLOPS/W | 2.39× | Peak spec improves faster than board power |
| Host interface | PCIe 4.0 ×16 | PCIe 5.0 ×16 | generation change | Higher host-I/O ceiling |
| Card links | 2 × QSFP-DD 200G + Warp 100 | 4 × QSFP-DD 800G | higher nominal line rate | Much larger direct scale-out envelope |

Official sources: [Blackhole card specifications](https://tenstorrent.com/en/hardware/cards),
[Wormhole card specifications](https://docs.tenstorrent.com/aibs/wormhole/specifications.html),
and the [Blackhole launch note](https://open.tenstorrent.com/vision/tenstorrent-launches-blackhole-developer-products-at-tenstorrent-dev-day),
which identifies 6 nm manufacturing, a faster NoC, higher memory density and
additional integrated RISC-V cores.

## What the pinned TT-Metal code actually shows

### 1. The simulator topology grows, but it is not the product table

| Descriptor field | Wormhole B0 | Blackhole | Quasar |
|---|---:|---:|---:|
| NoC coordinate extent | 10×12 | 17×12 | 10×8 |
| Functional workers | 80 | 140 | 32 |
| Worker L1 | 1,499,136 B | 1,572,864 B | 4,194,304 B |
| DRAM channels | 6 | 8 | 2 |
| PCIe endpoints | 1 | 2 | 0 |

Sources: [Wormhole descriptor](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/soc_descriptors/wormhole_b0_80_arch.yaml),
[Blackhole descriptor](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/soc_descriptors/blackhole_140_arch.yaml),
[Quasar descriptor](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/soc_descriptors/quasar_32_arch.yaml).

The 140/80 ratio is evidence that the software model sees a wider Blackhole
worker fabric. It must not be substituted for 120/72 enabled card cores.
Quasar's “32 workers” are cluster targets, not 32 Blackhole-equivalent Tensix
workers.

### 2. Wormhole and Blackhole preserve the three-thread compute pipeline

The HAL maps both architectures to BRISC/NCRISC data movement plus TRISC0,
TRISC1 and TRISC2 compute roles. This continuity explains why the same
reader → circular buffer → compute → circular buffer → writer structure spans
both generations. Blackhole's gain is therefore not “more TRISC stages” in this
HAL contract.

Sources: [Wormhole HAL](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/hal/tt-1xx/wormhole/wh_hal_tensix.cpp)
and [Blackhole HAL](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/hal/tt-1xx/blackhole/bh_hal_tensix.cpp).

### 3. Blackhole has a broader architecture-specific LLK surface

At the pinned commit, the reproducible file-set diff counts 150 Wormhole, 177
Blackhole and 59 Quasar LLK files. It finds 28 Blackhole-only paths versus
Wormhole, including experimental paths
for fast tilize/untilize, face-compressed matmul, specialized RMSNorm, Hadamard,
sampling, top-k, softmax-k and clamped SiLU. This is evidence of a broader tuned
kernel surface. It is not proof that every operation has a new instruction or
is faster.

A particularly concrete contract change appears in
[`llk_pack_tile_api.h`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/ckernels/blackhole/metal/llk_api/llk_pack_tile_api.h):
Blackhole branches on 8-bit input formats and carries input/tile-column context
that the [Wormhole wrapper](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/ckernels/wormhole_b0/metal/llk_api/llk_pack_tile_api.h)
does not express in the same way.

Counterexample: official [TT-NN profiling documentation](https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/profiling_ttnn_operations.html)
says Wormhole exposes four per-engine packer signals while Blackhole uses
`PACK_COUNT=1` with combined `PACKER_BUSY`; Blackhole instead adds deeper L1 mux
visibility. “Newer” therefore means a changed balance, not more of every unit.

The top-level ReLU and matmul LLK wrapper differences are too small to establish
a performance cause. A valid speed claim needs device profiling on matching
shapes, formats, clocks and software revisions.

## Why Quasar changes the compiler/runtime problem

The temporary public Quasar host API defines:

- eight DM cores per cluster, with DM0–DM1 reserved and six user-available;
- four Tensix Neo engines per cluster;
- four compute TRISCs per Neo, or sixteen compute processors in the HAL;
- a 4 MiB shared worker SRAM in the simulator descriptor;
- one compute kernel per cluster today, using one to four Neo engines.

Sources: [Quasar host API](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/host_api/temp_quasar_api.hpp),
[host API implementation](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/host_api/temp_quasar_api.cpp),
[Quasar HAL](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/hal/tt-2xx/quasar/qa_hal_tensix.cpp),
and [DM firmware](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-2xx/dm.cc).

That supports four carefully bounded inferences:

1. **More internal overlap can be scheduled.** Six user DMs can stage independent
   transfers while up to four Neo engines compute.
2. **Shared locality can reduce duplication.** Data reused across engines can
   remain in a larger shared SRAM if placement and synchronization are correct.
3. **The compiler now needs two-level placement.** It chooses a cluster, then
   chooses DM threads and Neo engines inside that cluster.
4. **Contention becomes more important.** Shared SRAM, caches and NoC paths can
   become bottlenecks; resource count alone cannot predict performance.

The Quasar LLK tree is currently much smaller and 128 Blackhole paths are absent
from it. ttsim documents only basic RISC-V,
NoC, SFPU, packer and unpacker functionality. The public
[Quasar matmul LLK](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/ckernels/quasar/metal/llk_api/llk_math_matmul_api.h)
shows an intended kernel contract, not proof that full workloads are mature.
[ttsim's status](https://github.com/tenstorrent/ttsim) is the decisive caveat.

## Execution flow

```text
Wormhole / Blackhole
Host queue → DRAM → BRISC reader → circular buffer
           → TRISC0 unpack → TRISC1 math → TRISC2 pack
           → circular buffer → NCRISC writer → DRAM

Quasar public direction
Host targets cluster → runtime selects DM2…DM7 and Neo0…Neo3
  → shared 4 MiB SRAM/cache-visible state
  → up to four Neo engines, each with four TRISCs
  → explicit visibility/synchronization → output
```

## How to reproduce the code audit

```bash
cd ~/src/tt-sim
export TT_METAL_HOME=~/src/tt-metal
chmod +x scripts/05-architecture-evidence.sh
./scripts/05-architecture-evidence.sh
```

The script records the exact commit, parses all three descriptors, diffs the
architecture-specific LLK file sets, extracts Quasar limits and records the
Blackhole pack-format branch. Its report goes under
`~/ttsim-lab-results/architecture-evidence-<UTC>/`.

## Claim review verdict

- **Supported:** Blackhole p150 raises several card-level ceilings over Wormhole
  n150, and its code has a broader architecture-specific optimization surface.
- **Supported as architectural direction:** Quasar exposes a cluster with more
  internal data-movement and compute resources plus a larger shared SRAM.
- **Not supported:** Quasar is already faster, more efficient, or generally
  better than Blackhole.
- **Measurement required:** any operator latency, throughput, energy or scaling
  ranking not stated in matching official product specifications.
