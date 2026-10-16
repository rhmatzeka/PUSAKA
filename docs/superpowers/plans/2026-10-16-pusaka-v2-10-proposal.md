# PUSAKA v2 — Rencana 10: penyesuaian proposal

**Goal:** Proposal (repo `~/Skripsi`, generator `sumber-generator/build.js` + `diagrams.js`) sesuai arsitektur v2, isi BAB I–Jadwal tetap ≤ 20 halaman.

Selesai 2026-10-16 (commit `a49e1d6` di repo proposal):

- Abstrak, batasan 1.4, metode pengodean 1.7.2: EIP-712 oleh pejabat, operator pengirim transaksi, enkripsi AES-256-GCM, Privy, Rust/WASM, Astro, Foundry.
- BAB II: kesenjangan penelitian (pemisahan pejabat/operator, enkripsi dengan kunci di tangan alumni), definisi operasional, Keccak di WASM, EIP-712 + `tryRecover` + pemisahan tugas, perangkat (Foundry, viem, Privy, Rust).
- BAB III: Tabel 3.1 KF-01–KF-10 baru, 3.2.2, Tabel 3.2, arsitektur empat lapisan + Tabel 3.3 (Postgres), langkah penerbitan EIP-712 dan dua jalur verifikasi, Tabel 3.4 `PusakaIjazah`, UML, Tabel 3.5 (Foundry unit/fuzz/invariant, berkas IPFS ditukar, kunci salah).
- Lampiran 3: metadata publik, format amplop, sembilan halaman aplikasi.
- Tujuh diagram digambar ulang (kerangka pikir, arsitektur, use case, dua activity, sequence QR berkunci, class `PusakaIjazah`).
- Isi BAB I–Jadwal 19 halaman (total PDF 35); kemiripan 5-gram terhadap 23 referensi 0,6%.
