# PUSAKA v2 — Rencana 07: `/alumni`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alumni yang masuk dengan email (wallet tertanam Privy dibuat dari email yang sama dengan draf) melihat ijazahnya, mencetak lembar QR berkunci, menyalin tautan, dan mengunduh PDF yang sidik jarinya sudah dicocokkan dengan blockchain.

**Architecture:** Kontrak ERC-721 tanpa enumerasi, jadi `GET /api/milik` (baru) memberi indeks token milik wallet pengguna dari Postgres; status setiap token tetap dibaca peramban dari kontrak (`ijazah(id)`). Kunci lewat `GET /api/kunci/{id}` (sudah membatasi pemilik/operator); PDF diunduh lewat `cekToken` yang sama dengan halaman publik.

**Tech Stack:** Rust axum + sqlx, Astro + React island, viem, WASM, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-pusaka-v2-design.md` (bagian 4 Alumni, 8.1 `/alumni`, 9 Alumni)

**Branch:** `feat/pusaka-v2-alumni` dari `feat/pusaka-v2-op`; PR ke `feat/pusaka-v2-op`.

## Global Constraints

- Status ijazah di layar alumni dibaca dari kontrak, bukan dari basis data.
- Daftar dari API tidak memuat kunci; kunci hanya lewat `/api/kunci/{id}`.
- PDF hanya diberikan bila Keccak-nya sama dengan `docHash` on-chain.

## Keputusan terhadap spec

1. **Endpoint tambahan `GET /api/milik`**: kontrak tidak menyediakan daftar token per pemilik, dan memindai event `Diterbitkan` di RPC publik Amoy dibatasi rentang blok. Indeks dari Postgres hanya dipakai untuk menemukan nomor token.

## Review Focus

1. Alumni hanya melihat ijazah miliknya (Rust `alumni_melihat_ijazah_miliknya_saja`).
2. Akun tanpa ijazah → daftar kosong dengan arahan, bukan galat (`pengguna_tanpa_ijazah_dapat_daftar_kosong`).
3. Ijazah dicabut tetap tampil dengan status `↓ Dicabut` dari kontrak.

---

### Task 1: `GET /api/milik`

- [ ] **Step 1: Tes yang gagal**

`crates/pusaka-api/tests/milik.rs`:

```rust
mod bantu;

use axum::http::StatusCode;
use bantu::*;
use serde_json::json;
use sqlx::PgPool;

#[sqlx::test(migrations = "../../migrations")]
async fn alumni_melihat_ijazah_miliknya_saja(pool: PgPool) {
    let u = siapkan(pool);
    let milik = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    terbitkan(&u, &milik, 1).await;
    let lain = buat_draf(&u, contoh_draf(2, "orang.lain@unpam.ac.id")).await;
    terbitkan(&u, &lain, 2).await;
    buat_draf(&u, contoh_draf(3, EMAIL_ALUMNI)).await; // belum terbit: tidak ikut

    let (s, b) = panggil(&u.app, "GET", "/api/milik", Some(&token(DID_ALUMNI)), None).await;
    assert_eq!(s, StatusCode::OK, "{b}");
    assert_eq!(
        b,
        json!({ "data": [{
            "token_id": 1, "status": "TERBIT", "nama": "Lulusan 1", "nomor_ijazah": "UNPAM/2027/0001",
            "prodi": "Teknik Informatika", "gelar": "S.Kom.", "tanggal_lulus": "2027-08-30"
        }] })
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn pengguna_tanpa_ijazah_dapat_daftar_kosong(pool: PgPool) {
    let u = siapkan(pool);
    let (s, b) = panggil(&u.app, "GET", "/api/milik", Some(&token(DID_TAMU)), None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(b, json!({ "data": [] }));
    let (s, _) = panggil(&u.app, "GET", "/api/milik", None, None).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
}
```

Run: `eval "$(scripts/db-uji.sh)" && cargo test -p pusaka-api --test milik` → Expected: FAIL (404).

- [ ] **Step 2: Implementasi**

`crates/pusaka-api/src/rute/milik.rs`:

```rust
use axum::Json;
use axum::extract::State;
use pusaka_core::heks::ke_hex;
use serde_json::{Value, json};

use crate::auth::Pengguna;
use crate::db;
use crate::galat::Galat;
use crate::negara::Negara;

/// `GET /api/milik`: ijazah tercatat milik wallet pengguna (tanpa kunci; kunci lewat `/api/kunci`).
/// Status di sini hanya indeks; halaman alumni tetap membaca status dari kontrak.
pub async fn daftar(State(n): State<Negara>, p: Pengguna) -> Result<Json<Value>, Galat> {
    let wallet: Vec<String> = p.wallet.iter().map(|w| ke_hex(w)).collect();
    let data: Vec<Value> = db::ijazah_milik(&n.db, &wallet)
        .await?
        .into_iter()
        .map(|d| {
            json!({
                "token_id": d.token_id,
                "status": d.status,
                "nama": d.nama,
                "nomor_ijazah": d.nomor_ijazah,
                "prodi": d.prodi,
                "gelar": d.gelar,
                "tanggal_lulus": d.tanggal_lulus,
            })
        })
        .collect();
    Ok(Json(json!({ "data": data })))
}
```

Perubahan `db.rs`, `rute/mod.rs`, klien web, dan E2E (lihat diff di Task 2):

```diff
diff --git a/crates/pusaka-api/src/db.rs b/crates/pusaka-api/src/db.rs
index 685670e..c4cd107 100644
--- a/crates/pusaka-api/src/db.rs
+++ b/crates/pusaka-api/src/db.rs
@@ -545,3 +545,14 @@ pub async fn selesaikan_cabut(
         .await?;
     Ok(true)
 }
+
+/// Ijazah yang sudah tercatat (TERBIT/DICABUT) milik salah satu wallet pengguna.
+pub async fn ijazah_milik(db: &PgPool, wallet: &[String]) -> Result<Vec<BarisDraf>, Galat> {
+    Ok(sqlx::query_as(concat!(
+        pilih_draf!(),
+        "where d.penerima = any($1) and d.token_id is not null order by d.token_id"
+    ))
+    .bind(wallet)
+    .fetch_all(db)
+    .await?)
+}
diff --git a/crates/pusaka-api/src/rute/mod.rs b/crates/pusaka-api/src/rute/mod.rs
index 17bb37f..c3215a9 100644
--- a/crates/pusaka-api/src/rute/mod.rs
+++ b/crates/pusaka-api/src/rute/mod.rs
@@ -4,6 +4,7 @@ pub mod cabut;
 pub mod draf;
 pub mod ipfs;
 pub mod kunci;
+pub mod milik;
 pub mod sesi;
 pub mod terbit;
 pub mod ttd;
@@ -27,4 +28,5 @@ pub fn semua() -> Router<Negara> {
         .route("/api/cabut/{id}/setujui", post(cabut::setujui))
         .route("/api/cabut/{id}/selesai", post(cabut::selesai))
         .route("/api/kunci/{token_id}", get(kunci::ambil))
+        .route("/api/milik", get(milik::daftar))
 }
diff --git a/web/e2e/op.spec.ts b/web/e2e/op.spec.ts
index da8f215..b0a659f 100644
--- a/web/e2e/op.spec.ts
+++ b/web/e2e/op.spec.ts
@@ -7,7 +7,7 @@ const DATA = new URL('./.data/', import.meta.url).pathname;
 // Alur berurutan: tiap tes melanjutkan keadaan tes sebelumnya (satu Anvil + satu basis data).
 test.describe.configure({ mode: 'serial' });
 
-async function masukSebagai(page: Page, label: 'Operator BAAK' | 'Rektor', ke: '/op' | '/meja') {
+async function masukSebagai(page: Page, label: 'Operator BAAK' | 'Rektor' | 'Alumni', ke: '/op' | '/meja' | '/alumni') {
   await page.goto(`/masuk/?ke=${ke}`);
   await page.getByRole('button', { name: `Masuk sebagai ${label}` }).click();
   await expect(page).toHaveURL(new RegExp(`${ke}/?$`));
@@ -143,3 +143,18 @@ test('pencabutan: operator meminta, Rektor menandatangani, operator mengirim ke
   await page.goto(tautanSiti);
   await expect(page.getByTestId('status')).toHaveText('↓ Dicabut');
 });
+
+test('alumni melihat ijazahnya, mencetak QR, dan mengunduh PDF', async ({ page }) => {
+  await masukSebagai(page, 'Alumni', '/alumni');
+  const kartu = page.getByTestId('ijazah-alumni');
+  await expect(kartu).toHaveCount(1);
+  await expect(kartu).toContainText('Agus Pratama');
+  await expect(kartu.getByTestId('status')).toHaveText('↑ Asli · tercatat');
+  await kartu.getByRole('button', { name: 'Lembar QR' }).click();
+  await expect(page.getByTestId('tautan-qr')).toHaveText(/\/i\/\d+#k=[A-Za-z0-9_-]{43}$/);
+  await page.getByRole('button', { name: 'Tutup' }).click();
+  const unduhan = page.waitForEvent('download');
+  await kartu.getByRole('button', { name: 'Unduh PDF' }).click();
+  expect((await unduhan).suggestedFilename()).toBe('ijazah-UNPAM-2026-0011.pdf');
+  await expect(page.getByTestId('kabar')).toHaveText(/sidik jari cocok/);
+});
diff --git a/web/src/lib/api.ts b/web/src/lib/api.ts
index 3695cac..778e921 100644
--- a/web/src/lib/api.ts
+++ b/web/src/lib/api.ts
@@ -96,6 +96,16 @@ export class GalatApi extends Error {
   }
 }
 
+export interface IjazahMilik {
+  token_id: number;
+  status: StatusDraf;
+  nama: string;
+  nomor_ijazah: string;
+  prodi: string;
+  gelar: string;
+  tanggal_lulus: string;
+}
+
 export interface KueriDraf {
   status?: StatusDraf;
   cari?: string;
@@ -117,6 +127,7 @@ export interface Api {
   setujuiCabut(id: string, sig: Hex, batasWaktu: bigint): Promise<{ id: string; status: StatusCabut }>;
   selesaiCabut(id: string, txHash: Hex): Promise<{ id: string; status: StatusCabut }>;
   kunci(tokenId: number): Promise<{ token_id: number; status: StatusDraf; kunci: Hex }>;
+  milik(): Promise<{ data: IjazahMilik[] }>;
 }
 
 export function buatApi(token: () => Promise<string>, dasar = ''): Api {
@@ -168,5 +179,6 @@ export function buatApi(token: () => Promise<string>, dasar = ''): Api {
       json('POST', `/api/cabut/${encodeURIComponent(id)}/setujui`, { sig, batas_waktu: Number(batasWaktu) }),
     selesaiCabut: (id, txHash) => json('POST', `/api/cabut/${encodeURIComponent(id)}/selesai`, { tx_hash: txHash }),
     kunci: (tokenId) => minta('GET', `/api/kunci/${tokenId}`),
+    milik: () => minta('GET', '/api/milik'),
   };
 }
diff --git a/web/tests/api.test.ts b/web/tests/api.test.ts
index c219e54..051ff2b 100644
--- a/web/tests/api.test.ts
+++ b/web/tests/api.test.ts
@@ -79,3 +79,8 @@ test('galat API menjadi GalatApi dengan kode dan pesan dari server', async () =>
 test('galat tanpa JSON tetap terbaca', async () => {
   await expect(api().kunci(9)).rejects.toMatchObject({ status: 502, kode: 'GALAT', message: 'Server menjawab 502' });
 });
+
+test('daftar ijazah milik pengguna', async () => {
+  await api().milik();
+  expect(diterima.at(-1)).toMatchObject({ metode: 'GET', url: '/api/milik' });
+});
```

Run: `cargo test -p pusaka-api --test milik && cargo clippy --workspace --all-targets -- -D warnings` → Expected: 2 lulus, clippy bersih.

`git commit -m "feat(api): GET /api/milik daftar ijazah tercatat milik wallet pengguna"`

---

### Task 2: Halaman `/alumni`

`web/src/islands/Alumni.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import BarisBukti from '../components/BarisBukti';
import Kerangka from '../components/Kerangka';
import LembarQr from '../components/LembarQr';
import Segel from '../components/Segel';
import type { IjazahMilik } from '../lib/api';
import { tanggal } from '../lib/format';
import type { Ijazah } from '../lib/jenis';
import { kunciDariFragmen } from '../lib/kunci';
import { buatSumber, type SumberRantai } from '../lib/sumber';
import { STATUS } from '../lib/tampilan';
import { tautanBerkunci } from '../lib/tautan';
import { cekToken, statusIjazah } from '../lib/verifikasi';
import PenyediaSesi from './sesi/PenyediaSesi';
import Penjaga, { useAplikasi } from './sesi/Penjaga';

const DOK_ALUMNI = [
  { href: '/alumni', ikon: '⬢', label: 'Ijazah saya' },
  { href: '/periksa', ikon: '⌕', label: 'Periksa ijazah' },
];

interface Kartu {
  milik: IjazahMilik;
  /** Status dibaca dari kontrak; `null` bila belum terbaca. */
  rantai: Ijazah | null;
}

function Isi() {
  const { api, info, sesi, j } = useAplikasi();
  const [kartu, setKartu] = useState<Kartu[] | null>(null);
  const [kabar, setKabar] = useState<{ teks: string; nada?: 'ok' | 'bad' } | null>(null);
  const [qr, setQr] = useState<{ tautan: string; nama: string; nomor: string } | null>(null);
  const [sumber, setSumber] = useState<SumberRantai | null>(null);

  const muat = useCallback(async () => {
    const s = await buatSumber(j);
    setSumber(s);
    const { data } = await api.milik();
    setKartu(await Promise.all(data.map(async (m) => ({ milik: m, rantai: await s.ijazah(BigInt(m.token_id)) }))));
  }, [api, j]);

  useEffect(() => {
    void muat().catch((e: unknown) => {
      setKartu([]);
      setKabar({ teks: e instanceof Error ? e.message : String(e), nada: 'bad' });
    });
  }, [muat]);

  async function tautan(m: IjazahMilik): Promise<string> {
    const { kunci } = await api.kunci(m.token_id);
    return tautanBerkunci(location.origin, m.token_id, kunci);
  }

  const gagal = (e: unknown) => setKabar({ teks: e instanceof Error ? e.message : String(e), nada: 'bad' });

  async function unduh(m: IjazahMilik) {
    if (!sumber) return;
    const t = await tautan(m);
    const h = await cekToken(BigInt(m.token_id), kunciDariFragmen(new URL(t).hash), sumber);
    if (h.jenis !== 'lengkap') throw new Error('Berkas ijazah tidak cocok dengan catatan blockchain. Hubungi BAAK.');
    const url = URL.createObjectURL(new Blob([h.pdf.slice()], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ijazah-${m.nomor_ijazah.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setKabar({ teks: 'PDF diunduh (sidik jari cocok dengan blockchain)', nada: 'ok' });
  }

  return (
    <Kerangka
      peran="Pusaka Alumni"
      kode="PSK-AL"
      status="Ijazah saya"
      wallet={info.wallet[0]}
      dok={DOK_ALUMNI}
      keluar={() => void sesi.keluar().then(() => location.assign('/masuk'))}
    >
      <section style={{ maxWidth: 720, margin: '18px auto 0' }} aria-live="polite">
        {kartu === null && <p className="catatan">Membaca ijazah dari blockchain…</p>}
        {kartu?.length === 0 && !kabar && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 200, margin: '0 auto' }}>
              <Segel nada="diam" />
            </div>
            <h1 className="judul">Belum ada ijazah di akun ini</h1>
            <p className="catatan" style={{ marginInline: 'auto' }}>
              Ijazah muncul di sini setelah BAAK mencatatnya ke blockchain dengan email yang sama dengan akun ini.
            </p>
          </div>
        )}
        {kartu?.map(({ milik: m, rantai }) => {
          const t = rantai ? STATUS[statusIjazah(rantai)] : STATUS.TIDAK_ADA;
          return (
            <article key={m.token_id} data-testid="ijazah-alumni" style={{ marginTop: 18 }}>
              <div className="baris-hud">
                <div className="hud">
                  PSK-{m.token_id}
                  <b data-nada={t.nada} data-testid="status">
                    {t.simbol} {t.kata}
                  </b>
                </div>
                <div className="hud" style={{ textAlign: 'right' }}>
                  Terbit<b>{rantai ? tanggal(rantai.waktuTerbit) : '—'}</b>
                </div>
              </div>
              <h1 className="judul">{m.nama}</h1>
              <p className="sub">
                {m.gelar} · {m.prodi} · {m.nomor_ijazah}
              </p>
              {rantai && statusIjazah(rantai) === 'DICABUT' && (
                <BarisBukti bukti={[{ ikon: '⛓', nama: 'Status di blockchain', ket: `↓ Dicabut ${tanggal(rantai.waktuCabut)}`, nada: 'bad' }]} />
              )}
              <div className="aksi">
                <button type="button" className="br" data-utama onClick={() => void tautan(m).then((x) => location.assign(x)).catch(gagal)}>
                  Buka halaman ijazah
                </button>
                <button
                  type="button"
                  className="br"
                  onClick={() => void tautan(m).then((x) => setQr({ tautan: x, nama: m.nama, nomor: m.nomor_ijazah })).catch(gagal)}
                >
                  Lembar QR
                </button>
                <button
                  type="button"
                  className="br"
                  onClick={() =>
                    void tautan(m)
                      .then((x) => navigator.clipboard?.writeText(x))
                      .then(() => setKabar({ teks: 'Tautan berkunci disalin. Bagikan hanya ke pihak yang perlu memeriksa.', nada: 'ok' }))
                      .catch(gagal)
                  }
                >
                  Salin tautan berkunci
                </button>
                <button type="button" className="br" onClick={() => void unduh(m).catch(gagal)}>
                  Unduh PDF
                </button>
              </div>
            </article>
          );
        })}
        {kabar && (
          <p className="catatan" data-testid="kabar" data-nada={kabar.nada}>
            {kabar.teks}
          </p>
        )}
      </section>
      {qr && <LembarQr {...qr} tutup={() => setQr(null)} />}
    </Kerangka>
  );
}

export default function Alumni() {
  return (
    <PenyediaSesi>
      <Penjaga perlu="masuk">
        <Isi />
      </Penjaga>
    </PenyediaSesi>
  );
}
```

`web/src/pages/alumni.astro`:

```astro
---
import Alumni from '../islands/Alumni';
import Ruang from '../layouts/Ruang.astro';
---

<Ruang judul="Ijazah saya" deskripsi="Ijazah digital alumni Universitas Pamulang: tautan berkunci, lembar QR, dan PDF." tanpaReferer>
  <Alumni client:only="react" />
</Ruang>
```

- [ ] Run: `npm --prefix web test && npm --prefix web run check && npm --prefix web run e2e` → Expected: unit lulus, 0 galat, E2E 24/24 (alumni: kartu Agus Pratama `↑ Asli · tercatat`, lembar QR berkunci, unduh `ijazah-UNPAM-2026-0011.pdf`).

`git commit -m "feat(web): halaman /alumni (ijazah milik, lembar QR, salin tautan berkunci, unduh PDF terverifikasi)"`

---

### Task 3: Dokumentasi, preview, PR

- [ ] Spec 7.2: tambah baris `| GET /api/milik | login | ijazah tercatat milik wallet pengguna (indeks; status dari kontrak) |`. Peta jalan baris 07 → ✅.
- [ ] Push, preview Vercel (`/alumni/`), `gh pr create --base feat/pusaka-v2-op`.
