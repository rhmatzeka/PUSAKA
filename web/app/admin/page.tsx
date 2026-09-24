"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Ringkas = { id: number; dicabut: boolean };

export default function Dasbor() {
  const [data, setData] = useState<Ringkas[] | null>(null);

  useEffect(() => {
    fetch("/api/ijazah").then((r) => r.json()).then(setData);
  }, []);

  const total = data?.length ?? 0;
  const dicabut = data?.filter((x) => x.dicabut).length ?? 0;
  const angka = [
    ["Total diterbitkan", total],
    ["Aktif", total - dicabut],
    ["Dicabut", dicabut],
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dasbor</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {angka.map(([label, nilai]) => (
          <div key={label} className="kartu">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-3xl font-bold">{data ? nilai : "…"}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Link href="/admin/issue" className="tombol">Terbitkan ijazah</Link>
        <Link href="/admin/certificates" className="tombol-garis">Lihat daftar</Link>
      </div>
    </div>
  );
}
