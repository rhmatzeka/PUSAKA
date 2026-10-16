"use client";
// Daftar ijazah + tombol cabut
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSesi } from "@/components/SesiAdmin";
import { singkat } from "@/lib/chain";
import { pesanError } from "@/lib/errors";

type Baris = { id: number; pemilik: string; dicabut: boolean; alasanCabut: string; diterbitkan: number };

export default function DaftarIjazah() {
  const { sesi } = useSesi();
  const [data, setData] = useState<Baris[] | null>(null);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState<number | null>(null);

  const muat = useCallback(() => fetch("/api/ijazah").then((r) => r.json()).then(setData), []);
  useEffect(() => { muat(); }, [muat]);

  async function cabut(id: number) {
    const alasan = window.prompt(`Alasan mencabut ijazah #${id}:`, "Salah data");
    if (!alasan) return;
    setPesan("");
    setSibuk(id);
    try {
      await (await sesi.kontrak.revoke(id, alasan)).wait();
      await muat();
      setPesan(`Ijazah #${id} berhasil dicabut.`);
    } catch (e) {
      setPesan(pesanError(e));
    } finally {
      setSibuk(null);
    }
  }

  return (
    <div>
      <h1 className="display-s">register ijazah</h1>
      {pesan && (
        <p className="mt-4 border-2 border-[var(--color-signal)] px-4 py-3 text-[var(--text-sm)] font-semibold text-[var(--color-signal)]">
          {pesan}
        </p>
      )}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-[var(--text-sm)]">
          <thead>
            <tr className="border-y-2 border-[var(--color-ink)] text-left">
              <th className="label py-3 pr-4">Token</th>
              <th className="label py-3 pr-4">Pemilik</th>
              <th className="label py-3 pr-4">Diterbitkan</th>
              <th className="label py-3 pr-4">Status</th>
              <th className="label py-3" />
            </tr>
          </thead>
          <tbody>
            {data?.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-[var(--color-muted)]">
                  Belum ada ijazah di register.
                </td>
              </tr>
            )}
            {data?.map((x) => (
              <tr key={x.id} className="border-b border-[var(--color-rule)]">
                <td className="py-3 pr-4">
                  <Link href={`/verify/${x.id}`} className="act-text">
                    #{x.id}
                  </Link>
                </td>
                <td className="data py-3 pr-4">{singkat(x.pemilik)}</td>
                <td className="data py-3 pr-4">{new Date(x.diterbitkan * 1000).toLocaleDateString("id-ID")}</td>
                <td className="py-3 pr-4 font-semibold" style={{ color: x.dicabut ? "var(--color-state-revoked)" : "var(--color-state-valid)" }}>
                  {x.dicabut ? `▲ DICABUT (${x.alasanCabut})` : "■ AKTIF"}
                </td>
                <td className="py-3 text-right">
                  {!x.dicabut && (
                    <button className="act-line" disabled={sibuk !== null} onClick={() => cabut(x.id)}>
                      {sibuk === x.id ? "Mencabut…" : "Cabut"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data && <p className="py-8 text-[var(--color-muted)]">Memuat…</p>}
      </div>
    </div>
  );
}
