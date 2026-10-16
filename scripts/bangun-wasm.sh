#!/usr/bin/env bash
# Bangun pusaka-core ke WASM untuk peramban. Jalankan setiap kali crates/pusaka-core berubah.
set -euo pipefail
cd "$(dirname "$0")/.."
wasm-pack build crates/pusaka-core --target web --release \
  --out-dir ../../web/src/wasm --out-name pusaka_core -- --features wasm
rm -f web/src/wasm/.gitignore web/src/wasm/package.json web/src/wasm/README.md
ls -la web/src/wasm
