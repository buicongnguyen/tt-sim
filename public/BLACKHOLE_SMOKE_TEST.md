# Verified Blackhole smoke test on WSL2

This is the web-accessible copy of the [complete repository test record](https://github.com/buicongnguyen/tt-sim/blob/main/docs/BLACKHOLE_SMOKE_TEST.md).

- **Result:** PASS
- **Observed:** 16 August 2026
- **Host:** WSL2, Ubuntu 22.04.5 LTS, x86_64
- **TT-Metal:** `50a82f83559` (`v0.77.0-dev20260815-5-g50a82f83559`)
- **UMD:** `9bbe7bc9`
- **Simulator:** `libttsim_bh.so`
- **Architecture:** Blackhole, device ID `0xb140`
- **SoC descriptor:** exact match with `tt_metal/soc_descriptors/blackhole_140_arch.yaml`

## Reproduce

```bash
cp "$TT_METAL_HOME/tt_metal/soc_descriptors/blackhole_140_arch.yaml" ~/sim/soc_descriptor.yaml
export TT_METAL_SIMULATOR="$HOME/sim/libttsim_bh.so"
export TT_METAL_SLOW_DISPATCH_MODE=1
export TT_METAL_DISABLE_SFPLOADMACRO=1
export TT_METAL_DPRINT_CORES=0,0  # optional
cd "$TT_METAL_HOME"
./build/programming_examples/metal_example_add_2_integers_in_riscv
```

## Observed evidence

```text
Disabling multi-erisc mode with simulator/emule target device
Creating Simulation device
TTSimTTDevice chip_id=0 PCI vendor_id=0x1e52 device_id=0xb140
Chip 0 has inconsistent ETH harvesting information ... Board unknown expects 0 units ... mask indicates 2 units.
Dispatch telemetry SMC buffer unavailable (no firmware info provider, e.g. simulator)
Success: Result is 21
JIT cache stats: 0/9 hits (0.0%)
Closing devices in cluster completed.
[6669] 0.3 seconds (24.6 KHz)
```

## Interpretation

| Signal | Classification | Meaning |
| --- | --- | --- |
| `device_id=0xb140` | PASS | TT-Metal loaded and identified the virtual Blackhole device. |
| Multi-ERISC disabled | EXPECTED | The simulator intentionally disables Blackhole dual Ethernet-RISC mode. |
| `Board unknown ... mask indicates 2` | BENIGN | UMD has no physical board identity for the simulator; the descriptor is correct. |
| SMC telemetry unavailable | EXPECTED | `ttsim` has no physical firmware provider or SMC telemetry buffer. |
| `Success: Result is 21` | PASS | Host dispatch, JIT compilation, BRISC execution and result transfer completed correctly. |
| `0/9` JIT cache hits | INFO | This first run compiled nine artifacts. |
| `24.6 KHz` | INFO | Simulator throughput, not Blackhole silicon performance. |

## Verdict

```text
RESULT: PASS
ARCHITECTURE: Blackhole
EXPECTED VALUE: 21
OBSERVED VALUE: 21
SIMULATOR INITIALIZATION: PASS
KERNEL EXECUTION: PASS
CLEAN SHUTDOWN: PASS
WARNINGS: Expected simulator limitations
```

## Primary references

- [Tenstorrent ttsim](https://github.com/tenstorrent/ttsim)
- [RISC-V addition example](https://github.com/tenstorrent/tt-metal/blob/main/tt_metal/programming_examples/add_2_integers_in_riscv/add_2_integers_in_riscv.cpp)
- [Simulator runtime options](https://github.com/tenstorrent/tt-metal/blob/main/tt_metal/llrt/rtoptions.cpp)
- [Dispatch telemetry fallback](https://github.com/tenstorrent/tt-metal/blob/main/tt_metal/impl/dispatch/dispatch_telemetry.cpp)
- [UMD harvesting validation](https://github.com/tenstorrent/tt-metal/blob/main/tt_metal/third_party/umd/device/cluster_descriptor.cpp)
