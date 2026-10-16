# shellcheck shell=bash
# Dipakai skrip lain: baca satu nilai dari berkas env tanpa `source` (PEM Privy berisi spasi).
# Berkas: $ENV_FILE atau .env.local di root repo. Nilai tidak pernah dicetak.
ENV_FILE="${ENV_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.local}"

ambil() {
  local baris
  baris=$(grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 || true)
  printf '%s' "${baris#*=}"
}

wajib() {
  local v
  v=$(ambil "$1")
  if [ -z "$v" ]; then
    echo "✕ $1 belum diisi di $ENV_FILE" >&2
    exit 1
  fi
  printf '%s' "$v"
}
