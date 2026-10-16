# PUSAKA v2 — Desain

Tanggal: 16 Oktober 2026
Status: menunggu tinjauan
Repo: `rhmatzeka/PUSAKA`

## 1. Tujuan

Membangun ulang PUSAKA (sistem verifikasi ijazah digital UNPAM) supaya:

1. **Kuat saat sidang.** Setiap komponen judul (ERC-721, IPFS, Keccak-256, ECDSA) punya peran yang tidak bisa dipertanyakan. Khususnya tanda tangan ECDSA: di v1 pengirim transaksi harus sama dengan penanda tangan, sehingga tanda tangannya redundan.
2. **Bisa diperiksa tanpa percaya server PUSAKA.** Verifikator membaca langsung dari blockchain.
3. **Menjaga data pribadi.** PDF ijazah, nama, dan NIM tidak lagi terbuka di IPFS publik.
4. **Ramah alumni awam.** Alumni tidak wajib paham kripto atau punya MetaMask.
5. **Kualitas kode setinggi mungkin**, dengan backend Rust yang berjalan di Vercel.
6. **Tampilan yang tidak terasa template.** Beranda mengikuti koreografi scroll quantumwallet.tech; halaman dalam memadukan aplikasi pendamping Quantum Wallet dan jendela perintah Raycast.

Judul skripsi tidak berubah. Proposal BAB III disesuaikan dengan alur baru di akhir pengerjaan (bagian 13).

## 2. Keputusan yang sudah disepakati

| Topik | Keputusan |
|---|---|
| Batas perubahan | Alur boleh dirancang ulang; BAB III proposal ikut disesuaikan, tetap ≤ 20 halaman |
| Penanda tangan | 1 pejabat (Rektor) menandatangani; operator BAAK mengirim transaksi |
| Privasi | PDF + data pribadi dienkripsi AES-256-GCM di peramban; kunci di bagian `#` tautan/QR |
| Wallet alumni | Privy membuat wallet tertanam dari email alumni; ijazah dicetak ke wallet itu |
| Tampilan lama | Dibuang; disimpan dulu di branch `arsip/v1` |
| Arsitektur | Satu proyek Vercel: frontend statis + fungsi Rust + Postgres |
| Frontend | Astro + React islands + TypeScript |
| Masuk | Privy dengan UI kustom dua panel (lihat 8.3) |
| Beranda | Koreografi scroll quantumwallet.tech, aset dan teks buatan sendiri |
| Halaman dalam | Aplikasi pendamping Quantum Wallet × jendela perintah Raycast |
| GitHub | Logika kripto bersama ditulis di Rust (native + WASM); file hasil generate ditandai `linguist-generated` |

## 3. Arsitektur

```
Peramban
 ├─ Astro (HTML statis) + React islands
 ├─ pusaka-core.wasm  (Keccak-256, AES-GCM, EIP-712, CSV)
 ├─ viem              (baca kontrak lewat RPC publik)
 └─ Privy SDK         (masuk, wallet, tanda tangan EIP-712)
        │ HTTPS (Bearer token Privy)
        ▼
Vercel function: api/index.rs → router axum (crate pusaka-api)
 ├─ Postgres (Neon)   antrean draf, tanda tangan, kunci terenkripsi, audit
 ├─ Privy REST API    buat wallet alumni, baca wallet milik pengguna
 ├─ Pinata            unggah ke IPFS
 └─ RPC Polygon       cek peran, baca receipt transaksi
        │
        ▼
Smart contract PusakaIjazah (Polygon Amoy)
```

**Prinsip:**
- Kebenaran status ijazah hanya ada di kontrak. Postgres hanya menyimpan pekerjaan yang belum on-chain (draf, tanda tangan, kunci).
- Verifikasi publik tidak melewati backend.
- Logika kripto ditulis sekali di `pusaka-core` dan dipakai di peramban (WASM) maupun server (native), sehingga hasilnya tidak mungkin berbeda.

## 4. Peran dan aktor

| Aktor | Identitas | Peran on-chain | Kerja utama |
|---|---|---|---|
| Admin rektorat | wallet Privy/MetaMask | `DEFAULT_ADMIN_ROLE` | Memberi/mencabut peran |
| Operator BAAK | wallet Privy/MetaMask | `OPERATOR_ROLE` | Unggah draf, kirim transaksi terbit/cabut |
| Pejabat (Rektor) | wallet Privy/MetaMask | `PENANDATANGAN_ROLE` | Tanda tangan EIP-712 atas draf dan pencabutan |
| Alumni | email/Google via Privy (wallet tertanam) | — (pemilik token) | Melihat ijazah, membagikan tautan berkunci |
| Verifikator | tanpa akun | — | Memeriksa ijazah |

## 5. Smart contract `PusakaIjazah`

Solidity 0.8.28, Foundry, OpenZeppelin Contracts 5 (`ERC721`, `AccessControl`, `EIP712`, `ECDSA`).

### 5.1 Data

```solidity
struct Penerbitan { address penerima; bytes32 docHash; bytes32 metadataHash; uint64 batasWaktu; }
struct Pencabutan { uint256 tokenId; bytes32 alasanHash; uint64 batasWaktu; }

struct Ijazah {
    bytes32 docHash;        // Keccak-256 PDF asli (sebelum enkripsi)
    address penandaTangan;  // pejabat yang menandatangani
    uint64  waktuTerbit;
    uint64  waktuCabut;     // 0 = tidak dicabut
}
```

- EIP-712 domain: `name = "PUSAKA"`, `version = "2"`, `chainId`, `verifyingContract`.
- `metadataHash = keccak256(bytes(uri))`: pejabat ikut menandatangani alamat metadata yang persis akan dicatat.
- `alasanHash = keccak256(bytes(alasan))`.

### 5.2 Fungsi

| Fungsi | Akses | Aturan |
|---|---|---|
| `terbitkan(Penerbitan p, bytes sig, string uri)` | `OPERATOR_ROLE` | `block.timestamp <= p.batasWaktu`; `keccak256(bytes(uri)) == p.metadataHash`; penanda tangan hasil `ECDSA.recover(_hashTypedDataV4(...))` memegang `PENANDATANGAN_ROLE`; `docHash` belum pernah terbit. Mint token ke `p.penerima`, simpan `Ijazah`, emit `Diterbitkan` dan `Locked` |
| `terbitkanBatch(Penerbitan[] p, bytes[] sig, string[] uri)` | `OPERATOR_ROLE` | sama, untuk banyak ijazah; panjang array wajib sama; maks 50 |
| `cabut(Pencabutan c, bytes sig, string alasan)` | `OPERATOR_ROLE` | tanda tangan sah dari `PENANDATANGAN_ROLE`; token ada; belum dicabut; batas waktu belum lewat. Isi `waktuCabut`, emit `Dicabut` |
| `periksa(bytes32 docHash) view` | publik | mengembalikan `(Status status, uint256 tokenId, Ijazah data)`; `Status { TIDAK_ADA, VALID, DICABUT }` |
| `ijazah(uint256 tokenId) view` | publik | data satu token (revert jika tidak ada) |
| `daftar(uint256 mulai, uint256 jumlah) view` | publik | halaman data untuk Buku Induk; `jumlah` maks 100 |
| `totalTerbit() view` | publik | jumlah token pernah dicetak |
| `locked(uint256) view` | publik | selalu `true` (ERC-5192) |

- **Soulbound:** `_update` menolak semua perpindahan selain mint. `supportsInterface` melaporkan ERC-721 dan ERC-5192 (`0xb45a3c0e`).
- **Pemisahan tugas ditegakkan di kontrak:** penanda tangan EIP-712 tidak boleh sama dengan pengirim transaksi (`PemisahanTugasDilanggar`), sehingga satu wallet yang memegang dua peran tetap tidak bisa menerbitkan atau mencabut sendirian. Admin (`DEFAULT_ADMIN_ROLE`) tetap pihak tepercaya yang membagikan peran; asumsi ini ditulis terbuka di skripsi.
- **Ijazah tetap sah walau peran pejabatnya dicabut.** `periksa` tidak mengecek peran penanda tangan saat ini, sama seperti ijazah kertas yang tetap sah setelah rektornya berganti. Peran hanya dicek saat terbit dan saat cabut.
- **Error:** `HashSudahTerbit`, `PenandaTanganTidakBerwenang`, `TandaTanganKedaluwarsa`, `MetadataTidakCocok`, `IjazahTidakAda`, `SudahDicabut`, `TidakDapatDipindahtangankan`, `PanjangTidakSama`, `BatchTerlaluBesar`, `PemisahanTugasDilanggar`, `AlasanTidakCocok`, `HashKosong`.
- **Event:** `Diterbitkan(uint256 indexed tokenId, address indexed penerima, bytes32 indexed docHash, address penandaTangan)`, `Dicabut(uint256 indexed tokenId, string alasan)`, `Locked(uint256 tokenId)`.

### 5.3 Tes Foundry

- **Unit:** setiap aturan dan error di 5.2, termasuk peran pejabat dicabut setelah terbit.
- **Fuzz:** `docHash` acak, kunci penanda tangan acak (harus ditolak kecuali berperan), `batasWaktu` di sekitar `block.timestamp`, panjang batch.
- **Invariant:** pemilik token tidak pernah berubah setelah mint; satu `docHash` hanya punya satu token; `totalTerbit` tidak pernah turun.
- **Gas:** `forge test --gas-report` dan skrip ukur untuk batch 1, 10, 25, dan 50 (data BAB IV).

## 6. Format data

### 6.1 Amplop terenkripsi (berkas di IPFS)

```
byte 0       versi = 0x01
byte 1..12   nonce AES-GCM (96 bit, acak)
byte 13..    ciphertext + tag (128 bit) dari:
               u32 big-endian panjang header
               header JSON UTF-8: {"nama","nim","prodi","gelar","nomor_ijazah","tanggal_lulus"}
               byte PDF asli
```

- **AAD:** byte versi diikat sebagai *additional authenticated data* AES-GCM, sehingga versi tidak bisa ditukar tanpa ketahuan.
- **Nonce:** wajib acak 12 byte (`crypto.getRandomValues`); pasangan kunci+nonce tidak boleh dipakai ulang.
- **Kunci:** 32 byte acak per ijazah, dibuat di peramban operator. Kunci dikirim di tautan sebagai base64url di fragmen: `/i/{tokenId}#k={kunci}`.
- **Pemeriksaan berlapis:** setelah dekripsi, peramban menghitung Keccak-256 PDF hasil dekripsi dan wajib sama dengan `docHash` on-chain. Ini membuktikan berkas di IPFS tidak ditukar.

### 6.2 Metadata publik (`tokenURI`, ERC-721)

```json
{
  "name": "Ijazah Universitas Pamulang",
  "description": "Ijazah digital PUSAKA. Data lulusan terenkripsi; periksa di pusaka.rahmateka.my.id/i/<tokenId>",
  "image": "ipfs://<CID gambar segel statis>",
  "attributes": [{ "trait_type": "Institusi", "value": "Universitas Pamulang" }],
  "pusaka": { "versi": 2, "berkas": "ipfs://<CID amplop>", "doc_keccak256": "0x…", "enkripsi": "AES-256-GCM" }
}
```

Metadata publik tidak berisi data pribadi apa pun.

## 7. Rust

### 7.1 `crates/pusaka-core` (tanpa I/O; native + `wasm32-unknown-unknown`)

| Modul | Isi |
|---|---|
| `hash` | `keccak256(&[u8]) -> [u8;32]` (crate `tiny-keccak`) |
| `amplop` | `segel(kunci, header, pdf) -> Vec<u8>`, `buka(kunci, bytes) -> (Header, Vec<u8>)`; error bertipe untuk versi salah, tag gagal, header rusak |
| `eip712` | `hash_penerbitan(domain, &Penerbitan)`, `hash_pencabutan(...)`; harus identik dengan `_hashTypedDataV4` |
| `csv` | parser CSV lulusan (kolom `nama,nim,prodi,gelar,nomor_ijazah,tanggal_lulus,email,file_pdf`), mendukung tanda kutip; laporan error per baris |
| `wasm` (fitur `wasm`) | ekspor `wasm-bindgen` untuk fungsi-fungsi di atas |

### 7.2 `crates/pusaka-api` (axum)

**Lapisan:** `config` (env divalidasi saat start) → `auth` (token Privy) → `peran` (cek on-chain lewat JSON-RPC `hasRole`; tanpa alloy supaya build Vercel ringan) → `handler` → `repo` (sqlx) / `privy` / `pinata` / `kontrak`.

**Autentikasi.** Header `Authorization: Bearer <access token Privy>` diverifikasi ES256 dengan `PRIVY_VERIFICATION_KEY`, `aud = PRIVY_APP_ID`, dan `iss = privy.io`. Daftar wallet milik pengguna diambil dari Privy REST API dan di-cache 5 menit per DID. Peran dibaca dari kontrak (`hasRole`) untuk wallet-wallet itu.

**Endpoint**

| Method & rute | Peran | Fungsi |
|---|---|---|
| `GET /api/sesi` | login | DID, wallet, peran |
| `POST /api/ipfs` | operator | unggah amplop atau metadata ke Pinata (maks 4 MiB, batas body fungsi Vercel) |
| `POST /api/draf` | operator | buat 1..50 draf; tiap draf membuat atau mengambil wallet alumni dari email lewat Privy |
| `GET /api/draf?status=&cari=&halaman=` | operator, pejabat | daftar draf |
| `GET /api/draf/{id}` | operator, pejabat | detail + kunci (untuk pratinjau) |
| `POST /api/draf/{id}/setujui` | pejabat | body `{sig, batas_waktu}`; server memulihkan alamat EIP-712, mewajibkan alamat itu milik pengguna dan memegang `PENANDATANGAN_ROLE` |
| `POST /api/draf/{id}/tolak` | pejabat | body `{alasan}` |
| `POST /api/draf/{id}/kirim-ulang` | operator | setelah draf ditolak dan diperbaiki |
| `POST /api/terbit` | operator | body `{tx_hash}`; server membaca receipt, mencocokkan event `Diterbitkan` dengan draf, lalu menandai TERBIT + `tokenId` |
| `POST /api/cabut` | operator | buat permintaan cabut `{token_id, alasan}` |
| `GET /api/cabut?status=` | operator, pejabat | daftar permintaan cabut |
| `POST /api/cabut/{id}/setujui` | pejabat | tanda tangan `Pencabutan` |
| `POST /api/cabut/{id}/selesai` | operator | body `{tx_hash}` |
| `GET /api/kunci/{tokenId}` | pemilik token, operator | kunci AES ijazah (didekripsi dari kunci master) |

**Status draf:** `MENUNGGU_TTD` → `DITANDATANGANI` → `TERBIT`; `MENUNGGU_TTD` → `DITOLAK` → (perbaikan) `MENUNGGU_TTD`. `DITANDATANGANI` yang melewati `batasWaktu` (default 7 hari) kembali ke `MENUNGGU_TTD`. `TERBIT` → `DICABUT` setelah pencabutan selesai. Kunci JSON memakai `snake_case`.

**Error:** `thiserror` dipetakan ke JSON `{ "kode": "PERAN_TIDAK_CUKUP", "pesan": "…" }` dengan status HTTP yang tepat. Tidak ada `unwrap`/`expect` di jalur request. Logging memakai `tracing`.

### 7.3 Database (`migrations/`, sqlx)

- `draf(id uuid pk, dibuat timestamptz, diubah timestamptz, status text, nama text, nim text, prodi text, gelar text, nomor_ijazah text, tanggal_lulus date, email text, penerima text, doc_hash bytea unique, uri text, cid_amplop text, alasan_tolak text, token_id bigint null, dibuat_oleh text)`
- `tanda_tangan(id uuid pk, jenis text check (jenis in ('penerbitan','pencabutan')), rujukan_id uuid, penanda_tangan text, sig bytea, batas_waktu timestamptz, dibuat timestamptz)`
- `kunci_ijazah(draf_id uuid pk references draf, kunci_terenkripsi bytea)`. Dienkripsi AES-256-GCM dengan `KUNCI_MASTER` (env), AAD = id draf.
- `permintaan_cabut(id uuid pk, token_id bigint, alasan text, status text, dibuat_oleh text, dibuat timestamptz)`
- `audit_log(id bigserial, waktu timestamptz, pelaku text, aksi text, rujukan text, detail jsonb)`
- Batas laju 120 aksi tulis/menit/DID dihitung dari `audit_log`. Migrasi dijalankan manual (`cargo run -p pusaka-api -- migrasi`) dengan koneksi langsung Neon.

### 7.4 Vercel

- `api/index.rs` membungkus router axum dengan `vercel_runtime`.
- `vercel.json` me-rewrite `/api/(.*)` ke `/api/index`.
- Di laptop: `cargo run -p pusaka-api` menjalankan router yang sama di port 8787, dan dev server Astro mem-proxy `/api` ke sana.

## 8. Frontend (`web/`)

Astro 5 (output statis), React 19 islands, TypeScript strict, Tailwind v4 dengan token desain, viem, `@privy-io/react-auth`, three.js + GSAP ScrollTrigger + Lenis (hanya di beranda), `pusaka-core.wasm`.

### 8.1 Rute

| Rute | Isi | Akses |
|---|---|---|
| `/` | Beranda 3D (8.2) | publik |
| `/periksa` | Segel jadi area unggah PDF; pindai QR (kamera); nomor token | publik |
| `/i/[tokenId]` | Hasil verifikasi. Dengan `#k=`: dekripsi, tampil nama, data, PDF. Tanpa kunci: status saja | publik |
| `/op` | Buku Induk (jendela perintah) | operator |
| `/op/unggah` | Draf tunggal atau CSV + kumpulan PDF, progres per baris | operator |
| `/op/cabut` | Permintaan pencabutan | operator |
| `/op/peran` | Lihat dan kelola peran (admin); ditunda ke rencana 09, sementara lewat `cast`/explorer | admin |
| `/meja` | Meja tanda tangan pejabat | pejabat |
| `/alumni` | Ijazah milik alumni, tautan berkunci, QR, unduh PDF | alumni |

### 8.2 Beranda: koreografi quantumwallet.tech

Satu kanvas three.js dipin sepanjang halaman (sekitar 7–8 tinggi layar). Objeknya adalah **Segel Pusaka**: keping heksagonal kaca-logam yang dibuat dengan kode, tanpa model berbayar. Animasinya digerakkan scroll (GSAP ScrollTrigger + Lenis).

| Babak | Visual | Teks |
|---|---|---|
| 1 Pembuka gelap | segel berputar pelan di ruang bintang, pendar biru | judul terpecah ke sudut: "Ijazah yang mustahil dipalsukan" · "dijaga blockchain" |
| 2 Cetak biru | latar menjadi kertas pucat, segel menjadi gambar garis lalu terurai berlapis dengan label | PDF → Keccak-256 → tanda tangan Rektor → token ERC-721 soulbound → berkas terenkripsi di IPFS |
| 3 Ponsel | mockup ponsel naik menampilkan `/i/[tokenId]` | "Periksa dari ponsel mana pun" · "tanpa akun, tanpa biaya" |
| 4 Uji pemalsuan | kamera mendekat, angka berjalan, lalu mode merah | "Sidik jari cocok 100%" → "1 bita berubah → TIDAK VALID" |
| 5 Inti terbuka | segel membuka, kristal inti menyala, berkas cahaya ke titik jaringan | "Tercatat permanen" + alamat kontrak dan `totalTerbit()` live dari chain |
| 6 Penutup putih | pecahan kristal melayang | "Asli atau palsu?" · "Periksa sendiri." + tombol Periksa dan Masuk |

- Tidak menyalin kode, teks, model, atau aset quantumwallet.tech. Yang ditiru hanya koreografi dan teknik.
- **Fallback:** `prefers-reduced-motion` atau GPU lemah menampilkan versi statis berupa gambar render tiap babak dengan scroll biasa.
- **Performa:** three.js dan GSAP hanya dimuat di `/`; LCP berupa teks.

### 8.3 Masuk (Privy, UI kustom)

Dua panel gelap seperti contoh referensi:
- **Panel kiri "Masuk":** tombol putih "Lanjut dengan Google", lalu grid Email, Apple, X, Discord, lalu "Hubungkan wallet →".
- **Panel kanan "Hubungkan wallet":** MetaMask, WalletConnect, Coinbase Wallet, OKX.

Memakai hook headless Privy (`useLoginWithOAuth`, `useLoginWithEmail`, `useConnectWallet`), bukan modal bawaan Privy.

### 8.4 Halaman dalam: bahasa visual

Diturunkan dari aplikasi pendamping Quantum Wallet dan Raycast (mockup v3 di `.superpowers/brainstorm/`, berkas `desain-3-halaman-v3.html`):

- **Latar:** ruang hitam-biru dengan pendar biru di belakang objek dan titik bintang halus. Tidak ada kartu kaca dekoratif.
- **HUD:** label mono kapital berjarak lebar di sudut layar (`PSK-OP / BAAK · AKTIF`, `WALLET / 41C2....9E0A`). Garis skala di tepi kiri membawa angka nyata (jumlah tercatat, siap, menunggu).
- **Objek:** Segel Pusaka berupa keping heksagon (CSS) dengan cincin orbit di halaman dalam; versi three.js hanya di beranda supaya halaman periksa ringan. Warna pendarnya ikut status.
- **Operator:** jendela perintah gaya Raycast. Kotak cari dengan chip filter, daftar kiri, detail label–nilai kanan, bilah bawah berisi aksi utama `↵` dan `Aksi ⌘K`, plus dok ikon di bawah jendela. Semua aksi bisa dijalankan dengan keyboard.
- **Pejabat (`/meja`):** gaya aplikasi Quantum murni. Ijazah melayang miring di tengah dengan orbit, data lulusan besar, tombol berkurung `‹ Tanda tangani ↵ ›` dan `‹ Tolak X ›`, serta "Setujui sisanya".
- **Hasil verifikasi:** baris bukti gaya daftar aset Quantum (ikon bulat, nama bukti, keterangan mono hijau "↑ COCOK 100%", nilai mono di kanan).
- **Status:** selalu kata + simbol + warna, tidak pernah warna saja.
- **Huruf:** Sora (teks), Space Mono (HUD, angka, hash).
- **Animasi:** di halaman dalam hanya 150–250 ms, dan mati saat reduced motion.
- **Responsif:** jendela perintah menjadi layar penuh di ponsel, dok menjadi bilah bawah. Diuji di lebar 320, 375, 414, dan 768 px.
- **Cetak:** `/i/[tokenId]` punya stylesheet cetak terang.

## 9. Alur lengkap

**Penerbitan**
1. Operator membuka `/op/unggah` dan memilih CSV + PDF, atau mengisi satu draf.
2. Untuk tiap baris, peramban (WASM) menghitung `H`, membuat kunci, menyegel amplop, mengunggah amplop dan metadata lewat `POST /api/ipfs`, lalu `POST /api/draf`. Backend memanggil Privy untuk wallet alumni dan menyimpan draf `MENUNGGU_TTD` beserta kunci terenkripsi.
3. Pejabat membuka `/meja`: pratinjau (dekripsi di peramban), lalu tanda tangan EIP-712 `Penerbitan`, atau tolak dengan alasan. "Setujui sisanya" menandatangani berurutan; dengan wallet tertanam Privy, konfirmasi bisa diatur sekali per sesi.
4. Operator di `/op` menekan "Catat N ijazah ke blockchain", yang mengirim `terbitkanBatch`. Setelah itu `POST /api/terbit` dengan `txHash` mencocokkan event dan menandai TERBIT.
5. Operator mengunduh lembar QR (PDF) berisi tautan berkunci untuk dicetak atau dikirim ke alumni.

**Verifikasi**
- **Unggah PDF:** WASM menghitung `H`, lalu viem memanggil `periksa(H)` di RPC publik dan menampilkan hasil.
- **QR berkunci:** `/i/{id}#k=` memanggil `ijazah(id)` dan `tokenURI` → metadata → amplop dari gateway IPFS → dekripsi → Keccak PDF wajib sama dengan `docHash` → tampil data dan PDF.
- **Nomor token saja:** status, tanggal terbit, dan penanda tangan; data pribadi tetap tertutup.

**Pencabutan:** operator membuat permintaan → pejabat menandatangani `Pencabutan` → operator mengirim `cabut` → status DICABUT terlihat di semua jalur verifikasi.

**Alumni:** masuk dengan email atau Google yang sama → `/alumni` membaca token milik wallet-nya → `GET /api/kunci/{id}` → salin tautan berkunci, unduh QR, unduh PDF.

## 10. Keamanan dan privasi

- **Kunci rahasia:** tidak pernah di repo maupun peramban (`PRIVY_APP_SECRET`, `PINATA_JWT`, `KUNCI_MASTER`, `DATABASE_URL`, kunci deployer).
- **Pertimbangan desain yang ditulis terbuka di skripsi:** server menyimpan kunci AES (terenkripsi kunci master) supaya alumni yang kehilangan tautan bisa memulihkannya.
- **Tanda tangan EIP-712** terikat ke chainId dan alamat kontrak (anti-replay), punya batas waktu, dan ikut mengikat `metadataHash`.
- **Kunci di fragmen URL:** bagian `#k=` tidak terkirim ke server, dan halaman `/i/*` memasang `Referrer-Policy: no-referrer`.
- **Pembatasan input:** ukuran berkas maks 4 MiB, batch maks 50, rate limit sederhana per DID di endpoint tulis.
- **Audit log** untuk setiap aksi operator dan pejabat.

## 11. Pengujian

| Lapisan | Alat | Cakupan |
|---|---|---|
| Kontrak | Foundry | 5.3 |
| `pusaka-core` | `cargo test`, `wasm-pack test --node` | vektor uji Keccak; segel lalu buka; amplop rusak/tag salah; hash EIP-712 sama dengan viem `hashTypedData` (vektor dari tes JS); CSV dengan kutip, kolom hilang, email salah |
| `pusaka-api` | `cargo test` + Postgres sementara + Anvil | alur draf → setujui → terbit → cabut; peran salah ditolak; token Privy palsu atau kedaluwarsa ditolak; tanda tangan dari wallet bukan milik pengguna ditolak (Privy di-mock) |
| Web | Vitest | utilitas dan komponen |
| E2E | Playwright + Anvil + API lokal | periksa PDF asli (VALID), PDF diubah 1 bita (TIDAK VALID), token dicabut (DICABUT), alur terbit lengkap, reduced motion, lebar 375 px |
| CI | GitHub Actions | `cargo fmt --check`, `cargo clippy -D warnings`, `forge fmt --check`, semua tes, `astro check`, build |

Data dari tes ini menjadi bahan BAB IV: black box, skenario pemalsuan, gas, dan waktu respon.

## 12. Struktur repo, git, dan deploy

```
contracts/      Foundry
crates/         pusaka-core, pusaka-api
api/index.rs    fungsi Vercel
migrations/     sqlx
web/            Astro
docs/           spesifikasi, rencana
Cargo.toml      workspace
vercel.json
.gitattributes  linguist-generated untuk lockfile, ABI, binding WASM, dist
.github/workflows/ci.yml
```

- **Kode v1** (`contracts/` Hardhat, `web/` Next.js, dan perubahan UI yang belum di-commit tanggal 26 Sep) disimpan di branch `arsip/v1` sebelum dihapus dari `main`.
- **Git:** setiap tahap di branch `feat/...` → PR ke `main`, tanpa atribusi AI di commit maupun PR.
- **Domain:** `pusaka.rahmateka.my.id` (Cloudflare DNS → Vercel).
- **Env:** `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_VERIFICATION_KEY`, `PINATA_JWT`, `PUBLIC_GATEWAY_URL`, `DATABASE_URL`, `KUNCI_MASTER`, `RPC_URL`, `PUBLIC_RPC_URL`, `ALAMAT_KONTRAK`, `CHAIN_ID`.
- **Lokal:** `anvil` + `forge script` deploy + `cargo run -p pusaka-api` + `npm run dev` di `web/`.

## 13. Urutan pengerjaan

| Tahap | Isi | Selesai bila |
|---|---|---|
| 0 | **Spike** Astro statis + fungsi Rust di satu proyek Vercel (preview deploy) | `/api/sesi` palsu menjawab dari Rust di URL preview; jika gagal, laporkan dan pakai cadangan (backend Rust via Docker di Vercel) |
| 1 | Arsip v1, kerangka repo, CI | `arsip/v1` ada; CI hijau di kerangka kosong |
| 2 | Kontrak v2 + tes Foundry | semua tes di 5.3 lulus, laporan gas |
| 3 | `pusaka-core` native + WASM | tes `pusaka-core` di bagian 11 lulus di native dan WASM |
| 4 | `pusaka-api` + migrasi + Privy + Pinata | tes integrasi lulus |
| 5 | `/periksa` dan `/i/[tokenId]` | tiga jalur verifikasi jalan terhadap Anvil |
| 6 | Masuk, `/op`, `/op/unggah`, `/meja`, pencabutan | alur terbit dan cabut lengkap di E2E |
| 7 | `/alumni` | alumni baru (email) melihat ijazahnya |
| 8 | Beranda 3D | 6 babak berjalan, fallback statis, lolos uji lebar layar |
| 9 | Deploy Amoy + Vercel + `.gitattributes` | URL produksi jalan; GitHub menampilkan Rust sebagai bahasa terbesar |
| 10 | Penyesuaian proposal | BAB III, batasan, abstrak, Tabel 3.1/3.2 sesuai v2; isi tetap ≤ 20 halaman |

## 14. Di luar lingkup

Mainnet, integrasi SIAKAD, pengiriman email otomatis ke alumni, tanda tangan ganda (Dekan + Rektor), aplikasi seluler native, dan transkrip nilai.

## 15. Risiko

| Risiko | Mitigasi |
|---|---|
| Runtime Rust Vercel masih beta | Tahap 0 spike; cadangan Docker di Vercel |
| Ukuran SDK Privy besar | Hanya dimuat di island halaman yang butuh login |
| Batas gratis Privy (499 MAU), Pinata, Neon | Cukup untuk uji skripsi; dicatat di batasan |
| Faucet POL Amoy | Beberapa faucet; uji utama di Anvil |
| Ukuran WASM | `opt-level = "z"`, `wasm-opt`; dimuat lazy di halaman periksa dan operator |
| Server memegang kunci AES | Dienkripsi kunci master; dibahas terbuka sebagai pertimbangan desain |
