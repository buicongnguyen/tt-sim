# Tenstorrent contribution roadmap: kernel first, compiler connected

Research snapshot: **16 August 2026**

## Verdict

Low-level kernel skill is one of the most valuable and scarce capabilities in
an NPU stack, but kernel work alone is not the destination. The strongest
learning path follows one operation through both halves of the system:

```text
Metalium data movement + compute kernel
  → TTNN operation and program construction
  → TT-MLIR layout, scheduling and lowering
  → TTMetal runtime commands
  → ttsim / tt-emule correctness evidence
```

Use a **60/40 split** while building the foundation:

- **60% kernel and runtime:** DRAM/L1, NoC, circular buffers, DST registers,
  data-movement kernels, compute kernels, runtime arguments and dispatch.
- **40% compiler:** TTIR/TTNN/D2M dialects, verification, rewrite legality,
  layouts, allocation, DMA scheduling and TTMetal lowering.

Model bring-up is useful later. It teaches TTNN coverage and integration, but
by itself it does not provide the same depth in compiler passes, memory
planning or synchronization.

## Where contribution is possible without hardware

| Project | Hardware-free work | External code path | Best role |
|---|---|---|---|
| `tenstorrent/ttsim` | Functional runs, strictness diagnostics, reproductions | Issues only; the public repository does not accept pull requests | Architectural oracle and bug detector |
| `tenstorrent/tt-metal` | Metalium examples, selected TTNN/LLK correctness work and simulator-backed numerical sweeps | Issues and pull requests | Kernel/runtime correctness and bounty readiness |
| `tenstorrent/tt-mlir` | IR parsing, verification, transformations, FileCheck tests and D2M lowering tests | Issues and pull requests | Primary compiler expertise |
| `tenstorrent/tt-emule` | Host and kernel API emulation on x86-64 without a card, driver or firmware | Pull requests welcome | Best first no-hardware upstream code contribution |
| Model bring-up | Host-side preparation and partial correctness work | Pull requests and some bounties | Later integration capstone; final validation often needs silicon or cloud access |

`ttsim` is not currently listed in the Tenstorrent bounty terms. A simulator
bug report is valuable, but a payout requires a merged pull request against an
in-scope repository and an issue carrying both `bounty` and a difficulty
label.

## Learn low-level kernels in this order

### 1. Data movement before arithmetic

Implement and verify `DRAM → L1 → DRAM`. Record the buffer addresses, page
sizes, transfer sizes, core coordinates and NoC ordering. Test at least one
aligned and one deliberately awkward size supported by the API.

**Exit gate:** a single corrupted byte fails the host oracle and the report
names the transfer that produced it.

### 2. Circular-buffer protocol

Build a reader, compute and writer pipeline. Explain every `reserve`, `push`,
`wait` and `pop`. Change the circular-buffer depth while holding tensor shape
constant, then introduce one controlled protocol error.

**Exit gate:** producer and consumer tile counts balance at every boundary,
and the intentional failure is explained rather than merely observed.

### 3. Compute and DST behavior

Start with one tile of elementwise add or ReLU, then single-core matmul. Cover
negative, zero, positive and boundary inputs. Identify when values live in L1,
circular buffers and DST registers.

**Exit gate:** every output element matches an independent host oracle and the
notebook identifies which RISC moves data and which compute engine performs
the math.

### 4. SFPU numerical domains

Sweep beyond the convenient input interval. Include overflow and underflow
boundaries, discontinuities at piecewise approximations, BF16-exact inputs,
NaN/Inf behavior where defined, and cross-architecture comparisons. Recent
`ttnn.i0` and `logaddexp` bounty issues demonstrate that `ttsim` can expose
real, silent numerical defects without silicon.

**Exit gate:** failures are reduced to a deterministic table containing input,
expected result, observed result, error metric, architecture and exact source
revision.

### 5. TTNN program construction

Trace how a public operation validates tensors, selects a program factory,
allocates buffers, sets compile-time and runtime arguments, creates kernels and
enqueues work. A kernel is not an isolated function; its host-side contract is
part of the implementation.

**Exit gate:** a diagram connects the public API to the exact reader, compute
and writer sources and identifies every argument crossing the host/device
boundary.

### 6. TT-MLIR connection

Trace the same operation through real upstream dialects and passes. Use
`ttmlir-opt`, lit and FileCheck before attempting an end-to-end execution.
Prefer a small verifier, canonicalization or IR-shape test over inventing a new
educational dialect.

**Exit gate:** before/after IR proves what changed, negative tests prove what
must not change, and the lowering can be related back to the Metalium program.

## How TT-MLIR combines with TT-Metal

TT-MLIR and TT-Metal own different parts of one stack. TT-MLIR represents and
transforms the program; TT-Metal provides the host runtime, device interaction
and kernels that ultimately perform the work. The useful mental model is:

```text
frontend or TTIR builder
  → TTIR: tensor semantics, shapes, dtypes and layouts
  ├─→ TTNN: library-level operations
  │     → TTNN FlatBuffer → ttrt → TTNN runtime → TT-Metal
  └─→ D2M: grids, generic compute and explicit data movement
        → TTKernel device IR + TTMetal host/device IR
        → FlatBuffer or generated code
```

The dialect boundary maps directly onto runtime responsibilities:

| Layer | Compiler/runtime responsibility | What to inspect |
|---|---|---|
| TTIR | Describes tensor computation and layout intent | Op verification, shapes, dtypes and `to_layout` operations |
| TTNN | Models the TTNN API at a high level | Operation selection, layouts, allocation and deallocation |
| D2M | Makes direct-to-metal dispatch and generic compute explicit | Grids, iterators, tiling, data movement and scheduling |
| TTKernel | Models low-level TT-Metal device kernels approximately one-to-one | NoC operations, circular buffers, tile registers and SFPU/FPU work |
| TTMetal | Models host/device interoperation | Buffer creation, transfers, program construction and enqueue operations |
| FlatBuffer + `ttrt` | Carries compiler output across the runtime boundary | Version, system descriptor, golden tensors, callbacks and runtime logs |
| TT-Metal | Owns device discovery, queues, buffers, dispatch and kernel execution | Runtime arguments, command queues, JIT artifacts and device traces |

### Lane A: TTNN backend for end-to-end integration

Use `TTIR → TTNN → FlatBuffer → ttrt` when the compiled program should remain
a sequence of TTNN library operations. A runtime-enabled TT-MLIR build uses
TT-Metal for operation execution and device interfacing. TT-MLIR's environment
also provides `TT_METAL_RUNTIME_ROOT`; keep the compiler and the TT-Metal
dependency selected by that environment aligned instead of mixing arbitrary
revisions.

This is the clearest route for model-level integration, golden-tensor checks
and runtime callbacks. The important proof is not only that a FlatBuffer was
created: show the TTNN IR, the serialized program, the TT-Metal runtime log and
the result comparison.

### Lane B: D2M for low-level compiler expertise

Use `TTIR → D2M → TTKernel + TTMetal` when the objective is to understand or
improve scheduling, explicit data movement and generated device kernels.
TTKernel exposes concepts that map closely to TT-Metal kernel APIs, while the
TTMetal dialect describes the host-side buffer and enqueue program.

This is the better lane for connecting compiler decisions to the low-level
skills learned in `ttsim`: a `ttkernel.noc_async_read`, circular-buffer
operation or tile computation should be traceable to the equivalent Metalium
mechanism. Direct TTMetal runtime coverage is branch- and feature-dependent;
prove compiler behavior with IR and tests before claiming that the generated
program executes end to end.

### Practical workflow without a device

1. Build the offline TT-MLIR compiler and run `check-ttmlir`.
2. Create one small TTIR builder fixture, such as add or matmul.
3. Compile the same fixture with `target="ttnn"` and `target="ttmetal"`.
4. Save TTIR, TTNN, D2M, TTKernel and TTMetal IR wherever the selected pipeline
   emits them.
5. Add a lit/FileCheck test for the intended lowering and a negative test for
   an illegal shape, layout or rewrite.
6. Map each emitted TTKernel/TTMetal operation to the corresponding TT-Metal
   kernel or host API.
7. Validate an equivalent hand-written TT-Metal or TTNN program with `ttsim`
   or `tt-emule`. Treat this as separate runtime evidence, not proof that the
   TT-MLIR FlatBuffer itself ran.
8. When a supported device or cloud system becomes available, build with
   `-DTTMLIR_ENABLE_RUNTIME=ON`, generate the matching system descriptor and
   use `ttrt run` to close the end-to-end loop.

**Exit gate:** a portfolio artifact contains both lowering lanes, before/after
IR, one negative compiler test, the TT-Metal API mapping and an explicit label
for compiler-only, simulator-backed and hardware-verified evidence.

## Route simulator findings to the correct repository

| Signal | First interpretation | Likely action |
|---|---|---|
| `AssertionFailure` | Internal simulator invariant failed | Minimize and report to `ttsim` |
| `UndefinedBehavior`, `NonContractualBehavior`, `UnpredictableValueUsed` | Simulated software violated the architecture contract | Fix or report the TT-Metal/TT-MLIR/LLK path; do not suppress the simulator check |
| `UnimplementedFunctionality` | Feature is planned but not implemented | Provide a real reproducer and use case; do not assume a patch is externally accepted |
| `UnsupportedFunctionality` | Deliberately excluded feature | Evaluate supported alternatives; it is not an ordinary backlog item |
| Silent wrong result on supported functionality | Kernel, composition, lowering or simulator defect | Compare architectures and an independent oracle, then bisect the responsible layer |
| Simulator-only timing change | Host simulator behavior, not silicon performance | Do not make a performance claim without hardware evidence |

This routing discipline is a core compiler/runtime skill: the useful outcome
is not just finding a failure, but locating the layer that owns it.

## Bounty strategy

The bounty program is a valid secondary goal, not a substitute for the
learning plan.

1. Watch the official filters for an issue labelled `bounty` plus a difficulty
   label.
2. Work only after a maintainer assigns the issue to you.
3. Prefer warmup/easy correctness or test issues until one ordinary upstream
   pull request has merged.
4. Claim the issue manually. Tenstorrent prohibits AI agents and automation
   from posting or requesting bounty assignments.
5. AI assistance may be used offline only when the human contributor reviews,
   understands and takes responsibility for the submission.
6. Do not work on an already assigned bounty expecting payment.

Snapshot on 16 August 2026: the TT-Metal open-bounty filter had no unassigned
results, and TT-MLIR had no open bounty issue. That state can change at any
time; always re-check the live filters before choosing work.

## Twelve-week execution plan

### Weeks 1–3 — runtime mechanics

- Pass DRAM loopback with byte-level verification.
- Build one reader/compute/writer pipeline.
- Run elementwise and single-core matmul baselines.
- Save one intentional NoC/alignment failure and one CB protocol failure.
- Treat sequence and correctness as evidence; never treat simulator time as a
  silicon benchmark.

### Weeks 4–6 — differential bug harness

- Compare PyTorch/NumPy goldens with TTNN on Wormhole and Blackhole `ttsim`.
- Sweep numeric domains, data types, shapes, layouts and memory placement.
- Record exact TT-Metal and simulator revisions.
- Reduce one novel failure to a small script or test vector.
- File an issue only after searching for duplicates and separating simulator
  limitations from software defects.

### Weeks 7–9 — real compiler work

- Install and build TT-MLIR in its supported environment.
- Trace one operation through TTIR/TTNN or D2M into TTMetal.
- Add lit/FileCheck coverage for an existing transformation.
- Add a negative verifier or rewrite-legality test.
- Run D2M builder/golden tests or `tt-emule` where device execution is not
  available.

### Weeks 10–12 — upstream proof

- Discuss one small `tt-emule` or TT-MLIR test improvement with maintainers.
- Submit a focused pull request with an independent correctness test.
- Publish the before/after IR, execution trace and oracle in the portfolio.
- After the first merge, manually claim a suitable unassigned warmup/easy
  bounty when one appears.

## Recommended first upstream-sized items

Confirm scope with maintainers before implementing any of these:

- TT-MLIR lit/FileCheck coverage for a D2M IR-shape contract.
- A negative verifier diagnostic or pattern-rewrite legality case.
- `tt-emule` coverage for an isolated UNPACK or TRISC-finish path.
- A deterministic TTNN/SFPU domain sweep that extends an existing narrow test.
- Documentation that connects one TTNN operation to its program factory and
  reader/compute/writer kernels.

The first contribution should be small enough to review completely. One
precise test that protects a real contract is more valuable than a large,
unvalidated refactor.

## Primary references

- [Official ttsim repository and contribution boundary](https://github.com/tenstorrent/ttsim)
- [TT-Metal contribution guide](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/CONTRIBUTING.md)
- [TT-Metal bounty issues](https://github.com/tenstorrent/tt-metal/issues?q=is%3Aissue%20state%3Aopen%20label%3Abounty)
- [TT-Metal unassigned bounty filter](https://github.com/tenstorrent/tt-metal/issues?q=is%3Aissue%20state%3Aopen%20label%3Abounty%20no%3Aassignee)
- [Tenstorrent bounty terms](https://docs.tenstorrent.com/bounty_terms.html)
- [TT-MLIR repository](https://github.com/tenstorrent/tt-mlir)
- [TT-MLIR dialect and architecture overview](https://docs.tenstorrent.com/tt-mlir/overview.html)
- [TTIR builder TTNN and TTMetal targets](https://docs.tenstorrent.com/tt-mlir/builder/ttir-builder.html)
- [`ttrt` runtime and TT-Metal integration](https://docs.tenstorrent.com/tt-mlir/ttrt.html)
- [TT-MLIR build and runtime dependency setup](https://docs.tenstorrent.com/tt-mlir/getting-started)
- [TT-MLIR compiler and runtime project structure](https://docs.tenstorrent.com/tt-mlir/project-structure.html)
- [TT-MLIR open bounty filter](https://github.com/tenstorrent/tt-mlir/issues?q=is%3Aissue%20state%3Aopen%20label%3Abounty)
- [tt-emule: hardware-free Metal host and kernel API emulation](https://github.com/tenstorrent/tt-emule)
- [`ttnn.i0` simulator-backed numerical bounty](https://github.com/tenstorrent/tt-metal/issues/50465)
- [`logaddexp` simulator-backed numerical bounty](https://github.com/tenstorrent/tt-metal/issues/52037)
