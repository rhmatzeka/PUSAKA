# Deploy PUSAKA ke produksi

Target: kontrak di **Polygon Amoy**, situs + fungsi Rust di **Vercel**, basis data **Neon**, berkas di **Pinata**,
domain **pusaka.rahmateka.my.id**. Semua rahasia hanya di `.env.local` (tidak di-commit) dan di env Vercel.

## 1. Akun dan kunci

| Layanan | Yang disiapkan | Masuk ke `.env.local` |
|---|---|---|
| Privy | App baru. Login methods: Email, Google, Apple, X, Discord, Wallet. Embedded wallets: *Create on login → users without wallets*. Allowed domains: `pusaka.rahmateka.my.id` dan `*.vercel.app`. Salin *Verification key* (Configuration → App settings). | `PRIVY_APP_ID`, `PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_VERIFICATION_KEY` (satu baris, `\n` sebagai pemisah) |
| Neon | Project Postgres. Salin connection string *pooled* dan *direct*. | `DATABASE_URL` (pooled), `DATABASE_URL_LANGSUNG` (direct) |
| Pinata | API key JWT dengan izin upload file. Gateway (mis. `https://xxx.mypinata.cloud`). | `PINATA_JWT`, `PUBLIC_GATEWAY_URL` |
| Wallet | Tiga wallet berbeda: **deployer** (isi POL Amoy dari faucet), **operator BAAK**, **Rektor** (MetaMask). | `DEPLOYER_PK`, `OPERATOR`, `PENANDATANGAN` |
| Kunci master | `openssl rand -hex 32`. **Simpan cadangannya**: tanpa ini kunci ijazah tidak bisa dipulihkan. | `KUNCI_MASTER` |
| RPC | `https://rpc-amoy.polygon.technology` (atau Alchemy/Infura). | `RPC_URL`, `PUBLIC_RPC_URL`, `CHAIN_ID=80002`, `PUBLIC_CHAIN_ID=80002` |

## 2. Kontrak

```bash
scripts/deploy-kontrak.sh
```

Isi `ALAMAT_KONTRAK` dan `PUBLIC_ALAMAT_KONTRAK` dengan alamat yang dicetak. Commit `contracts/deployments/80002.json` (alamat publik).

## 3. Basis data

```bash
cargo run -p pusaka-api -- migrasi        # memakai DATABASE_URL_LANGSUNG
```

## 4. Vercel

```bash
scripts/env-vercel.sh                     # salin env produksi (nilai tidak dicetak)
npx vercel@latest deploy --prod
npx vercel@latest domains add pusaka.rahmateka.my.id
```

Cloudflare DNS: `CNAME pusaka → cname.vercel-dns.com`, proxy **mati** (awan abu-abu).

## 5. Uji asap dan uji manual

```bash
scripts/periksa-produksi.sh https://pusaka.rahmateka.my.id
```

Lalu dengan dua peramban: operator (MetaMask wallet operator) unggah satu draf → Rektor (MetaMask wallet Rektor)
tanda tangani di `/meja` → operator catat ke blockchain → buka lembar QR di ponsel.

## 6. Serah-terima admin (opsional)

Deployer memegang `DEFAULT_ADMIN_ROLE`. Untuk menyerahkannya ke wallet/multisig rektorat:

```bash
cast send $ALAMAT_KONTRAK "grantRole(bytes32,address)" 0x00 <ADMIN_BARU> --rpc-url $RPC_URL --private-key $DEPLOYER_PK
cast send $ALAMAT_KONTRAK "renounceRole(bytes32,address)" 0x00 <DEPLOYER> --rpc-url $RPC_URL --private-key $DEPLOYER_PK
```
