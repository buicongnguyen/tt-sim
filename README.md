# TT•SIM Lab

A source-grounded, hands-on field guide for learning Tenstorrent's official [`ttsim`](https://github.com/tenstorrent/ttsim) on Windows through Ubuntu 22.04 in WSL2—without Tenstorrent hardware.

The site is designed for this machine's current baseline:

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

## Repository map

- `src/` — interactive guide
- `scripts/` — WSL audit, activation and smoke-test helpers
- `docs/RESEARCH.md` — scope decisions, machine audit and upstream evidence
- `docs/TTSIM_READING_PATH.md` — curated first-party documentation and suggested reading order
- `docs/TTSIM_DEBUGGING_PATH.md` — layered host, RISC-V, CB/L1, NoC and simulator debugging playbook
- `docs/SIMULATION_SEQUENCE.md` — detailed Blackhole and Quasar control/data sequence diagrams
- `docs/QUASAR_CLUSTER_LAB.md` — source-backed Quasar cluster versus Blackhole architecture study
- `scripts/03-quasar-cluster-lab.sh` — repeatable descriptor audit and Quasar L1 baseline
- `docs/COMPILER_RUNTIME_CAPSTONE.md` — eight-stage fused-linear compiler/runtime roadmap
- `experiments/fused-linear-relu/` — MLIR before/after fixtures and deterministic NumPy oracle
- `docs/ARCHITECTURE_RESEARCH_PLAN.md` — evidence hierarchy, logic review and publication gates
- `docs/TENSTORRENT_GENERATION_COMPARISON.md` — Wormhole/Blackhole/Quasar code and product comparison
- `docs/BLACKHOLE_VS_HUAWEI_ASCEND.md` — memory, dataflow, software and scaling comparison
- `scripts/05-architecture-evidence.sh` — reproducible descriptor and architecture-LLK audit
- `huawei.html` — dedicated Blackhole versus Huawei Ascend Pages route
- `.github/workflows/pages.yml` — GitHub Pages deployment

## Scope

This guide focuses on `tenstorrent/ttsim`, Tenstorrent's official C++ simulator shared library. It explicitly distinguishes the separate community Python project [`mesham/tt-sim`](https://github.com/mesham/tt-sim).

Tenstorrent, TT-Metalium, Wormhole, Blackhole and Quasar are referenced for educational purposes. This repository is an independent learning guide.
