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
    <div className="no-print border-t-2 border-[var(--color-ink)] pt-4">
      <p className="label">Cocokkan berkas Anda</p>
      <label className="act-line mt-3 cursor-pointer">
        Pilih berkas PDF
        <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => pilih(e.target.files?.[0])} />
      </label>
      {hasil === "cocok" && (
        <p className="mt-4 border-2 border-[var(--color-state-valid)] px-4 py-3 text-[var(--text-sm)] font-semibold text-[var(--color-state-valid)]">
          ■ Sama persis dengan berkas yang tercatat.
        </p>
      )}
      {hasil === "beda" && (
        <p className="mt-4 border-2 border-[var(--color-state-invalid)] px-4 py-3 text-[var(--text-sm)] font-semibold text-[var(--color-state-invalid)]">
          ✕ Berbeda dari berkas yang tercatat: sudah diubah, dipindai ulang, atau disimpan ulang.
        </p>
      )}
      {hasil && hasil !== "cocok" && hasil !== "beda" && (
        <p className="mt-4 text-[var(--text-sm)] font-semibold text-[var(--color-state-invalid)]">{hasil}</p>
      )}
    </div>
  );
}
