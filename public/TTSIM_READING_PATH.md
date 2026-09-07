# ttsim documentation reading path

Start with the [six simulator interview answers](./index.html#simulator-interview),
then use this reading path to connect each explanation to an experiment and its
source. The `Success: Result is 21` smoke test is one useful starting point; it
does not establish tensor-kernel correctness or hardware performance.

## Interview answer: how would you learn and validate an unfamiliar simulator?

**Short answer:** I would first identify its supported execution contract, then
run a small known example and check the result independently. I would add one
controlled change at a time and record exactly what each test establishes.

1. **Purpose.** Separate the simulator, the runtime that drives it, and this
   repository's study material. They are different artifacts with different
   responsibilities.
2. **Baseline.** Record the simulator version, TT-Metal revision, architecture
   descriptor, command and input. A reproducible baseline makes later failures
   easier to attribute.
3. **Mechanism.** Trace the input through arguments, memory movement, execution
   and result verification. Explain the contract at each boundary rather than
   memorizing function names alone.
4. **Controlled test.** Change one supported input or implementation choice.
   Compare with a reference and investigate the first mismatch. Check whether
   an exit reports unsupported behavior before blaming application code.
5. **Evidence boundary.** A passing test supports the tested case within the
   model. It does not prove complete hardware correctness, timing-sensitive
   behavior, sustained bandwidth or power. Define the later device test needed
   for each deployment claim.

**Remember:** contract → baseline → mechanism → test → boundary.

**Huawei follow-up:** transfer this method to a named Ascend target and CANN
version. Do not describe Tenstorrent simulator behavior as an Ascend result.

For mechanism-by-mechanism debugging, use [`TTSIM_DEBUGGING_PATH.md`](./TTSIM_DEBUGGING_PATH.md).

## 1. Orient yourself

| Read | Use it for |
| --- | --- |
| [ttsim README](https://github.com/tenstorrent/ttsim) | Supported platforms, release artifacts, builds and TT-Metal integration. |
| [Latest ttsim release](https://github.com/tenstorrent/ttsim/releases/latest) | Selecting and recording the simulator version used by an experiment. |
| [Simulator FAQ](https://docs.tenstorrent.com/tt-vscode-toolkit/faq/) | Understanding suitable workloads and the limits of simulator performance results. |
| [Twenty-and-Ten Things You Can Do with ttsim](https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/ttsim-twenty-and-ten/) | Choosing the next small, observable experiment. |

## 2. Build kernel intuition

1. Read [TT-Metalium getting started](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/get_started/get_started.html) for the reader, compute and writer pipeline.
2. Pick one [programming example](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/examples/index.html) that is close to the question you want to test.
3. Follow one [Metalium lab exercise](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/index.html), keeping only the portions supported by ttsim.
4. Use [Explore TT-Metalium](https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/explore-metalium/) to locate the host code, kernels and build targets.

For every run, record the TT-Metal commit, ttsim version, architecture, command, hypothesis and observed output. Change one variable at a time.

## 3. Debug simulator failures

Read these before treating a strict simulator exit as a crash:

- [libttsim API and ABI](https://github.com/tenstorrent/ttsim/blob/main/docs/libttsim_api.md) explains the lifecycle, virtual PCIe boundary, DMA callbacks, BAR access, clocking, single-threaded model and compatibility policy.
- [Simulator error handling](https://github.com/tenstorrent/ttsim/blob/main/docs/sim_error_handling.md) explains failure categories and why a test should isolate simulator execution in its own process.
- [Unsupported functionality](https://github.com/tenstorrent/ttsim/blob/main/docs/unsupported_functionality.md) is the first place to check when an expected hardware feature is not modeled.

## 4. Go down one architecture layer

Open only the reference needed for the current question:

- [Metalium advanced topics](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/index.html) — tiles, NoC memory addressing, Tensix compute engines, data flow and FP32 accuracy.
- [Tiles](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/tiles.html) — the 32×32 tile, faces, padding and layout.
- [Memory for kernel developers](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/memory_for_kernel_developers.html) — local addresses, L1, DRAM and NoC coordinates.
- [Compute engines and data flow](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.html) — unpacker, packer, FPU, SFPU and TRISC roles.
- [Wormhole and Blackhole ISA documentation](https://github.com/tenstorrent/tt-isa-documentation) — architecture-specific low-level instruction details. Do not transfer assumptions between chips without checking.
- [Tenstorrent glossary](https://github.com/tenstorrent/tt-isa-documentation/blob/main/Glossary.md) — names used across the ISA and architecture documentation.

## 5. Advanced boundary: QEMU

The [ttsim QEMU Bridge lesson](https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/ttsim-qemu-bridge/) adds a guest OS and kernel-driver boundary. Save it until a direct `TT_METAL_SIMULATOR=libttsim_*.so` experiment works reliably; otherwise failures are harder to localize.

## Suggested weekly loop

1. Choose one documented behavior.
2. Predict an observable output.
3. Find the smallest example that reaches it.
4. Run the unchanged baseline in ttsim.
5. Make one controlled edit and run again.
6. Explain the difference using one architecture reference.
7. Commit the note with exact version information.

The original link inventory was checked on 2026-08-12. The interview framing was
revised on 2026-09-06; no new simulator execution is implied. The upstream README,
library API and unsupported-functionality documents were consulted for that
revision. Links to `main` or `latest` are moving references: record a source
commit for a reproducible experiment and recheck version-specific behavior.
