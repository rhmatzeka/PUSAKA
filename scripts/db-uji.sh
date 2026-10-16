#!/usr/bin/env bash
# Postgres sementara untuk `cargo test` (container --rm, hilang saat dihentikan).
# Pakai: eval "$(scripts/db-uji.sh)"
set -euo pipefail
NAMA=pusaka-pg-uji
if ! docker ps --format '{{.Names}}' | grep -qx "$NAMA"; then
  docker run -d --rm --name "$NAMA" -e POSTGRES_PASSWORD=uji \
    -p 127.0.0.1:55432:5432 postgres:17-alpine >/dev/null
  # Lewat TCP supaya tidak tertipu server sementara saat initdb (hanya socket).
  until docker exec "$NAMA" psql -U postgres -h 127.0.0.1 -c 'select 1' >/dev/null 2>&1; do
    sleep 0.5
  done
fi
echo "export DATABASE_URL=postgres://postgres:uji@127.0.0.1:55432/postgres"
