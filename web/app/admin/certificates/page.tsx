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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Daftar Ijazah</h1>
      {pesan && <p className="text-sm font-medium">{pesan}</p>}
      <div className="kartu overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Token</th>
              <th className="px-4 py-2">Pemilik</th>
              <th className="px-4 py-2">Diterbitkan</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Belum ada ijazah.</td></tr>
            )}
            {data?.map((x) => (
              <tr key={x.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <Link href={`/verify/${x.id}`} className="font-medium underline">#{x.id}</Link>
                </td>
                <td className="px-4 py-2 font-mono">{singkat(x.pemilik)}</td>
                <td className="px-4 py-2">{new Date(x.diterbitkan * 1000).toLocaleDateString("id-ID")}</td>
                <td className="px-4 py-2">
                  {x.dicabut ? (
                    <span className="text-amber-700" title={x.alasanCabut}>DICABUT ({x.alasanCabut})</span>
                  ) : (
                    <span className="text-emerald-700">AKTIF</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {!x.dicabut && (
                    <button className="tombol-garis py-1" disabled={sibuk !== null} onClick={() => cabut(x.id)}>
                      {sibuk === x.id ? "Mencabut…" : "Cabut"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data && <p className="px-4 py-6 text-center text-slate-500">Memuat…</p>}
      </div>
    </div>
  );
}
