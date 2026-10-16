#!/usr/bin/env bash
# Deploy PusakaIjazah ke jaringan RPC_URL memakai DEPLOYER_PK, lalu beri OPERATOR_ROLE dan
# PENANDATANGAN_ROLE. Hasilnya di contracts/deployments/<chainId>.json (alamat publik, boleh di-commit).
#   scripts/deploy-kontrak.sh                       # memakai .env.local
#   ENV_FILE=berkas.env scripts/deploy-kontrak.sh
set -euo pipefail
AKAR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/_env.sh
. "$AKAR/scripts/_env.sh"

pk=$(wajib DEPLOYER_PK)
operator=$(wajib OPERATOR)
penandatangan=$(wajib PENANDATANGAN)
rpc=$(wajib RPC_URL)

if [ "${operator,,}" = "${penandatangan,,}" ]; then
  echo "✕ OPERATOR dan PENANDATANGAN harus wallet berbeda (kontrak menolak operator menyetujui dirinya sendiri)" >&2
  exit 1
fi

chain=$(cast chain-id --rpc-url "$rpc")
saldo=$(cast balance "$(cast wallet address "$pk")" --rpc-url "$rpc" --ether)
echo "→ chain $chain, saldo deployer $saldo"

verifikasi=()
kunci_scan=$(ambil POLYGONSCAN_API_KEY)
if [ -n "$kunci_scan" ] && [ "$chain" != 31337 ]; then
  verifikasi=(--verify --etherscan-api-key "$kunci_scan")
fi

mkdir -p "$AKAR/contracts/deployments"
cd "$AKAR/contracts"
DEPLOYER_PK="$pk" OPERATOR="$operator" PENANDATANGAN="$penandatangan" \
  forge script script/Deploy.s.sol --rpc-url "$rpc" --broadcast --slow "${verifikasi[@]}" >/dev/null

hasil="deployments/$chain.json"
alamat=$(grep -oE '0x[0-9a-fA-F]{40}' "$hasil" | head -1)
echo "✓ PusakaIjazah: $alamat"
echo "  Isi di .env.local: ALAMAT_KONTRAK=$alamat dan PUBLIC_ALAMAT_KONTRAK=$alamat, CHAIN_ID=PUBLIC_CHAIN_ID=$chain"
