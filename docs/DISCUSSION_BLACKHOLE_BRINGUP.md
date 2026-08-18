# Discussion chain 01 — Blackhole BRISC/NCRISC bring-up

Started: **18 August 2026**<br>
Architecture: **Blackhole Tensix**<br>
Source baseline: **`tenstorrent/tt-metal@50a82f835593512c4176546b4af68d7e91315a86`**<br>
Status: **reproduction and root-cause proof plan; historical compiler details still required**

Interactive view:
<https://buicongnguyen.github.io/tt-sim/discussion-blackhole-bringup.html>

This is the first question-and-answer chain promoted from the
[Discussion workbench](./DISCUSSION.md). It turns a remembered bring-up symptom
into a reproducible, evidence-gated investigation.

> Case memory: “While bringing up Blackhole, NCRISC could not call BRISC. It
> seemed that a third-party compiler compiled the kernel incorrectly.”

The memory is useful, but two parts must be corrected before debugging:

1. On the inspected Blackhole path, **NCRISC does not call BRISC**. BRISC is the
   supervisor. BRISC publishes `LOAD` and `GO` in shared subordinate state;
   NCRISC observes those messages, invokes its own operation-kernel entry point,
   and publishes `DONE`.
2. A run that changes when the optimization level or compiler changes is
   **compiler-sensitive**, but it is not yet proof of a compiler bug. The same
   preprocessed input, flags, linker inputs, load image and runtime conditions
   must move from fail to pass with the compiler variable.

The historical record supplied so far does not name the failing compiler
version, the known-good version, the bad instruction sequence or the final
patch. This guide therefore does not invent them. It gives the exact process
that would justify the root-cause statement and the fix record that should be
completed when those artifacts are recovered.

## Short answer

Debug the smallest boundary first:

```text
host launch GO → BRISC sees host GO → BRISC writes DM1 LOAD → NCRISC prepares (R)
               → BRISC writes DM1 GO → NCRISC calls its operation ELF
               → CRT + separate host-GO mailbox check → K → kernel_main → KD
               → NCRISC D/DONE → BRISC observes all enabled subordinates DONE
```

There are **two GO-bearing locations** here. `subordinate_sync->dm1` is the
BRISC-to-NCRISC `LOAD/GO/DONE` handshake. The operation wrapper's
`wait_for_go_message()` reads `mailboxes->go_messages[...]`, the launch-level
host/dispatcher GO mailbox. They are not the same word and should be captured
separately when `R` appears without `K`.

Use Watcher waypoints to locate the first missing transition. If execution
reaches NCRISC operation waypoint `K` but not `KD`, the failure is inside
`kernel_main`; if it reaches NCRISC firmware `R` but never operation `K`, inspect
the DM1 subordinate-GO wait, operation handoff, ELF entry, CRT/data
initialization, separate launch-level host-GO mailbox, load image and ABI. Only
after
binary readback matches and the same build input fails with compiler A but
passes with compiler B should the investigation be reduced to a compiler
reproducer.

## Plan

| Step | Decision | Evidence produced | Stop condition |
|---|---|---|---|
| 0 | Can the failure be reproduced on one core? | commit, board, commands, launch inputs, clean logs | no stable reproduction |
| 1 | Is this initialization, launch or operation execution? | BRISC/NCRISC Watcher waypoints | first missing boundary found |
| 2 | Did NCRISC observe the BRISC `LOAD/GO` state? | subordinate state plus `GW/GD/W/R` markers | handshake branch classified |
| 3 | Did the intended NCRISC ELF reach the expected address unchanged? | host ELF hash, readback, sections, map | transport/load mismatch found |
| 4 | Did control enter the operation wrapper and `kernel_main`? | `R/K/KD/D` markers and failing PC | exact code interval found |
| 5 | Is the symptom source-, optimization- or toolchain-sensitive? | minimized input and controlled build matrix | one variable moves outcome |
| 6 | Does the result follow only the compiler? | compiler path/version/hash A/B | root cause is proven or rejected |
| 7 | Does the fix survive clean rebuild and regression? | matched firmware/kernel rebuild plus negative tests | closure criteria pass |

### Logic review of the plan

- **Corrected direction:** BRISC signals NCRISC; NCRISC does not make a normal
  C/C++ call into BRISC.
- **Separate firmware from operation code:** Blackhole runs persistent NCRISC
  firmware and then calls the NCRISC operation entry at `kernel_lma`. The
  operation wrapper subsequently calls the user `kernel_main`.
- **Do not jump from hang to compiler:** a missing GO, stale launch state,
  incorrect enable mask, corrupt load, linker/ABI mismatch, CRT failure and user
  kernel deadlock can look similar from the host.
- **Treat `-O0` as a locator:** `O0` passing while `O2` fails narrows the case to
  optimization-sensitive code. It does not distinguish undefined behavior,
  inline assembly constraints, an LTO/link problem or a compiler defect.
- **Control cache state:** normal JIT keys include compiler version, but build-map
  mode deliberately omits it to make compiler logs comparable. Use a different
  `TT_METAL_CACHE` directory for every compiler and force recompilation.
- **Rebuild a matched pair:** the operation ELF links against symbols from a
  weakened firmware ELF. Do not mix a firmware image from compiler A with an
  operation image from compiler B when claiming a clean A/B.

### Code review of the plan

The decision points correspond to real code boundaries in the pinned source:

- [BRISC writes `LOAD`, initializes firmware configuration, starts NCRISC, runs
  its own kernel and waits for subordinate completion](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L354-L590).
- [Blackhole BRISC publishes NCRISC `GO` through `subordinate_sync->dm1`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L290-L298).
- [NCRISC waits for BRISC notification, invokes `kernel_lma`, then signals
  completion](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/ncrisc.cc#L77-L192).
- [The NCRISC operation wrapper initializes data, waits for its run message and
  brackets `kernel_main` with `K`/`KD`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/ncrisck.cc#L38-L95).
- [The operation wrapper's `wait_for_go_message()` polls the separate
  launch-level `go_messages` mailbox](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/internal/firmware_common.h#L194-L206).
- [Blackhole HAL assigns independent BRISC and NCRISC firmware bases and reset
  launch values](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/hal/tt-1xx/blackhole/bh_hal_tensix.cpp#L97-L147).
- [The JIT selects the TT-packaged RISC-V compiler and composes common flags](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/jit_build/build.cpp#L124-L205).
- [Build-map mode emits saved temporaries and compiler dumps; link-map mode
  emits the linker map](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/jit_build/build.cpp#L628-L767).

## STAR case study — first Blackhole unit-test bring-up

### Evidence status

This STAR record is a **source-backed reconstruction and repeatable lab**, not a
claim that the missing historical compiler artifacts have been recovered. It
separates:

- **source fact** — visible in the pinned TT-Metal revision;
- **experiment** — a command to run on the Blackhole system;
- **result** — an artifact actually captured from that run;
- **open** — evidence still required before making a historical root-cause
  claim.

That distinction matters in STAR format: the `Result` cannot be invented merely
to make the story sound complete.

### S — Situation

During first Blackhole bring-up, assume the smallest failing observation is a
one-worker unit test involving both data-movement RISCs. Host-side kernel
creation succeeds and the JIT produces an ELF for both processor selections,
but the run hangs or returns wrong data. The remembered hypothesis is that a
third-party compiler generated incorrect NCRISC code.

The hypothesis is not yet a root cause because four different states can look
like “the kernel compiled but did not run”:

```text
ELF exists → bytes delivered → entry executed → kernel_main returned → data correct
```

The existing
[`TensixTestEquivalentDataMovementKernelsWithDifferentProcessors`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/api/test_kernel_compile_cache.cpp#L32-L68)
checks that separate `RISCV_0` and `RISCV_1` ELF files exist. It does **not**
load, enter or execute those ELFs. Conversely,
[`TensixSingleCoreDirectDramReaderWriter`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/api/test_direct.cpp#L564-L577)
executes a `RISCV_1` reader and `RISCV_0` writer together and verifies returned
DRAM data. A combined failure does not, by itself, identify which RISC failed.

### T — Task

Find the **first broken boundary**, not merely the last visible symptom:

1. prove the test executables and observation tools are usable;
2. separate host API creation from compilation;
3. execute BRISC and NCRISC independently with known data;
4. combine them only after each individual path passes;
5. add synchronization and TRISC compute one layer at a time;
6. classify the missing firmware/operation waypoint interval;
7. prove binary identity and the failing PC;
8. vary the compiler only after every earlier boundary is controlled.

The deliverable is an evidence bundle containing the command, exit status,
Watcher/DPRINT output, compiler identity, ELF/map/disassembly, input and output
hashes, and the first failing ladder rung.

### Terminology used in this case

| Term | Small definition |
|---|---|
| host test | C++ GTest code running on Ubuntu; it creates Programs, buffers and kernels and checks results |
| device kernel | RISC-V operation code selected by the host test and executed on a Tensix processor |
| firmware | persistent BRISC/NCRISC supervisory code already running around operation launches |
| operation wrapper | per-operation entry that performs CRT/setup, calls `kernel_main`, performs postchecks and returns |
| `RISCV_0` | Blackhole/Wormhole host API selection that maps to the BRISC data-movement processor in the reviewed path |
| `RISCV_1` | Blackhole/Wormhole host API selection that maps to the NCRISC data-movement processor in the reviewed path |
| compile pass | proves a build artifact exists; it says nothing about device delivery or execution |
| execution pass | proves control ran far enough to complete; it can still produce incorrect data |
| data-verification pass | compares returned bytes/words with a known expected result |
| isolation test | runs one processor or one mechanism so another processor cannot hide the cause |

The processor mapping is encoded when TT-Metal converts reader/writer data
movement configurations into processor classes; see
[`program.cpp`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/program/program.cpp#L415-L432)
and
[`kernel_types.cpp`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/kernels/kernel_types.cpp#L13-L43).

### A — Action: build and run a module-isolation ladder

At audit time the local `build/test/tt_metal` directory contained only
`unit_tests_legacy`; the source defines the newer `unit_tests_api` and
`unit_tests_debug_tools` targets. Build the exact suites before treating “test
not found” as a device failure:

```bash
cd ~/src/tt-metal
cmake --build build --target unit_tests_api unit_tests_debug_tools -j"$(nproc)"

API=./build/test/tt_metal/unit_tests_api
DBG=./build/test/tt_metal/unit_tests_debug_tools
```

The target names come from
[`tests/tt_metal/tt_metal/CMakeLists.txt`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/CMakeLists.txt#L70-L86),
the [API test CMake file](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/api/CMakeLists.txt#L1-L43)
and the [debug-tools CMake file](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/debug_tools/CMakeLists.txt#L1-L19).

#### Action flow

```mermaid
flowchart TD
    B[Build API + debug-tool suites] --> C[Create kernel objects]
    C --> E[Compile same source for RISCV_0 and RISCV_1]
    E --> O[Validate Watcher and DPRINT themselves]
    O --> R0[Run BRISC-only data tests]
    R0 --> R1[Run or add NCRISC-only data test]
    R1 --> RW[Run combined NCRISC reader + BRISC writer]
    RW --> S[Run BRISC-NCRISC barrier test]
    S --> T[Add TRISC datacopy stage]
    T --> D[Repeat smallest reproducer in supported dispatch modes]
    D --> A{All pre-compiler boundaries proven?}
    A -- no --> F[Debug first failing rung]
    A -- yes --> AB[Run controlled compiler A/B]
```

#### Ladder and decision at every rung

| Level | Command or change | Processor/module | What a pass proves | What a failure means next |
|---|---|---|---|---|
| L0 | build both suites | host build | required test binaries exist | repair configuration/build before device diagnosis |
| L1 | `MeshDispatchFixture.TensixCreateKernelsOnComputeCores` | host API | kernel creation/config validation succeeds | inspect `CreateKernel`, core range and configuration; compilation is not reached |
| L2 | `MeshDeviceFixture.TensixTestEquivalentDataMovementKernelsWithDifferentProcessors` | RISCV_0 + RISCV_1 build | separate processor ELFs exist | compare build state, flags, target output and JIT cache; still no execution proof |
| L3 | `MeshWatcherFixture.TestWatcherWaypoints` | Watcher | firmware/operation progress markers can be observed | do not interpret silence in the target test until Watcher works |
| L3b | `DevicePrintOutputFixture.PrintConcurrentAllRiscs` and `PrintCallstackPcFull` | DPRINT | messages from all RISCs and device call-stack symbolization work | fix DPRINT/debug-info path before relying on printed values or stacks |
| L4 | `MeshDeviceFixture.TensixSingleCoreDirectDramReaderOnly` and `…WriterOnly` | RISCV_0 / BRISC | real DRAM↔L1 kernels execute and every returned word matches | stay on BRISC, memory addressing, NoC or dispatch; NCRISC is not the first problem |
| L5 | add/adapt one one-core `RISCV_1` known-pattern test | RISCV_1 / NCRISC | NCRISC alone enters, transfers data, completes and returns correct output | classify `W/R/K/KD/D`; this is the missing isolation rung in the reviewed set |
| L6 | `MeshDeviceFixture.TensixSingleCoreDirectDramReaderWriter` | RISCV_1 reader + RISCV_0 writer | both DM processors cooperate through L1 and return correct DRAM data | if L4/L5 pass, inspect cross-RISC buffer and ordering contracts |
| L7 | `KernelThreadSyncTest.BarrierSynchronizesThreads` | BRISC ↔ NCRISC | the explicit two-RISC barrier produces verified L1 state | inspect synchronization, semaphore state and NoC visibility |
| L8 | `AnyDispatchMeshDeviceFixture.TensixSingleCoreDirectDramReaderDatacopyWriter` | DM + TRISC | reader → compute/datacopy → writer works | the first new boundary is circular buffers, compute setup or TRISC |
| L9 | repeat the smallest reproducer through every mode it actually supports | dispatch | failure is or is not command-delivery-specific | do not use a test hard-coded to `slow_dispatch::LaunchProgram` as proof of fast/slow equivalence |

Run the existing rungs separately so the first failed command remains obvious:

```bash
"$API" --gtest_filter='MeshDispatchFixture.TensixCreateKernelsOnComputeCores'

"$API" --gtest_filter='MeshDeviceFixture.TensixTestEquivalentDataMovementKernelsWithDifferentProcessors'

"$DBG" --gtest_filter='MeshWatcherFixture.TestWatcherWaypoints'
"$DBG" --gtest_filter='DevicePrintOutputFixture.PrintConcurrentAllRiscs'
"$DBG" --gtest_filter='DevicePrintOutputFixture.PrintCallstackPcFull'

"$API" --gtest_filter='MeshDeviceFixture.TensixSingleCoreDirectDramReaderOnly'
"$API" --gtest_filter='MeshDeviceFixture.TensixSingleCoreDirectDramWriterOnly'
"$API" --gtest_filter='MeshDeviceFixture.TensixSingleCoreDirectDramReaderWriter'
"$API" --gtest_filter='KernelThreadSyncTest.BarrierSynchronizesThreads'
"$API" --gtest_filter='AnyDispatchMeshDeviceFixture.TensixSingleCoreDirectDramReaderDatacopyWriter'
```

Host and device source locations for review:

- kernel creation host test:
  [`test_kernel_creation.cpp:36–53`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/api/test_kernel_creation.cpp#L36-L53);
- two-processor compile host test:
  [`test_kernel_compile_cache.cpp:32–68`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/api/test_kernel_compile_cache.cpp#L32-L68),
  device source
  [`reader_unary_push_4.cpp`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/test_kernels/dataflow/reader_unary_push_4.cpp);
- BRISC-only host setup and verification:
  [`test_direct.cpp:46–175`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/api/test_direct.cpp#L46-L175),
  [reader kernel](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/test_kernels/dataflow/unit_tests/dram/direct_reader_dram_to_l1.cpp)
  and [writer kernel](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/test_kernels/dataflow/unit_tests/dram/direct_writer_l1_to_dram.cpp);
- combined NCRISC-reader/BRISC-writer mapping:
  [`test_direct.cpp:193–317`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/api/test_direct.cpp#L193-L317),
  [reader kernel](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/test_kernels/dataflow/unit_tests/dram/direct_reader_unary_2_0.cpp)
  and [writer kernel](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/test_kernels/dataflow/unit_tests/dram/direct_writer_unary_2_0.cpp);
- explicit BRISC/NCRISC barrier host test:
  [`test_kernel_thread_sync.cpp:77–130`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/api/test_kernel_thread_sync.cpp#L77-L130),
  [barrier device kernel](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/test_kernels/dataflow/kernel_thread_barrier.cpp);
- Watcher self-test:
  [`test_waypoint.cpp:54–220`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/debug_tools/watcher/test_waypoint.cpp#L54-L220);
- DPRINT and call-stack self-tests:
  [`test_print_output.cpp:226`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/debug_tools/device_print/test_print_output.cpp#L226-L231)
  and
  [`test_print_output.cpp:640–658`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/debug_tools/device_print/test_print_output.cpp#L640-L658).

#### C1 — Which toolchain built the ELF, and does the ELF match the design?

First, use the correct name: the Blackhole data-movement processor is
**NCRISC**, not “NRISC.” The C1 branch has two separate gates:

1. **toolchain identity** — did the JIT use the required SFPI compiler, version,
   executable and flags?
2. **load-image contract** — are the ELF architecture, entry, load spans, region
   sizes and actual 32-bit words consistent with the Blackhole memory map and
   the bytes written to the device?

```mermaid
flowchart TD
    C1[JIT / toolchain / build-state problem] --> P[Capture compiler path from the JIT compile log]
    P --> R[Read required SFPI version and build from tt_metal/sfpi-version]
    R --> V{Actual version and build match?}
    V -- no --> I[Install the pinned SFPI package and create a fresh cache]
    V -- yes --> H[Record compiler SHA-256 and complete compile/link commands]
    H --> J{Logged JIT path equals the verified executable?}
    J -- no --> Q[Fix local-versus-system SFPI selection or stale build state]
    J -- yes --> F[Force JIT and build BRISC, NCRISC and TRISC ELFs]
    F --> E[Continue to the ELF/load-image acceptance gate]
```

The runtime JIT checks for these compiler locations in this order:

```text
1. $TT_METAL_HOME/runtime/sfpi/compiler/bin/riscv-tt-elf-g++
2. /opt/tenstorrent/sfpi/compiler/bin/riscv-tt-elf-g++
```

Do not infer the selected path from `PATH`. The JIT constructs the full path in
[`JitBuildEnv::init`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/jit_build/build.cpp#L124-L205).
The CMake configuration independently reads the required release, selects or
downloads SFPI, calls the compiler with `--version`, and stops on a version
mismatch in
[`tt_metal/hw/CMakeLists.txt`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/CMakeLists.txt#L41-L173).

For the inspected checkout, the requirement and observed compiler were:

| Item | Inspected value |
|---|---|
| TT-Metal requirement | SFPI `7.69.0`, package build `822` |
| selected compiler | `/home/n/src/tt-metal/runtime/sfpi/compiler/bin/riscv-tt-elf-g++` |
| reported identity | `riscv-tt-elf-g++ (tenstorrent/sfpi:7.69.0[822]) 15.1.0` |
| executable SHA-256 | `063f7076c71b36200631acee16790b38c52b27bbc1e0e8933efaae9992fafea4` |

The version/build pin is stored in
[`tt_metal/sfpi-version`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/sfpi-version).
The downloadable archive also has a pinned SHA-256. That archive hash validates
the package; the executable hash above identifies the concrete compiler used by
this experiment. Record both when investigating a suspected compiler defect.

Run these checks before compiling the reproducer:

```bash
cd ~/src/tt-metal

grep -E '^sfpi_(version|build)=' tt_metal/sfpi-version
grep -E '^TT_USE_SYSTEM_SFPI' build/CMakeCache.txt || true

realpath runtime/sfpi/compiler/bin/riscv-tt-elf-g++
runtime/sfpi/compiler/bin/riscv-tt-elf-g++ --version | head -1
sha256sum runtime/sfpi/compiler/bin/riscv-tt-elf-g++

export TT_METAL_FORCE_JIT_COMPILE=1
export TT_METAL_LOG_KERNELS_COMPILE_COMMANDS=1
export TT_METAL_KERNEL_MAP=1
export TT_METAL_RISCV_DEBUG_INFO=1

./path/to/one_core_reproducer 2>&1 | tee /tmp/blackhole-jit-command.log
```

The final authority is the `g++ compile cmd` and `g++ link cmd` in that log.
They prove the exact executable, optimization level, defines, architecture
flags, linker script and weakened firmware ELF. `TT_METAL_FORCE_JIT_COMPILE`
prevents an old cache hit from hiding the compiler actually under test. Normal
JIT build keys include the compiler version; build-map mode intentionally omits
it, so compiler A/B experiments still require different cache directories.

##### Check ELF structure, size and content

The next graph is deliberately separate from toolchain selection:

```mermaid
flowchart TD
    E[One BRISC / NCRISC / TRISC ELF] --> A{ELF32, little-endian, RISC-V?}
    A -- no --> A1[Wrong target or corrupt artifact]
    A -- yes --> B{Entry equals first PT_LOAD VMA and HAL firmware base?}
    B -- no --> B1[Wrong linker script, architecture or processor selection]
    B -- yes --> S[Decode .segments triples: VMA, trim bound, size limit]
    S --> O{Every PT_LOAD memory size is within its embedded limit?}
    O -- no --> O1[Loader rejects code, TLS or static-data overflow]
    O -- yes --> P[Materialize TT-Metal 32-bit load spans]
    P --> G{Aggregate operation image fits kernel config buffer?}
    G -- no --> G1[Program finalization rejects the packed program]
    G -- yes --> X[Dump span words, disassemble, hash each span]
    X --> D{Supported explicit device readback matches address, length and words?}
    D -- no --> D1[Load address, transport, cache or stale-image problem]
    D -- yes --> K[Image identity proven; interpret R / K / KD]
```

The memory map is a shared host/device/linker source of truth. Blackhole defines
the local memories, fixed firmware holes and kernel limits in
[`dev_mem_map.h`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/internal/tt-1xx/blackhole/dev_mem_map.h#L31-L87),
and derives the five firmware bases in
[`dev_mem_map.h:119–123`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/internal/tt-1xx/blackhole/dev_mem_map.h#L119-L123).
The linker selects `TEXT_START`, `TEXT_SIZE`, local-data size and minimum stack
for exactly one RISC in
[`main.ld`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/toolchain/main.ld#L1-L121).
It then writes triples of `segment VMA : trim bound : size limit` into the
non-loadable `.segments` metadata section in
[`script_tng.ld`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/toolchain/script_tng.ld#L220-L244).

Inspect every ELF with the matching SFPI binutils:

```bash
cd ~/src/tt-metal
TT_CASE_TOOLS=runtime/sfpi/compiler/bin
TT_CASE_ELF=/path/to/brisc.elf

"$TT_CASE_TOOLS/riscv-tt-elf-readelf" -h "$TT_CASE_ELF"
"$TT_CASE_TOOLS/riscv-tt-elf-readelf" -lW "$TT_CASE_ELF"
"$TT_CASE_TOOLS/riscv-tt-elf-readelf" -SW "$TT_CASE_ELF"
"$TT_CASE_TOOLS/riscv-tt-elf-objdump" -s -j .segments "$TT_CASE_ELF"
"$TT_CASE_TOOLS/riscv-tt-elf-nm" -nC "$TT_CASE_ELF" | head -80
"$TT_CASE_TOOLS/riscv-tt-elf-objdump" -drSC "$TT_CASE_ELF" > /tmp/risc.dis
sha256sum "$TT_CASE_ELF"
```

Acceptance checks:

- ELF header is `ELF32`, little-endian, machine `RISC-V`;
- entry address equals the first executable `PT_LOAD` virtual address;
- that address equals the RISC firmware base supplied by
  [`bh_hal_tensix.cpp`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/hal/tt-1xx/blackhole/bh_hal_tensix.cpp#L97-L145);
- executable `p_memsz` is within the `.segments` text limit;
- local-data/TLS `p_memsz` is within its `.segments` limit, which reserves the
  required stack space;
- symbols and disassembly map the suspected PC to the expected source interval;
- the complete ELF hash is used only for artifact provenance—not as the device
  payload hash.

The inspected Blackhole cache produced this example. These values are a local
observation, not constants to copy into another revision:

| Firmware | Entry / text VMA | Text bytes | Embedded text limit | Result |
|---|---:|---:|---:|---|
| BRISC | `0x3a60` | `0x12fc` = 4,860 B | `0x2200` = 8,704 B | fits |
| NCRISC | `0x5c60` | `0x04e8` = 1,256 B | `0x0a00` = 2,560 B | fits |
| TRISC0 | `0x6660` | `0x0494` = 1,172 B | `0x0a00` = 2,560 B | fits |
| TRISC1 | `0x7060` | `0x0244` = 580 B | `0x0a00` = 2,560 B | fits |
| TRISC2 | `0x7a60` | `0x046c` = 1,132 B | `0x0a00` = 2,560 B | fits |

Do not compare the on-disk ELF file size with a firmware hole. ELF headers,
section tables, symbols and debug information are not all loaded. Compare the
`PT_LOAD` memory sizes and TT-Metal's packed spans.

##### What “ELF converted to hex” means in current TT-Metal

`tt_elffile.hpp` explicitly describes the loader as a replacement for the old
hex-file mechanism. Current TT-Metal does this:

```text
ELF PT_LOAD segments
  → validate entry/alignment/architecture
  → apply .segments trim and overflow limits
  → ll_api::memory packs address + length + uint32_t words
  → CONTIGUOUS_XIP relocates the operation view when required
  → dispatch records packed size and aligned per-RISC offset
  → LLRT writes each span to the selected core/address
```

The code path is:

- [ELF validation and `.segments` overflow enforcement](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/tt_elffile.cpp#L358-L415)
  and [ELF/PT_LOAD parsing](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/tt_elffile.cpp#L421-L555);
- [`ll_api::memory` packs segments into address/word spans](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/tt_memory.cpp#L40-L101);
- [dispatch stores each packed size and aligned offset](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/program/dispatch.cpp#L480-L533);
- [Program finalization rejects the aggregate image if it exceeds the kernel
  configuration buffer](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/program/program.cpp#L2933-L2954);
- [LLRT iterates and writes the materialized spans](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/llrt.cpp#L169-L260).

For a human-readable view of the instruction words, dump only the section under
inspection and display little-endian 32-bit words:

```bash
"$TT_CASE_TOOLS/riscv-tt-elf-objcopy" \
  --dump-section .text=/tmp/risc-text.bin "$TT_CASE_ELF"
xxd -e -g4 /tmp/risc-text.bin | head -40
sha256sum /tmp/risc-text.bin
```

This is useful for compiler A/B comparison, but it is still only the `.text`
section. Do **not** use whole-file `objcopy -O binary` as proof of what TT-Metal
sends: separated virtual addresses, non-loadable metadata, trimmed regions and
multiple spans make a flat binary an unreliable model.

To prove content matches the design, preserve three comparisons:

1. **source ↔ instructions:** use `objdump -drSC`, `nm` and `addr2line` to map
   the suspected instructions and PC to the expected function/source;
2. **ELF ↔ materialized span:** record each TT-Metal span address, word count and
   SHA-256 after `.segments` processing;
3. **materialized span ↔ device:** perform a supported, explicit bounded
   readback before `GO` and compare the same address, length and words.

For Blackhole multicast firmware writes, the standard readback flag is not a
general solution. Use a controlled unicast/isolation path or an explicit safe
readback implementation, as explained in Q5 below.

#### The missing NCRISC-only rung

Do not relabel the L2 compile test as an NCRISC execution test. Add or adapt a
minimal test with:

```cpp
DataMovementConfig{
    .processor = DataMovementProcessor::RISCV_1,
    .noc = NOC::RISCV_1_default,
};
```

Use one worker, a fixed input pattern, a small aligned transfer and explicit
host readback. Record the selected kernel ELF and output hash. Parameterize the
same test over the suspected optimization level only after the baseline passes.
This test should become a permanent regression if it reproduces the failure.

#### Interpret `R`, `K` and `KD` as different code intervals

These are Watcher waypoint strings, not function names:

| Marker | Small meaning | If it is the last marker |
|---|---|---|
| `I` | RISC firmware entered initialization | reset PC, firmware load or early initialization |
| `GW` | BRISC waits for host launch `GO` | host/dispatch launch message has not been accepted |
| `GD` | BRISC observed host `GO` | host-to-BRISC launch boundary passed |
| `W` | NCRISC firmware waits for BRISC `LOAD/GO` | DM1 enable, shared state or visibility problem |
| `R` | NCRISC prepared the launch; operation handoff is next | DM1 GO wait, `kernel_lma` handoff, image/entry, CRT, launch-level host-GO mailbox or ABI |
| `K` | operation wrapper completed CRT/setup and is immediately before `kernel_main` | failure is in `kernel_main`: wait, CB, NoC, bad address or generated instruction |
| `KD` | `kernel_main` returned | user body completed; inspect post-kernel checks and wrapper return |
| `NKFW` / `NKFD` | post-kernel NoC check begins / ends | distinguish the postamble from the user kernel |
| `D` | operation returned to persistent NCRISC firmware | NCRISC completed; inspect DONE visibility or another subordinate |
| `NTW` / `NTD` | BRISC waits for / sees all enabled subordinates done | identify supervisor completion versus an unfinished TRISC/NCRISC |

The important diagnostic sentence is therefore:

> **`R` without `K` and `K` without `KD` are different problems.** `R→K`
> covers the DM1 subordinate-GO wait, operation handoff, image/entry, CRT,
> the separate launch-level host-GO mailbox check and ABI.
> `K→KD` covers the user `kernel_main` body and its waits, memory traffic and
> generated instructions.

One nuance: in the reviewed `ncrisc.cc`, `R` appears before the Blackhole loop
that waits for subordinate `GO` and before the `kernel_lma` call. Therefore an
`R`-without-`K` result must not be described too narrowly as “bad ELF entry”; it
also includes a DM1 GO value that never arrives and the operation wrapper's
separate launch-level host-GO mailbox check.

```mermaid
sequenceDiagram
    participant B as BRISC firmware
    participant S as Shared DM1 sync
    participant N as NCRISC firmware
    participant O as NCRISC operation wrapper
    participant U as kernel_main
    B->>S: publish LOAD, then GO
    N->>N: waypoint W while waiting
    N->>N: launch preparation; waypoint R
    loop Blackhole subordinate wait
        N->>S: invalidate + read DM1 GO
    end
    N->>O: call kernel_lma
    O->>O: CRT and operation setup
    O->>O: poll launch-level host GO mailbox
    O->>O: waypoint K
    O->>U: call kernel_main
    U-->>O: return
    O->>O: waypoint KD, then NKFW/NKFD
    O-->>N: return to firmware
    N->>N: waypoint D
    N->>S: publish DONE
```

Code beside the sequence:

- [BRISC launch and `NTW/NTD` completion wait](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L354-L590)
- [NCRISC firmware `W/R/D`, GO polling and `kernel_lma`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/ncrisc.cc#L109-L192)
- [NCRISC operation `K/KD/NKFW/NKFD`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/ncrisck.cc#L38-L95)
- [Launch-level `wait_for_go_message()` mailbox poll](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/internal/firmware_common.h#L194-L206)

```mermaid
flowchart TD
    W{Last NCRISC interval}
    W -->|stays at W| A[BRISC notification, DM1 enable, shared LOAD/GO]
    W -->|R but no K| B[DM1 GO, handoff, image, entry, CRT, host-GO mailbox, ABI]
    W -->|K but no KD| C[kernel_main: waits, CBs, NoC, memory, generated code]
    W -->|KD but no D| D[postchecks, wrapper return, return ABI]
    W -->|D but BRISC waits| E[DONE visibility or another enabled subordinate]
```

### R — Result

The result available now is a **code-review result**, not a completed historical
hardware diagnosis:

| Result item | State | Evidence |
|---|---|---|
| correct control direction | proven from source | BRISC supervises with shared `LOAD/GO/DONE`; NCRISC does not call BRISC as a normal C++ function |
| compilation proof boundary | proven from source | the two-processor compile test checks only ELF-file existence |
| BRISC data test | available | reader-only and writer-only explicitly select `RISCV_0` and verify returned data |
| combined DM test | available | reader selects `RISCV_1`, writer selects `RISCV_0`, and the output is compared |
| synchronization test | available | barrier test names BRISC writer and NCRISC reader and verifies L1 state |
| NCRISC-only data isolation | **gap found** | add/adapt a one-core `RISCV_1` test with host result verification |
| historical failing/pass compiler identities | **open** | paths, versions and hashes were not supplied |
| wrong instruction and final fix | **open** | failing PC, minimized input, disassembly difference and patch are not supplied |

The first useful completion record should look like this:

```text
first failing rung: L5 NCRISC-only data verification
last interval:      NC:R, no NC:K
host ELF hash:      <sha256>
device bytes hash:  <sha256 or readback artifact>
failing PC:         <address resolved in the exact ELF>
compiler A:         <path, version, sha256, flags, result>
compiler B:         <path, version, sha256, flags, result>
root cause:         OPEN until all compiler A/B gates pass
```

### L — Learning

1. **Build success is not runtime success.** A generated ELF proves neither
   transfer nor entry.
2. **Test one processor before their interaction.** BRISC-only and NCRISC-only
   data tests make the combined failure interpretable.
3. **Validate the debugger before trusting silence.** Watcher and DPRINT have
   their own unit tests.
4. **Use the first missing interval.** `R` without `K` is a subordinate-GO,
   handoff/entry/CRT/launch-mailbox class; `K` without `KD` is a `kernel_main`
   class.
5. **Dispatch mode is a controlled experiment.** Run only a reproducer that
   supports both paths; a hard-coded slow-dispatch call cannot test fast
   dispatch.
6. **Optimization sensitivity is not compiler proof.** Source undefined
   behavior, inline assembly constraints, link/LTO and ABI mismatches remain
   alternatives.
7. **Turn the minimal failure into a regression.** Keep known input/output,
   processor selection, ELF identity, waypoint expectation and negative case.

## Large overview — use this only to orient the case

```mermaid
flowchart TD
    A[Reproduce on one Blackhole worker] --> B{BRISC and NCRISC initialized?}
    B -- no --> B1[Boot, reset PC, firmware image, board state]
    B -- yes --> C{BRISC leaves GW and reaches GD?}
    C -- no --> C1[Host launch message or launch configuration]
    C -- yes --> D{NCRISC leaves W and reaches R?}
    D -- no --> D1[DM1 enable, LOAD/GO value, cache visibility, shared sync]
    D -- yes --> E{NCRISC operation reaches K?}
    E -- no --> E1[DM1 GO, operation handoff, ELF load, entry, CRT, host-GO mailbox, ABI]
    E -- yes --> F{Operation reaches KD?}
    F -- no --> F1[User kernel, NoC wait, semaphore, bad generated code]
    F -- yes --> G{Firmware reaches D and BRISC completes?}
    G -- no --> G1[Return ABI, post-kernel checks, DONE visibility]
    G -- yes --> H[Handshake is healthy; inspect result correctness]
    E1 --> I{Materialized spans equal a supported explicit readback?}
    F1 --> J{Failure follows one source/optimization construct?}
    I -- no --> I1[Fix transport or address selection]
    I -- yes --> J
    J -- no --> J1[Continue runtime or source-debug branch]
    J -- yes --> K{Same input fails with compiler A and passes with B?}
    K -- no --> K1[Compiler defect not proven]
    K -- yes --> L[Minimize, disassemble, report, pin/work around, regress]
```

The rest of this page breaks that graph into smaller decisions and keeps code
links beside each graph.

## Q1 — What actually happens between BRISC and NCRISC?

**Answer:** BRISC is the supervisor in this path. After seeing the launch-level
host GO, it first writes `RUN_SYNC_MSG_LOAD` so NCRISC can prepare CB and launch
state. On Blackhole, `start_ncrisc_kernel_run_early` later writes
`RUN_SYNC_MSG_GO` to the DM1 subordinate field. NCRISC invalidates its L1 cache
while polling this field, observes GO, and calls its own operation entry. The
operation wrapper performs CRT setup, separately verifies the launch-level
`go_messages[...]` host GO, then enters `kernel_main`. When it returns, NCRISC
writes `RUN_SYNC_MSG_DONE`; BRISC waits until all enabled subordinates are done.

```mermaid
sequenceDiagram
    participant H as Host/dispatcher GO mailbox
    participant B as BRISC firmware
    participant S as Shared subordinate sync
    participant N as NCRISC firmware
    participant K as NCRISC operation ELF
    H->>B: RUN_MSG_GO + launch fields
    B->>S: DM1 LOAD
    N->>S: wake, prepare CB and launch state
    N->>N: waypoint R
    B->>S: DM1 GO
    N->>S: poll + invalidate until GO
    N->>K: call kernel_lma entry
    K->>K: CRT
    K->>H: wait_for_go_message reads host GO mailbox
    H-->>K: RUN_MSG_GO already visible
    K->>K: waypoint K → kernel_main → KD
    K-->>N: return stack usage
    N->>S: DONE
    B->>S: wait for all enabled subordinates
```

Code beside the graph:

- [BRISC `start_ncrisc_kernel_run_early`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L290-L298)
- [BRISC launch loop and completion wait](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L390-L590)
- [NCRISC wait/call/complete path](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/ncrisc.cc#L77-L192)
- [Launch-level GO mailbox poll](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/internal/firmware_common.h#L194-L206)

## Q2 — What is the first decision I make?

**Answer:** reproduce on one worker core and freeze the environment. Multi-core
bring-up hides whether the first failure is local, multicast-related or caused
by another core. Record the following before adding prints:

```bash
cd ~/src/tt-metal
git rev-parse HEAD
git status --short
tt-smi -s

TT_CASE_COMPILER=runtime/sfpi/compiler/bin/riscv-tt-elf-g++
realpath "$TT_CASE_COMPILER"
"$TT_CASE_COMPILER" --version
sha256sum "$TT_CASE_COMPILER"
```

At the inspected checkout, the selected local compiler reports
`riscv-tt-elf-g++ (tenstorrent/sfpi:7.69.0[822]) 15.1.0`; its observed SHA-256
was `063f7076c71b36200631acee16790b38c52b27bbc1e0e8933efaae9992fafea4`.
That is a snapshot of this checkout, **not** the unknown historical failing
compiler.

The JIT prefers
`$TT_METAL_HOME/runtime/sfpi/compiler/bin/riscv-tt-elf-g++`, then the compiler
under `/opt/tenstorrent/sfpi`. Thus “third-party compiler” should be recorded as
the exact Tenstorrent SFPI-packaged RISC-V toolchain, not as the host `g++`.

```mermaid
flowchart LR
    R[One-core reproducer] --> F[Freeze source + board + launch input]
    F --> T[Record compiler path + version + hash]
    T --> C[Use fresh named cache]
    C --> O[Capture untouched failure]
```

Code beside the graph:

- [Compiler selection precedence and flags](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/jit_build/build.cpp#L124-L205)
- [Runtime cache environment handling](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/rtoptions.cpp#L416-L429)

## Q3 — Which observation separates handshake problems from kernel problems?

**Answer:** the latest Watcher waypoint on BRISC and NCRISC. Run Watcher alone
first; do not combine the first classification run with DPRINT or the Device
Profiler.

```bash
export TT_METAL_WATCHER=5
export TT_METAL_WATCHER_APPEND=1
unset TT_METAL_DPRINT_CORES
unset TT_METAL_DEVICE_PROFILER

./path/to/one_core_reproducer
```

The log is normally under `generated/watcher/watcher.log`. A five-second poll is
appropriate for a hang investigation but too invasive for performance work.
`TT_METAL_WATCHER_DUMP_ALL=1` can itself access unsafe state while a kernel is
running, so leave it off for the first pass.

| Last useful boundary | Interpretation | Next branch |
|---|---|---|
| BRISC never reaches `I` | BRISC firmware/reset/load problem | firmware image and reset PC |
| BRISC `GW`, NCRISC `W` | BRISC is waiting for host GO; NCRISC is idle | host launch/dispatch state |
| BRISC `GD` or `R`, NCRISC remains `W` | host GO reached BRISC, NCRISC did not start | DM1 enable, shared `LOAD/GO`, cache visibility |
| NCRISC firmware `R`, no operation `K` | launch preparation ran, but operation K is not proven | DM1 GO, `kernel_lma` handoff, load address, ELF entry, CRT, launch-level host-GO mailbox, ABI |
| NCRISC operation `K`, no `KD` | entered `kernel_main`, did not return | user kernel, wait, memory fault, generated instructions |
| operation `KD`, no firmware `D` | user body returned; postamble/return failed | NOC flush assertions, wrapper return, ABI |
| NCRISC firmware `D`, BRISC does not finish | NCRISC ran; supervisor did not observe completion | DONE visibility or another enabled subordinate |

```mermaid
flowchart TD
    W{Latest paired waypoints?}
    W -->|BR:GW / NC:W| H[Host GO or launch configuration]
    W -->|BR:R / NC:W| S[DM1 LOAD/GO visibility or DM1 enable]
    W -->|NC:R / no NC:K| E[DM1 GO, handoff, entry, load, CRT, host-GO mailbox or ABI]
    W -->|NC:K / no NC:KD| U[Inside user kernel]
    W -->|NC:KD / no NC:D| P[Postamble or return ABI]
    W -->|NC:D / BR waits| D[DONE visibility or another subordinate]
```

Code beside the graph:

- [BRISC waypoints and launch decisions](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L354-L590)
- [NCRISC firmware `W`, `R`, `D`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/ncrisc.cc#L109-L192)
- [NCRISC operation `K`, `KD`, `NKFW`, `NKFD`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/ncrisck.cc#L69-L95)
- [Official Watcher documentation](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/watcher.html)

## Q4 — When do I add DPRINT?

**Answer:** after Watcher identifies one short interval. DPRINT is for values and
addresses; it should not replace the lower-overhead waypoint classifier. Run it
as a separate build/run and include a newline on every message.

```bash
unset TT_METAL_WATCHER
unset TT_METAL_DEVICE_PROFILER
export TT_METAL_DPRINT_CORES=0,0
export TT_METAL_DPRINT_RISCVS=BR+NC
export TT_METAL_DPRINT_ONE_FILE_PER_RISC=1
export TT_METAL_FORCE_JIT_COMPILE=1

./path/to/one_core_reproducer
```

Good temporary values are the core, kernel ID, DM1 enable state, `kernel_lma`,
launch message value and the shared subordinate state before/after the write.
Avoid printing in a tight polling loop; it changes timing and can fill the
device print buffer.

```mermaid
flowchart LR
    A[Watcher finds interval] --> B{Need a value?}
    B -- no --> C[Keep waypoints only]
    B -- yes --> D[Add one DPRINT before and after interval]
    D --> E[Force rebuild]
    E --> F[Run DPRINT without Watcher/profiler]
    F --> G[Remove instrumentation and reproduce again]
```

References beside the graph:

- [Official Device Debug Print guide](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_print.html)
- [JIT DPRINT and Watcher compile defines](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/jit_build/build.cpp#L224-L265)

## Q4A — What do DPRINT, Watcher and Tracy actually observe?

They answer different questions and operate at different layers. Selecting the
tool by its familiar name is a common mistake; select it by the missing fact.

| Missing fact | First tool | Mechanism | Main perturbation |
|---|---|---|---|
| Where did a RISC stop progressing? | Watcher | device code overwrites fixed per-RISC L1 mailboxes; a host thread periodically snapshots and decodes them | polling traffic and compiled-in checks |
| What value, address or branch decision did the kernel see? | DPRINT | kernel serializes a typed message into a shared L1 ring; the host drains it and resolves format metadata from the ELF | locking, formatting traffic and possible producer stall |
| Where is host time spent? | Tracy host zones | in-process Tracy client records timestamped C++/Python zones; capture/viewer consumes the event stream | timestamp/event overhead |
| How long did a device interval take? | Device Program Profiler | RISC code writes timestamped zone markers to reserved L1, optionally drained through DRAM, then host code correlates them with Tracy/CSV | scarce profiler SRAM and marker overhead |
| What bytes or state remain after a hang? | host readback, `tt-triage`, then TT-ExaLens | host/UMD reads a bounded L1/DRAM range; triage can compare it against ELF sections | snapshot may be inconsistent; halting a RISC changes execution |
| Is first-silicon board logic or a physical debug path wrong? | lab JTAG/FPGA facilities | board-specific TAP/debug module or FPGA ILA captures signals/state | highly invasive and platform-specific |

```mermaid
flowchart TD
    Q{What fact is missing?}
    Q -->|Last completed state?| W[Watcher waypoints and safety state]
    Q -->|A value or address?| D[DPRINT or bounded memory readback]
    Q -->|Host or device time?| T[Tracy plus Device Profiler]
    Q -->|State after a hang?| X[tt-triage or TT-ExaLens]
    Q -->|Physical bring-up signal?| J[Board-lab JTAG or FPGA capture]

    W --> R[Reproduce without instrumentation]
    D --> R
    T --> R
    X --> R
    J --> R
```

The last step matters. Every observer can move a race, consume L1, introduce a
host read or halt a core. A conclusion is stronger when the same failure is
reproduced once more after the temporary observer is removed.

### DPRINT mechanism: an ELF-described, host-drained L1 message ring

`DPRINT` is the public alias of `DEVICE_PRINT`. It is not a UART and the RISC
does not format a normal C++ stream by itself. In a source build with
`DEBUG_PRINT_ENABLED`, the compiler validates the format, places the format,
file and line metadata in a device-print ELF section, and emits kernel code that
serializes typed arguments.

The writer constructs a compact header containing the RISC ID, kernel/firmware
flag, payload length and string-information ID. It then acquires the shared
print-buffer lock, checks the `wpos`/`rpos` ring pointers, writes an aligned
payload, advances `wpos` and releases the lock. The host DPRINT server reads the
ring from L1 (or through its dispatch aggregation path), resolves the metadata
ID against the loaded ELF and writes the formatted line to stdout or a file.

```mermaid
sequenceDiagram
    participant C as C++ compiler/linker
    participant R as BRISC/NCRISC/TRISC
    participant L as shared DPRINT L1 ring
    participant H as host DPRINT server
    participant O as terminal/file

    C->>C: store format, file and line in ELF metadata
    R->>L: acquire shared lock
    R->>L: wait for free space using wpos/rpos
    R->>L: write header plus typed aligned payload
    R->>L: publish new wpos and release lock
    H->>L: read pending span, including wraparound
    H->>H: resolve string-info ID from ELF
    H->>O: format and emit complete line
    H->>L: advance rpos and clear producer stall
```

The host server writes a start magic before normal traffic. If no compatible
server drains the buffer, the producer can run out of room and stall. That is
why enabling DPRINT changes timing more than a four-byte Watcher waypoint, and
why a print in a polling loop can hide or create the symptom. End every logical
line with `\n`: the host keeps per-RISC partial-line state, so an unterminated
tail may never appear.

Use DPRINT when Watcher has already reduced the problem to a short interval and
you need a few concrete values—for example `kernel_lma`, a launch field, a CB
pointer, a semaphore value or a computed address. Select one core and only the
needed RISCs. Do not use DPRINT for cycle-accurate profiling, for dumping a large
tensor, or as the first observer of an unknown hang.

Code beside the mechanism:

- [DPRINT API contract and host-server requirement](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/api/debug/dprint.h#L9-L29)
- [Message metadata and typed serialization](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/api/debug/device_print.h#L168-L244)
- [Shared lock, ring-space wait and wrap protocol](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/api/debug/device_print.h#L1415-L1816)
- [Host ring read, parse and `rpos` update](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/debug/dprint_server.cpp#L565-L680)
- [Official Device Print guide](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_print.html)

### Watcher mechanism: four-byte progress mailboxes plus safety state

A waypoint such as `W`, `R`, `K` or `KD` is folded into a 32-bit value and
written into the current hardware thread's dedicated L1 mailbox. It overwrites
the previous value; it is a latest-state breadcrumb, not an ordered trace log.
That fixed-size property makes it useful when DPRINT traffic would be excessive.

Watcher is larger than the waypoint macro. With `WATCHER_ENABLED`, firmware and
kernels also maintain launch/kernel IDs, assert and pause state, NoC-sanitizer
information, debug-ring state, stack-use information and other guarded fields.
The host Watcher thread periodically reads the per-core mailbox/launch region,
decodes it, appends `generated/watcher/watcher.log`, and raises an error when a
sanitizer or consistency check fails.

```mermaid
sequenceDiagram
    participant R as each device RISC
    participant M as per-core Watcher L1 state
    participant H as host Watcher thread
    participant G as watcher.log / exception

    R->>M: overwrite this RISC's 4-byte waypoint
    R->>M: update launch, assert or sanitizer state
    loop every TT_METAL_WATCHER interval
        H->>M: read mailbox and launch region
        H->>H: decode RISC state, IDs and waypoints
        H->>H: validate NoC, CB, stack and L1 invariants
        H->>G: append snapshot or report violation
    end
```

Use Watcher first for hangs, invalid NoC accesses, circular-buffer bounds,
device asserts, firmware launch-state corruption and "which RISC got how far?"
questions. Increase the polling interval when a frequent poll perturbs the
reproducer. Avoid `TT_METAL_WATCHER_DUMP_ALL=1` initially: reading every exposed
state while a kernel is live can itself hang or distort the run. Because a
mailbox retains only its last marker, use paired markers around meaningful
boundaries and use DPRINT or a profiler if you need event history.

Code beside the mechanism:

- [Four-byte per-RISC waypoint mailbox](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/api/debug/waypoint.h#L8-L41)
- [Watcher host thread and polling loop](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/debug/watcher_server.cpp#L547-L616)
- [Core snapshot fields and checks](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/debug/watcher_device_reader.cpp#L278-L340)
- [NoC and mailbox validation failures](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/debug/watcher_device_reader.cpp#L715-L819)
- [Official Watcher guide](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/watcher.html)

### Tracy mechanism: host zones and device markers meet on one analysis timeline

Tracy host instrumentation records scoped begin/end timestamps, thread identity,
names and optional messages or plots in the process. `tracy-capture` or the GUI
connects to that Tracy client, collects the stream and saves a `.tracy` trace.
Normal host zones are enabled in the standard build; extra debug categories must
be selected at build time.

Device profiling is a related but separate producer. `DeviceZoneScopedN`
creates an RAII scope in RISC code; construction records the start marker and
destruction records the end marker. Markers occupy a finite reserved L1 buffer.
The host Device Profiler reads per-core L1 directly in slow dispatch or drains
the configured L1/DRAM path in fast dispatch, parses the records and emits
Tracy/CSV data.

```mermaid
flowchart LR
    subgraph Host[Host process]
        HZ[C++ or Python Tracy zones] --> TC[Tracy client event stream]
        DP[DeviceProfiler parser] --> TC
    end

    subgraph Device[Blackhole device]
        DZ[DeviceZoneScopedN] --> PB[finite per-core L1 marker buffer]
        PB -->|fast dispatch| DR[profiler DRAM staging]
    end

    PB -->|slow dispatch read| DP
    DR -->|host drain| DP
    TC --> CAP[tracy-capture]
    CAP --> VIEW[GUI or WASM viewer]
    DP --> CSV[CSV reports]
```

Use host Tracy to measure JIT compilation, program construction, command
submission, queue waits and host synchronization. Use Device Program Profiler
after correctness is stable to measure named device intervals. Do not infer
silicon performance from ttsim timing: simulation is valuable for event order
and control flow, but its wall time is not Blackhole hardware time. Profiler L1
is finite, so instrument a few coarse zones before subdividing the hot one.

Do not combine DPRINT, Watcher and Device Profiler in one decisive run. Their
reserved SRAM and instrumentation can conflict, and even when a combination
builds, it makes causality harder to review. Run three named passes with the same
input and one observer at a time:

```bash
# Pass A: progress and safety
TT_METAL_WATCHER=5 ./path/to/reproducer

# Pass B: selected values; Watcher/profiler unset
TT_METAL_DPRINT_CORES=0,0 TT_METAL_DPRINT_RISCVS=BR+NC \
  ./path/to/reproducer

# Pass C: timing after correctness; Watcher/DPRINT unset
python3 -m tracy ./path/to/reproducer
```

The pinned launcher includes device collection by default and sets
`TT_METAL_DEVICE_PROFILER=1` in the child process. Use `--no-device` only when
the question is deliberately host-only; this revision does not define a `-d`
option.

Code beside the mechanism:

- [Tracy build and debug-category options](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/cmake/project_options.cmake#L5-L12)
- [Host Tracy zone/category macros](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/tools/profiler/tracy_debug_zones.hpp#L12-L139)
- [`DeviceZoneScopedN` and RAII start/end markers](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/tools/profiler/kernel_profiler.hpp#L713-L746)
- [Device profiler L1/DRAM read and parse path](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/profiler/profiler.cpp#L1227-L1420)
- [Pinned Tracy launcher options and default device collection](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tools/tracy/__main__.py#L18-L31)
- [Official Tracy guide](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/tracy_profiler.html)
- [Official Device Program Profiler guide](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_program_profiler.html)

## Q4B — How should I inspect Blackhole L1 or DRAM contents?

Use the least invasive level that answers the question. "Use JTAG" is not one
step: it hides coordinate translation, address ownership, synchronization,
cache/NoC visibility and the risk of stopping a RISC while another RISC changes
the same location.

```mermaid
flowchart TD
    A{Can the reproducer reach a safe checkpoint?}
    A -- yes --> H[Finish the queue or use a deliberate device checkpoint]
    H --> R[Read the owned L1 or DRAM buffer through the host API]
    R --> V[Save bytes, address, core, size and SHA-256]

    A -- no, process hung --> T[Preserve generated ELFs and logs]
    T --> I[Run tt-triage binary-integrity and state checks]
    I --> E{Need registers, PC or stepping?}
    E -- no --> V
    E -- yes --> G[TT-ExaLens RISC debug or GDB server]
    G --> P{Public debugger cannot expose required physical state?}
    P -- no --> V
    P -- yes --> J[Escalate to board-specific JTAG or FPGA lab plan]
```

### Level 1 — synchronized host readback

For a buffer owned by the test, finish the producing command queue or reach an
explicit producer/consumer checkpoint, then call the host read API. The pinned
implementation performs an L1 barrier, translates the logical coordinate to a
virtual device coordinate and calls the cluster read path.

```cpp
#include <cstdint>
#include <fstream>
#include <vector>

// device, logical_core, l1_addr and byte_count come from this test's allocation.
std::vector<std::uint32_t> words;
tt::tt_metal::detail::ReadFromDeviceL1(
    device, logical_core, l1_addr, byte_count, words);

std::ofstream dump("l1-core-0-0.bin", std::ios::binary);
dump.write(reinterpret_cast<const char*>(words.data()), byte_count);
```

This `detail` API is appropriate for a controlled debug test, not an API promise
for production code. Read only a range whose owner and size are known. Do not
guess an address inside firmware, launch mailboxes, CB configuration or debug
buffers. A barrier makes prior host/device transactions visible; it does not
atomically freeze several RISCs, so a live producer can still make a torn
snapshot. Save the logical and translated core, address, byte count, command
queue checkpoint and expected data pattern beside the dump.

Code beside the method:

- [`ReadFromDeviceL1` contract](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/api/tt-metalium/tt_metal.hpp#L343-L386)
- [L1 barrier, core translation and cluster read](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/host_api/tt_metal.cpp#L315-L351)
- [UMD-backed core read and Watcher host-read sanitizer](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/tt_cluster.cpp#L855-L907)

### Level 2 — `tt-triage` and TT-ExaLens after a hang

The pinned repository already contains a stronger binary-content check. The
`check_binary_integrity` triage script finds the firmware and operation ELFs,
parses their `.text` sections, reads the corresponding device L1 addresses via
TT-ExaLens and compares the bytes. Run it before another workload overwrites the
device state, while the matching generated artifacts still exist:

```bash
cd ~/src/tt-metal

# Confirm the debugger packages used by this checkout.
python -m pip show tt-exalens tt-umd

# Compare firmware and operation .text bytes with the corresponding ELFs.
./tools/tt-triage.py --run=check_binary_integrity

# Add state/call-stack context when it is supported for this checkout/device.
./tools/tt-triage.py --run=dump_callstacks -v
```

TT-ExaLens (also documented as TT-Lensium) can read on-chip memory and expose a
GDB server. Its `brxy` command is useful for a small read-only L1/DRAM check after
the exact device, coordinate system and address have been confirmed. For
example, the official tutorial uses the following command shape:

```bash
tt-exalens --commands "brxy 0,0 0xADDRESS WORD_COUNT; x" > l1-read.txt
```

Do not copy an address from a different architecture or revision. Do not attach
two owners that both believe they control the device. A GDB halt, breakpoint or
single step is an invasive experiment: BRISC/NCRISC coordination, NoC progress
and timeout behavior can change while one RISC is stopped. In the pinned
TT-Metal revision, the triage call-stack provider explicitly disables its full
GDB call-stack route on Blackhole because of a recorded TT-ExaLens limitation;
that is a version-specific warning, not proof that all Blackhole memory reads
are unsupported.

Code and documentation beside the method:

- [Pinned ELF-to-device `.text` byte comparison](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tools/triage/check_binary_integrity.py#L31-L107)
- [Pinned Blackhole GDB call-stack limitation](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tools/triage/callstack_provider.py#L390-L435)
- [TT-ExaLens repository](https://github.com/tenstorrent/tt-exalens)
- [TT-ExaLens application tutorial](https://github.com/tenstorrent/tt-exalens/blob/main/docs/ttexalens-app-tutorial.md)

### Level 3 — physical JTAG or FPGA capture is a lab interface, not a TT-Metal flag

| Term | Meaning in this guide |
|---|---|
| JTAG / TAP | IEEE 1149.x serial test/debug access and its Test Access Port state machine; the available instructions and debug blocks are chip/board-specific |
| RISC debug module | on-chip control for halt, resume, registers, PC and memory access; a software debugger may reach it without an external JTAG probe |
| FPGA ILA | an Integrated Logic Analyzer synthesized into an FPGA bitstream to sample chosen RTL signals around a trigger |

No generic external-JTAG workflow, TAP map or OpenOCD configuration was found in
the reviewed pinned TT-Metal source, its `tools/triage` directory or the public
TT-ExaLens material. TT-ExaLens uses UMD and on-chip RISC-debug facilities; its
GDB server should not be described as proof that an external JTAG cable is in
the path.

For first-silicon or board bring-up, a company lab may have a physical JTAG path
or an FPGA prototype with an integrated logic analyzer. That workflow needs the
specific board schematic, scan/debug authorization, reset/power sequence,
device-revision register map, halt semantics and approved probe/server. On an
FPGA prototype, capture points and the PCIe/NoC memory-dump bridge must be built
into that bitstream; an FPGA cannot be added later as a transparent memory probe
for a production Blackhole card.

Before such an escalation, write a lab capture contract:

1. Freeze the exact board revision, bitstream/RTL or ASIC stepping and clock/reset state.
2. Name the physical RISC/core and translate the target into the lab address map.
3. Decide whether to halt all writers, trigger on a waypoint, or accept a live and possibly torn snapshot.
4. Capture address, size, endianness, timestamp/trigger and tool versions with the bytes.
5. Compare the same address span with the linker/ELF span, not merely a whole-file hash.
6. Resume/reset with an explicit recovery procedure and rerun without the probe.

For ttsim, prefer simulator memory APIs and deterministic checkpoints. JTAG and
FPGA ILA do not improve simulated timing fidelity.

## Q4C — What are huge pages, when are they needed, and what is mapped?

| Term | Definition |
|---|---|
| KMD | kernel-mode driver; owns privileged device and DMA/IOMMU setup |
| UMD | user-mode driver; maps device/shared memory into the Metalium process through the KMD |
| IOMMU | hardware that translates device DMA addresses and enforces mappings, analogous to an MMU for I/O |
| IOVA | I/O virtual address presented to the device after IOMMU/KMD mapping |
| `hugetlbfs` | Linux filesystem whose files are backed by explicitly reserved huge pages |
| NUMA | non-uniform memory access; CPU sockets/nodes have different latency to a PCIe device and its host memory |

Huge pages are **host system memory**, not Tensix L1 and not device DRAM. In the
non-IOMMU physical-silicon path, UMD opens files from a 1 GiB `hugetlbfs` mount,
maps them into the host process, pins/associates them with a device/channel and
obtains the device-visible NoC/I/O address. Metalium's system-memory manager then
partitions that shared region for fast-dispatch issue/completion queues and
writes commands through the returned host virtual address.

With an enabled IOMMU/KMD path, UMD can register/map system memory and use an
IOVA instead; the current UMD guidance says a separate hugepage setup is not
required for Wormhole/Blackhole in that mode.

```mermaid
flowchart TD
    A[Physical TT PCIe device] --> I{KMD reports IOMMU path?}
    I -- yes --> M[KMD/UMD register system memory]
    M --> V[host VA plus device IOVA/NoC address]

    I -- no --> H[allocate 1 GiB hugetlbfs page per required channel]
    H --> P[mmap MAP_SHARED plus MAP_POPULATE]
    P --> N[NUMA bind and map page to device/NoC address]
    N --> V

    V --> C[Metalium partitions issue, completion and auxiliary CQ regions]
    C --> D[host writes commands; device DMA/dispatch reads them]
```

Use hugepage provisioning when all of these are true:

- the target is physical silicon using the PCIe/KMD/UMD path;
- the IOMMU mapping path is not enabled or available;
- fast-dispatch/shared host system memory needs pinned device-visible channels;
- the system has sufficient 1 GiB pages and NUMA placement for the attached devices.

Do not provision them merely for DPRINT, Watcher, device L1 buffers or DRAM
buffers. Standard ttsim/Quasar simulation does not use the physical PCIe
hugetlbfs path: the pinned Metalium environment forces DRAM-backed command queues
for Quasar simulation, while simulated UMD system memory uses anonymous `mmap`
and `MADV_HUGEPAGE`. Configuring WSL huge pages does not make a physical TT PCIe
device visible inside WSL.

Diagnose the platform before changing it:

```bash
cd ~/src/tt-metal/tt_metal/third_party/umd

# UMD's detector decides which branch applies.
./scripts/iommu_detect.sh

# Read-only host state checks.
grep -i Huge /proc/meminfo
cat /sys/kernel/mm/hugepages/hugepages-1048576kB/nr_hugepages
cat /sys/kernel/mm/hugepages/hugepages-1048576kB/free_hugepages
findmnt -t hugetlbfs
systemctl status tenstorrent-hugepages.service --no-pager
```

If IOMMU is disabled and pages are missing, use the current Tenstorrent system
tools/installer for that host rather than copying a stale page count from another
machine. Required channels depend on the device/topology. Reserve pages at boot
when possible, because obtaining physically contiguous 1 GiB pages after memory
fragmentation can fail. NUMA placement mostly affects throughput/latency, but a
wrong page count or missing mapping prevents the command-queue path from being
created at all.

Code beside the mapping:

- [Pinned UMD IOMMU/hugepage setup guidance](https://github.com/tenstorrent/tt-umd/blob/9bbe7bc93544029aadaa2b2bcbf39e774fa77f9a/README.md#L23-L40)
- [1 GiB hugetlbfs allocation and channel accounting](https://github.com/tenstorrent/tt-umd/blob/9bbe7bc93544029aadaa2b2bcbf39e774fa77f9a/device/hugepage.cpp#L29-L150)
- [IOMMU versus hugepage mapping and device I/O address](https://github.com/tenstorrent/tt-umd/blob/9bbe7bc93544029aadaa2b2bcbf39e774fa77f9a/device/chip_helpers/silicon_sysmem_manager.cpp#L124-L330)
- [Metalium command-queue partition over mapped host memory](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/dispatch/system_memory_manager.cpp#L193-L230)
- [Quasar simulation forces DRAM-backed command queues](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/context/metal_env.cpp#L192-L199)
- [Simulated anonymous system-memory mapping](https://github.com/tenstorrent/tt-umd/blob/9bbe7bc93544029aadaa2b2bcbf39e774fa77f9a/device/chip_helpers/simulation_sysmem_manager.cpp#L45-L89)
- [Current TT-UMD repository guidance](https://github.com/tenstorrent/tt-umd)
- [Tenstorrent installer/system tools](https://github.com/tenstorrent/tt-installer)

## Q5 — How do I prove the correct NCRISC binary was sent and entered?

**Answer:** preserve the host build, inspect the ELF and linker map, explicitly
read back a supported device L1/config-buffer range, and map the failing PC to
that same image.

`TT_METAL_KERNEL_READBACK_ENABLE=1` is **not blanket proof** for a normal
Blackhole worker-operation image. The helper in `llrt.cpp` can compare supported
unicast writes, but the Blackhole Tensix firmware path uses multicast and its
source warns that multicast readback is unsupported. The ordinary operation
binary configuration path also calls the write helper without establishing an
automatic readback result. Treat the environment flag as a useful check only
when the exact call path supports it; otherwise add an explicit, bounded L1 or
configuration-buffer readback before `GO` and preserve the compared bytes.

Use a dedicated cache for this compiler. Do not reuse it for compiler B.

```bash
export TT_METAL_CACHE=/tmp/tt-metal-bh-ncrisc-compiler-a
export TT_METAL_FORCE_JIT_COMPILE=1
export TT_METAL_KERNEL_MAP=1
export TT_METAL_LOG_KERNELS_COMPILE_COMMANDS=1
export TT_METAL_LOG_KERNEL_COMPILE=1
export TT_METAL_RISCV_DEBUG_INFO=1
export TT_METAL_KERNEL_READBACK_ENABLE=1

./path/to/one_core_reproducer
```

Locate the NCRISC ELF, map and saved compiler intermediates under that cache.
Use the matching tools from the same SFPI compiler directory:

```bash
TT_CASE_TOOLS=runtime/sfpi/compiler/bin

"$TT_CASE_TOOLS/riscv-tt-elf-readelf" -hSW path/to/ncrisc.elf
"$TT_CASE_TOOLS/riscv-tt-elf-nm" -nC path/to/ncrisc.elf
"$TT_CASE_TOOLS/riscv-tt-elf-objdump" -drSC path/to/ncrisc.elf > /tmp/ncrisc.dis
"$TT_CASE_TOOLS/riscv-tt-elf-addr2line" -e path/to/ncrisc.elf -fC 0xFAILING_PC
```

Do not subtract a guessed base blindly. First inspect the ELF type and section
virtual addresses. The Blackhole HAL has separate BRISC and NCRISC firmware
bases and programs NCRISC's reset PC to its firmware base; those values are the
authoritative architecture mapping for this revision.

```mermaid
flowchart TD
    H[Hash host ELF and materialized spans] --> R{Write path supports readback?}
    R -- unicast helper --> U[Enable helper and preserve comparison]
    R -- multicast / operation path --> X[Perform explicit bounded L1 or config-buffer readback before GO]
    U --> M{Bytes match?}
    X --> M
    M -- no --> T[Transport, address, span or stale image]
    M -- yes --> S[Read ELF sections, symbols and entry]
    S --> P[Resolve failing PC]
    P --> B{Before operation K?}
    B -- yes --> A[Entry, CRT, relocation or ABI]
    B -- no --> U[Generated user-kernel code]
```

Code beside the graph:

- [Blackhole BRISC/NCRISC bases and launch values](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/hal/tt-1xx/blackhole/bh_hal_tensix.cpp#L97-L147)
- [Unicast write/readback helper](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/llrt/llrt.cpp#L169-L246)
- [Blackhole Tensix firmware multicast write and readback caveat](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/device/firmware/risc_firmware_initializer.cpp#L1143-L1165)
- [Worker operation binary write path](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/kernels/kernel.cpp#L1079-L1092)
- [Operation wrapper entry and CRT](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/ncrisck.cc#L38-L74)

## Q6 — What evidence is sufficient to suspect generated code?

**Answer:** the failure must be after the correct operation image has been
verified and localized to a generated instruction interval. Then reduce the
input in this order:

1. Keep one core and one NCRISC data-movement kernel.
2. Remove NoC operations and shared-state accesses not required to reproduce.
3. Replace the body with a return; add source statements back until it fails.
4. Compare `KernelBuildOptLevel::O0`, `O1`, `O2`, `Os` through
   `DataMovementConfig::opt_level`.
5. Preserve `.ii`, assembly, ELF, map and disassembly for the smallest failing
   and passing pair.
6. Check source undefined behavior, alignment, `volatile`, aliasing and inline
   assembly constraints before filing a compiler bug.

Example host-side optimization toggle:

```cpp
DataMovementConfig config{
    .processor = DataMovementProcessor::RISCV_1,
    .noc = NOC::RISCV_1_default,
    .opt_level = KernelBuildOptLevel::O0,
};
```

Use the processor value that your pinned API maps to NCRISC; confirm the
program's processor assignment rather than copying the example blindly.

```mermaid
flowchart LR
    F[Failing kernel] --> Z[Replace body with return]
    Z --> A[Add one construct at a time]
    A --> O[O0/O1/O2/Os matrix]
    O --> U{Source UB or ABI violation?}
    U -- yes --> S[Fix source contract]
    U -- no --> C[Preserve minimal compiler input]
```

Code beside the graph:

- [`KernelBuildOptLevel` and `DataMovementConfig::opt_level`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/api/tt-metalium/kernel_types.hpp#L53-L102)
- [Default common JIT flags, including LTO](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/jit_build/build.cpp#L165-L205)
- [Saved intermediates in build-map mode](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/jit_build/build.cpp#L628-L677)

## Q7 — How do I prove or reject the compiler root cause?

**Answer:** run a two-toolchain matrix in which the preprocessed input, flags,
linker script, firmware/kernel pairing, device, launch arguments and runtime
state remain fixed.

| Test | Compiler | Optimization | Cache | Purpose |
|---|---|---|---|---|
| A1 | suspected | failing level | unique A1 | reproduce failure |
| A2 | suspected | `O0` | unique A2 | locate optimization sensitivity |
| B1 | known-good | same failing level | unique B1 | compiler-variable A/B |
| B2 | known-good | `O0` | unique B2 | matrix control |

If replaying logged commands outside TT-Metal, switch the compiler **and its
matching assembler/linker/plugin set together**. Keep two artifact directories.
Compare preprocessed source hashes before comparing assembly.

```mermaid
flowchart TD
    I[Identical preprocessed input + link inputs] --> A[Compiler A fails]
    I --> B[Compiler B passes]
    A --> D[Disassembly differs at localized failing interval]
    B --> D
    D --> R{Outcome follows compiler across clean repeats?}
    R -- no --> N[Compiler root cause rejected]
    R -- yes --> M[Minimal reproducer]
    M --> V{Valid source and ABI?}
    V -- no --> S[Source bug, not compiler bug]
    V -- yes --> P[Compiler defect is justified]
```

The compiler conclusion is justified only when all of these gates pass:

- the input `.ii` hashes match;
- compile/link commands differ only by the intended toolchain paths/version;
- host materialized spans and a supported explicit device readback agree;
- the failure stays at the same source/instruction boundary;
- the outcome follows the compiler on clean repeated runs;
- a minimized valid input reproduces it;
- the known-good compiler or compiler patch removes the wrong instruction
  sequence without changing the source contract.

Build-key warning: [the normal key includes compiler version, but build-map
mode omits it](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/jit_build/build.cpp#L369-L388).
This is why the matrix requires separate cache directories in addition to
`TT_METAL_FORCE_JIT_COMPILE=1`.

## Q8 — Which decision path do I choose for this remembered case?

**Answer:** choose the path that disproves cheaper explanations before the
compiler branch:

1. Rewrite the symptom as “BRISC reached/failed to reach a shared launch
   transition, or NCRISC failed before/after its own operation entry.”
2. Reproduce on one core without added prints.
3. Use the BRISC/NCRISC waypoint pair to choose exactly one interval.
4. If NCRISC reaches `K`, stop investigating BRISC-to-NCRISC startup and debug
   the user kernel interval.
5. If it reaches firmware `R` but not operation `K`, verify the operation ELF,
   readback, entry point, CRT and ABI.
6. Only if the image is correct and the PC lands in generated code, preserve
   the compiler inputs and run the A/B matrix.
7. If the A/B proof gates pass, reduce the compiler defect and apply the fix
   ladder below.

This ordering is chosen because each step divides the hypothesis space while
changing as little device behavior as possible.

## Q9 — How is a confirmed compiler-caused case fixed?

**Answer:** use a layered fix, then rebuild and retest the complete matched
image set.

```mermaid
flowchart LR
    P[Proven compiler defect] --> I[Immediate: pin known-good toolchain by hash]
    I --> W[Short term: source workaround around minimized construct]
    W --> U[Durable: upgrade/downgrade or patch SFPI compiler]
    U --> B[Rebuild firmware + operation kernels with fresh caches]
    B --> G[Regression: compile-level + one-core runtime + full bring-up]
```

1. **Containment:** pin the known-good compiler path, version and SHA-256 in the
   bring-up environment. Fail early if the hash differs.
2. **Workaround:** if necessary, rewrite only the minimized triggering construct
   and document why. Do not globally disable optimization without measuring the
   code-size/performance effect.
3. **Durable correction:** consume the compiler version containing the upstream
   fix, or carry a reviewed compiler patch.
4. **Clean rebuild:** use new cache directories; rebuild base BRISC/NCRISC
   firmware and the operation kernels with one coherent toolchain.
5. **Regression:** retain the minimized compile test, a one-core handshake test
   covering `W → R → K → KD → D`, result verification and the broader bring-up
   test.

The matched rebuild matters because the JIT [weakens firmware symbols and links
operation kernels against the firmware ELF](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/jit_build/build.cpp#L721-L790).

## Root-cause closure record

The process above is executable now. The historical statement “the compiler was
the root cause and this fixed it” remains **unverified** until this record is
filled with actual artifacts:

| Field | Current value |
|---|---|
| failing TT-Metal commit | not supplied |
| Blackhole board/stepping | not supplied |
| failing compiler path/version/hash | not supplied |
| passing compiler path/version/hash | not supplied |
| last BRISC/NCRISC waypoint pair | not supplied |
| failing PC and ELF/source mapping | not supplied |
| minimized valid compiler input | not supplied |
| wrong versus correct instruction sequence | not supplied |
| final toolchain patch/version or source workaround | not supplied |
| clean-rebuild regression logs | not supplied |

Until those fields exist, the responsible conclusion is:

> The remembered Blackhole failure is compatible with a toolchain-sensitive
> NCRISC operation-kernel problem, but the available evidence does not yet
> distinguish a compiler defect from source undefined behavior, ABI/link/load
> mismatch or a launch-synchronization fault.

## Artifact layout for the repeatable case

```text
experiments/blackhole-ncrisc-bringup/
├── README.md
├── environment/
│   ├── tt-metal-commit.txt
│   ├── board.txt
│   └── compiler-a-b.txt
├── source/
│   ├── reproducer.cpp
│   └── minimized.ii
├── build-a/
│   ├── compile-command.txt
│   ├── link-command.txt
│   ├── kernel.elf
│   ├── kernel.map
│   └── kernel.dis
├── build-b/
├── logs/
│   ├── watcher-a.log
│   ├── watcher-b.log
│   └── readback-hashes.txt
└── result.md
```

Commit small text artifacts and scripts. Store large compiler dump families as
a compressed release artifact or an external artifact with a recorded hash.
Never publish proprietary board logs, firmware or toolchain binaries without
permission.

## Tool selection

- **Watcher first:** classify hangs and the last per-RISC waypoint.
- **DPRINT second:** inspect a small number of values inside the chosen
  interval; run separately from Watcher/Device Profiler.
- **ELF/binutils next:** prove image, symbol and failing-PC identity.
- **GDB for host control:** stop around compile, binary write and launch-message
  generation. Standard host GDB does not single-step Blackhole RISC firmware.
- **Device Profiler/Tracy later:** performance tools are useful after
  correctness. They are not the primary root-cause tools for a pre-entry hang.

Official tool references:

- [TT-Metalium tools index](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/index.html)
- [Watcher](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/watcher.html)
- [Device Debug Print](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_print.html)
- [Device Program Profiler](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_program_profiler.html)
- [Tracy Profiler](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/tracy_profiler.html)

## Closure checklist

- [ ] one-core failure repeats from a fresh cache
- [ ] source revision, board identity and compiler hashes recorded
- [ ] last BRISC/NCRISC waypoints recorded
- [ ] host ELF equals device readback
- [ ] failing PC maps to the saved ELF and source
- [ ] valid minimized source reproduces the issue
- [ ] compiler A/B changes only the toolchain
- [ ] clean repeats make the outcome follow the compiler
- [ ] fix rebuilds firmware and operation kernels coherently
- [ ] compile-level, one-core and full bring-up regressions pass
- [ ] historical closure record above is complete
