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

## Repository map

- `src/` — interactive guide
- `scripts/` — WSL audit, activation and smoke-test helpers
- `docs/RESEARCH.md` — scope decisions, machine audit and upstream evidence
- `docs/TTSIM_READING_PATH.md` — curated first-party documentation and suggested reading order
- `docs/TTSIM_DEBUGGING_PATH.md` — layered host, RISC-V, CB/L1, NoC and simulator debugging playbook
- `.github/workflows/pages.yml` — GitHub Pages deployment

## Scope

This guide focuses on `tenstorrent/ttsim`, Tenstorrent's official C++ simulator shared library. It explicitly distinguishes the separate community Python project [`mesham/tt-sim`](https://github.com/mesham/tt-sim).

Tenstorrent, TT-Metalium, Wormhole and Blackhole are referenced for educational purposes. This repository is an independent learning guide.
