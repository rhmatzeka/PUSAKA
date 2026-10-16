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
    ["Diterbitkan", total],
    ["Aktif", total - dicabut],
    ["Dicabut", dicabut],
  ] as const;

  return (
    <div>
      <h1 className="display-s">register</h1>
      <div className="cells mt-8 md:grid-cols-3">
        {angka.map(([label, nilai]) => (
          <div key={label} className="cell">
            <p className="label">{label}</p>
            <p className="display-s mt-2 tabular-nums">{data ? nilai : "—"}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
        <Link href="/admin/issue" className="act">Terbitkan ijazah</Link>
        <Link href="/admin/certificates" className="act-text">Lihat register</Link>
      </div>
    </div>
  );
}
