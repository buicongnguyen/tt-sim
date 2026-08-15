# Compiler/runtime capstone: `Y = ReLU(A × B + bias)`

Research snapshot: **16 August 2026**

This is an eight-experiment path from one verified byte transfer to a small AI
compiler and runtime. The same graph is used throughout:

```text
Y = ReLU(A × B + bias)
```

The goal is not to hide the stack behind a framework. It is to make every
boundary observable: tensor shape, tile layout, DRAM allocation, L1 residency,
NoC transfer, circular-buffer synchronization, kernel dispatch, IR rewrite and
buffer lifetime.

## Read this support boundary first

Use two target lanes rather than assuming Blackhole and Quasar are interchangeable.

| Lane | What to practice now | What not to claim |
|---|---|---|
| Blackhole ttsim | Metalium examples, buffers, reader/compute/writer pipelines, program construction and correctness experiments that the current simulator supports | Simulator wall time predicts Blackhole silicon performance |
| Quasar ttsim | The supported single-DM L1 baseline, byte-pattern/address experiments, descriptor/API study and simple bring-up as upstream support expands | The complete fused matmul runtime already works, or the simulator descriptor is a final silicon specification |
| Offline compiler | MLIR parsing, verification, fusion, canonicalization, lifetime analysis and deterministic host oracles | An offline rewrite proves device execution or performance |

TT-MLIR's public repository currently names Wormhole and Blackhole as hardware
targets. Quasar is pre-silicon and binary-only in public ttsim. Treat the
compiler experiments as target-independent until a target lowering is selected.

## Repository starter kit

This repository includes a minimal, deliberately unregistered educational MLIR
dialect and a NumPy correctness oracle:

```text
experiments/fused-linear-relu/
├── input.mlir       # matmul → add_bias → relu
├── expected.mlir    # fused_linear_relu
├── oracle.py        # deterministic valid + invalid shape checks
└── README.md        # how to use the fixtures
```

Run the target-independent baseline first:

```bash
cd ~/src/tt-sim/experiments/fused-linear-relu
python3 oracle.py

# Optional: syntax-check with an LLVM/MLIR or TT-MLIR build.
$TT_MLIR_HOME/build/bin/ttmlir-opt \
  --allow-unregistered-dialect input.mlir -o /dev/null
```

Expected oracle signal:

```text
PASS valid graph: shape=(64, 64)
PASS invalid graph: incompatible matmul dimensions rejected
```

## The eight experiments

### 1. DRAM loopback

Implement a verified `DRAM → L1 → DRAM` copy before doing any math.

- Start from `metal_example_loopback`.
- Record the exact source and destination sizes, page size, core and NoC order.
- Test 4 B, 32 B, 1 KiB and one deliberately non-aligned size where the API
  permits it.
- Verify every output byte on the host; do not accept “program exited zero” as
  correctness.
- Save the command, simulator SHA and TT-Metal commit.

**Exit gate:** a corrupted byte makes the test fail and the notebook identifies
the transfer that produced it.

### 2. Compute kernel

Implement elementwise addition first, then replace the operation with ReLU on
one supported compute target.

- Keep the tensor to one tile (`32×32`) initially.
- Compare every output element with a host oracle.
- Include negative, zero, positive and boundary values.
- Separate runtime arguments from compile-time arguments in the notebook.

**Exit gate:** the host oracle and device result agree, and you can name which
processor moved data and which processor executed math.

### 3. Streaming pipeline

Split the operation into reader, compute and writer kernels joined by circular
buffers.

- Reader: DRAM to input circular buffers.
- Compute: wait, pop, perform the operation, reserve and push output tiles.
- Writer: output circular buffer to DRAM.
- Vary circular-buffer depth while holding the tensor shape constant.

**Exit gate:** tile counts balance at every producer/consumer boundary and an
intentional missing push, pop or NoC barrier produces an explainable failure.

### 4. Tiling explorer

Create a shape matrix instead of testing one convenient tensor:

| Case | M | K | N | Question |
|---|---:|---:|---:|---|
| Aligned square | 64 | 64 | 64 | What is the simplest tile grid? |
| Aligned rectangle | 64 | 128 | 64 | Which operand creates more traffic? |
| Padded M | 33 | 128 | 64 | Where is padding introduced and removed? |
| Padded N | 64 | 128 | 65 | Which output elements are logically invalid? |

Record logical shape, padded shape, tile count, allocated bytes, DRAM bytes and
the local-memory high-water mark. Compare plans, not simulator time.

**Exit gate:** every padding decision is visible in a machine-readable report
and output is cropped back to the logical shape.

### 5. Runtime executor

Build a small host runtime around three concepts:

1. a typed buffer record with shape, layout, memory space, size and ownership;
2. a program cache keyed by operation, target, formats, tile plan and compile-time arguments;
3. an executor that enqueues writes, programs and reads with explicit dependencies.

Run the same graph twice. The second invocation should reuse the compiled
program while updating runtime arguments safely.

**Exit gate:** a trace proves allocation, transfer, dispatch and readback order;
cache hit/miss behavior is tested independently from numerical correctness.

### 6. MLIR fusion pass

Recognize this directed acyclic graph:

```text
relu(add_bias(matmul(A, B), bias))
```

and replace it with:

```text
fused_linear_relu(A, B, bias)
```

The starter files use generic quoted operations so they can be parsed before a
custom dialect exists. Then define real operations and a `RewritePattern`.

The pattern must reject:

- incompatible matrix dimensions;
- a bias that cannot be broadcast to the result;
- mismatched element types;
- an intermediate value with additional users, unless the rewrite preserves it.

Use FileCheck-style positive and negative tests. Run canonicalization after the
rewrite to remove dead intermediate operations.

**Exit gate:** valid graphs fuse; invalid graphs emit specific diagnostics; the
unfused and fused host oracles agree.

### 7. Memory planner

Assign each tensor a half-open lifetime interval `[definition, last_use)` and a
memory space. Begin with a linear-scan allocator.

```text
value      lifetime   initial space
A          [0, 1)     DRAM
B          [0, 1)     DRAM
bias       [0, 2)     DRAM
matmul     [1, 2)     local candidate
add        [2, 3)     local candidate
Y          [3, 4)     DRAM
```

For the unfused graph, quantify whether `matmul` and `add` require distinct
temporary allocations. For the fused graph, attempt to keep the intermediate
inside the kernel pipeline. Parameterize local-memory capacity by target; never
hardcode one architecture's number into the IR.

**Exit gate:** no simultaneously live buffers overlap, capacity violations are
diagnosed, and the report shows peak bytes plus allocation reuse.

### 8. End-to-end compiler

Connect the pieces without erasing their interfaces:

```text
graph
  → parsed IR
  → verified IR
  → fusion + canonicalization
  → tile/layout selection
  → buffer lifetime plan
  → target-specific program
  → Metalium execution
  → host correctness oracle
```

Emit an artifact directory for every run:

```text
run-<timestamp>/
├── 00-input.mlir
├── 01-verified.mlir
├── 02-fused.mlir
├── memory-plan.json
├── dispatch-trace.json
├── result.npy
└── report.md
```

**Exit gate:** one command reproduces the run; the report proves numerical
equivalence and counts allocations, dispatches and transferred bytes before and
after fusion. A reduction is a measured property of the implementation, not an
assumption attached to the word “fused.”

## Target baselines

### Blackhole simulator lane

```bash
cd ~/src/tt-metal
export TT_METAL_SIMULATOR=~/sim/libttsim_bh.so
export TT_METAL_SLOW_DISPATCH_MODE=1
cp tt_metal/soc_descriptors/blackhole_140_arch.yaml \
  ~/sim/soc_descriptor.yaml

./build/programming_examples/metal_example_loopback
```

Advance one official example at a time: loopback, eltwise, then single-core
matmul. Keep a passing baseline before changing kernels. Feature support varies
with the paired TT-Metal and ttsim revisions.

### Quasar simulator lane

```bash
cd ~/src/tt-metal
export TT_METAL_SIMULATOR=~/sim/libttsim_qsr.so
export TT_METAL_SLOW_DISPATCH_MODE=1
cp tt_metal/soc_descriptors/quasar_32_arch.yaml \
  ~/sim/soc_descriptor.yaml

./build/test/tt_metal/unit_tests_legacy \
  --gtest_filter=QuasarMeshDeviceSingleCardFixture.SingleDmL1Write
```

On the source/release pair used by this guide, the supported baseline uses the
legacy NoC V1 path. Follow `QUASAR_CLUSTER_LAB.md` before changing that source
selection. Begin by varying byte patterns, L1 addresses and sizes. Do not jump
directly to matmul merely because the MLIR graph contains one.

## What belongs in the portfolio repository

- the fusion operation and rewrite pass;
- positive and negative IR tests;
- a buffer lifetime planner with capacity diagnostics;
- a Metalium executor and program-cache tests;
- NumPy correctness tests with fixed random seeds;
- before/after IR, memory plans and dispatch traces;
- a report that distinguishes measured counts from simulator timing;
- an explicit target-support table for every reproduced result.

## Primary references

- [TT Architecture and Metalium Guide](https://github.com/tenstorrent/tt-metal/blob/main/METALIUM_GUIDE.md)
- [Metalium DRAM loopback](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/examples/dram_loopback.html)
- [Metalium getting started: reader, compute, writer and circular buffers](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/get_started/get_started.html)
- [TT-MLIR architecture and dialect overview](https://docs.tenstorrent.com/tt-mlir/overview.html)
- [TT-MLIR tools, including `ttmlir-opt`](https://docs.tenstorrent.com/tt-mlir/tools.html)
- [MLIR pass infrastructure](https://mlir.llvm.org/docs/PassManagement/)
- [MLIR pattern rewriting](https://mlir.llvm.org/docs/PatternRewriter/)
- [MLIR canonicalization](https://mlir.llvm.org/docs/Canonicalization/)
- [Official ttsim status and target baselines](https://github.com/tenstorrent/ttsim)
