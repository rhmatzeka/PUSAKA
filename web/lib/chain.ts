// Jaringan diambil dari contract.json (ditulis scripts/deploy.js), jadi tidak perlu env.
import kontrak from "./contract.json";

const JARINGAN = {
  80002: {
    nama: "Polygon Amoy",
    chainIdHex: "0x13882",
    rpc: "https://polygon-amoy.drpc.org",
    explorer: "https://amoy.polygonscan.com",
    mataUang: "POL",
  },
  31337: {
    nama: "Hardhat Lokal",
    chainIdHex: "0x7a69",
    rpc: "http://127.0.0.1:8545",
    explorer: "",
    mataUang: "ETH",
  },
} as const;

export const jaringan = JARINGAN[kontrak.chainId as keyof typeof JARINGAN];
export const alamatKontrak = kontrak.address;

export const singkat = (alamat: string) => `${alamat.slice(0, 6)}…${alamat.slice(-4)}`;
