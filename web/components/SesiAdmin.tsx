"use client";
// Login admin: connect MetaMask, cek ISSUER_ROLE, tanda tangani pesan tantangan (6.5). Berlaku 15 menit.
import { createContext, useContext, useState } from "react";
import type { Contract, JsonRpcSigner } from "ethers";
import { singkat, jaringan } from "@/lib/chain";
import { pesanError } from "@/lib/errors";
import { pesanLogin } from "@/lib/pesan";
import { connect, kontrakDengan } from "@/lib/wallet";

export type Sesi = {
  signer: JsonRpcSigner;
  alamat: string;
  kontrak: Contract;
  headers: Record<string, string>;
};

const Ctx = createContext<{ sesi: Sesi; keluar: () => void } | null>(null);

export function useSesi() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSesi di luar SesiAdmin");
  return v;
}

export default function SesiAdmin({ children }: { children: React.ReactNode }) {
  const [sesi, setSesi] = useState<Sesi | null>(null);
  const [error, setError] = useState("");
  const [sedang, setSedang] = useState(false);

  async function masuk() {
    setError("");
    setSedang(true);
    try {
      const signer = await connect();
      const alamat = await signer.getAddress();
      const kontrak = kontrakDengan(signer);
      if (!(await kontrak.hasRole(await kontrak.ISSUER_ROLE(), alamat))) throw new Error("Wallet ini tidak berhak menerbitkan.");
      const t = await (await fetch("/api/auth/nonce")).json();
      const signature = await signer.signMessage(pesanLogin(t.issuedAt, t.nonce));
      setSesi({
        signer,
        alamat,
        kontrak,
        headers: { "x-pusaka-issued-at": t.issuedAt, "x-pusaka-nonce": t.nonce, "x-pusaka-tag": t.tag, "x-pusaka-signature": signature },
      });
    } catch (e) {
      setError(pesanError(e));
    } finally {
      setSedang(false);
    }
  }

  if (!sesi) {
    return (
      <div className="kartu mx-auto max-w-md space-y-4 text-center">
        <h1 className="text-xl font-bold">Masuk sebagai Admin BAAK</h1>
        <p className="text-sm text-slate-600">
          Hubungkan wallet MetaMask yang memiliki peran penerbit (ISSUER_ROLE), lalu tanda tangani pesan login. Tidak ada biaya.
        </p>
        <button className="tombol" onClick={masuk} disabled={sedang}>{sedang ? "Menunggu MetaMask…" : "Masuk dengan MetaMask"}</button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ sesi, keluar: () => setSesi(null) }}>
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg bg-white px-4 py-2 text-sm shadow-sm">
        <span>
          Admin: <span className="font-mono">{singkat(sesi.alamat)}</span> (ISSUER) <span className="text-emerald-600">●</span> {jaringan.nama}
        </span>
        <button className="ml-auto text-slate-500 underline" onClick={() => setSesi(null)}>Keluar</button>
      </div>
      {children}
    </Ctx.Provider>
  );
}
