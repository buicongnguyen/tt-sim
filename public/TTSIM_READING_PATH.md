# ttsim documentation reading path

This is the web-accessible copy of [`docs/TTSIM_READING_PATH.md`](https://github.com/buicongnguyen/buicongnguyen.github.io/blob/main/tt-sim/TTSIM_READING_PATH.md). Use it after the first `Success: Result is 21` smoke test.

## Recommended order

1. Read the [ttsim README](https://github.com/tenstorrent/ttsim), [latest release notes](https://github.com/tenstorrent/ttsim/releases/latest) and [simulator FAQ](https://docs.tenstorrent.com/tt-vscode-toolkit/faq/).
2. Pick a small test from [Twenty-and-Ten Things You Can Do with ttsim](https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/ttsim-twenty-and-ten/).
3. Learn the host, reader, compute and writer flow in [TT-Metalium getting started](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/get_started/get_started.html).
4. Adapt one [programming example](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/examples/index.html) or [Metalium lab exercise](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/index.html).
5. When a failure crosses the simulator boundary, consult the [libttsim API and ABI](https://github.com/tenstorrent/ttsim/blob/main/docs/libttsim_api.md), [error handling](https://github.com/tenstorrent/ttsim/blob/main/docs/sim_error_handling.md) and [unsupported functionality](https://github.com/tenstorrent/ttsim/blob/main/docs/unsupported_functionality.md).
6. Use [Metalium advanced topics](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/index.html) and the [Wormhole/Blackhole ISA docs](https://github.com/tenstorrent/tt-isa-documentation) only for the layer you are investigating.
7. Save the [ttsim QEMU Bridge](https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/ttsim-qemu-bridge/) until direct shared-library simulation is reliable.

For every experiment, record the TT-Metal commit, ttsim version, architecture, command, hypothesis and observed output. Change one variable at a time and never treat simulator runtime as silicon performance.
