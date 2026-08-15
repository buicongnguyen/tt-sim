#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-inspect}"
TT_METAL_ROOT="${TT_METAL_HOME:-$HOME/src/tt-metal}"
QSR_LIBRARY="${TT_METAL_SIMULATOR:-$HOME/sim/libttsim_qsr.so}"
RESULTS_ROOT="${TTSIM_LAB_RESULTS:-$HOME/ttsim-lab-results}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RESULT_DIR="$RESULTS_ROOT/quasar-cluster-$STAMP"
REPORT="$RESULT_DIR/architecture-report.md"

QSR_SOC="$TT_METAL_ROOT/tt_metal/soc_descriptors/quasar_32_arch.yaml"
BH_SOC="$TT_METAL_ROOT/tt_metal/soc_descriptors/blackhole_140_arch.yaml"
QSR_API="$TT_METAL_ROOT/tt_metal/impl/host_api/temp_quasar_api.hpp"
QSR_NOC_HEADER="$TT_METAL_ROOT/tt_metal/hw/inc/internal/tt-2xx/quasar/noc_nonblocking_api.h"
QSR_TEST="$TT_METAL_ROOT/build/test/tt_metal/unit_tests_legacy"
EXPECTED_V1101_SHA="b82063169370cb49ceab219fb853310f4dd19cb6a799fab460876a7f65c10b60"

usage() {
  printf '%s\n' \
    "Usage: $0 [inspect|run|all]" \
    "  inspect  Compare the Quasar and Blackhole descriptors and record source constants." \
    "  run      Execute the supported Quasar single-DM L1 write test." \
    "  all      Run both phases in one timestamped result directory."
}

require_file() {
  if [[ ! -f "$1" ]]; then
    printf 'Missing required file: %s\n' "$1" >&2
    exit 1
  fi
}

prepare() {
  require_file "$QSR_SOC"
  require_file "$BH_SOC"
  require_file "$QSR_API"
  mkdir -p "$RESULT_DIR"
}

inspect_architecture() {
  python3 - "$QSR_SOC" "$BH_SOC" <<'PY' | tee "$REPORT"
import sys
from pathlib import Path

try:
    import yaml
except ImportError as exc:
    raise SystemExit("PyYAML is required; activate TT-Metal's python_env before running this lab.") from exc


def load(path):
    with Path(path).open(encoding="utf-8") as stream:
        return yaml.safe_load(stream)


def flatten_count(value):
    if not isinstance(value, list):
        return 0
    return sum(flatten_count(item) if isinstance(item, list) else 1 for item in value)


def row(label, qsr, bh):
    print(f"| {label} | {qsr} | {bh} |")


qsr = load(sys.argv[1])
bh = load(sys.argv[2])
print("# Quasar cluster lab — architecture evidence")
print()
print("These values describe the checked-out TT-Metal simulator descriptors, not an unreleased final-silicon promise.")
print()
print("| Descriptor field | Quasar | Blackhole |")
print("|---|---:|---:|")
row("Architecture", qsr["arch_name"], bh["arch_name"])
row("NoC coordinate extent", f'{qsr["grid"]["x_size"]}×{qsr["grid"]["y_size"]}', f'{bh["grid"]["x_size"]}×{bh["grid"]["y_size"]}')
row("Functional worker nodes", len(qsr["functional_workers"]), len(bh["functional_workers"]))
row("Worker shared SRAM", f'{qsr["worker_l1_size"] // 1048576:g} MiB', f'{bh["worker_l1_size"] / 1048576:g} MiB')
row("DRAM channels in descriptor", len(qsr["dram"]), len(bh["dram"]))
row("Ethernet endpoints in descriptor", flatten_count(qsr["eth"]), flatten_count(bh["eth"]))
row("PCIe endpoints in descriptor", flatten_count(qsr["pcie"]), flatten_count(bh["pcie"]))
PY

  {
    printf '\n## Reproducibility\n\n'
    printf -- '- TT-Metal commit: `%s`\n' "$(git -C "$TT_METAL_ROOT" rev-parse HEAD)"
    if [[ -f "$QSR_LIBRARY" ]]; then
      printf -- '- Quasar library: `%s`\n' "$QSR_LIBRARY"
      printf -- '- Quasar SHA-256: `%s`\n' "$(sha256sum "$QSR_LIBRARY" | awk '{print $1}')"
    else
      printf -- '- Quasar library: not found at `%s`\n' "$QSR_LIBRARY"
    fi
    printf '\n## Quasar cluster constants from the host API\n\n```text\n'
    grep -E 'QUASAR_NUM_(DM_CORES|RESERVED_DM_CORES|USER_DM_CORES|TENSIX_ENGINES)_PER_CLUSTER' "$QSR_API" || true
    printf '```\n'
  } | tee -a "$REPORT"

  if [[ -f "$QSR_LIBRARY" ]]; then
    actual_sha="$(sha256sum "$QSR_LIBRARY" | awk '{print $1}')"
    if [[ "$actual_sha" == "$EXPECTED_V1101_SHA" ]]; then
      printf 'Library check: PASS — Quasar ttsim v1.10.1\n'
    else
      printf 'Library check: NOTE — checksum differs from the v1.10.1 x86-64 release.\n'
    fi
  fi
  printf 'Architecture report: %s\n' "$REPORT"
}

run_baseline() {
  require_file "$QSR_LIBRARY"
  require_file "$QSR_NOC_HEADER"
  require_file "$QSR_TEST"

  if grep -Eq '^[[:space:]]*#define[[:space:]]+NOC_API_V2' "$QSR_NOC_HEADER"; then
    printf '%s\n' \
      "NOC_API_V2 is enabled in $QSR_NOC_HEADER." \
      "The current v1.10.1 Quasar simulator documents this baseline on the legacy NOC V1 path." \
      "Review the guide, disable that define intentionally, rebuild the affected JIT artifacts, then rerun." >&2
    exit 2
  fi

  simulator_dir="$(dirname "$QSR_LIBRARY")"
  if [[ -f "$simulator_dir/soc_descriptor.yaml" ]]; then
    cp -a "$simulator_dir/soc_descriptor.yaml" "$RESULT_DIR/soc_descriptor.before.yaml"
  fi
  cp "$QSR_SOC" "$simulator_dir/soc_descriptor.yaml"

  export TT_METAL_HOME="$TT_METAL_ROOT"
  export TT_METAL_SIMULATOR="$QSR_LIBRARY"
  export TT_METAL_SLOW_DISPATCH_MODE=1
  export TT_METAL_DPRINT_CORES=0,0
  export TT_METAL_CACHE="$RESULT_DIR/tt-metal-cache"

  set +e
  "$QSR_TEST" --gtest_filter=QuasarMeshDeviceSingleCardFixture.SingleDmL1Write 2>&1 | tee "$RESULT_DIR/quasar-l1-write.log"
  test_status=${PIPESTATUS[0]}
  set -e

  if [[ $test_status -ne 0 ]]; then
    printf 'Baseline result: FAIL (exit %d)\nLog: %s\n' "$test_status" "$RESULT_DIR/quasar-l1-write.log" >&2
    exit "$test_status"
  fi
  if ! grep -Eq '\[[[:space:]]*PASSED[[:space:]]*\][[:space:]]+1 test' "$RESULT_DIR/quasar-l1-write.log"; then
    printf 'Baseline exited successfully but the expected GoogleTest PASS marker was not found.\n' >&2
    exit 3
  fi
  printf 'Baseline result: PASS\nLog: %s\n' "$RESULT_DIR/quasar-l1-write.log"
}

case "$MODE" in
  inspect)
    prepare
    inspect_architecture
    ;;
  run)
    prepare
    run_baseline
    ;;
  all)
    prepare
    inspect_architecture
    run_baseline
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 64
    ;;
esac
