#!/usr/bin/env bash

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source this file so its exports remain active:" >&2
  echo "  source scripts/01-activate-wormhole.sh" >&2
  exit 2
fi

if [[ -z "${TT_METAL_HOME:-}" ]]; then
  echo "TT_METAL_HOME is not set. Example: export TT_METAL_HOME=~/src/tt-metal" >&2
  return 2
fi

sim_library="${TTSIM_LIBRARY:-${HOME}/sim/libttsim_wh.so}"
descriptor_source="${TT_METAL_HOME}/tt_metal/soc_descriptors/wormhole_b0_80_arch.yaml"
descriptor_target="$(dirname "${sim_library}")/soc_descriptor.yaml"

if [[ ! -f "${sim_library}" ]]; then
  echo "Simulator not found: ${sim_library}" >&2
  return 2
fi

if [[ ! -f "${descriptor_source}" ]]; then
  echo "Wormhole descriptor not found: ${descriptor_source}" >&2
  return 2
fi

cp "${descriptor_source}" "${descriptor_target}"
export TT_METAL_SIMULATOR="${sim_library}"
export TT_METAL_SLOW_DISPATCH_MODE=1
export TT_METAL_DISABLE_SFPLOADMACRO=1

echo "ttsim activated"
echo "  TT_METAL_HOME=${TT_METAL_HOME}"
echo "  TT_METAL_SIMULATOR=${TT_METAL_SIMULATOR}"
echo "  descriptor=${descriptor_target}"
