# Debug low-level kernel flow

**Discussion subpage 06 — host, firmware, operation wrapper and kernel debugging**

Interactive Mermaid page:
<https://buicongnguyen.github.io/tt-sim/debug-low-level-kernel-flow.html>

Source baseline:
[`tt-metal@50a82f835593512c4176546b4af68d7e91315a86`](https://github.com/tenstorrent/tt-metal/tree/50a82f835593512c4176546b4af68d7e91315a86)

This page consolidates the low-level diagrams that are otherwise distributed
between the firmware-flow, Blackhole bring-up and synchronization guides. It
does not introduce a new execution model. Its purpose is to keep the code,
launch boundary and debugging decision visible together.

## Waypoint definitions

| Waypoint | Meaning |
|---|---|
| `W` | NCRISC persistent firmware waits for BRISC `LOAD` / `GO`. |
| `R` | NCRISC launch preparation completed; operation handoff follows. |
| `K` | The operation wrapper is about to call `kernel_main`. |
| `KD` | `kernel_main` returned to the operation wrapper. |
| `D` | Control returned to persistent NCRISC firmware and completion is published. |

`R` without `K` and `K` without `KD` are different failures. The first is
before operation-wrapper entry; the second is inside `kernel_main` or the code
it calls.

## 1. Firmware build and Blackhole cold boot

```mermaid
sequenceDiagram
    autonumber
    participant MC as Host MetalContext
    participant JIT as TT-Metal JIT build
    participant L1 as Worker-core L1
    participant BR as BRISC firmware
    participant NC as NCRISC firmware
    participant TR as TRISC0/1/2
    participant CQ as Prefetch and dispatch

    MC->>JIT: Create firmware build states
    JIT->>JIT: Compile and link each RISC target
    JIT-->>MC: BRISC, NCRISC and TRISC ELF images
    MC->>L1: Initialize launch and synchronization state
    loop Each firmware target
        MC->>L1: Transfer ELF spans to firmware address
    end
    MC->>BR: Release BRISC from reset
    BR->>BR: Configure subordinate reset PCs
    BR->>NC: Release NCRISC and request INIT
    BR->>TR: Release TRISCs and request INIT
    par NCRISC initialization
        NC-->>BR: Initialization DONE
    and TRISC initialization
        TR-->>BR: Initialization DONE
    end
    BR-->>MC: Worker initialization complete
    MC->>CQ: Install persistent command-queue programs
    CQ->>CQ: Enter prefetch and dispatch loops
```

Code: [firmware build targets](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/jit_build/build.cpp#L628-L790),
[host firmware placement](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/device/firmware/risc_firmware_initializer.cpp#L1053-L1199),
[BRISC subordinate initialization](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L181-L275).

## 2. First operation and warm relaunch

```mermaid
sequenceDiagram
    autonumber
    participant H as Host runtime / TTNN
    participant JIT as TT-Metal Program build
    participant HCQ as Host command queue
    participant PD as Device prefetch/dispatch
    participant DRAM as Device binary storage
    participant L1 as Worker L1
    participant BR as BRISC / DM0
    participant NC as NCRISC / DM1
    participant TR as TRISC0/1/2

    alt First use or program-cache miss
        H->>JIT: Compile Program kernels
        JIT-->>H: DM0, DM1 and TRISC binaries
        H->>H: Pack ELF spans into binary pages
        H->>HCQ: Enqueue binary upload
        HCQ->>PD: Transfer upload command
        PD->>DRAM: Store program binary pages
    else Warm launch
        H->>H: Reuse compiled and committed binaries
    end
    H->>HCQ: Enqueue runtime args and launch commands
    HCQ->>PD: Prefetch command stream
    PD->>L1: Write runtime arguments and kernel configuration
    opt Kernels are not resident
        PD->>L1: Move operation kernels into worker L1
    end
    PD->>L1: Write launch message
    PD->>PD: NoC write barrier
    PD->>BR: Publish GO
    BR->>NC: Publish LOAD and GO
    BR->>TR: Start enabled TRISCs
    par DM0 kernel
        BR->>BR: Call BRISC kernel entry
    and DM1 kernel
        NC->>NC: Call NCRISC kernel entry
    and Compute kernels
        TR->>TR: Run unpack, math and pack
    end
    NC-->>BR: DONE
    TR-->>BR: DONE
    BR-->>PD: Worker completion
    PD-->>H: Command or event completion
```

Code: [operation-binary generation](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/kernels/kernel.cpp#L900-L955),
[dispatch command sequence](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/program/dispatch.cpp#L3169-L3277),
[BRISC run loop](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L389-L592).

## 3. NCRISC operation handoff

```mermaid
sequenceDiagram
    participant B as BRISC firmware
    participant S as Shared DM1 launch state
    participant N as NCRISC firmware
    participant O as NCRISC operation wrapper
    participant U as kernel_main

    B->>S: Publish LOAD, then GO
    N->>N: W - wait for BRISC notification
    N->>N: Prepare launch
    N->>N: R - preparation complete
    loop Blackhole subordinate wait
        N->>S: Invalidate cache and read DM1 GO
    end
    N->>O: Call operation kernel_lma
    O->>O: CRT and operation setup
    O->>O: Wait for launch-level host GO
    O->>O: K - wrapper entered
    O->>U: Call kernel_main
    U-->>O: Return
    O->>O: KD - kernel_main returned
    O-->>N: Return to persistent firmware
    N->>N: D - operation completed
    N->>S: Publish DONE
```

Code: [NCRISC persistent loop](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/ncrisc.cc#L77-L192),
[NCRISC operation wrapper](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/ncrisck.cc#L38-L95),
[launch-level host-GO wait](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/internal/firmware_common.h#L194-L206).

NCRISC does not call BRISC. BRISC is the supervisor that publishes shared
launch state; NCRISC observes that state and calls its own operation wrapper.

## 4. First missing waypoint boundary

```mermaid
flowchart TD
    S[Blackhole test hangs] --> W{Last NCRISC waypoint interval}
    W -->|Still at W| A[Check BRISC notification,<br/>DM1 enable and shared LOAD/GO]
    W -->|R but no K| B[Check kernel image, entry address,<br/>CRT, ABI and host-GO mailbox]
    W -->|K but no KD| C[Check kernel_main waits,<br/>circular buffers, NoC and memory]
    W -->|KD but no D| D[Check wrapper postconditions,<br/>return ABI and firmware restoration]
    W -->|D but BRISC waits| E[Check DONE visibility and<br/>other enabled subordinate RISCs]
    A --> T[Use Watcher plus bounded DPRINT]
    B --> T
    C --> T
    D --> T
    E --> T
```

Code: [four-byte Watcher waypoint](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/api/debug/waypoint.h#L8-L41),
[NCRISC firmware markers](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/ncrisc.cc#L77-L192),
[operation-wrapper markers](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/firmware/src/tt-1xx/ncrisck.cc#L38-L95).

## 5. Debugging-tool selection

```mermaid
flowchart TD
    Q{What information is missing?}
    Q -->|Last completed firmware state?| W[Watcher waypoints]
    Q -->|A value, address or branch?| D[DPRINT]
    Q -->|Host or device timing?| T[Tracy and Device Profiler]
    Q -->|State after a hang?| X[tt-triage or TT-ExaLens]
    Q -->|Physical bring-up signal?| J[JTAG or FPGA capture]
    W --> R[Reproduce without instrumentation]
    D --> R
    T --> R
    X --> R
    J --> R
```

References: [Watcher](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/watcher.html),
[Device Print](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_print.html),
[Device Program Profiler](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_program_profiler.html),
[Tracy](https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/tracy_profiler.html).

## 6. DPRINT mechanism

```mermaid
sequenceDiagram
    participant C as Compiler/linker
    participant R as Device RISC
    participant L as Shared DPRINT L1 ring
    participant H as Host DPRINT server
    participant O as Terminal/file

    C->>C: Store format, file and line metadata in ELF
    R->>L: Acquire shared lock
    R->>L: Check free ring-buffer space
    R->>L: Write header and typed payload
    R->>L: Publish write position
    R->>L: Release shared lock
    H->>L: Read pending DPRINT records
    H->>H: Resolve metadata from ELF
    H->>O: Format and print complete line
    H->>L: Advance read position
```

Code: [DPRINT API contract](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/api/debug/dprint.h#L9-L29),
[device serializer/ring protocol](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/api/debug/device_print.h#L168-L244),
[host DPRINT server](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/debug/dprint_server.cpp#L565-L680).

## Logic review

- Cold boot and operation launch are separate lifetimes.
- BRISC supervises subordinate worker RISCs; NCRISC does not call BRISC.
- `R` is firmware-side launch preparation, not proof that `kernel_main` ran.
- `K` without `KD` moves the investigation into the operation kernel.
- A NoC barrier orders the relevant NoC engine state; it is not interchangeable
  with a compiler barrier or a generic RISC-V `fence`.
- DPRINT, Watcher and profiling perturb execution differently. Capture a clean
  reproduction and normally run them separately.

For the longer analysis and smaller per-paragraph diagrams, continue with
[the firmware-to-kernel flow](./RISC_FIRMWARE_TO_KERNEL_FLOW.md),
[the Blackhole bring-up chain](./DISCUSSION_BLACKHOLE_BRINGUP.md), and
[the Blackhole synchronization field guide](./DISCUSSION_BLACKHOLE_SYNCHRONIZATION.md).
