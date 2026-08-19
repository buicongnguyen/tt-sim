type Source = { label: string; href: string };
type Diagram = {
  id: string;
  eyebrow: string;
  title: string;
  explanation: string;
  mermaid: string;
  sources: readonly Source[];
};

const commit = "50a82f835593512c4176546b4af68d7e91315a86";
const ttMetal = `https://github.com/tenstorrent/tt-metal/blob/${commit}`;

const diagrams: readonly Diagram[] = [
  {
    id: "boot",
    eyebrow: "01 / COLD BOOT",
    title: "Host loads every firmware image; BRISC supervises release.",
    explanation: "This is device-session initialization. It is separate from the operation kernels uploaded or reused for each Program.",
    mermaid: `sequenceDiagram
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
    CQ->>CQ: Enter prefetch and dispatch loops`,
    sources: [
      { label: "Firmware build states", href: `${ttMetal}/tt_metal/jit_build/build.cpp#L628-L790` },
      { label: "Host firmware load", href: `${ttMetal}/tt_metal/impl/context/risc_firmware_initializer.cpp#L1053-L1199` },
      { label: "BRISC subordinate initialization", href: `${ttMetal}/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L181-L275` },
    ],
  },
  {
    id: "launch",
    eyebrow: "02 / PROGRAM LAUNCH",
    title: "Cold and warm launches converge before runtime state and GO.",
    explanation: "A program-cache hit can remove compilation and binary traffic. It does not remove new runtime arguments, configuration, launch state or execution ordering.",
    mermaid: `sequenceDiagram
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
    PD-->>H: Command or event completion`,
    sources: [
      { label: "Generate operation binaries", href: `${ttMetal}/tt_metal/impl/kernels/kernel.cpp#L900-L955` },
      { label: "Dispatch command sequence", href: `${ttMetal}/tt_metal/impl/program/dispatch.cpp#L3169-L3277` },
      { label: "BRISC run loop", href: `${ttMetal}/tt_metal/hw/firmware/src/tt-1xx/brisc.cc#L389-L592` },
    ],
  },
  {
    id: "handoff",
    eyebrow: "03 / NCRISC HANDOFF",
    title: "Persistent firmware calls the operation wrapper, which calls kernel_main.",
    explanation: "NCRISC does not call BRISC. BRISC publishes shared launch state; NCRISC observes it and enters its own operation image.",
    mermaid: `sequenceDiagram
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
    N->>S: Publish DONE`,
    sources: [
      { label: "NCRISC persistent loop", href: `${ttMetal}/tt_metal/hw/firmware/src/tt-1xx/ncrisc.cc#L77-L192` },
      { label: "NCRISC operation wrapper", href: `${ttMetal}/tt_metal/hw/firmware/src/tt-1xx/ncrisck.cc#L38-L95` },
      { label: "Launch-level GO wait", href: `${ttMetal}/tt_metal/hw/inc/internal/firmware_common.h#L194-L206` },
    ],
  },
  {
    id: "interval",
    eyebrow: "04 / FIRST MISSING BOUNDARY",
    title: "The last waypoint chooses the next code interval.",
    explanation: "Do not add every debugging tool at once. First classify the interval with Watcher, then inspect the smallest missing boundary.",
    mermaid: `flowchart TD
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
    E --> T`,
    sources: [
      { label: "Watcher waypoint mailbox", href: `${ttMetal}/tt_metal/hw/inc/api/debug/waypoint.h#L8-L41` },
      { label: "NCRISC waypoints", href: `${ttMetal}/tt_metal/hw/firmware/src/tt-1xx/ncrisc.cc#L77-L192` },
      { label: "Operation-wrapper waypoints", href: `${ttMetal}/tt_metal/hw/firmware/src/tt-1xx/ncrisck.cc#L38-L95` },
    ],
  },
  {
    id: "tools",
    eyebrow: "05 / OBSERVER SELECTION",
    title: "Choose the tool from the fact that is missing.",
    explanation: "Watcher is the low-traffic classifier; DPRINT inspects bounded values; Tracy and Device Profiler answer timing questions after correctness is stable.",
    mermaid: `flowchart TD
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
    J --> R`,
    sources: [
      { label: "Official Watcher guide", href: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/watcher.html" },
      { label: "Official Device Print guide", href: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_print.html" },
      { label: "Official Device Profiler guide", href: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/device_program_profiler.html" },
      { label: "Official Tracy guide", href: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/tracy_profiler.html" },
    ],
  },
  {
    id: "dprint",
    eyebrow: "06 / DPRINT MECHANISM",
    title: "Device RISCs serialize records; the host resolves and formats them.",
    explanation: "DPRINT is a shared L1 ring protocol, not a direct terminal write. Excess output can block or perturb the failing timing, so keep it core- and RISC-scoped.",
    mermaid: `sequenceDiagram
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
    H->>L: Advance read position`,
    sources: [
      { label: "DPRINT API contract", href: `${ttMetal}/tt_metal/hw/inc/api/debug/dprint.h#L9-L29` },
      { label: "Device serialization and ring protocol", href: `${ttMetal}/tt_metal/hw/inc/api/debug/device_print.h#L168-L244` },
      { label: "Host DPRINT server", href: `${ttMetal}/tt_metal/impl/debug/dprint_server.cpp#L565-L680` },
    ],
  },
];

const waypoints = [
  ["W", "NCRISC firmware waits for BRISC LOAD / GO"],
  ["R", "firmware launch preparation completed; operation handoff follows"],
  ["K", "the operation wrapper is about to call kernel_main"],
  ["KD", "kernel_main returned to the operation wrapper"],
  ["D", "control returned to persistent NCRISC firmware and DONE is published"],
] as const;

function DebugLowLevelKernelFlowApp() {
  return (
    <div className="kernel-flow-page">
      <header className="kernel-flow-topbar">
        <a href="./index.html" className="kernel-flow-brand"><b>TT•SIM</b><span>low-level debug atlas</span></a>
        <nav aria-label="Page navigation">
          <a href="#boot">Boot</a><a href="#launch">Launch</a><a href="#handoff">Handoff</a><a href="#interval">Waypoints</a><a href="#tools">Tools</a><a href="#dprint">DPRINT</a><a className="kernel-flow-back" href="./discussion.html">← Discussion</a>
        </nav>
      </header>

      <main>
        <section className="kernel-flow-hero">
          <div><span>DISCUSSION SUBPAGE / 06</span><small>TT-METAL · {commit.slice(0, 12)}</small></div>
          <article><p>HOST → FIRMWARE → WRAPPER → KERNEL_MAIN → DONE</p><h1>Debug the first<br/><em>missing boundary.</em></h1><p className="kernel-flow-thesis">Six rendered Mermaid diagrams connect TT-Metal host launch code to BRISC, NCRISC, TRISCs, Watcher waypoints and DPRINT. Every major arrow has a pinned code or official-tool reference.</p></article>
          <aside><b>CORRECTED MODEL</b><p>The host loads each base firmware image. BRISC supervises NCRISC and TRISC launch state. Persistent firmware calls per-Program operation kernels.</p><a href="./DEBUG_LOW_LEVEL_KERNEL_FLOW.md">Read Mermaid source ↗</a></aside>
        </section>

        <section className="waypoint-legend" aria-label="NCRISC waypoint definitions">
          {waypoints.map(([name, meaning]) => <article key={name}><b>{name}</b><p>{meaning}</p></article>)}
        </section>

        {diagrams.map((diagram, index) => (
          <section id={diagram.id} className={`kernel-diagram-section ${index % 2 ? "alternate" : ""}`} key={diagram.id}>
            <header><span>{diagram.eyebrow}</span><h2>{diagram.title}</h2><p>{diagram.explanation}</p></header>
            <div className="mermaid-shell">
              <pre className="mermaid">{diagram.mermaid}</pre>
              <noscript>Enable JavaScript to render this Mermaid diagram. The complete Mermaid source is available in the linked Markdown guide.</noscript>
            </div>
            <div className="kernel-source-row">
              <b>CODE BESIDE THE FLOW</b>
              {diagram.sources.map((source) => <a href={source.href} key={source.href}>{source.label} ↗</a>)}
            </div>
          </section>
        ))}

        <section className="kernel-flow-verdict">
          <div><span>R WITHOUT K</span><p>The problem is before operation-wrapper entry: DM1 GO, handoff, image, entry, CRT, host-GO mailbox or ABI.</p></div>
          <i>≠</i>
          <div><span>K WITHOUT KD</span><p>The wrapper reached <code>kernel_main</code>; investigate its waits, circular buffers, NoC, memory access and generated instructions.</p></div>
        </section>
      </main>

      <footer className="kernel-flow-footer"><div><b>TT•SIM · LOW-LEVEL KERNEL DEBUG FLOW</b><p>Source-linked Mermaid atlas for Blackhole worker bring-up.</p></div><a href="./discussion-blackhole-bringup.html">Bring-up chain →</a><a href="./firmware-flow.html">Firmware atlas →</a><a href="https://github.com/buicongnguyen/tt-sim/blob/main/docs/DEBUG_LOW_LEVEL_KERNEL_FLOW.md">GitHub source ↗</a></footer>
    </div>
  );
}

export default DebugLowLevelKernelFlowApp;
