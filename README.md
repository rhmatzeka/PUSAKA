# PUSAKA

Sistem verifikasi ijazah digital UNPAM berbasis smart contract ERC-721 (soulbound) + IPFS, dengan hash Keccak-256 dan tanda tangan ECDSA. Rancangan lengkapnya ada di `~/Skripsi/PLAN-PUSAKA.md`.

```
pusaka/
├── contracts/   Hardhat 2: PusakaCertificate.sol, 15 unit test, skrip deploy dan ukur gas
└── web/         Next.js: halaman verifikasi, admin BAAK, portal alumni, API
```

## Jalankan di laptop (blockchain lokal, tanpa akun apa pun)

Butuh 3 terminal.

```bash
# 1. Blockchain lokal
cd contracts && npm install && npm run node

# 2. Deploy kontrak (menulis web/lib/contract.json)
cd contracts && npm run deploy:lokal

# 3. Web
cd web && npm install
cp .env.example .env.local        # lalu isi AUTH_SECRET: openssl rand -hex 32
npm run dev                       # buka http://localhost:3000
```

Tanpa `PINATA_JWT`, berkas "IPFS" disimpan di `web/.ipfs-lokal/`. Ini hanya untuk uji di laptop.

**MetaMask untuk uji lokal:** tambahkan jaringan `Hardhat Lokal` (RPC `http://127.0.0.1:8545`, chain ID `31337`, mata uang `ETH`), lalu impor private key akun #0 yang dicetak `npm run node` (itu wallet admin). Akun #1 dan seterusnya bisa dipakai sebagai wallet alumni. Kunci-kunci ini publik, **jangan pernah** dipakai di jaringan sungguhan. Bisa juga pakai wallet MetaMask sendiri sebagai admin: `ADMIN_ADDRESS=0xAlamatKamu npm run deploy:lokal` (wallet itu otomatis diberi 100 ETH uji). Kalau blockchain lokal di-restart, deploy ulang kontrak dan di MetaMask pilih *Settings → Advanced → Clear activity tab data*.

## Uji

```bash
cd contracts && npx hardhat test       # 15 passing (unit test kontrak)
cd web && npm run uji:e2e              # 16 uji black box KF-01..KF-10 di Chrome, screenshot di web/hasil-uji/
```

`uji:e2e` butuh blockchain lokal + kontrak yang baru di-deploy + `npm run dev` berjalan.

## Pindah ke Polygon Amoy + Pinata + Vercel

1. Isi `contracts/.env` (lihat `.env.example`): `DEPLOYER_PRIVATE_KEY`, `AMOY_RPC_URL`, `ETHERSCAN_API_KEY`. Wallet deployer perlu POL uji dari faucet.
2. `cd contracts && npm run deploy:amoy`, lalu jalankan perintah `npx hardhat verify ...` yang dicetak. `web/lib/contract.json` otomatis berpindah ke Amoy (chain ID 80002).
3. Isi `web/.env.local` (dan env di Vercel): `RPC_URL_SERVER` (Alchemy/Infura Amoy), `AUTH_SECRET`, `PINATA_JWT`, `NEXT_PUBLIC_GATEWAY_URL`.
4. Push ke GitHub, import di Vercel dengan **Root Directory = `web`**, lalu Deploy.
5. Ukur gas untuk Bab IV: `HARGA_POL_IDR=<harga POL> CONTRACT_ADDRESS=<alamat> npm run ukur:amoy` di `contracts/`.
