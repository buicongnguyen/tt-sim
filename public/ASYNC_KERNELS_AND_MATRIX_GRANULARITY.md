# Asynchronous kernels and matrix granularity

Research date: **16 August 2026**
TT-Metal source inspected: **`50a82f835593512c4176546b4af68d7e91315a86`**

## Executive correction

Tenstorrent does use semaphores, barriers, atomics, circular-buffer credits and
fences, but they operate at different scopes and are not interchangeable.

The matrix-shape conclusion is:

> A normal Tenstorrent tile is 32×32 and is stored as four 16×16 faces. In the
> current Wormhole, Blackhole and Quasar LLKs, one standard `MVMUL` updates an
> 8×16 destination strip. Four such issues cover a 32×16 region, not an entire
> 32×32 output tile.

The official [Tiles guide](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/tiles.html)
documents the four-face storage layout. The current
[`TensorShape`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/tt-llk/common/tensor_shape.h#L19-L42)
defines a maximum 16×16 face, a 32×32 tile and a 2×2 face grid.

## One pipeline, several synchronization domains

```text
Host command queue
       ↓ enqueue program / event / Finish
Reader data-movement RISC
       ↓ NoC reads + read barrier
Input circular buffer
       ↓ wait_front / pop_front
UNPACK RISC → MATH RISC → PACK RISC
       ↓ tile_regs acquire / commit / wait / release
Output circular buffer
       ↓ wait_front / pop_front
Writer data-movement RISC
       ↓ NoC writes + write barrier
DRAM, another core, PCIe or fabric
```

A compute kernel is written as one source but compiled into three binaries for
the unpack, math and pack RISC-V processors. The official
[Tensix compute-engine guide](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.html)
explains why destination-register ownership must be synchronized explicitly.

## The correct Tenstorrent mechanisms

| Mechanism | Scope | Guarantee | Normal use |
|---|---|---|---|
| Command queue and event | Host and device | FIFO submission or explicit dependency/completion | Overlap host work, transfers and programs |
| `noc_async_read/write` | Issuing data-movement RISC and NoC | Starts a transfer; return does not imply completion | DRAM↔L1, peer L1, PCIe and multicast movement |
| NoC read/write/atomic barrier | One transaction queue or transaction ID | Waits for the selected transaction class to complete | Before consuming read data, reusing write source, or requiring atomic completion |
| `noc_async_writes_flushed` | Issuing write queue | Commands have departed; destination completion is not promised | Preserve overlap when the documented NoC ordering conditions are sufficient |
| Circular buffer operations | Producer and consumer sharing L1 | Tile/page ownership plus backpressure | Reader→compute and compute→writer streaming |
| `tile_regs_*` | UNPACK, MATH and PACK threads | Exclusive destination-register ownership and handoff | Protect FPU/SFPU results while packing overlaps math |
| NoC semaphore | Multiple Tensix cores | A local 4-byte L1 value can be waited on and remotely signalled | Readiness, credits, multicast acknowledgements and collectives |
| NoC atomic increment | Remote L1 word | Concurrent increments are not lost | Implement semaphore arrival counts and shared credits |
| Compiler/CPU fence | Compiler or host CPU | Prevents a particular class of reordering | Compiler correctness, PCIe/system-memory command rings; not NoC completion |

### Asynchronous NoC operations

`noc_async_read` and `noc_async_write` enqueue work and return. Their barriers
are deliberately separate so a kernel can issue several transfers, do useful
work, and wait only at the first real dependency.

```cpp
cb_reserve_back(input_cb, 1);
noc_async_read(src_noc_addr, get_write_ptr(input_cb), tile_bytes);
noc_async_read_barrier();   // bytes are now usable in local L1
cb_push_back(input_cb, 1);  // publish the completed tile to compute
```

The output direction reverses the ownership rule:

```cpp
cb_wait_front(output_cb, 1);
noc_async_write(get_read_ptr(output_cb), dst_noc_addr, tile_bytes);
noc_async_write_barrier();  // NoC no longer needs the source CB page
cb_pop_front(output_cb, 1); // page may now be reused
```

Use the narrowest correct wait. A read barrier should not become a full barrier
unless reads, writes and atomics all need to complete. Transaction-ID barriers
can wait for one transfer group while another remains in flight. See the
[`noc_async_read` API](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/apis/kernel_apis/data_movement/noc_async_read.html)
and [`noc_async_full_barrier` API](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/apis/kernel_apis/data_movement/noc_async_full_barrier.html).

### Circular-buffer credits

```text
Producer: reserve_back → fill page → push_back
Consumer: wait_front   → use page  → pop_front
```

`reserve_back` and `wait_front` may block. `push_back` publishes completed data;
`pop_front` releases storage for reuse. They do not themselves make an earlier
NoC transfer complete. The [CB API](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/apis/kernel_apis/circular_buffers/cb_wait_front.html)
also requires cumulative wait counts when several waits occur without a pop.

Only one thread should update a given CB read pointer and only one should update
its write pointer. Sharing pointer updates between, for example, compute and a
writer creates nondeterministic metadata even when the tile bytes are correct.

### Destination-register handoff

The public compute-kernel pattern is:

```cpp
cb_wait_front(in0, 1);
cb_wait_front(in1, 1);

tile_regs_acquire();
matmul_tiles(in0, in1, 0, 0, 0);
tile_regs_commit();

tile_regs_wait();
cb_reserve_back(out, 1);
pack_tile(0, out);
cb_push_back(out, 1);
tile_regs_release();

cb_pop_front(in0, 1);
cb_pop_front(in1, 1);
```

The exact legal ordering can move independent CB operations to overlap pack
with later work, but the ownership edges cannot be removed. Internal LLK names
such as `t6_semaphore_wait_on_zero`, `FPU_SFPU` and `UNPACK_SYNC` are lower-level
hardware handshakes. Regular Metalium kernels should use `tile_regs_*` rather
than manipulating those semaphores directly.

### Cross-core semaphores and atomics

`noc_semaphore_wait` polls a local L1 semaphore until it equals a target.
`noc_semaphore_wait_min` waits until the value is at least the target. Another
core can call `noc_semaphore_inc` on its NoC address; the increment is a remote
hardware atomic. See the official
[`noc_semaphore_inc` reference](https://docs.tenstorrent.com/tt-metal/v0.60.1/tt-metalium/tt_metal/apis/kernel_apis/data_movement/noc_semaphore_inc.html).

A conservative data-before-signal protocol is:

```cpp
noc_async_write(src_l1, remote_payload, bytes);
noc_async_write_barrier();
noc_semaphore_inc(remote_ready_sem, 1);
noc_async_atomic_barrier();
```

The current
[`NoC_tile_transfer/writer0.cpp`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/programming_examples/NoC_tile_transfer/kernels/dataflow/writer0.cpp#L27-L48)
uses this safe sequence. More optimized multicast protocols may use
`noc_async_writes_flushed` plus the NoC/VC ordering guarantee before signalling,
then a write barrier only before the source CB page is reused. That optimization
is correct only when its ordering assumptions match the selected architecture,
NoC, command buffer and virtual channel. The official
[multicast matmul lab](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/matmul/lab3/lab3.html)
walks through this distinction.

For monotonic arrival counters, `wait_min` avoids an exact-value waiter missing
an overshoot. Monotonic epochs also avoid resetting a counter while increments
for the next iteration are already in flight.

### Fence is an overloaded word

The LLK helper
[`fence_compiler()`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/tt-llk/common/ckernel_fence.h)
is a compiler-only memory clobber. It does not drain NoC transactions or wait
for FPU, SFPU, unpack or pack. Host `sfence`/`mfence` calls order CPU-visible
command-ring and PCIe memory. A RISC-V `fence.i` concerns the instruction cache.
None should be substituted for the public NoC or compute barriers.

## What the LLK does with a 32×32 tile

### Storage geometry

```text
32×32 tile

┌────────────────┬────────────────┐
│ face 0: 16×16  │ face 1: 16×16  │
├────────────────┼────────────────┤
│ face 2: 16×16  │ face 3: 16×16  │
└────────────────┴────────────────┘
```

The legacy flat face count maps as follows:

```text
1 face  → 16×16
2 faces → 16×32 by the legacy helper
4 faces → 32×32
```

Two faces are a real tiny-tile geometry. They are not the physical operation
repeated four times to form a full tile.

### Matrix micro-operation geometry

In the current standard Wormhole, Blackhole and Quasar LLKs:

```text
MVMUL: D[8,16] = B[8,16] × A[16,16]
```

The statement is visible in the
[Blackhole LLK](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/tt-llk/tt_llk_blackhole/llk_lib/llk_math_matmul.h#L47-L69)
and the equivalent Wormhole and Quasar implementations. The official TT-NN
documentation describes the matrix engine as natively multiplying 16×16 faces;
the LLK exposes the still-finer fact that one issued `MVMUL` updates eight of
the sixteen destination rows.

For ordinary matrix notation:

```text
C00 = A00×B00 + A01×B10
C01 = A00×B01 + A01×B11
C10 = A10×B00 + A11×B10
C11 = A10×B01 + A11×B11
```

Each 16×16 output face receives two K-face products. Each face product requires
two 8×16 destination strips. Therefore the current full-tile replay is:

```text
4 output faces × 2 K faces × 2 strips = 16 MVMUL issues
```

That count is per math-fidelity phase in the inspected standard path. Higher
fidelity can replay additional mantissa phases.

```text
16×32 × 32×16 → 16×16 output: 4 MVMUL issues per phase
32×32 × 32×32 → 32×32 output: 16 MVMUL issues per phase
```

The current Quasar LLK also contains an `ENABLE_2X_FORMAT` specialization for
MXFP4 with a shorter traversal. It is a format-specific path, not evidence that
ordinary BF16/BFP matmul uses fewer standard MVMUL issues. See
[`tt_llk_quasar/llk_math_matmul.h`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/tt-llk/tt_llk_quasar/llk_lib/llk_math_matmul.h).

## Huawei: the equivalent concepts

Huawei exposes an asynchronous pipeline, but at a different software boundary:

```text
Separated AIC: GM → MTE2 → L1 → MTE1 → L0A/L0B → Cube → L0C
                                                        ↓ FixPipe
                                                       GM / L1
Separated AIV: GM → MTE2 → UB → Vector → UB → MTE3 → GM
```

This is the separated AIC/AIV architecture described in the
[CANN 8.0 hardware guide](https://www.hiascend.com/document/detail/en/canncommercial/800/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html).
AIC/AIV exchange uses GM in that guide. Do not assume a direct FixPipe-to-UB
path or apply this diagram to the original coupled Ascend 910. Queue events
order transfers; they are not transfer engines themselves.

| Tenstorrent concept | Huawei Ascend concept | Important difference |
|---|---|---|
| Local circular buffer | `TQue`, `AllocTensor`, `EnQue`, `DeQue`, `FreeTensor` | Huawei's framework associates queues with logical positions such as VECIN, A1, B1 and CO1 |
| Async NoC movement | `DataCopy` on MTE pipelines | Ascend C normally abstracts physical on-chip routing rather than exposing per-coordinate NoC calls |
| Cross-engine semaphore | `SetFlag` / `WaitFlag` | Synchronizes different instruction pipelines inside an AI Core |
| Same-engine barrier | `PipeBarrier` | Orders dependent instructions in one pipeline |
| Memory completion barrier | `DataSyncBarrier` | Prevents later instructions until selected earlier memory accesses finish |
| Matrix/vector split handoff | `CrossCoreSetFlag` / `CrossCoreWaitFlag` | Primarily AIC/AIV coordination in separated mode, not a general peer-address NoC semaphore API |
| Remote/shared update | `AtomicAdd/Min/Max/CAS`, `SetAtomicAdd` | Often used for several AI cores accumulating into global memory |
| Resource and event allocation | `TPipe` and `TQueBind` | Framework inserts much of the Cube synchronization automatically |

Huawei documents its Scalar, Vector, Cube, MTE2/MTE3 and FixPipe pipelines as
asynchronously parallel. `SetFlag`/`WaitFlag` handles different pipelines,
whereas `PipeBarrier` orders one pipeline. The framework automatically inserts
much of the Cube synchronization; manual events remain important in static
tensor or explicitly managed low-level code. See the
[Huawei synchronization guide](https://www.hiascend.com/document/detail/en/canncommercial/850/API/ascendcopapi/atlasascendc_api_07_0179.html)
and [CANN 9 API map](https://www.hiascend.com/document/detail/en/CANNCommunityEdition/900/API/ascendcopapi/atlasascendc_api_07_0003.html).

Huawei's `TQue` is the closest conceptual counterpart to a local Tenstorrent
CB: tasks communicate through queues and queue depth enables pipeline
parallelism. It is not binary- or semantics-compatible with a TT CB. See the
[TQue reference](https://www.hiascend.com/document/detail/en/CANNCommunityEdition/900/API/ascendcopapi/atlasascendc_api_07_0137.html).

Huawei atomics are frequently connected to output accumulation. For example,
`SetAtomicAdd<float>()` makes following VECOUT/L0C/L1-to-GM data transfers
perform atomic addition; the mode must then be disabled so it does not leak
into later transfers. See the [atomic-add reference](https://www.hiascend.com/document/detail/en/CANNCommunityEdition/900/API/ascendcopapi/atlasascendc_api_07_0210.html).

## Huawei matrix granularity

Huawei does not expose one universal 32×32 logical tile corresponding to TT's
default tile. Its Cube path divides matrices into datatype-dependent fractals.

```text
Input A fractal: 16 × (32 bytes / sizeof(input type))
Input B fractal: (32 bytes / sizeof(input type)) × 16
Output C fractal: 16 × 16
```

For FP16/BF16:

```text
A: 16×16    B: 16×16    C: 16×16
```

For INT8:

```text
A: 16×32    B: 32×16    C: 16×16, normally INT32 accumulation
```

The Huawei 16×32 shape therefore often comes from the 32-byte Cube input block
holding twice as many INT8 values. It is not the same abstraction as a TT
16×32 two-face tiny tile. The official
[`Mmad` reference](https://www.hiascend.com/document/detail/en/CANNCommunityEdition/900/API/ascendcopapi/atlasascendc_api_07_0249.html)
documents the input and output fractals; the
[layout guide](https://www.hiascend.com/document/detail/en/canncommercial/850/opdevg/Ascendcopdevg/atlas_ascendc_10_0099.html)
documents ZZ, ZN and NZ arrangements.

For a 32×32 FP16 matrix multiplication, Huawei conceptually has four 16×16
output fractals and two K-fractal contributions per output: eight 16×16
contributions. The `Mmad` API accepts the larger M/N/K operation and the
framework/hardware walks its fractals. Public Huawei documentation does not
expose a lower sub-fractal issue shape equivalent to TT's open 8×16 LLK
schedule, so an exact micro-instruction count would be speculation.

## Failure patterns worth practising

| Intentional error | Expected symptom | Best first evidence |
|---|---|---|
| `cb_push_back` before read barrier | Compute sees stale or partial input | DPRINT values and CB state |
| `cb_pop_front` before write completion | Later producer overwrites a source still used by NoC | Watcher hang/corruption plus NoC trace |
| Missing semaphore increment | Receiver or sender waits forever | Watcher waypoint stuck at semaphore wait |
| Wrong multicast destination count | Permanent credit wait or early release | Semaphore values and core coordinates |
| Exact wait after a counter overshoots | Waiter never observes equality | Print monotonic counter; use `wait_min` when valid |
| Missing `tile_regs_commit/wait/release` | Pack/math race or deadlock | TRISC waypoints and destination-register checkpoint |
| Compiler fence used as device barrier | Reordering may be constrained, transfer still incomplete | Compare with explicit NoC barrier |
| Huawei missing pipeline event | DMA/Vector/Cube reads data before its producer finishes | Ascend timeline and event/queue audit |

## Recommended experiment

Implement one tile copy and one tile matmul with a two-entry CB, then run these
four variants:

1. Correct barriers and CB ownership.
2. Two reads issued before one read barrier, demonstrating useful overlap.
3. Remove one semaphore signal and identify the blocked RISC with Watcher.
4. Replace the full write barrier before notification only after proving the
   same-NoC/command-buffer/VC ordering contract, while retaining a completion
   barrier before CB reuse.

Record issued bytes, CB pointers, semaphore epochs, barrier locations, MVMUL
count, math fidelity and output PCC. Simulator wall time is not silicon
performance; this experiment is about correctness and pipeline overlap.

## Final comparison

```text
Tenstorrent
  logical tile:       usually 32×32
  storage face:       16×16
  LLK MVMUL result:   8×16 strip
  local streaming:    circular buffers
  peer coordination:  explicit NoC semaphores and atomics

Huawei FP16/BF16
  Cube input fractal: 16×16
  Cube output fractal:16×16
  local streaming:    TQue + TPipe
  pipeline ordering:  SetFlag/WaitFlag + PipeBarrier

Huawei INT8
  Cube inputs:        16×32 and 32×16
  Cube output:        16×16 with wider accumulation
```

The most important compiler lesson is to model the synchronization scope. A
CB credit, a register handoff, a NoC completion, a remote atomic and a compiler
fence may all appear near one tile, but each proves a different fact.
