#!/usr/bin/env bash
set -euo pipefail

echo "== TT•SIM WSL preflight =="
grep '^PRETTY_NAME=' /etc/os-release
printf 'kernel: '; uname -r
printf 'architecture: '; uname -m
printf 'logical CPUs: '; nproc
free -h
df -h /

echo
echo "== tools =="
for tool_name in git python3 cmake ninja g++ wget ccache; do
  if command -v "${tool_name}" >/dev/null 2>&1; then
    printf '%-10s ready\n' "${tool_name}"
  else
    printf '%-10s MISSING\n' "${tool_name}"
  fi
done

if ! grep -qi microsoft /proc/version; then
  echo "warning: this does not look like WSL2" >&2
fi
