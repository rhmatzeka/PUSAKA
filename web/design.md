# Design — PUSAKA

Sistem desain terkunci untuk aplikasi register ijazah digital UNPAM. Setiap redesign halaman
membaca berkas ini lebih dulu. Jangan bikin sistem baru per halaman; perluas atau ubah berkas ini
kalau sistemnya memang perlu tumbuh.

## Genre

editorial — varian Swiss/systems. Ini dokumen resmi kampus, bukan produk SaaS: struktur dibawa
grid dan garis, bukan kartu dan bayangan.

## Macrostructure family

- **Halaman pemasaran** (`/`): Narrative Workflow — tiga tahap ordinal (1.0 terbit · 2.0 bagikan ·
  3.0 periksa). Boleh divariasikan: figur konstruksi di hero, isi tahap.
- **Halaman kerja** (`/verify`, `/alumni`, `/admin/*`): Index-First — baris bergaris, tanpa kartu.
  Variasi: jumlah jalur masuk, isi kolom tabel.
- **Halaman rekaman** (`/verify/[tokenId]`): Long Document — hasil verifikasi diperlakukan sebagai
  dokumen: stempel status, daftar rekaman, QR di kolom margin.

## Theme — Grid (Swiss neo-grotesque), signal ultramarine

- `--color-paper` oklch(99% 0.003 255)
- `--color-paper-2` oklch(97.2% 0.004 255)
- `--color-paper-3` oklch(94.5% 0.005 255)
- `--color-ink` oklch(16% 0.01 255)
- `--color-ink-2` oklch(38% 0.012 255)
- `--color-muted` oklch(52% 0.012 255)
- `--color-rule` oklch(88% 0.006 255)
- `--color-signal` oklch(45% 0.19 264)
- `--color-focus` oklch(45% 0.19 264)

Axes: paper **light** · display **grotesk-heavy lowercase** · accent **cool (ultramarine)**.

### Penyimpangan tercatat: palet status

Tema Grid mensyaratkan satu tinta sinyal per halaman. Aplikasi ini butuh tiga status yang tidak
boleh tertukar, jadi ditambahkan `--color-state-valid` (ultramarine), `--color-state-revoked`
(oklch 52% 0.13 75), `--color-state-invalid` (oklch 47% 0.2 27). Aturannya: **status tidak pernah
dibawa warna saja** — selalu kata + geometri (■ ▲ ✕) + warna, supaya tetap terbaca bagi pengguna
dengan buta warna dan saat dicetak hitam-putih.

## Typography

- Display: Archivo 800, **huruf kecil**, tracking −0.045em, line-height 0.9
- Body: Archivo 400, 17px, line-height 1.5
- Label: Archivo 600, 12px, kapital, tracking 0.09em
- Outlier: Geist Mono — **hanya** untuk data mesin (hash, alamat wallet, chain, kolofon)
- Skala display: `clamp(2.5rem, 7.4vw, 6.25rem)`; heading kedua `clamp(1.875rem, 4.2vw, 3.25rem)`
- Header selalu roman. Tidak ada header miring.

## Spacing

Skala 4pt bernama di `tokens.css` (`--space-3xs` … `--space-4xl`). Halaman memakai nama token,
bukan nilai mentah. Band besar bernapas di `--space-3xl`, band ringkas di `--space-xl`.

## Motion

- Easing: `--ease-out` cubic-bezier(0.16, 1, 0.3, 1), `--ease-in`, `--ease-in-out`
- Hanya hover micro-state 190ms dan tekan `translateY(1px)`. **Tidak ada scroll reveal, tidak ada
  parallax, tidak ada animasi masuk.**
- `prefers-reduced-motion`: semua transisi turun ke 150ms.
- Cincin fokus muncul seketika, tidak dianimasikan.

## Microinteractions

- Sukses ditampilkan diam-diam di tempat kejadian; tidak ada toast perayaan.
- Area unggah berubah warna garis saat berkas diseret ke atasnya.
- Tabel register memakai hover baris, bukan tombol melayang.

## CTA voice

- Primer `.act`: isi ultramarine, sudut nol, teks 600, label pendek ("Periksa ijazah").
- Sekunder `.act-line`: garis 1px tinta, sudut nol.
- Tersier `.act-text`: tautan bergaris bawah tebal, dipakai untuk aksi di dalam dokumen.
- Label CTA tidak pernah pecah dua baris (`white-space: nowrap`).

## Per-page allowances

- Halaman pemasaran boleh memakai **plate** (satu band tinta penuh) dan figur konstruksi.
- Halaman kerja **tidak boleh** memakai plate maupun enrichment; fungsi yang membawa halaman.
- Halaman rekaman: tipografi, rule, dan QR saja.

## Yang WAJIB sama di semua halaman

Wordmark `pusaka` + kotak sinyal, grid 12 kolom yang terlihat, hairline sebagai pemisah, palet dan
tinta sinyal, pasangan huruf, suara CTA, masthead N6, kolofon Ft4.

## Yang BOLEH berbeda

Macrostructure di dalam familinya, jumlah kolom yang ditempati, figur konstruksi per halaman,
urutan bagian.

## Larangan khusus proyek ini

Kartu dengan bayangan, sudut membulat, gradien, ikon emoji sebagai penanda fitur, chrome peramban
tiruan, angka atau testimoni karangan, dan eyebrow bernomor di luar tiga tahap ordinal di beranda.

## Exports

### tokens.css

Berkas `tokens.css` di akar proyek adalah sumbernya; `app/globals.css` mengimpornya lalu
memetakan ke `@theme inline` milik Tailwind v4. Salin berkas itu untuk memindahkan sistem ini.
