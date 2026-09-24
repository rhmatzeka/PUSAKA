// Terjemahan error wallet/kontrak ke pesan Indonesia
import { Interface } from "ethers";
import kontrak from "./contract.json";

const iface = new Interface(kontrak.abi);

const PESAN: Record<string, string> = {
  HashSudahTerdaftar: "Ijazah ini sudah pernah diterbitkan.",
  TandaTanganTidakSah: "Tanda tangan tidak cocok dengan wallet.",
  AccessControlUnauthorizedAccount: "Wallet ini tidak berhak menerbitkan.",
  SudahDicabut: "Ijazah sudah dicabut.",
  SertifikatTidakAda: "Ijazah tidak ditemukan.",
  PanjangArrayBerbeda: "Jumlah data batch tidak sama.",
  TidakDapatDipindahtangankan: "Ijazah tidak dapat dipindahtangankan.",
};

type ErrorWallet = {
  code?: string | number;
  message?: string;
  shortMessage?: string;
  data?: string;
  revert?: { name?: string };
  info?: { error?: { data?: string | { data?: string } } };
};

export function pesanError(err: unknown): string {
  const e = err as ErrorWallet;
  if (e?.message === "METAMASK_TIDAK_ADA") return "Pasang MetaMask untuk masuk. Verifikator tetap bisa memakai web tanpa MetaMask.";
  if (e?.message === "LOGIN_KEDALUWARSA") return "Login admin kedaluwarsa. Silakan masuk lagi.";
  if (e?.code === "ACTION_REJECTED" || e?.code === 4001) return "Dibatalkan oleh pengguna.";
  if (e?.code === "INSUFFICIENT_FUNDS") return "Saldo POL uji habis. Ambil dari faucet Polygon Amoy.";
  if (e?.revert?.name && PESAN[e.revert.name]) return PESAN[e.revert.name];
  const raw = e?.data ?? e?.info?.error?.data;
  const data = typeof raw === "string" ? raw : raw?.data;
  if (data) {
    try {
      const p = iface.parseError(data);
      if (p && PESAN[p.name]) return PESAN[p.name];
    } catch {}
  }
  return e?.shortMessage ?? e?.message ?? "Terjadi kesalahan.";
}
