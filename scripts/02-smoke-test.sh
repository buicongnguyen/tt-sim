#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${TT_METAL_HOME:-}" ]]; then
  echo "TT_METAL_HOME is not set" >&2
  exit 2
fi

if [[ -z "${TT_METAL_SIMULATOR:-}" ]]; then
  echo "TT_METAL_SIMULATOR is not set; source scripts/01-activate-wormhole.sh first" >&2
  exit 2
fi

example="${TT_METAL_HOME}/build/programming_examples/metal_example_add_2_integers_in_riscv"
if [[ ! -x "${example}" ]]; then
  echo "Built example not found: ${example}" >&2
  exit 2
fi

echo "TT-Metal commit: $(git -C "${TT_METAL_HOME}" rev-parse --short HEAD)"
echo "Simulator: ${TT_METAL_SIMULATOR}"
echo "Expected: Success: Result is 21"
exec "${example}"
