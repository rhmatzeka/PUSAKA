#!/usr/bin/env bash
# Uji asap setelah deploy: halaman statis, rewrite /i/<token>, API Rust, dan konfigurasi env.
#   scripts/periksa-produksi.sh https://pusaka.rahmateka.my.id
set -uo pipefail
URL="${1:?pakai: scripts/periksa-produksi.sh <url>}"
gagal=0

cek() {
  local nama=$1 jalur=$2 harus=$3 cocok=${4:-} berkas status
  berkas=$(mktemp)
  status=$(curl -s -o "$berkas" -w '%{http_code}' "$URL$jalur")
  if [ "$status" != "$harus" ] || { [ -n "$cocok" ] && ! grep -q "$cocok" "$berkas"; }; then
    echo "✕ $nama ($jalur): status $status, harus $harus${cocok:+ dan memuat \"$cocok\"}"
    gagal=1
  else
    echo "✓ $nama"
  fi
  rm -f "$berkas"
}

cek "Beranda" / 200 'Ijazah yang'
cek "Periksa" /periksa/ 200 'Periksa ijazah'
cek "Rewrite /i/<token>" /i/1 200 'Hasil verifikasi ijazah'
cek "Masuk" /masuk/ 200 'Masuk'
cek "API kesehatan" /api/kesehatan 200 'pusaka-api'
cek "API sesi menolak tanpa token (env lengkap)" /api/sesi 401 'TIDAK_TERAUTENTIKASI'
exit $gagal
