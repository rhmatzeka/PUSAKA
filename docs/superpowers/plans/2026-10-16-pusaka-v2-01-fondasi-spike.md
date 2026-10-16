# PUSAKA v2 · Rencana 01 — Fondasi + Spike Vercel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengarsipkan kode v1, membuat kerangka monorepo v2 (workspace Rust + Astro), dan membuktikan bahwa halaman Astro statis serta satu fungsi Rust (axum) bisa berjalan bersama dalam satu deployment Vercel.

**Architecture:** Root repo menjadi workspace Cargo sekaligus paket `pusaka-vercel` yang punya satu binary `api/index.rs` (fungsi Vercel). Binary itu membungkus `pusaka_api::router()` dengan `VercelLayer`. Di laptop, router yang sama dijalankan oleh `crates/pusaka-api/src/main.rs`. Frontend Astro ada di `web/` dan dibangun ke `web/dist`.

**Tech Stack:** Rust 1.98 (edition 2024), axum 0.8, tokio 1, tower 0.5, vercel_runtime 2.4 (fitur `axum`), Astro 7, React 19, Tailwind 4, Node 24, GitHub Actions, Vercel CLI (`npx vercel`).

**Spec:** `docs/superpowers/specs/2026-10-16-pusaka-v2-design.md` (bagian 3, 7.4, 12, 13 tahap 0–1)

## Global Constraints

- Branch kerja: `feat/pusaka-v2`. Tanpa atribusi AI di commit/PR; commit atas identitas git user saja.
- Kode v1 disimpan di branch `arsip/v1` **termasuk perubahan UI 26 Sep yang belum di-commit**, sebelum dihapus dari branch v2.
- Rahasia (`.env`, `.env.local`) tidak pernah di-commit. Salinan fisik folder v1 (beserta `.env`-nya) dipindah ke `~/Skripsi/pusaka-v1/`, bukan dihapus.
- Rust: edition 2024; `cargo fmt --check` dan `cargo clippy --all-targets -- -D warnings` wajib bersih.
- Astro: `output: 'static'`; hasil build di `web/dist`.
- Vercel: satu proyek; `/api/*` di-rewrite ke fungsi `api/index`.
- Port API lokal: `127.0.0.1:8787` (bisa diubah lewat env `PUSAKA_API_ALAMAT`).

## Review Focus

- Path asli tetap sampai di axum setelah rewrite Vercel (`/api/kesehatan`, bukan `/api/index`) → dicek di Task 4 step 4.
- Rute API yang tidak ada mengembalikan JSON 404, bukan HTML/teks kosong → tes `rute_tidak_dikenal_404_json` di Task 2.
- Folder v1 yang tidak ter-track (`node_modules`, `.env`, `.ipfs-lokal`) tidak hilang saat dibersihkan → dipindah, dicek di Task 1 step 6.
- Dev server Astro mem-proxy `/api` ke API lokal, sehingga halaman lokal bisa memanggil Rust → Task 3 step 5.
- Build di Vercel memakai `npm ci` yang membutuhkan `web/package-lock.json` ter-commit → Task 3 step 7.

---

### Task 1: Arsipkan kode v1

**Files:**
- Branch baru: `arsip/v1`
- Hapus dari `feat/pusaka-v2`: `contracts/`, `web/`, `README.md` (v1)
- Pindah fisik: folder v1 ke `~/Skripsi/pusaka-v1/`

**Interfaces:**
- Consumes: working tree saat ini (branch `feat/pusaka-v2`, commit `09cc8a6`) yang masih membawa 16 file v1 termodifikasi + `web/components/TautanNav.tsx`, `web/components/TautanTab.tsx`, `web/design.md`, `web/.hallmark/` belum ter-track.
- Produces: branch `arsip/v1` di origin; branch `feat/pusaka-v2` tanpa kode v1.

- [ ] **Step 1: Pastikan posisi dan isi working tree**

Run: `cd ~/Skripsi/pusaka && git branch --show-current && git status --short | wc -l`
Expected: `feat/pusaka-v2` dan angka ≥ 19.

- [ ] **Step 2: Buat branch arsip dan commit perubahan UI yang belum tersimpan**

```bash
git switch -c arsip/v1
git add web contracts
git status --short | grep -E '\.env' && echo "STOP: ada .env ter-stage" || echo "aman"
git commit -m "arsip: redesign UI v1 (26 Sep) yang belum di-commit"
```
Expected: `aman`, lalu commit berhasil. File spec dan `.gitignore` v2 ikut terbawa ke branch arsip, dan itu tidak masalah.

- [ ] **Step 3: Push branch arsip**

Run: `git push -u origin arsip/v1`
Expected: branch `arsip/v1` muncul di GitHub.

- [ ] **Step 4: Kembali ke branch v2 dan hapus kode v1 dari index**

```bash
git switch feat/pusaka-v2
git rm -r -q --cached contracts web README.md
```
Expected: `git status --short` menampilkan baris `D ` untuk file-file v1.

- [ ] **Step 5: Pindahkan folder fisik v1 keluar repo**

```bash
mkdir -p ~/Skripsi/pusaka-v1
mv contracts web README.md ~/Skripsi/pusaka-v1/
```

- [ ] **Step 6: Verifikasi tidak ada yang hilang**

Run: `ls -a ~/Skripsi/pusaka-v1/web | grep -E '^\.env|^\.ipfs-lokal|^node_modules' ; ls ~/Skripsi/pusaka-v1/contracts/.env`
Expected: `.env.local`, `.ipfs-lokal`, `node_modules`, dan `contracts/.env` ada di lokasi baru.

- [ ] **Step 7: Commit penghapusan**

```bash
git commit -m "chore: keluarkan kode v1 (tersimpan di branch arsip/v1)"
```
Expected: `ls` di root repo hanya menyisakan `docs/` dan `.gitignore`.

---

### Task 2: Workspace Rust + crate `pusaka-api` minimal

**Files:**
- Create: `Cargo.toml`, `rust-toolchain.toml`, `crates/pusaka-api/Cargo.toml`, `crates/pusaka-api/src/lib.rs`, `crates/pusaka-api/src/main.rs`, `api/index.rs`
- Test: `crates/pusaka-api/tests/kesehatan.rs`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `pusaka_api::router() -> axum::Router`; rute `GET /api/kesehatan` → `200 {"layanan":"pusaka-api","versi":"0.1.0"}`; rute lain di bawah `/api/` → `404 {"kode":"TIDAK_DITEMUKAN","pesan":"Rute tidak ditemukan"}`. Rencana 04 menambahkan rute di router ini.

- [ ] **Step 1: Tulis manifest workspace dan toolchain**

`Cargo.toml`:
```toml
[workspace]
members = ["crates/pusaka-api"]
resolver = "3"

[workspace.package]
edition = "2024"
rust-version = "1.85"
license = "MIT"

[workspace.dependencies]
axum = "0.8"
tokio = { version = "1", features = ["macros", "rt-multi-thread", "net"] }
tower = { version = "0.5", features = ["util"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
http-body-util = "0.1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Paket root = fungsi Vercel. Vercel membangun setiap [[bin]] di sini menjadi satu function.
[package]
name = "pusaka-vercel"
version = "0.1.0"
edition.workspace = true
publish = false

[[bin]]
name = "index"
path = "api/index.rs"

[dependencies]
pusaka-api = { path = "crates/pusaka-api" }
vercel_runtime = { version = "2.4", features = ["axum"] }
tokio = { workspace = true }
tower = { workspace = true }

[profile.release]
codegen-units = 1
lto = "fat"
opt-level = 3
```

`rust-toolchain.toml`:
```toml
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy"]
```

`crates/pusaka-api/Cargo.toml`:
```toml
[package]
name = "pusaka-api"
version = "0.1.0"
edition.workspace = true
license.workspace = true
publish = false

[dependencies]
axum = { workspace = true }
tokio = { workspace = true }
serde = { workspace = true }
tracing = { workspace = true }
tracing-subscriber = { workspace = true }

[dev-dependencies]
tower = { workspace = true }
serde_json = { workspace = true }
http-body-util = { workspace = true }
```

Tambahkan ke `.gitignore` (setelah baris `.superpowers/`):
```
/target
```

- [ ] **Step 2: Tulis tes yang gagal**

`crates/pusaka-api/tests/kesehatan.rs`:
```rust
use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

async fn panggil(uri: &str) -> (StatusCode, Value) {
    let res = pusaka_api::router()
        .oneshot(Request::get(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap())
}

#[tokio::test]
async fn kesehatan_mengembalikan_nama_dan_versi() {
    let (status, body) = panggil("/api/kesehatan").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "layanan": "pusaka-api", "versi": "0.1.0" }));
}

#[tokio::test]
async fn rute_tidak_dikenal_404_json() {
    let (status, body) = panggil("/api/tidak-ada").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["kode"], "TIDAK_DITEMUKAN");
}
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `cargo test -p pusaka-api`
Expected: gagal kompilasi karena `src/lib.rs` belum ada.

- [ ] **Step 4: Implementasi router**

`crates/pusaka-api/src/lib.rs`:
```rust
//! Backend PUSAKA. Router yang sama dijalankan di Vercel (`api/index.rs`)
//! dan di laptop (`src/main.rs`).

use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;

#[derive(Serialize)]
struct Kesehatan {
    layanan: &'static str,
    versi: &'static str,
}

#[derive(Serialize)]
struct GalatJson {
    kode: &'static str,
    pesan: &'static str,
}

/// Semua rute HTTP PUSAKA.
pub fn router() -> Router {
    Router::new()
        .route("/api/kesehatan", get(kesehatan))
        .fallback(tidak_ditemukan)
}

async fn kesehatan() -> Json<Kesehatan> {
    Json(Kesehatan {
        layanan: "pusaka-api",
        versi: env!("CARGO_PKG_VERSION"),
    })
}

async fn tidak_ditemukan() -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        Json(GalatJson {
            kode: "TIDAK_DITEMUKAN",
            pesan: "Rute tidak ditemukan",
        }),
    )
}
```

`crates/pusaka-api/src/main.rs`:
```rust
//! Server lokal untuk pengembangan: `cargo run -p pusaka-api`.

use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();
    let alamat = std::env::var("PUSAKA_API_ALAMAT").unwrap_or_else(|_| "127.0.0.1:8787".into());
    let listener = tokio::net::TcpListener::bind(&alamat).await?;
    tracing::info!(%alamat, "pusaka-api berjalan");
    axum::serve(listener, pusaka_api::router()).await
}
```

`api/index.rs`:
```rust
//! Fungsi Vercel: membungkus router axum PUSAKA. Semua `/api/*` di-rewrite ke sini (vercel.json).

use tower::ServiceBuilder;
use vercel_runtime::Error;
use vercel_runtime::axum::VercelLayer;

#[tokio::main]
async fn main() -> Result<(), Error> {
    let app = ServiceBuilder::new()
        .layer(VercelLayer::new())
        .service(pusaka_api::router());
    vercel_runtime::run(app).await
}
```

- [ ] **Step 5: Jalankan tes, pastikan lulus, dan cek kualitas**

Run: `cargo test -p pusaka-api && cargo build --bin index && cargo fmt --check && cargo clippy --all-targets -- -D warnings`
Expected: 2 tes `ok`, binary `index` terbangun, fmt dan clippy tanpa keluaran galat.

- [ ] **Step 6: Coba server lokal**

Run: `(cargo run -q -p pusaka-api &) ; sleep 3; curl -s localhost:8787/api/kesehatan; pkill -f target/debug/pusaka-api`
Expected: `{"layanan":"pusaka-api","versi":"0.1.0"}`

- [ ] **Step 7: Commit**

```bash
git add Cargo.toml Cargo.lock rust-toolchain.toml .gitignore crates/pusaka-api api/index.rs
git commit -m "feat(api): workspace Rust dan router axum minimal untuk Vercel"
```

---

### Task 3: Kerangka web Astro

**Files:**
- Create: `web/package.json`, `web/astro.config.mjs`, `web/tsconfig.json`, `web/src/styles/global.css`, `web/src/pages/index.astro`, `web/.gitignore`
- Generated: `web/package-lock.json`

**Interfaces:**
- Consumes: `GET /api/kesehatan` dari Task 2.
- Produces: `npm --prefix web run build` → `web/dist/index.html`; dev server mem-proxy `/api` ke `127.0.0.1:8787`.

- [ ] **Step 1: Buat `web/package.json`**

```json
{
  "name": "pusaka-web",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check"
  },
  "dependencies": {
    "@astrojs/react": "^7.1.0",
    "astro": "^7.4.0",
    "react": "^19.3.1",
    "react-dom": "^19.3.1"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.10",
    "@tailwindcss/vite": "^4.3.3",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.9"
  }
}
```

- [ ] **Step 2: Konfigurasi Astro, TypeScript, dan CSS**

`web/astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  },
});
```

`web/tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strictest",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "react" }
}
```

`web/src/styles/global.css`:
```css
@import "tailwindcss";
```

`web/.gitignore`:
```
node_modules/
dist/
.astro/
```

- [ ] **Step 3: Halaman uji spike**

`web/src/pages/index.astro`:
```astro
---
import '../styles/global.css';
---
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PUSAKA v2</title>
  </head>
  <body class="min-h-dvh bg-neutral-950 text-neutral-100 grid place-items-center font-mono">
    <main class="text-center">
      <h1 class="text-2xl">PUSAKA v2 · kerangka</h1>
      <p id="status" class="mt-4 text-neutral-400">memanggil /api/kesehatan…</p>
    </main>
    <script>
      const el = document.getElementById('status')!;
      fetch('/api/kesehatan')
        .then((r) => r.json())
        .then((j: { layanan: string; versi: string }) => (el.textContent = `API Rust: ${j.layanan} ${j.versi}`))
        .catch(() => (el.textContent = 'API Rust tidak terjangkau'));
    </script>
  </body>
</html>
```

- [ ] **Step 4: Instal dan build**

Run: `npm --prefix web install && npm --prefix web run build && npm --prefix web run check`
Expected: `web/dist/index.html` ada; `astro check` melaporkan `0 errors`. Jika Astro 7 menolak salah satu opsi konfigurasi, baca `web/node_modules/astro/README.md` dan dokumentasi di `node_modules/astro/dist/` untuk nama opsi yang berlaku, perbaiki, lalu ulangi.

- [ ] **Step 5: Cek proxy lokal ke Rust**

Run (dua proses): `cargo run -q -p pusaka-api &` lalu `npm --prefix web run dev -- --port 4321 &`; tunggu 5 detik, lalu `curl -s localhost:4321/api/kesehatan`; hentikan keduanya (`pkill -f pusaka-api; pkill -f "astro dev"`).
Expected: `{"layanan":"pusaka-api","versi":"0.1.0"}`

- [ ] **Step 6: Pastikan lockfile ada**

Run: `test -f web/package-lock.json && echo ada`
Expected: `ada`

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "feat(web): kerangka Astro + React + Tailwind dengan proxy ke API Rust"
```

---

### Task 4: Spike deploy Vercel (gerbang keputusan)

**Files:**
- Create: `vercel.json`, `.vercelignore`

**Interfaces:**
- Consumes: binary `index` (Task 2), `web/dist` (Task 3).
- Produces: URL preview Vercel tempat `/` = halaman Astro dan `/api/kesehatan` = JSON dari Rust. **Hasilnya dilaporkan ke user sebelum rencana 02–04 dikerjakan.**

- [ ] **Step 1: Konfigurasi Vercel**

`vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "installCommand": "npm --prefix web ci",
  "buildCommand": "npm --prefix web run build",
  "outputDirectory": "web/dist",
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api/index" }]
}
```

`.vercelignore`:
```
target/**
web/node_modules/**
docs/**
.superpowers/**
```

- [ ] **Step 2: Login Vercel (dilakukan user)**

Minta user menjalankan di prompt Claude Code: `! npx vercel@latest login`
Expected: CLI melaporkan login berhasil.

- [ ] **Step 3: Tautkan proyek dan deploy preview**

```bash
npx vercel@latest link --yes --project pusaka
npx vercel@latest deploy 2>&1 | tee /tmp/pusaka-deploy.log
```
Expected: log diakhiri URL preview `https://pusaka-<hash>-<akun>.vercel.app`. Di log build harus ada tahap Rust (kompilasi `index`) dan tahap `npm run build`.

- [ ] **Step 4: Uji preview**

Preview Vercel bisa dilindungi "Vercel Authentication". Uji lewat CLI yang sudah login:
```bash
URL=$(grep -o 'https://pusaka-[^ ]*vercel.app' /tmp/pusaka-deploy.log | tail -1)
npx vercel@latest curl /api/kesehatan --deployment "$URL"
npx vercel@latest curl /api/tidak-ada --deployment "$URL"
npx vercel@latest curl / --deployment "$URL" | grep -o 'PUSAKA v2 · kerangka'
```
Expected: `{"layanan":"pusaka-api","versi":"0.1.0"}`, JSON `TIDAK_DITEMUKAN`, dan teks halaman Astro. Jika perintah `vercel curl` tidak tersedia di versi CLI, minta user membuka URL preview di peramban (sudah login Vercel) dan melihat teks "API Rust: pusaka-api 0.1.0".

- [ ] **Step 5: Gerbang keputusan**

- **Jika step 4 lulus:** commit, lalu laporkan ke user bahwa spike berhasil beserta URL preview.
- **Jika gagal** (fungsi Rust tidak terdeteksi, path tiba sebagai `/api/index`, atau build gagal): hentikan rencana, catat log galat persis, dan laporkan ke user dengan dua opsi: (a) perbaikan konfigurasi yang ditemukan, atau (b) cadangan di spec bagian 15, yaitu backend Rust via Docker di Vercel. **Jangan lanjut ke rencana 02–04 sebelum user memilih.**

- [ ] **Step 6: Commit**

```bash
git add vercel.json .vercelignore
git commit -m "chore: konfigurasi Vercel (Astro statis + fungsi Rust)"
```

---

### Task 5: CI, `.gitattributes`, dan README

**Files:**
- Create: `.github/workflows/ci.yml`, `.gitattributes`, `README.md`

**Interfaces:**
- Produces: workflow `ci` dengan job `rust` dan `web`. Rencana 02 menambah job `kontrak`, rencana 03 menambah langkah WASM.

- [ ] **Step 1: Workflow CI**

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:

jobs:
  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with: { components: "rustfmt, clippy" }
      - uses: Swatinem/rust-cache@v2
      - run: cargo fmt --all --check
      - run: cargo clippy --workspace --all-targets -- -D warnings
      - run: cargo test --workspace

  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm, cache-dependency-path: web/package-lock.json }
      - run: npm --prefix web ci
      - run: npm --prefix web run check
      - run: npm --prefix web run build
```

- [ ] **Step 2: `.gitattributes`**

```
# File hasil generate/vendor tidak dihitung di statistik bahasa GitHub
Cargo.lock                linguist-generated=true
web/package-lock.json     linguist-generated=true
abi/**                    linguist-generated=true
web/src/wasm/**           linguist-generated=true
contracts/lib/**          linguist-vendored=true
docs/**                   linguist-documentation=true
```

- [ ] **Step 3: README v2**

`README.md`:
````markdown
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
````

- [ ] **Step 4: Push dan pastikan CI hijau**

```bash
git add .github .gitattributes README.md
git commit -m "ci: workflow Rust + web, gitattributes linguist, README v2"
git push -u origin feat/pusaka-v2
gh run watch --exit-status $(gh run list --branch feat/pusaka-v2 --limit 1 --json databaseId -q '.[0].databaseId')
```
Expected: job `rust` dan `web` sukses.

- [ ] **Step 5: Buka PR**

```bash
gh pr create --base main --head feat/pusaka-v2 --title "PUSAKA v2: fondasi + spike Vercel" \
  --body "Rencana 01: arsip v1 ke branch arsip/v1, workspace Rust + router axum, kerangka Astro, konfigurasi Vercel (spike lulus), CI. Spec: docs/superpowers/specs/2026-10-16-pusaka-v2-design.md"
```
Expected: URL PR tercetak. Body PR tanpa atribusi AI.
