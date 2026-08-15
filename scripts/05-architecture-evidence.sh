#!/usr/bin/env bash
set -euo pipefail

TT_METAL_ROOT="${TT_METAL_HOME:-$HOME/src/tt-metal}"
RESULTS_ROOT="${TTSIM_LAB_RESULTS:-$HOME/ttsim-lab-results}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RESULT_DIR="$RESULTS_ROOT/architecture-evidence-$STAMP"
REPORT="$RESULT_DIR/tt-metal-evidence.md"

WH_SOC="$TT_METAL_ROOT/tt_metal/soc_descriptors/wormhole_b0_80_arch.yaml"
BH_SOC="$TT_METAL_ROOT/tt_metal/soc_descriptors/blackhole_140_arch.yaml"
QSR_SOC="$TT_METAL_ROOT/tt_metal/soc_descriptors/quasar_32_arch.yaml"
WH_LLK="$TT_METAL_ROOT/tt_metal/hw/ckernels/wormhole_b0/metal/llk_api"
BH_LLK="$TT_METAL_ROOT/tt_metal/hw/ckernels/blackhole/metal/llk_api"
QSR_LLK="$TT_METAL_ROOT/tt_metal/hw/ckernels/quasar/metal/llk_api"
QSR_API="$TT_METAL_ROOT/tt_metal/impl/host_api/temp_quasar_api.hpp"
QSR_API_IMPL="$TT_METAL_ROOT/tt_metal/impl/host_api/temp_quasar_api.cpp"

for required in "$WH_SOC" "$BH_SOC" "$QSR_SOC" "$QSR_API" "$QSR_API_IMPL"; do
  if [[ ! -f "$required" ]]; then
    printf 'Missing required TT-Metal file: %s\n' "$required" >&2
    exit 1
  fi
done

mkdir -p "$RESULT_DIR"

python3 - "$TT_METAL_ROOT" "$WH_SOC" "$BH_SOC" "$QSR_SOC" "$WH_LLK" "$BH_LLK" "$QSR_LLK" <<'PY' > "$REPORT"
from pathlib import Path
import subprocess
import sys

try:
    import yaml
except ImportError as exc:
    raise SystemExit("PyYAML is required; activate TT-Metal's python_env first.") from exc

root = Path(sys.argv[1])
descriptors = [Path(item) for item in sys.argv[2:5]]
llk_roots = [Path(item) for item in sys.argv[5:8]]
names = ["Wormhole B0", "Blackhole", "Quasar"]

def load(path):
    return yaml.safe_load(path.read_text(encoding="utf-8"))

def flatten_count(value):
    if not isinstance(value, list):
        return 0
    return sum(flatten_count(item) if isinstance(item, list) else 1 for item in value)

def files(path):
    return {str(item.relative_to(path)).replace("\\", "/") for item in path.rglob("*") if item.is_file()}

data = [load(path) for path in descriptors]
commit = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()

print("# TT-Metal architecture evidence")
print()
print(f"- TT-Metal commit: `{commit}`")
print("- Generated from the checked-out descriptors and LLK trees.")
print("- Descriptor counts describe simulator models; they are not product-card enabled-core specifications.")
print()
print("## SoC descriptor fields")
print()
print("| Field | Wormhole B0 | Blackhole | Quasar |")
print("|---|---:|---:|---:|")
rows = [
    ("Architecture", [item["arch_name"] for item in data]),
    ("NoC coordinate extent", [f'{item["grid"]["x_size"]}×{item["grid"]["y_size"]}' for item in data]),
    ("Functional workers", [len(item["functional_workers"]) for item in data]),
    ("Worker L1 bytes", [item["worker_l1_size"] for item in data]),
    ("DRAM channels", [len(item["dram"]) for item in data]),
    ("Ethernet endpoints", [flatten_count(item.get("eth", [])) for item in data]),
    ("PCIe endpoints", [flatten_count(item.get("pcie", [])) for item in data]),
]
for label, values in rows:
    print(f"| {label} | {values[0]} | {values[1]} | {values[2]} |")

llks = [files(path) for path in llk_roots]
print()
print("## Public low-level-kernel surface")
print()
print("File counts are software-surface evidence, not instruction counts or performance measurements.")
print()
print("| Comparison | Count |")
print("|---|---:|")
print(f"| Wormhole LLK files | {len(llks[0])} |")
print(f"| Blackhole LLK files | {len(llks[1])} |")
print(f"| Quasar LLK files | {len(llks[2])} |")
print(f"| Blackhole-only vs Wormhole | {len(llks[1] - llks[0])} |")
print(f"| Blackhole LLKs absent from Quasar | {len(llks[1] - llks[2])} |")
print()
print("### Representative Blackhole-only paths")
print()
for path in sorted(llks[1] - llks[0])[:40]:
    print(f"- `{path}`")
PY

{
  printf '\n## Quasar host-API constraints\n\n```text\n'
  grep -nE 'QUASAR_NUM_(DM_CORES|RESERVED_DM_CORES|USER_DM_CORES|TENSIX_ENGINES)_PER_CLUSTER' "$QSR_API" || true
  grep -n 'single compute kernel' "$QSR_API_IMPL" || true
  printf '```\n'
  printf '\n## Blackhole pack-format branch\n\n```text\n'
  grep -nE 'IS_8BIT_FORMAT|tile_cols|input_operand' "$BH_LLK/llk_pack_tile_api.h" || true
  printf '```\n'
  printf '\n## Interpretation guardrail\n\n'
  printf '%s\n' '- A source difference establishes a different software contract or capability.' '- It does not establish realized workload speed without silicon measurements.' '- Quasar remains pre-silicon and its public simulator is in early bring-up.'
} >> "$REPORT"

printf 'Evidence report: %s\n' "$REPORT"
