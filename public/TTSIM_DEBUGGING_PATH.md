# ttsim mechanism-by-mechanism debugging playbook

This playbook follows one value from host code through data movement, circular buffers, compute and output. It is designed for TT-Metalium source builds using `tenstorrent/ttsim` in WSL2.

## The boundary to remember

- **Host C++ is a normal Linux process.** Build with symbols and use `gdb` for program construction, buffers, kernel creation, runtime arguments, enqueueing and host call stacks.
- **Device kernels are RISC-V programs inside the simulated Tensix.** They are not normal host threads. Use DPRINT, checkpoints, dumps, asserts and simulator errors to follow them.
- **Some TT-Metal debug tools are hardware-oriented.** Watcher, tt-triage, Device Profiler and NoC Debug Dump may depend on the exact TT-Metal/ttsim pair. Start with the ttsim-verified DPRINT path and treat the others as progressively deeper options.

## Verified status on this WSL machine

These results were reproduced on 2026-08-16 with TT-Metal commit `50a82f835593`, ttsim v1.10.1, `libttsim_bh.so` and `libttsim_qsr.so`:

| Path | Observed result | Meaning |
| --- | --- | --- |
| VS Code/GDB | Blocked before launch: `gdb` is not installed; current CMake build is `Release` and has no `.debug_info`/`.debug_line` sections | Install GDB and create a separate Debug build before expecting source breakpoints |
| Blackhole + Watcher | PASS: Watcher attached, polled, wrote `generated/watcher/watcher.log`, and the example returned `21` | This is the verified Watcher practice lane |
| Quasar + Watcher | Watcher attached and dumped state, then ttsim stopped at `UnimplementedFunctionality: rv64_custom_0: funct3=2` | Attachment is not proof of end-to-end Watcher support on Quasar |
| Blackhole + Device Profiler | `test_full_buffer` passed and created the CSV, but it contained only the two header lines and no `TEST-FULL` zones | Profiler plumbing starts, but this ttsim pair does not provide a useful device timeline |
| Quasar + Device Profiler | Profiler firmware compiled and the runtime printed `Profiler started`, then stopped at the same unimplemented custom instruction | Do not use Device Profiler as the Quasar correctness path yet |
| Blackhole + Tracy host capture | Tracy capture binary is present in `build/tools/profiler/bin/tracy-capture` | Host-side Tracy is the useful visualization path under ttsim; its durations measure simulator-host execution, not silicon |

The practical order is therefore: **GDB for host state, DPRINT for Quasar device state, Watcher for the verified Blackhole hang lab, and Tracy for the host timeline.** Re-test Device Profiler whenever either TT-Metal or ttsim changes.

## Non-negotiable rules

1. Save one baseline run before adding instrumentation.
2. Select one logical core and one RISC whenever possible.
3. Change one observation point per run.
4. DPRINT and checkpoints are selected at kernel compile time; instrumentation changes the binary under test.
5. DPRINT, Watcher, Device Profiler and NoC Debug Dump compete for kernel/L1 resources. Do not enable them together.
6. Use profiler output to study chronology only. Never report ttsim timing as silicon performance.
7. Record TT-Metal commit, ttsim version, architecture, environment variables and complete stderr with every failure.

## Pass 0 — capture a clean baseline

```bash
export TT_METAL_SIMULATOR=~/sim/libttsim_wh.so
export TT_METAL_SLOW_DISPATCH_MODE=1
export TT_METAL_DISABLE_SFPLOADMACRO=1

unset TT_METAL_DPRINT_CORES TT_METAL_DPRINT_RISCVS
unset TT_METAL_WATCHER TT_METAL_DEVICE_PROFILER
unset TT_METAL_NOC_DEBUG_DUMP TT_METAL_CHECKPOINT

cd "$TT_METAL_HOME"
./build/programming_examples/metal_example_eltwise_binary 2>&1 | tee /tmp/ttsim-baseline.log
```

Write down the first observable mismatch—not the final cascade of errors.

## Pass 1 — debug the host path with GDB

Official Metalium guidance separates host debugging from kernel debugging.

**Read first:** [Single-core matmul debugging lab](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/matmul/lab1/lab1.html). Keep [Inspector](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/inspector.html) and [tt-triage](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/triage.html) beside it for recorded host state and post-failure analysis.

### Repair the current VS Code setup

Open a **WSL: Ubuntu** VS Code window at the TT-Metal checkout. A Windows VS Code window cannot launch a Linux ELF through Windows GDB:

```bash
cd ~/src/tt-metal
code .
```

Install GDB inside Ubuntu, not on Windows:

```bash
sudo apt update
sudo apt install -y gdb
gdb --version
```

Keep the working Release build and create a separate symbol-rich build:

```bash
cd ~/src/tt-metal
CMAKE_BUILD_PARALLEL_LEVEL=8 ./build_metal.sh \
  --debug \
  --build-dir build-debug \
  --build-metal-tests \
  --build-programming-examples
```

Confirm that the executable and line tables exist:

```bash
file build-debug/test/tt_metal/unit_tests_legacy
readelf -S build-debug/test/tt_metal/unit_tests_legacy \
  | grep -E 'debug_info|debug_line'
```

`not stripped` alone is insufficient; GDB needs DWARF line information to bind a source breakpoint.

### Launch Quasar host code from VS Code

Copy this configuration to `~/src/tt-metal/.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Quasar ttsim — SingleDmL1Write host",
      "type": "cppdbg",
      "request": "launch",
      "program": "${workspaceFolder}/build-debug/test/tt_metal/unit_tests_legacy",
      "args": [
        "--gtest_filter=QuasarMeshDeviceSingleCardFixture.SingleDmL1Write"
      ],
      "cwd": "${workspaceFolder}",
      "MIMode": "gdb",
      "miDebuggerPath": "/usr/bin/gdb",
      "stopAtEntry": true,
      "externalConsole": false,
      "environment": [
        { "name": "TT_METAL_HOME", "value": "/home/n/src/tt-metal" },
        { "name": "TT_METAL_SIMULATOR", "value": "/home/n/sim/libttsim_qsr.so" },
        { "name": "TT_METAL_SLOW_DISPATCH_MODE", "value": "1" }
      ],
      "setupCommands": [
        {
          "description": "Enable GDB pretty printing",
          "text": "-enable-pretty-printing",
          "ignoreFailures": true
        }
      ]
    }
  ]
}
```

Before pressing F5, stage the matching descriptor once:

```bash
cp tt_metal/soc_descriptors/quasar_32_arch.yaml \
  ~/sim/soc_descriptor.yaml
```

Set a source breakpoint in `tests/tt_metal/tt_metal/test_single_dm_l1_write.cpp`. The device source it launches is `tests/tt_metal/tt_metal/test_kernels/dataflow/simple_l1_write.cpp`; a red dot there will not behave like a host breakpoint because that file becomes a simulated RISC-V kernel.

Use plain GDB first if F5 still fails:

```bash
gdb --args \
  ./build-debug/test/tt_metal/unit_tests_legacy \
  --gtest_filter=QuasarMeshDeviceSingleCardFixture.SingleDmL1Write
```

Useful first commands:

```text
(gdb) break main
(gdb) run
(gdb) next
(gdb) bt
(gdb) info locals
```

Follow these host mechanisms in order:

1. device creation and selected architecture;
2. input/output buffer size, layout and address;
3. program and logical core range;
4. reader, writer and compute kernel source paths;
5. compile-time and runtime argument order;
6. enqueue, finish and close calls.

Inspector is designed to record Metal host-runtime facts with low overhead. Its data can remain in `generated/inspector` after the runtime exits.

## Pass 2 — trace one data-movement RISC with DPRINT

The official ttsim lesson demonstrates DPRINT under simulation. Select only logical core `(0,0)` and BRISC first:

**Read first:** [Device Debug Print](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_print.html). Then follow the DPRINT experiment in [Twenty-and-Ten Things You Can Do with ttsim](https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/ttsim-twenty-and-ten/).

```bash
export TT_METAL_DPRINT_CORES=0,0
export TT_METAL_DPRINT_RISCVS=BR
export TT_METAL_DPRINT_ONE_FILE_PER_RISC=1
./build/programming_examples/metal_example_eltwise_binary
```

In the kernel:

```cpp
#include "api/debug/dprint.h"

void kernel_main() {
    const uint32_t src = get_arg_val<uint32_t>(0);
    const uint32_t bytes = get_arg_val<uint32_t>(1);
    DPRINT_DATA0("reader start src=0x{:x} bytes={}\n", src, bytes);

    // reserve CB -> issue NoC read -> barrier -> push CB

    DPRINT_DATA0("reader pushed input tile\n");
}
```

Always terminate each DPRINT line with `\n`; the host print server buffers incomplete lines. Repeat with `TT_METAL_DPRINT_RISCVS=NC` if the program uses NCRISC.

Observe:

- runtime arguments before they become addresses;
- logical destination coordinates;
- byte counts and tile counts;
- markers immediately before and after NoC barriers;
- CB reserve/push or wait/pop order.

## Pass 3 — take a consistent CB/L1 snapshot

**Read first:** [Debug Checkpoints](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/checkpoint.html). Use [Memory for kernel developers](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/memory_for_kernel_developers.html) to interpret addresses and [Tiles](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/tiles.html) to interpret layout.

For a quick, unsynchronized observation:

```cpp
#include "api/debug/dump.h"

debug_dump_cb(0, 8);          // CB0 metadata and eight words
debug_dump_l1(0x100000, 16);  // arbitrary L1 region
```

For a consistent pipeline snapshot:

```bash
export TT_METAL_CHECKPOINT=1
export TT_METAL_DPRINT_CORES=0,0
export TT_METAL_CACHE=~/ttsim-cache/checkpoint-pass-01
```

Add the same checkpoint to **every active kernel on the core**:

```cpp
#include "api/debug/checkpoint.h"

DEBUG_CHECKPOINT("after_read");
```

Every active RISC must reach the matching checkpoint or the barrier itself will hang. Compare `rd`, `wr`, tiles acknowledged and tiles received for producer and consumer views.

## Pass 4 — locate the first bad compute stage

**Read first:** [Compute engines and data flow within Tensix](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.html). Open the [ISA documentation](https://github.com/tenstorrent/tt-isa-documentation) only when the question reaches instruction behavior.

Run separate passes for the three compute roles:

| Filter | Mechanism | Question |
| --- | --- | --- |
| `TR0` | Unpack | Did the correct CB data and format enter compute? |
| `TR1` | Math | Did the operation first produce an incorrect value here? |
| `TR2` | Pack | Was the correct result converted and written to the output CB? |

```bash
export TT_METAL_DPRINT_CORES=0,0
export TT_METAL_DPRINT_RISCVS=TR0  # then repeat with TR1 and TR2
./build/programming_examples/metal_example_eltwise_binary
```

Print a small tile slice, not an entire tensor. The useful fact is the **last correct boundary**.

## Pass 5 — diagnose ordering and hangs

**Read first:** [Watcher](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/watcher.html). For outstanding transaction ordering, use the separate experimental [NOC Debug Dump](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/noc_debug_dump.html) reference. Interpret simulator termination using [ttsim error handling](https://github.com/tenstorrent/ttsim/blob/main/docs/sim_error_handling.md).

ttsim deliberately exposes software ordering permitted by synchronization, including schedules that may be rare on silicon. Treat a simulator-only race as evidence that the software is missing a required ordering edge.

Start with the strict simulator error and your last DPRINT marker. Then run Watcher as a separate experiment. `TT_METAL_WATCHER` is the polling interval in seconds; a longer interval is less invasive:

```bash
unset TT_METAL_DPRINT_CORES TT_METAL_DPRINT_RISCVS
unset TT_METAL_DEVICE_PROFILER TT_METAL_NOC_DEBUG_DUMP
export TT_METAL_WATCHER=10
export TT_METAL_WATCHER_APPEND=1
```

Do not set `TT_METAL_WATCHER_DUMP_ALL=1` initially: upstream warns that reading unsafe state while a kernel is running can itself hang the workload.

### Verified Blackhole Watcher run

```bash
cd ~/src/tt-metal
cp tt_metal/soc_descriptors/blackhole_140_arch.yaml \
  ~/sim/soc_descriptor.yaml

export TT_METAL_SIMULATOR=~/sim/libttsim_bh.so
export TT_METAL_SLOW_DISPATCH_MODE=1
export TT_METAL_DISABLE_SFPLOADMACRO=1

./build/programming_examples/metal_example_add_2_integers_in_riscv
```

Expected proof:

```text
Watcher log file: /home/n/src/tt-metal/generated/watcher/watcher.log
Watcher server initialized, disabled features: None
Watcher checking device 0
Success: Result is 21
Watcher thread stopped watching...
```

Read the log from another VS Code terminal:

```bash
less generated/watcher/watcher.log
grep -nE 'k_ids|assert|waypoint|kernel' \
  generated/watcher/watcher.log | head -n 80
```

Watcher reports the active kernel IDs, per-RISC state, last waypoints, invalid NoC coordinates/addresses, active-CB out-of-bounds transactions and L1 address-zero corruption. On Wormhole/Blackhole, the traditional RISC dump order is BRISC, NCRISC, TRISC0, TRISC1 and TRISC2.

Add short, unique waypoints around a suspected wait and pair them with Watcher assertions:

```cpp
#include "debug/assert.h"
#include "debug/waypoint.h"

void kernel_main() {
    const uint32_t bytes = get_arg_val<uint32_t>(1);
    WAYPOINT("ARG");
    ASSERT(bytes > 0);

    WAYPOINT("RDW");  // about to wait/read
    // NoC read, semaphore wait, or CB wait
    WAYPOINT("RDD");  // wait/read completed
}
```

Waypoints hold up to four characters. A useful convention is `W` for waiting and `D` for done, so the last marker tells you which wait never completed. These macros compile out when Watcher is disabled.

### Dump Watcher state from GDB

If the host process is stuck, interrupt it with Ctrl+C. In a GDB terminal:

```text
(gdb) thread 1
(gdb) up
(gdb) call tt::watcher::dump(stderr, true)
```

Repeat `up` until the selected frame is inside the `tt` namespace. With VS Code `cppdbg`, enter GDB commands in the Debug Console with the `-exec` prefix, for example:

```text
-exec call tt::watcher::dump(stderr, true)
```

The final `true` requests hardware-register state. The call works even when Watcher was not enabled, but debug-only waypoint information is then absent.

### Current Quasar limitation

The same `SingleDmL1Write` test was run with `TT_METAL_WATCHER=2`. Watcher successfully attached, produced an 11,756-byte log and identified Quasar DM/Neo state, but the instrumented kernel stopped at:

```text
UnimplementedFunctionality: rv64_custom_0: funct3=2 reg_index=32 cmd_buf=0
```

For TT-Metal `50a82f835593` plus ttsim v1.10.1, use DPRINT for the Quasar device path. Re-run this Watcher probe after upgrading either component; do not infer support from the attach message alone.

Look for a producer waiting to reserve space while a consumer waits for data, invalid NoC addresses, CB out-of-bounds access or two mechanisms waiting on each other.

For a separate experimental NoC pass:

```bash
unset TT_METAL_WATCHER
TT_METAL_NOC_DEBUG_DUMP=1 ./build/programming_examples/metal_example_eltwise_binary
```

NoC Debug Dump can flag issues such as an asynchronous write that reaches kernel end without the required barrier. It cannot be combined with DPRINT, Watcher or Device Profiler.

## Pass 6 — add assertions or post-failure triage

Lightweight kernel asserts expand to a RISC-V `ebreak` on failure:

```bash
export TT_METAL_LIGHTWEIGHT_KERNEL_ASSERTS=1
```

After a hang, `tt-triage` can analyze Inspector and device state when supported by the active environment. Simulator failures are intentionally strict and can terminate through `_Exit(1)`, so run each experiment in its own process and capture stderr.

## Pass 7 — inspect chronology, never benchmark

**Read first:** [Device Program Profiler](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_program_profiler.html). Use [Tracy Profiler](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/tracy_profiler.html) for the combined host/device view.

Device profiling is built into normal source builds but is off at runtime. Disable the other observers first:

```bash
unset TT_METAL_DPRINT_CORES TT_METAL_DPRINT_RISCVS
unset TT_METAL_WATCHER TT_METAL_NOC_DEBUG_DUMP
export TT_METAL_DEVICE_PROFILER=1
```

Add a small number of named zones to the device kernel:

```cpp
#include <tools/profiler/kernel_profiler.hpp>

void kernel_main() {
    DeviceZoneScopedN("L1-WRITE");
    // Region to observe
}
```

The annotation has overhead. The current profiler buffer has space for only 125 scopes per core, so profile a phase or loop aggregate rather than every iteration. Results are normally collected during device close. A long-running host can request them explicitly after finishing its work:

```cpp
tt::tt_metal::detail::ReadDeviceProfilerResults(device);
```

The official smoke workload is:

```bash
cd ~/src/tt-metal
cp tt_metal/soc_descriptors/blackhole_140_arch.yaml \
  ~/sim/soc_descriptor.yaml
export TT_METAL_SIMULATOR=~/sim/libttsim_bh.so

./build/programming_examples/profiler/test_full_buffer

wc -l generated/profiler/.logs/profile_log_device.csv
grep 'TEST-FULL' generated/profiler/.logs/profile_log_device.csv | head
```

On hardware, the CSV contains begin/end rows with device, core, RISC, timer, zone, source file and line. On this Blackhole ttsim run, the example printed `Test Passed`, but the CSV contained only:

```text
ARCH: blackhole, CHIP_FREQ[MHz]: 0, Max Compute Cores: 140
PCIe slot, core_x, core_y, ... zone name, type, source line, source file, meta data
```

There were no `TEST-FULL` rows. This is a successful simulator correctness run, not a successful device-profile capture. On Quasar, profiler firmware compiled with `PROFILE_KERNEL=1` and the runtime printed `Profiler started on device 0`, but execution stopped at the same unimplemented `rv64_custom_0` instruction seen with Watcher.

### Use Tracy for the host-side view

The built capture tool exists at `build/tools/profiler/bin/tracy-capture`. Use two VS Code WSL terminals.

Terminal A:

```bash
cd ~/src/tt-metal
./build/tools/profiler/bin/tracy-capture \
  -o /tmp/ttsim-blackhole-host.tracy
```

Terminal B:

```bash
cd ~/src/tt-metal
unset TT_METAL_DPRINT_CORES TT_METAL_WATCHER
unset TT_METAL_DEVICE_PROFILER TT_METAL_NOC_DEBUG_DUMP
./build/programming_examples/metal_example_add_2_integers_in_riscv
```

Open the resulting `.tracy` file in Tenstorrent's Tracy GUI. For Python workloads, `python -m tracy ...` starts the WASM viewer; its default HTTP/WebSocket ports are 8080 and 8081. In WSL2, open the printed localhost URL from Windows, or forward both ports if the viewer is remote.

Use Tracy to answer host questions—JIT compilation, program construction, submission, waits and shutdown. Use any simulator device events only as execution-order evidence. The official ttsim lesson states that hardware performance-counter and cycle-timer values intentionally diverge under simulation; do not use them to predict hardware speed.

## Failure-to-tool map

| Symptom | First tool | Next boundary |
| --- | --- | --- |
| VS Code cannot start GDB | Confirm WSL window, `/usr/bin/gdb`, Debug binary and DWARF sections | Host debugger installation/build |
| Breakpoint is hollow or never binds | Check that `program` uses `build-debug`, not `build`, and set it in a host `.cpp` file | Host source mapping and symbols |
| Breakpoint is inside a device kernel | Replace it with DPRINT, a waypoint, checkpoint or zone | Simulated RISC-V execution |
| Wrong buffer, core or runtime argument | Host GDB / Inspector | Program creation and dispatch |
| No kernel print | DPRINT configuration and trailing `\n` | JIT compile and selected RISC |
| Reader ran, compute did not | CB dump/checkpoint | Producer push vs consumer wait |
| First bad numerical value | TR0 → TR1 → TR2 DPRINT passes | Unpack, math or pack |
| Blackhole hang or invalid transaction | ttsim stderr, then verified Watcher pass | Last waypoint and NoC/CB checks |
| Quasar Watcher/profiler hits `rv64_custom_0` | Return to DPRINT and record the exact pair | Unsupported simulator instruction |
| Suspected missing NoC barrier | Separate NoC Debug Dump | Outstanding reads/writes |
| Need host execution order | Tracy | Named host scopes |
| Device profiler CSV has only headers | No usable device zones were returned | Re-test on hardware or a newer pair |

## Primary documentation

- [TT-Metalium debugging tools](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/index.html)
- [Device Debug Print](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_print.html)
- [Debug Checkpoints](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/checkpoint.html)
- [Watcher](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/watcher.html)
- [Device Program Profiler](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_program_profiler.html)
- [Inspector](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/inspector.html)
- [tt-triage](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/triage.html)
- [NOC Debug Dump](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/noc_debug_dump.html)
- [ttsim error handling](https://github.com/tenstorrent/ttsim/blob/main/docs/sim_error_handling.md)
- [Twenty-and-Ten ttsim experiments](https://docs.tenstorrent.com/tt-vscode-toolkit/lessons/ttsim-twenty-and-ten/)

Verified against public upstream documentation and the pinned WSL simulator pair on 2026-08-16.
