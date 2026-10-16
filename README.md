# PUSAKA

Sistem verifikasi ijazah digital Universitas Pamulang: token ERC-721 soulbound di Polygon,
tanda tangan pejabat EIP-712 (ECDSA), sidik jari Keccak-256, dan berkas terenkripsi di IPFS.

Rancangan: `docs/superpowers/specs/2026-10-16-pusaka-v2-design.md`. Kode v1 ada di branch `arsip/v1`.

```
crates/pusaka-api   backend Rust (axum) — di Vercel lewat api/index.rs
web/                frontend Astro
docs/               spesifikasi dan rencana
```

## Jalankan di laptop

```bash
cargo run -p pusaka-api          # API di 127.0.0.1:8787
npm --prefix web install
npm --prefix web run dev         # http://localhost:4321 (proxy /api ke Rust)
```

## Uji

```bash
cargo test --workspace
npm --prefix web run check
```
