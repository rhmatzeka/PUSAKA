#!/usr/bin/env bash
# Salin env produksi dari .env.local ke proyek Vercel (environment production). Nilai dikirim lewat
# stdin dan tidak pernah dicetak. Variabel kosong dilewati dengan peringatan.
set -euo pipefail
AKAR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/_env.sh
. "$AKAR/scripts/_env.sh"
cd "$AKAR"

VAR=(
  DATABASE_URL PRIVY_APP_ID PRIVY_APP_SECRET PRIVY_VERIFICATION_KEY PINATA_JWT KUNCI_MASTER
  RPC_URL ALAMAT_KONTRAK CHAIN_ID
  PUBLIC_RPC_URL PUBLIC_ALAMAT_KONTRAK PUBLIC_CHAIN_ID PUBLIC_GATEWAY_URL PUBLIC_PRIVY_APP_ID
)
for v in "${VAR[@]}"; do
  nilai=$(ambil "$v")
  if [ -z "$nilai" ]; then
    echo "! $v kosong, dilewati"
    continue
  fi
  npx -y vercel@latest env rm "$v" production -y >/dev/null 2>&1 || true
  printf '%s' "$nilai" | npx -y vercel@latest env add "$v" production >/dev/null
  echo "✓ $v"
done
echo "Selesai. Deploy ulang production supaya PUBLIC_* ikut terbakar ke bundel: npx vercel@latest deploy --prod"
