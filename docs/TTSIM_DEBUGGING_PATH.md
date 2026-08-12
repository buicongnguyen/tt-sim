# ttsim mechanism-by-mechanism debugging playbook

This playbook follows one value from host code through data movement, circular buffers, compute and output. It is designed for TT-Metalium source builds using `tenstorrent/ttsim` in WSL2.

## The boundary to remember

- **Host C++ is a normal Linux process.** Build with symbols and use `gdb` for program construction, buffers, kernel creation, runtime arguments, enqueueing and host call stacks.
- **Device kernels are RISC-V programs inside the simulated Tensix.** They are not normal host threads. Use DPRINT, checkpoints, dumps, asserts and simulator errors to follow them.
- **Some TT-Metal debug tools are hardware-oriented.** Watcher, tt-triage, Device Profiler and NoC Debug Dump may depend on the exact TT-Metal/ttsim pair. Start with the ttsim-verified DPRINT path and treat the others as progressively deeper options.

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

```bash
cd "$TT_METAL_HOME"
./build_metal.sh --build-type Debug
gdb --args ./build/programming_examples/metal_example_eltwise_binary
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
rm -rf ~/.cache/tt-metal-cache
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

Start with the strict simulator error and your last DPRINT marker. Then, if supported by the selected versions, run Watcher separately:

```bash
unset TT_METAL_DPRINT_CORES TT_METAL_DEVICE_PROFILER TT_METAL_NOC_DEBUG_DUMP
export TT_METAL_WATCHER=120
./build/programming_examples/metal_example_eltwise_binary
```

Watcher waypoints show the last code region reached by BRISC, NCRISC, TRISC0, TRISC1 and TRISC2. Look for a producer waiting to reserve space while a consumer waits for data, invalid NoC addresses, CB out-of-bounds access or two mechanisms waiting on each other.

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

Disable the other observers first:

```bash
unset TT_METAL_DPRINT_CORES TT_METAL_WATCHER TT_METAL_NOC_DEBUG_DUMP
TT_METAL_DEVICE_PROFILER=1 ./build/programming_examples/metal_example_eltwise_binary
```

`DeviceZoneScopedN("name")` can mark selected kernel regions. Use the generated timeline or CSV to answer ordering questions: which RISC began, waited and completed first? Do not use simulator durations to predict hardware speed.

## Failure-to-tool map

| Symptom | First tool | Next boundary |
| --- | --- | --- |
| Wrong buffer, core or runtime argument | Host GDB / Inspector | Program creation and dispatch |
| No kernel print | DPRINT configuration and trailing `\n` | JIT compile and selected RISC |
| Reader ran, compute did not | CB dump/checkpoint | Producer push vs consumer wait |
| First bad numerical value | TR0 → TR1 → TR2 DPRINT passes | Unpack, math or pack |
| Hang or invalid transaction | ttsim stderr, then Watcher | Last waypoint and NoC/CB checks |
| Suspected missing NoC barrier | Separate NoC Debug Dump | Outstanding reads/writes |
| Need execution order | Device Profiler / Tracy | Named host and device scopes |

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

Verified against public upstream documentation on 2026-08-12.
