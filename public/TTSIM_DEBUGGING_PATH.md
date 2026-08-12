# ttsim mechanism-by-mechanism debugging path

Use this after the first ttsim smoke test. The complete editable source is maintained in `docs/TTSIM_DEBUGGING_PATH.md`.

## Follow one value through six boundaries

1. **Host program:** build TT-Metalium with `./build_metal.sh --build-type Debug` and use `gdb` to inspect buffers, programs, core ranges and runtime arguments.
2. **BRISC/NCRISC data movement:** enable `TT_METAL_DPRINT_CORES=0,0`, then select one RISC with `TT_METAL_DPRINT_RISCVS=BR` or `NC`.
3. **Circular buffers and L1:** use `debug_dump_cb`, `debug_dump_l1`, or matching `DEBUG_CHECKPOINT` calls in every active kernel on the core.
4. **TRISC compute pipeline:** repeat small DPRINT passes for `TR0` (unpack), `TR1` (math) and `TR2` (pack). Find the last correct stage.
5. **NoC ordering and hangs:** start with strict ttsim errors. When supported by the selected TT-Metal/ttsim pair, use Watcher waypoints or a separate NOC Debug Dump run.
6. **Chronology:** use Device Profiler or Tracy only to understand execution order. Never interpret simulator timing as silicon performance.

Each step’s exact official reference is linked below so you can keep the relevant document open while running the command.

## Safe focused DPRINT pass

```bash
export TT_METAL_SIMULATOR=~/sim/libttsim_wh.so
export TT_METAL_SLOW_DISPATCH_MODE=1
export TT_METAL_DISABLE_SFPLOADMACRO=1
export TT_METAL_DPRINT_CORES=0,0
export TT_METAL_DPRINT_RISCVS=BR
export TT_METAL_DPRINT_ONE_FILE_PER_RISC=1
cd "$TT_METAL_HOME"
./build/programming_examples/metal_example_eltwise_binary
```

DPRINT is chosen at kernel compile time and changes the observed kernel. End every line with `\n` or the host print server may not flush it.

## Important constraints

- GDB follows host C++; device kernels require DPRINT, checkpoints, asserts and state dumps.
- Save an uninstrumented baseline first and change one observation point per run.
- Do not combine DPRINT, Watcher, Device Profiler and NOC Debug Dump.
- Checkpoint names must match in every active kernel or the barrier will hang.
- Support for hardware-oriented tools can vary by TT-Metal and ttsim version.
- Capture complete stderr because strict simulator failures can terminate the process directly.

## Official documentation

- [Host GDB debugging lab](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/matmul/lab1/lab1.html)
- [TT-Metalium debugging tools](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/index.html)
- [Device Debug Print](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_print.html)
- [Debug Checkpoints](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/checkpoint.html)
- [Compute engines and data flow within Tensix](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.html)
- [Memory for kernel developers](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/memory_for_kernel_developers.html)
- [Watcher](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/watcher.html)
- [Device Program Profiler](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_program_profiler.html)
- [Inspector and tt-triage](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/triage.html)
- [NOC Debug Dump](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/noc_debug_dump.html)
- [ttsim error handling](https://github.com/tenstorrent/ttsim/blob/main/docs/sim_error_handling.md)
