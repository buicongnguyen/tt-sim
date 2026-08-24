# Discussion workbench

Started: **18 August 2026**

Updated: **19 August 2026**

This is the provisional inbox for debugging and optimization discussions. It
is intentionally less polished than the book chapters. An item may begin as a
question or hypothesis, but it must not be presented elsewhere as a verified
fact until its evidence gate is satisfied.

Interactive view: <https://buicongnguyen.github.io/tt-sim/discussion.html>

## Why this page exists

The guide now contains architecture, debugging, compiler/runtime and experiment
chapters. New questions often touch several of them at once. Placing an early
idea directly into a finished chapter makes the book harder to audit and
reorganize.

The Discussion page provides a temporary path:

```text
question → reproducible observation → source evidence → conclusion → chapter
```

Discussion items may be incomplete, wrong or blocked. Their status must make
that visible.

## Item lifecycle

| Status | Meaning | Required next step |
|---|---|---|
| `INBOX` | A question worth keeping; no experiment has been designed | State one falsifiable hypothesis |
| `EXPERIMENT` | A reproduction plan exists or is being run | Save commands, environment and raw output |
| `EVIDENCE` | Source, logs or measurements support a bounded conclusion | Perform logic review and document limitations |
| `READY` | The conclusion is stable enough to move into the book | Select the destination chapter and preserve backlinks |
| `PROMOTED` | Material has moved into a maintained chapter | Keep only a short index entry here |

## Working rules

1. One item should ask one primary question.
2. Record the TT-Metal/ttsim commit, simulator library hash and target
   architecture when they affect the result.
3. Separate source-code evidence, simulator observation and hardware
   measurement.
4. Simulator wall time is never presented as silicon performance.
5. Optimization claims need a baseline, a changed variable and at least one
   correctness check.
6. A failed experiment is still evidence when its environment and failure
   boundary are recorded.
7. Promotion should move the conclusion—not every exploratory note—into the
   destination chapter.

## Debugging queue

### DBG-01 — Build a host-to-device stack trace recipe

- **Status:** `EXPERIMENT`
- **Question:** Which host frames should be captured to connect `Program`
  creation, binary packing, command generation and worker GO?
- **Hypothesis:** A small stable breakpoint set can explain most slow-dispatch
  launches without stepping through every allocator or template wrapper.
- **Evidence needed:** GDB backtraces from one cold launch and one cached
  relaunch, with the exact TT-Metal commit.
- **Next experiment:** Run one single-core reader/compute/writer Program twice
  and compare the captured host boundaries.
- **Possible destination:** `WSL_AGENT_HOST_DEVICE_DEBUGGING.md`

### DBG-02 — Debug Blackhole BRISC/NCRISC bring-up

- **Status:** `EVIDENCE`
- **Detailed Q&A:** [Discussion chain 01 — Blackhole BRISC/NCRISC
  bring-up](./DISCUSSION_BLACKHOLE_BRINGUP.md)
- **Question:** How do we distinguish a shared launch failure,
  operation-entry fault and real compiler miscompile?
- **Hypothesis:** Paired waypoints, ELF readback and a controlled compiler A/B
  can isolate the first broken boundary.
- **Evidence available:** The control flow and eight-stage decision process are
  pinned to `tt-metal@50a82f835593512c4176546b4af68d7e91315a86`.
- **Evidence still needed:** Historical failing/passing compiler identities,
  paired waypoints, failing PC, minimized valid input and final fix artifacts.
- **Next experiment:** Recover those artifacts and execute the compiler A/B
  closure matrix in the detailed Q&A.
- **Possible destination:** `RISC_FIRMWARE_TO_KERNEL_FLOW.md`

### DBG-03 — Identify the exact binary executed by each RISC

- **Status:** `INBOX`
- **Question:** How do we map a simulator PC or Watcher report to the firmware
  ELF, operation ELF, symbol and source line?
- **Hypothesis:** Build metadata plus RISC load addresses is enough to automate
  the mapping with `readelf`, `nm`, `objdump` and `addr2line`.
- **Evidence needed:** A script that resolves at least one BRISC, NCRISC and
  TRISC address from a real build directory.
- **Next experiment:** Inventory the JIT cache and linker map after the existing
  Blackhole smoke test.
- **Possible destination:** `TTSIM_DEBUGGING_PATH.md`

### DBG-04 — Classify simulator unsupported-instruction failures

- **Status:** `EXPERIMENT`
- **Question:** Is an unsupported instruction reached during base firmware,
  dispatch setup or user kernel execution?
- **Hypothesis:** The failing PC, active RISC and latest launch waypoint are
  sufficient to route the issue to ttsim or TT-Metal.
- **Evidence needed:** Disassembly around the PC and a minimal reproduction
  stripped of unrelated kernels.
- **Next experiment:** Apply the classifier to the recorded Quasar
  `rv64_custom_0` failure.
- **Possible destination:** `TTSIM_DEBUGGING_PATH.md`

### DBG-05 — Select and debug Blackhole synchronization

- **Status:** `EVIDENCE`
- **Detailed Q&A:** [Discussion subpage 03 — Blackhole synchronization
  field guide](./DISCUSSION_BLACKHOLE_SYNCHRONIZATION.md)
- **Question:** Which compiler fence, RISC-V fence, NoC barrier, L1
  semaphore, CB credit or Tensix hardware wait enforces the dependency that
  actually failed?
- **Hypothesis:** Separating the compiler, local RISC, NoC, cross-core
  readiness, buffer ownership and Tensix pipeline domains prevents false fixes
  that only change timing.
- **Evidence available:** The implementations and Watcher waypoints are pinned
  to `tt-metal@50a82f835593512c4176546b4af68d7e91315a86`; the guide includes
  checkpoint, delay-injection, profiler and ELF-disassembly flows.
- **Next experiment:** Run the data-before-signal lab with a targeted NoC write
  delay, then preserve a clean NoC profiler trace in a separate run.
- **Possible destination:** `ASYNC_KERNELS_AND_MATRIX_GRANULARITY.md` and
  `TTSIM_DEBUGGING_PATH.md`

### DBG-06 — Trace the low-level kernel boundary

- **Status:** `EVIDENCE`
- **Detailed diagrams:** [Discussion subpage 06 — debug low-level kernel
  flow](./DEBUG_LOW_LEVEL_KERNEL_FLOW.md)
- **Question:** Which host, firmware, wrapper or `kernel_main` boundary failed
  first?
- **Hypothesis:** A source-linked Mermaid sequence plus `W/R/K/KD/D`
  waypoints can select one short interval before intrusive debugging.
- **Evidence available:** Six diagrams consolidate cold boot, Program launch,
  NCRISC handoff, waypoint routing, observer selection and DPRINT mechanics at
  `tt-metal@50a82f835593512c4176546b4af68d7e91315a86`.
- **Next experiment:** Attach one real failing waypoint pair, ELF, PC and
  bounded DPRINT result to the relevant interval.
- **Possible destination:** `RISC_FIRMWARE_TO_KERNEL_FLOW.md` and
  `DISCUSSION_BLACKHOLE_BRINGUP.md`

## Optimization queue

### OPT-01 — Measure cold versus warm Program launch traffic

- **Status:** `EXPERIMENT`
- **Question:** Which binary and configuration writes disappear after a Program
  becomes committed?
- **Hypothesis:** The warm launch reuses operation binaries but still carries
  updated runtime arguments, launch state and GO.
- **Correctness gate:** Both launches produce identical results for identical
  inputs; changed runtime arguments affect only the expected output.
- **Evidence needed:** Command-type and transferred-byte counts for launch one
  and launch two.
- **Possible destination:** `RISC_FIRMWARE_TO_KERNEL_FLOW.md`

### OPT-02 — Move NoC barriers to the first real dependency

- **Status:** `INBOX`
- **Question:** Where can reader or writer kernels overlap work without
  violating data-before-signal or buffer-reuse ordering?
- **Hypothesis:** Several transfers can be issued before one typed barrier when
  their circular-buffer ownership remains valid.
- **Correctness gate:** Deterministic output plus no Watcher NoC or CB errors.
- **Evidence needed:** Before/after command order, barrier count and transferred
  bytes; hardware performance must be validated separately.
- **Possible destination:** `ASYNC_KERNELS_AND_MATRIX_GRANULARITY.md`

### OPT-03 — Choose circular-buffer depth from producer/consumer behavior

- **Status:** `INBOX`
- **Question:** When does adding another CB page improve overlap, and when does
  it only consume L1?
- **Hypothesis:** The useful depth is determined by burst size and the slowest
  pipeline stage rather than a universal double-buffer rule.
- **Correctness gate:** Producer and consumer counts balance; no live page is
  reused before completion.
- **Evidence needed:** CB pointer traces and L1 peak for depths one through
  four.
- **Possible destination:** compiler/runtime capstone experiment 3 or 7.

### OPT-04 — Compare fusion by memory traffic, not operation count alone

- **Status:** `INBOX`
- **Question:** When does `matmul + bias + relu` fusion reduce dispatches,
  allocations or DRAM/L1 traffic?
- **Hypothesis:** The main gain is avoiding materialized intermediates; a
  rewrite that preserves those intermediates is not useful fusion.
- **Correctness gate:** Fused and unfused outputs pass the same NumPy oracle.
- **Evidence needed:** Allocation lifetime table, dispatch count and estimated
  bytes for both graphs.
- **Possible destination:** `COMPILER_RUNTIME_CAPSTONE.md`

### OPT-05 — Select BFP8, MXFP4 or wider formats by error budget

- **Status:** `INBOX`
- **Question:** Which tensors tolerate reduced precision without violating the
  operation’s numerical contract?
- **Hypothesis:** Format choice should be per tensor role and architecture;
  “smallest format everywhere” will not preserve quality.
- **Correctness gate:** Shape-aware error metrics and a model/task-level quality
  threshold, not only one tile comparison.
- **Evidence needed:** Supported target matrix, conversion cost, memory traffic
  and numerical error.
- **Possible destination:** a future data-format chapter.

### OPT-06 — Optimize a Transformer on Blackhole

- **Status:** `EXPERIMENT`
- **Detailed Q&A:** [Discussion chain 02 — Transformer on Blackhole
  optimization](./DISCUSSION_TRANSFORMER_BLACKHOLE_OPTIMIZATION.md)
- **Question:** How do prefill and decode optimization decisions flow through
  either handwritten TTNN or the current TT-Forge/TT-MLIR compiler route into
  TT-Metal kernels?
- **Hypothesis:** Separating the two entry routes, stabilizing shapes/layouts and
  profiling the warm path will expose a smaller useful tuning surface than
  rewriting kernels first.
- **Correctness gate:** One-block PCC plus end-to-end token/perplexity criteria
  defined before the performance sweep.
- **Evidence available:** Model, attention, MLP, matmul and SDPA paths pinned to
  `tt-metal@50a82f835593512c4176546b4af68d7e91315a86`; logic and code reviews are
  included in the detailed page. The current TT-Forge/TT-MLIR architecture and
  the reviewed release's distinct dependency pins are recorded separately.
- **Evidence still needed:** Exact checkpoint, Blackhole SKU/mesh, shape
  distribution, warm profiler reports and completed before/after ledger.
- **Next experiment:** Choose and pin either the handwritten TTNN or compiler
  entry route, run accuracy and warm performance baselines, then profile prefill
  and decode separately.
- **Possible destination:** a maintained Transformer optimization chapter after
  the hardware evidence gates pass.

### OPT-07 — Apply quantization and mixed precision to an LLM

- **Status:** `EVIDENCE`
- **Detailed Q&A:** [Discussion subpage 05 — TTNN/TT-Metal LLM
  quantization](./DISCUSSION_TT_METAL_QUANTIZATION.md)
- **Question:** Which public and low-level datatypes form a supported,
  measurable LLM path on the pinned TTNN/TT-Metal source?
- **Hypothesis:** The practical generic path is BF16 baseline → BFP8 by tensor
  role → selective BFP4, while INT8, FP8_E4M3 and MX claims require narrower
  operation/architecture proof.
- **Correctness gate:** layer tensors, logits/tokens and perplexity/task quality
  remain within a predeclared budget.
- **Evidence available:** datatype enum, tile sizes, linear contract,
  quantize/requantize/dequantize validators, TT-Transformers precision policy
  and Blackhole LLK integer path pinned to `tt-metal@50a82f8…`.
- **Next experiment:** run the accuracy/performance presets and isolate one
  decoder's FF1/FF3 BFP4 change.
- **Possible destination:** a maintained quantization and mixed-precision
  chapter after real Blackhole quality/performance measurements are filled.

### OPT-08 — Answer NPU architecture trade-off questions

- **Status:** `EVIDENCE`
- **Detailed Q&A:** [Discussion subpage 07 — NPU architecture interview
  workbench](./DISCUSSION_ARCHITECTURE_INTERVIEW.md)
- **Question:** How do fixed-area allocation, GEMM dataflow, 7B-to-70B scaling,
  precision, utilization and power decisions become defensible recommendations?
- **Hypothesis:** Adding evidence and validation to “bottleneck, options,
  trade-offs, recommendation” exposes weak assumptions before an interview
  answer becomes a design claim.
- **Evidence available:** Thirteen topic plans connect the interview brief to
  résumé/portfolio ownership boundaries, six detailed cases, 17 recall prompts,
  roofline/SRAM/KV/pipeline/energy models, four Mermaid flows and pinned
  TT-Metal/TTNN contracts.
- **Next experiment:** Run the one-day sequence, rehearse each 45-second
  opening, then answer one likely follow-up with a formula, a named counter and
  a rollback gate.
- **Possible destination:** presentation Q&A appendix and a maintained NPU
  architecture chapter.

## Presentation room

The [30-minute research and achievement presentation](./DISCUSSION_PRESENTATION_30_MIN.md)
compresses the bring-up and Transformer studies into copy-ready slides, speaker
notes, two small boot/launch diagrams and a technical question bank. Its
`VERIFIED`, `PERSONALIZE` and `MEASURE` labels prevent source facts from being
mixed with unsupported personal or performance claims.

## Promotion queue

No item is automatically promoted. During review, ask:

- Is the conclusion bounded to a named architecture and revision?
- Can another reader repeat the observation?
- Is the evidence linked next to the claim?
- Have alternative explanations been considered?
- Does the destination chapter improve when this conclusion is added?
- Can the raw exploratory notes stay here while the chapter receives a shorter
  maintained explanation?

When an item is promoted, replace its body here with:

```markdown
### ID — Title

- **Status:** `PROMOTED`
- **Conclusion:** One bounded sentence.
- **Destination:** Link to the maintained chapter or section.
- **Evidence record:** Link to experiment files, logs or source anchors.
```

## New-item template

```markdown
### TRACK-NN — Question-sized title

- **Status:** `INBOX`
- **Track:** debugging | optimization
- **Question:** What exactly do we want to know?
- **Hypothesis:** What result do we currently expect, and why?
- **Architecture/revision:** Wormhole | Blackhole | Quasar; commit/hash
- **Evidence already available:** source links, logs, measurements
- **Evidence still needed:** the missing proof
- **Next experiment:** one reproducible action
- **Correctness gate:** what must remain true
- **Possible destination:** chapter or “undecided”
```

## Reorganization policy

The Discussion page is an inbox, not a permanent table of contents. Once
several verified items share one concept, create or select the appropriate book
chapter, move the maintained explanation there, retain backlinks to the raw
evidence, and mark the original items `PROMOTED`.
