"use client";
// Verifikator mengunggah PDF yang ia terima untuk dicocokkan dengan token ini. PDF tidak dikirim ke server.
import { useState } from "react";
import { cekPdf, hashPdf } from "@/lib/hash";

export default function CocokkanPdf({ docHash }: { docHash: string }) {
  const [hasil, setHasil] = useState<"cocok" | "beda" | string | null>(null);

  async function pilih(file?: File) {
    if (!file) return;
    const salah = cekPdf(file);
    if (salah) return setHasil(salah);
    setHasil((await hashPdf(file)) === docHash ? "cocok" : "beda");
  }

  return (
    <div className="space-y-2 print:hidden">
      <label className="tombol-garis cursor-pointer">
        Cocokkan dengan PDF
        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => pilih(e.target.files?.[0])} />
      </label>
      {hasil === "cocok" && <p className="text-sm font-medium text-emerald-700">✔ PDF ini sama persis dengan ijazah yang tercatat.</p>}
      {hasil === "beda" && (
        <p className="text-sm font-medium text-red-700">
          ✘ PDF ini berbeda dari ijazah yang tercatat (sudah diubah, atau hasil scan/simpan ulang).
        </p>
      )}
      {hasil && hasil !== "cocok" && hasil !== "beda" && <p className="text-sm text-red-700">{hasil}</p>}
    </div>
  );
}
