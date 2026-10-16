# PUSAKA v2 — Rencana 09: deploy Amoy + Vercel + domain

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PUSAKA berjalan di `https://pusaka.rahmateka.my.id` dengan kontrak di Polygon Amoy, dan GitHub menampilkan Rust sebagai bahasa terbesar.

**Architecture:** Skrip yang tidak pernah mencetak rahasia (`scripts/_env.sh` membaca nilai per kunci tanpa `source`, karena PEM Privy berisi spasi): `deploy-kontrak.sh` (forge script + pemeriksaan pemisahan tugas), `env-vercel.sh` (env produksi lewat stdin), `periksa-produksi.sh` (uji asap). Langkah yang butuh akun pemilik ada di `DEPLOY.md`.

**Spec:** `docs/superpowers/specs/2026-10-16-pusaka-v2-design.md` (12, 13 tahap 9)

## Global Constraints

- Rahasia hanya di `.env.local` dan env Vercel; `DEPLOYER_PK` tidak pernah ke Vercel.
- Operator ≠ penanda tangan (dicek skrip sebelum deploy, ditegakkan kontrak).
- `.gitattributes` menandai lockfile, ABI, binding WASM sebagai generated dan `contracts/lib` sebagai vendored.

## Review Focus

1. Nilai rahasia tidak muncul di keluaran skrip mana pun.
2. PEM berspasi di `.env.local` tidak merusak skrip.
3. Uji asap gagal jelas bila env Vercel belum lengkap (`/api/sesi` 503, bukan 401).

---

### Task 1: Skrip deploy dan uji asap — selesai di branch ini

- [x] `scripts/_env.sh`, `scripts/deploy-kontrak.sh`, `scripts/env-vercel.sh`, `scripts/periksa-produksi.sh` (shellcheck bersih).
- [x] Uji kering `deploy-kontrak.sh` terhadap Anvil port 8566 dengan berkas env berisi PEM berspasi → kontrak ter-deploy, `PENANDATANGAN_ROLE` terpasang; OPERATOR = PENANDATANGAN ditolak.
- [x] Uji `periksa-produksi.sh` terhadap server statis lokal + API tanpa env → lima ✓, `/api/sesi` ✕ 503 dengan pesan jelas.
- [x] `DEPLOY.md`, `.env.example` lengkap.

### Task 2: Akun dan kunci (pemilik proyek)

- [ ] Ikuti `DEPLOY.md` bagian 1; isi `.env.local`.

### Task 3: Kontrak Amoy

- [ ] `scripts/deploy-kontrak.sh` → isi alamat → commit `contracts/deployments/80002.json`.

### Task 4: Migrasi Neon + env Vercel + deploy production + domain

- [ ] `cargo run -p pusaka-api -- migrasi`; `scripts/env-vercel.sh`; merge PR #1–#9 ke `main` (Vercel production dari `main`) atau `npx vercel@latest deploy --prod`; `vercel domains add`; CNAME Cloudflare.

### Task 5: Uji asap + uji manual + statistik bahasa

- [ ] `scripts/periksa-produksi.sh https://pusaka.rahmateka.my.id` → semua ✓.
- [ ] Uji manual alur terbit di produksi (DEPLOY.md bagian 5).
- [ ] `gh api repos/rhmatzeka/PUSAKA/languages` → Rust terbesar (saat ini Rust ≈199 KB, TypeScript ≈112 KB, TSX ≈94 KB).
