"use client";
// Verifikasi: masukkan token ID atau unggah PDF (hash dihitung di browser)
import { useRouter } from "next/navigation";
import { useState } from "react";
import LabelStatus from "@/components/LabelStatus";
import { cekPdf, hashPdf } from "@/lib/hash";

export default function Verifikasi() {
  const router = useRouter();
  const [tokenId, setTokenId] = useState("");
  const [sedang, setSedang] = useState(false);
  const [error, setError] = useState("");
  const [tidakValid, setTidakValid] = useState<{ nama: string; hash: string; detik: string } | null>(null);

  async function periksaPdf(file?: File) {
    if (!file) return;
    setError("");
    setTidakValid(null);
    const salah = cekPdf(file);
    if (salah) return setError(salah);
    setSedang(true);
    const t0 = performance.now();
    try {
      const hash = await hashPdf(file);
      const r = await fetch(`/api/verify?hash=${hash}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (j.tokenId !== "0") return router.push(`/verify/${j.tokenId}?hash=${hash}`);
      setTidakValid({ nama: file.name, hash, detik: ((performance.now() - t0) / 1000).toFixed(2) });
    } catch (e) {
      setError(`Gagal memeriksa: ${(e as Error).message}`);
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Verifikasi Ijazah</h1>
      <form
        className="kartu flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d+$/.test(tokenId) && Number(tokenId) > 0) router.push(`/verify/${tokenId}`);
          else setError("Token ID harus berupa angka.");
        }}
      >
        <div className="flex-1">
          <label className="label" htmlFor="token">Token ID (tertera di bawah kode QR)</label>
          <input id="token" className="input" inputMode="numeric" value={tokenId} onChange={(e) => setTokenId(e.target.value.trim())} placeholder="mis. 12" />
        </div>
        <button className="tombol">Periksa</button>
      </form>

      <p className="text-center text-sm text-slate-500">atau</p>

      <label
        className="kartu flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed py-10 text-center hover:bg-slate-50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          periksaPdf(e.dataTransfer.files[0]);
        }}
      >
        <span className="font-medium">{sedang ? "Memeriksa…" : "Seret PDF ijazah ke sini atau klik untuk memilih"}</span>
        <span className="text-xs text-slate-500">Maks 4 MB. Berkas tidak dikirim ke server, hanya sidik jarinya.</span>
        <input type="file" accept="application/pdf" className="hidden" disabled={sedang} onChange={(e) => periksaPdf(e.target.files?.[0])} />
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {tidakValid && (
        <div className="space-y-2">
          <LabelStatus status="TIDAK VALID" catatan="Hasil scan atau PDF yang disimpan ulang tidak akan cocok. Gunakan berkas asli atau kode QR." />
          <p className="break-all text-xs text-slate-500">
            {tidakValid.nama} · sidik jari <span className="font-mono">{tidakValid.hash}</span> · diperiksa dalam {tidakValid.detik} detik
          </p>
        </div>
      )}
      <p className="text-sm text-slate-500">Tidak perlu login atau wallet.</p>
    </div>
  );
}
