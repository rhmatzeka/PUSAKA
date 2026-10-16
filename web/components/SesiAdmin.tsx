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
      <div className="grid gap-x-8 gap-y-5 border-t-2 border-[var(--color-ink)] pt-6 md:grid-cols-12">
        <div className="md:col-span-6">
          <h1 className="display-s">masuk</h1>
          <p className="prose mt-4">
            Hubungkan wallet MetaMask yang memegang peran penerbit (ISSUER_ROLE), lalu tanda tangani pesan login.
            Tanda tangan ini tidak mengirim transaksi dan tidak dikenai biaya.
          </p>
        </div>
        <div className="md:col-span-4 md:col-start-9">
          <button className="act" onClick={masuk} disabled={sedang}>
            {sedang ? "Menunggu MetaMask…" : "Masuk dengan MetaMask"}
          </button>
          {error && (
            <p role="alert" className="mt-4 border-2 border-[var(--color-state-invalid)] p-3 text-[var(--text-sm)] font-semibold text-[var(--color-state-invalid)]">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ sesi, keluar: () => setSesi(null) }}>
      <div className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--color-rule)] pb-3">
        <p className="data text-[var(--color-muted)]">
          <span className="mark-square mr-2 align-middle" aria-hidden />
          {singkat(sesi.alamat)} · ISSUER · {jaringan.nama}
        </p>
        <button className="act-text ml-auto" onClick={() => setSesi(null)}>
          Keluar
        </button>
      </div>
      {children}
    </Ctx.Provider>
  );
}
