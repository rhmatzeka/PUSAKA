# PUSAKA v2 — Peta Jalan Rencana

Spec: `docs/superpowers/specs/2026-10-16-pusaka-v2-design.md`

Spec v2 mencakup beberapa subsistem yang masing-masing bisa diuji sendiri. Karena itu rencananya dipecah. Rencana bertanda ✅ sudah ditulis rinci; sisanya ditulis setelah rencana sebelumnya selesai, supaya memakai hasil nyata (terutama hasil spike Vercel di rencana 01).

| No | Rencana | Tahap spec | Hasil yang bisa diuji | Status |
|---|---|---|---|---|
| 01 | Fondasi + spike Vercel | 0, 1 | Astro statis + fungsi Rust jalan di satu deployment preview Vercel; kode v1 diarsipkan; CI hijau | ✅ `2026-10-16-pusaka-v2-01-fondasi-spike.md` |
| 02 | Kontrak `PusakaIjazah` v2 | 2 | `forge test` lulus (unit, fuzz, invariant), laporan gas, ABI diekspor, deploy ke Anvil | ✅ `2026-10-16-pusaka-v2-02-kontrak.md` |
| 03 | Crate `pusaka-core` (native + WASM) | 3 | Keccak, amplop AES-GCM, EIP-712, CSV teruji; paket WASM terbangun | ✅ `2026-10-16-pusaka-v2-03-core.md` |
| 04 | Crate `pusaka-api` + Postgres + Privy + Pinata | 4 | Tes integrasi alur draf → setujui → terbit → cabut | ✅ `2026-10-16-pusaka-v2-04-api.md` |
| 05 | Web: `/periksa` dan `/i/[tokenId]` | 5 | Tiga jalur verifikasi terhadap Anvil (Playwright) | ✅ `2026-10-16-pusaka-v2-05-periksa.md` |
| 06 | Web: masuk Privy, `/op`, `/op/unggah`, `/meja`, pencabutan | 6 | E2E alur terbit dan cabut | ✅ `2026-10-16-pusaka-v2-06-op.md` |
| 07 | Web: `/alumni` | 7 | Alumni baru melihat ijazahnya | ✅ `2026-10-16-pusaka-v2-07-alumni.md` |
| 08 | Web: beranda 3D | 8 | Enam babak + fallback statis | ✅ `2026-10-16-pusaka-v2-08-beranda.md` |
| 09 | Deploy Amoy + Vercel + domain | 9 | URL produksi; GitHub menampilkan Rust terbesar | ✍ `2026-10-16-pusaka-v2-09-deploy.md` (skrip siap; menunggu akun) |
| 10 | Penyesuaian proposal BAB III | 10 | Proposal sesuai v2, ≤ 20 halaman isi | ✅ `2026-10-16-pusaka-v2-10-proposal.md` |

Urutan wajib: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10. Rencana 02 dan 03 boleh dikerjakan paralel setelah 01.

## Vektor acuan bersama

Dibuat dengan ethers v6 (pustaka independen) dan dipakai sebagai nilai harapan di tes Solidity (rencana 02), Rust (rencana 03), dan web (rencana 05):

```
domain            name "PUSAKA", version "2", chainId 31337,
                  verifyingContract 0x5FbDB2315678afecb367f032d93F642f64180aa3
keccak("")        0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
keccak("abc")     0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45
uri               ipfs://bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy
docHash           keccak("%PDF-1.7 ijazah PUSAKA")
                  = 0x413538c95b60dfa9a17c6008dda06f5589538080ef91043561f8668fde026edb
metadataHash      keccak(uri) = 0x14ecfb0c60c4bdfac4451a0238994b0b8024f8e018440289db82f5b6e4cf9e5f
penerima          0x70997970C51812dc3A010C7d01b50e0d17dc79C8
batasWaktu        1793000000
domainSeparator   0x234afa7e8e5a1ef9ad82593a023f56bd249579702732f95795cd18b5e39ed04c
structPenerbitan  0x745f7ca1ca905ff314fb499063eb5505a76efae516d39a3670adfd8e89c9dfc5
digestPenerbitan  0x069e362cc547e60dc1beb36e2f4502c5e07a3689275ac21faaaa791b024f9be5
alasan            "salah nama ibu"
alasanHash        0xb0e811a06cdecac05b2c76b58d65333b5a96d4666441412f169bc50020178302
digestPencabutan  (tokenId 7, batasWaktu 1793000000)
                  = 0xd9bc14d3408df457dab6f74a5d04e5c5768e3526573c85bbf7080d0ae73e8bc6
kunci rektor      0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a (Anvil #2, publik)
alamat rektor     0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
sigPenerbitan     0x005375b038da81be905bbe4ab2ddd240a489ccd90e34c85ac7d6a1913e33859358dbb04ecdd2f170e730c5813a49cc71b3fca320e102dd263359a15e40448fae1b
```

## Aturan git untuk semua rencana

- Kerja di branch `feat/pusaka-v2` (atau turunan `feat/pusaka-v2-<bagian>`), PR ke `main` per rencana.
- **Tanpa atribusi AI:** tidak ada `Co-Authored-By`, "Generated with", atau sejenisnya di commit maupun deskripsi PR. Commit hanya atas identitas git user (`rhmatzeka`).
- Rahasia (`.env`, kunci privat selain kunci Anvil publik) tidak pernah di-commit.
