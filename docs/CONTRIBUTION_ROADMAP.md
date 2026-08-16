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
- [TT-Metal contribution guide](https://github.com/tenstorrent/tt-metal/blob/main/CONTRIBUTING.md)
- [TT-Metal bounty issues](https://github.com/tenstorrent/tt-metal/issues?q=is%3Aissue%20state%3Aopen%20label%3Abounty)
- [TT-Metal unassigned bounty filter](https://github.com/tenstorrent/tt-metal/issues?q=is%3Aissue%20state%3Aopen%20label%3Abounty%20no%3Aassignee)
- [Tenstorrent bounty terms](https://docs.tenstorrent.com/bounty_terms.html)
- [TT-MLIR repository](https://github.com/tenstorrent/tt-mlir)
- [TT-MLIR open bounty filter](https://github.com/tenstorrent/tt-mlir/issues?q=is%3Aissue%20state%3Aopen%20label%3Abounty)
- [tt-emule: hardware-free Metal host and kernel API emulation](https://github.com/tenstorrent/tt-emule)
- [`ttnn.i0` simulator-backed numerical bounty](https://github.com/tenstorrent/tt-metal/issues/50465)
- [`logaddexp` simulator-backed numerical bounty](https://github.com/tenstorrent/tt-metal/issues/52037)
