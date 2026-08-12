# Research and machine plan

Research date: 2026-08-12 (Asia/Seoul)

## Scope decision

The requested name is ambiguous:

1. [`tenstorrent/ttsim`](https://github.com/tenstorrent/ttsim) is Tenstorrent's official, open-source C++ full-system simulator. It supplies architecture-specific `libttsim.so` libraries that TT-Metalium loads through `TT_METAL_SIMULATOR`.
2. [`mesham/tt-sim`](https://github.com/mesham/tt-sim) is a separate community Python architecture simulator derived from public ISA documentation.

This project uses the official `tenstorrent/ttsim` because the user asked for “tt-sim of Tenstorrent,” wants TT-Metal experiments, and wants the WSL2 workflow documented by Tenstorrent.

## Machine audit

Read-only checks found:

| Item | Result | Interpretation |
| --- | --- | --- |
| WSL distro | Ubuntu 22.04.5 LTS | Supported baseline |
| WSL version | 2 | Correct execution environment |
| Host architecture | x86_64 | Matches standard release assets |
| Kernel | 6.18.33.2-microsoft-standard-WSL2 | Current WSL2 kernel |
| Logical CPUs | 28 | Good compile parallelism |
| RAM | 15 GiB | Workable; close other heavy jobs during build |
| Swap | 4 GiB | Useful safety margin |
| WSL disk | 942 GiB free | More than sufficient for TT-Metal + submodules/builds |
| Git | 2.34.1 | Ready |
| Python | 3.10.12 | Ready |
| CMake/Ninja/g++ | Missing at audit time | Installed in phase A |
| GitHub SSH | Authenticated as `buicongnguyen` | Use SSH remotes |
| Default WSL distro | `docker-desktop` | Change default to `Ubuntu-22.04` |

## Deployment sequence

1. Make Ubuntu 22.04 the default WSL distro.
2. Install a minimal build toolchain in Ubuntu.
3. Clone TT-Metalium with submodules into the Linux filesystem and run its dependency/build scripts.
4. Pin and download the Wormhole and Blackhole ttsim libraries.
5. Place the matching `soc_descriptor.yaml` beside the active library.
6. Export `TT_METAL_SIMULATOR`, `TT_METAL_SLOW_DISPATCH_MODE=1`, and `TT_METAL_DISABLE_SFPLOADMACRO=1`.
7. Run the RISC-V add example and require `Success: Result is 21` before proceeding.
8. Work through focused experiments, recording commit, simulator version, hypothesis, output and one controlled variation.

## Compatibility policy

The website pins ttsim `v1.10.0`, the latest GitHub release observed on the research date. TT-Metalium and the simulator share an API/ABI; a moving TT-Metal `main` checkout may require a different simulator release. Record both versions, avoid upgrading one component mid-lab, and follow the version required by the chosen TT-Metal revision if an ABI mismatch is reported.

## Upstream evidence

- [ttsim README](https://github.com/tenstorrent/ttsim): WSL2 support, release assets, build-from-source path, TT-Metal integration, SoC descriptors, slow dispatch and unsupported SFPLOADMACRO.
- [ttsim latest release](https://github.com/tenstorrent/ttsim/releases/latest): current pinned release at research time.
- [TT-Metal installation](https://github.com/tenstorrent/tt-metal/blob/main/INSTALLING.md): source clone, build script and environment setup.
- [Twenty-and-Ten Things You Can Do with ttsim](https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/ttsim-twenty-and-ten/): validated learning experiments and example outputs.
- [ttsim FAQ](https://docs.tenstorrent.com/tt-vscode-toolkit/faq/): learning-appropriate workloads and performance limitations.

## Things deliberately excluded from the first path

- Hardware drivers, firmware and `tt-smi`: the shared-library simulator path does not need a physical device.
- QEMU bridge and `tt-kmd`: valuable later, but adds a second virtual machine and driver layer before the learner has run a first kernel.
- Multi-chip simulation: upstream labels it experimental; start with one Wormhole model.
- Performance benchmarking and full model inference: ttsim is for correctness, architecture exploration, kernel work and focused TT-NN operations.
