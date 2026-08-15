# Quasar clusters versus Blackhole cores: a repeatable architecture lab

Research snapshot: **16 August 2026**

TT-Metal source baseline: **`50a82f835593512c4176546b4af68d7e91315a86`**

Quasar simulator baseline: **ttsim v1.10.1**, x86-64 SHA-256 `b82063169370cb49ceab219fb853310f4dd19cb6a799fab460876a7f65c10b60`

## The short answer

Yes: Quasar is **cluster-oriented inside the chip**. The current experimental
host API says that one addressable Quasar worker cluster contains:

- 8 data-movement (DM) cores;
- 4 Tensix Neo engines, each with 4 TRISC processors; and
- one shared 4 MiB SRAM address space.

Users target the cluster; TT-Metal selects resources inside it. On ordinary
worker clusters, DM0 and DM1 are reserved for runtime work, leaving DM2–DM7 as
six user DM cores. A cluster accepts one compute kernel, which may use one to
four Neo engines.

That is different from a **device mesh**. TT-Metal represents even one chip as a
1×1 `MeshDevice`, and Blackhole chips can also form large multi-chip clusters.
The terms describe different levels:

1. **Quasar worker cluster:** one on-chip NoC-addressed compute node.
2. **On-chip grid:** many Quasar worker clusters; the current simulator
   descriptor exposes 32 workers in an 8×4 rectangle.
3. **MeshDevice / system cluster:** one or more accelerator chips managed as a
   logical mesh; this abstraction applies to Blackhole as well as Quasar.

## Evidence hierarchy

Quasar remains pre-silicon and its public simulator is binary-only. Therefore,
the comparison below separates facts in the public host API from values in the
current simulator descriptor. Descriptor values explain what this lab runs;
they are not promises about an unreleased production part.

| Property | Quasar in this public stack | Blackhole | Evidence type |
|---|---|---|---|
| Kernel target | Cluster | Tensix worker core | Host API / HAL |
| Data-movement processors per target | 8 DM; 6 currently available to user kernels | BRISC + NCRISC | Host API / HAL |
| Compute organization | 4 Neo engines × 4 TRISCs | TRISC0 + TRISC1 + TRISC2 | Host API / HAL |
| Shared SRAM per worker target | 4 MiB | 1.5 MiB | Simulator SoC descriptor |
| Worker targets | 32, arranged 8×4 | 140 functional nodes in the unharvested SoC descriptor | Simulator SoC descriptor |
| NoC coordinate extent | 10×8 | 17×12 | Simulator SoC descriptor |
| DRAM channels represented | 2 | 8 | Simulator SoC descriptor |
| Ethernet / PCIe endpoints represented | none in the current QSR descriptor | 14 Ethernet / 2 PCIe | Simulator SoC descriptor |
| Local memory behavior | DM private caches + shared L2 + TL1 visibility path | Explicit shared SRAM scratchpad | Implementation notes / Metalium docs |
| Public ttsim maturity | Early bring-up; binary-only | Near feature complete; source available | ttsim README |

### Why this matters to a compiler

A Blackhole-oriented lowering commonly thinks in a three-kernel pipeline:
reader on BRISC, compute across three TRISCs, writer on NCRISC. Quasar adds an
intra-cluster scheduling problem. A compiler or runtime must select DM threads
and Neo engines, respect the one-compute-kernel-per-cluster rule, and manage
visibility through caches before another agent or the host observes data.

Do not bake these into a generic graph IR. Carry target capabilities—worker
count, SRAM capacity, available DM threads, engine count, legal memory spaces
and required visibility operations—as attributes introduced during target
lowering. That keeps fusion, tiling and memory planning independent of one chip.

## Run the experiment

From the cloned learning-guide repository in WSL:

```bash
cd /path/to/tt-sim
chmod +x scripts/03-quasar-cluster-lab.sh

export TT_METAL_HOME=~/src/tt-metal
export TT_METAL_SIMULATOR=~/sim/libttsim_qsr.so

# Phase 1: descriptor and source audit; does not run the simulator
./scripts/03-quasar-cluster-lab.sh inspect

# Phase 2: supported Quasar L1-write baseline
./scripts/03-quasar-cluster-lab.sh run

# Or capture both phases in one timestamped directory
./scripts/03-quasar-cluster-lab.sh all
```

Each invocation creates a timestamped directory under
`~/ttsim-lab-results/`. The architecture phase writes an evidence table,
TT-Metal commit and simulator checksum. The runtime phase saves the complete
GoogleTest log and uses an isolated JIT cache.

The script deliberately does **not** edit `NOC_API_V2`. With ttsim v1.10.1,
the upstream known-issues section says the baseline test currently requires the
legacy NOC V1 path. If V2 is enabled, the script stops and asks you to make and
review that source decision yourself.

## Follow-up compiler/runtime experiments

1. **Resource-aware scheduling:** model one cluster as six user DM slots and
   four Neo-engine slots. Reject a schedule requesting seven user DMs or two
   compute kernels on the same cluster.
2. **Tiling and placement:** compare a 4 MiB Quasar cluster budget with a
   1.5 MiB Blackhole worker budget. Report tile residency, spill bytes and NoC
   transfers instead of simulator wall-clock time.
3. **Visibility pass:** represent `DM store → L2 flush → host/NoC read` as
   explicit IR effects. Write a verifier that rejects a read with no visibility
   operation on its dependency path.
4. **Two-level parallelism:** distribute an operation over the 8×4 cluster grid,
   then assign work inside each cluster across Neo engines. Keep those mapping
   decisions as two separate passes.
5. **Target-independent fusion:** fuse `matmul + bias + relu` before target
   lowering, then compare Blackhole and Quasar resource plans for the same
   fused operation.

## Primary sources

- [Quasar experimental host API at the lab commit](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/host_api/temp_quasar_api.hpp)
- [Quasar processor mapping in the HAL](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/hal/tt-2xx/quasar/qa_hal_tensix.cpp)
- [Blackhole processor mapping in the HAL](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/hal/tt-1xx/blackhole/bh_hal_tensix.cpp)
- [Quasar simulator SoC descriptor](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/soc_descriptors/quasar_32_arch.yaml)
- [Blackhole simulator SoC descriptor](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/soc_descriptors/blackhole_140_arch.yaml)
- [TT-Metal mesh and DRAM-loopback explanation](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/examples/dram_loopback.html)
- [Blackhole grid and three-kernel architecture](https://docs.tenstorrent.com/tt-quietbox2-guide/builder-hacker/01-tt-metal-architecture/)
- [Official ttsim status and Quasar known issues](https://github.com/tenstorrent/ttsim)
