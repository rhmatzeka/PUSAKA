#!/usr/bin/env bash
# Tulis ABI kontrak ke abi/PusakaIjazah.json (dipakai Rust dan web).
set -euo pipefail
cd "$(dirname "$0")/.."
forge build --silent
mkdir -p ../abi
jq '.abi' out/PusakaIjazah.sol/PusakaIjazah.json > ../abi/PusakaIjazah.json
echo "ABI: abi/PusakaIjazah.json ($(jq length ../abi/PusakaIjazah.json) entri)"
