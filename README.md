# TT•SIM Lab

A source-grounded, hands-on field guide for learning Tenstorrent's official [`ttsim`](https://github.com/tenstorrent/ttsim) on Windows through Ubuntu 22.04 in WSL2—without Tenstorrent hardware.

For interview preparation, start with the [source review and claim-to-code map](docs/INTERVIEW_SOURCE_REVIEW.md).
It distinguishes pinned implementation facts, dated product specifications,
proposed experiments and résumé claims. Run `npm run check:sources` to repeat
the read-only GitHub citation audit (network access required).

The site is designed for this machine's recorded baseline:

- Ubuntu 22.04.5 on WSL2, x86_64
- 28 logical CPUs
- 15 GiB RAM plus 4 GiB swap
- 942 GiB free in the WSL virtual disk
- Git and Python 3.10 already available
- CMake, Ninja and g++ installed during the first setup phase

## Run the guide locally

```powershell
npm install
npm run dev
```

Open the local URL shown by Vite. A production build is created with:

```powershell
npm test
```

## Publish

Push `main` to `git@github.com:buicongnguyen/tt-sim.git`. The included GitHub Actions workflow builds the site and deploys `dist/` to GitHub Pages. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions** if it is not selected automatically.

Expected URL: <https://buicongnguyen.github.io/tt-sim/>

- Architecture comparison: <https://buicongnguyen.github.io/tt-sim/#generations>
- Blackhole versus Huawei Ascend: <https://buicongnguyen.github.io/tt-sim/huawei.html>
- Async kernels and matrix granularity: <https://buicongnguyen.github.io/tt-sim/async-kernels.html>
- Host-to-RISC firmware and operation-kernel flow: <https://buicongnguyen.github.io/tt-sim/firmware-flow.html>
- Kernel/compiler contribution roadmap: <https://buicongnguyen.github.io/tt-sim/#contribute>
- Debugging and optimization discussion workbench: <https://buicongnguyen.github.io/tt-sim/discussion.html>
- Blackhole BRISC/NCRISC bring-up decision chain: <https://buicongnguyen.github.io/tt-sim/discussion-blackhole-bringup.html>
- Blackhole fence, semaphore and hardware-wait field guide: <https://buicongnguyen.github.io/tt-sim/discussion-blackhole-synchronization.html>
- Transformer on Blackhole optimization chain: <https://buicongnguyen.github.io/tt-sim/discussion-transformer-blackhole-optimization.html>
- Source-backed 30-minute presentation room: <https://buicongnguyen.github.io/tt-sim/discussion-presentation.html>
- TTNN/TT-Metal LLM quantization guide: <https://buicongnguyen.github.io/tt-sim/discussion-quantization.html>
- Low-level kernel Mermaid debug flow: <https://buicongnguyen.github.io/tt-sim/debug-low-level-kernel-flow.html>
- Principal-level NPU interview plan, evidence map and workbench: <https://buicongnguyen.github.io/tt-sim/discussion-architecture-interview.html>
- Fifty principal-level NPU interview questions and layered answers: <https://buicongnguyen.github.io/tt-sim/discussion-architecture-interview-qa.html>

## Repository map

- `src/` — interactive guide
- `scripts/` — WSL audit, activation and smoke-test helpers
- `docs/RESEARCH.md` — scope decisions, machine audit and upstream evidence
- `docs/TTSIM_READING_PATH.md` — curated first-party documentation and suggested reading order
- `docs/TTSIM_DEBUGGING_PATH.md` — layered host, RISC-V, CB/L1, NoC and simulator debugging playbook
- `docs/WSL_AGENT_HOST_DEVICE_DEBUGGING.md` — native Codex/Claude WSL setup and a GDB-to-DPRINT host/device trace plan
- `examples/vscode/launch.json` — copy-ready WSL/GDB launch profile for the Quasar host-side test
- `docs/SIMULATION_SEQUENCE.md` — detailed Blackhole and Quasar control/data sequence diagrams
- `docs/QUASAR_CLUSTER_LAB.md` — source-backed Quasar cluster versus Blackhole architecture study
- `scripts/03-quasar-cluster-lab.sh` — repeatable descriptor audit and Quasar L1 baseline
- `docs/COMPILER_RUNTIME_CAPSTONE.md` — eight-stage fused-linear compiler/runtime roadmap
- `experiments/fused-linear-relu/` — MLIR before/after fixtures and deterministic NumPy oracle
- `docs/ARCHITECTURE_RESEARCH_PLAN.md` — evidence hierarchy, logic review and publication gates
- `docs/TENSTORRENT_GENERATION_COMPARISON.md` — Wormhole/Blackhole/Quasar code and product comparison
- `docs/BLACKHOLE_VS_HUAWEI_ASCEND.md` — memory, dataflow, software and scaling comparison
- `docs/ASYNC_KERNELS_AND_MATRIX_GRANULARITY.md` — NoC/CB/register synchronization, LLK MVMUL geometry and Huawei equivalents
- `docs/RISC_FIRMWARE_TO_KERNEL_FLOW.md` — source-linked BRISC/NCRISC/TRISC build, boot, dispatch and warm-launch analysis
- `docs/CONTRIBUTION_ROADMAP.md` — hardware-free low-level kernel, TT-MLIR, upstream contribution and bounty strategy
- `docs/DISCUSSION.md` — provisional debugging and optimization questions, experiments and promotion queue
- `docs/DISCUSSION_TRANSFORMER_BLACKHOLE_OPTIMIZATION.md` — source-backed prefill/decode optimization flow from TTNN model code to TT-Metal kernels
- `docs/DISCUSSION_BLACKHOLE_SYNCHRONIZATION.md` — compiler/RISC/NoC fence boundaries, two semaphore families, hardware waits and race-debug labs
- `docs/DISCUSSION_PRESENTATION_30_MIN.md` — copy-ready 30-minute research/achievement deck, boot flows, speaker notes and Q&A bank
- `docs/DISCUSSION_TT_METAL_QUANTIZATION.md` — source-audited BFP8/BFP4, integer and MX decision guide for LLM inference
- `docs/DEBUG_LOW_LEVEL_KERNEL_FLOW.md` — consolidated Mermaid cold-boot, Program-launch, NCRISC-handoff, waypoint and DPRINT flow
- `docs/DISCUSSION_ARCHITECTURE_INTERVIEW.md` — 13-topic preparation plan, résumé/portfolio evidence map, 17 recall prompts and detailed architecture decisions
- `scripts/05-architecture-evidence.sh` — reproducible descriptor and architecture-LLK audit
- `huawei.html` — dedicated Blackhole versus Huawei Ascend Pages route
- `async-kernels.html` — dedicated asynchronous-kernel and matrix-granularity Pages route
- `firmware-flow.html` — dedicated host-to-RISC firmware and operation-kernel Pages route
- `discussion.html` — filterable provisional discussion and chapter-promotion workbench
- `discussion-blackhole-bringup.html` — source-backed BRISC/NCRISC bring-up and compiler root-cause decision chain
- `discussion-blackhole-synchronization.html` — interactive Blackhole synchronization contract selector and Watcher waypoint decoder
- `discussion-transformer-blackhole-optimization.html` — interactive Transformer-on-Blackhole optimization decision chain and measurement ledger
- `discussion-presentation.html` — interactive presentation room with per-slide copy controls and source-backed boot diagrams
- `discussion-quantization.html` — interactive datatype ledger, model precision flow and copyable quantization experiments
- `debug-low-level-kernel-flow.html` — rendered Mermaid atlas for low-level worker-kernel debugging
- `discussion-architecture-interview.html` — interactive NPU architecture trade-off and interview-answer workbench
- `discussion-architecture-interview-qa.html` — searchable 50-question principal NPU interview reader
- `.github/workflows/pages.yml` — GitHub Pages deployment

## Scope

This guide focuses on `tenstorrent/ttsim`, Tenstorrent's official C++ simulator shared library. It explicitly distinguishes the separate community Python project [`mesham/tt-sim`](https://github.com/mesham/tt-sim).

Tenstorrent, TT-Metalium, Wormhole, Blackhole and Quasar are referenced for educational purposes. This repository is an independent learning guide.
