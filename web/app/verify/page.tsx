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
  const [seret, setSeret] = useState(false);
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
    <div className="shell pb-20 pt-12">
      <header className="grid gap-x-8 gap-y-4 md:grid-cols-12">
        <h1 className="display-s md:col-span-5">periksa ijazah</h1>
        <p className="prose md:col-span-6 md:col-start-7">
          Dua jalan masuk. Berkas PDF tidak pernah dikirim ke server: sidik jarinya dihitung di peramban Anda, dan
          hanya sidik jari itu yang dikirim untuk dicocokkan.
        </p>
      </header>

      {/* Jalur A — token ID */}
      <section className="mt-14 grid gap-x-8 gap-y-5 border-t-2 border-[var(--color-ink)] pt-6 md:grid-cols-12">
        <div className="md:col-span-3">
          <p className="label">Jalur A</p>
          <h2 className="heading mt-1">Token ID atau QR</h2>
        </div>
        <form
          className="md:col-span-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d+$/.test(tokenId) && Number(tokenId) > 0) router.push(`/verify/${tokenId}`);
            else setError("Token ID harus berupa angka.");
          }}
        >
          <label className="label" htmlFor="token">
            Nomor token
          </label>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <input
              id="token"
              className="field max-w-64 flex-1"
              inputMode="numeric"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value.trim())}
              placeholder="12"
            />
            <button className="act">Periksa</button>
          </div>
          <p className="label mt-3 normal-case tracking-normal">Angka ini tercetak di bawah kode QR pada ijazah.</p>
        </form>
      </section>

      {/* Jalur B — unggah berkas */}
      <section className="mt-12 grid gap-x-8 gap-y-5 border-t-2 border-[var(--color-ink)] pt-6 md:grid-cols-12">
        <div className="md:col-span-3">
          <p className="label">Jalur B</p>
          <h2 className="heading mt-1">Berkas PDF</h2>
        </div>
        <div className="md:col-span-9">
          <label
            className={`mark-diagonal flex cursor-pointer flex-col items-start gap-2 border-2 px-6 py-10 transition-colors duration-150 ${
              sedang ? "cursor-progress" : ""
            }`}
            style={{
              borderColor: seret ? "var(--color-signal)" : "var(--color-ink)",
              background: seret ? "var(--color-paper-2)" : "var(--color-paper)",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setSeret(true);
            }}
            onDragLeave={() => setSeret(false)}
            onDrop={(e) => {
              e.preventDefault();
              setSeret(false);
              periksaPdf(e.dataTransfer.files[0]);
            }}
          >
            <span className="display-s">{sedang ? "menghitung…" : "letakkan berkas"}</span>
            <span className="text-[var(--text-sm)] text-[var(--color-ink-2)]">
              Seret PDF ijazah ke area ini, atau klik untuk memilih. Maksimal 4 MB.
            </span>
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              disabled={sedang}
              onChange={(e) => periksaPdf(e.target.files?.[0])}
            />
          </label>
        </div>
      </section>

      {error && (
        <p role="alert" className="mt-8 border-2 border-[var(--color-state-invalid)] p-4 font-semibold text-[var(--color-state-invalid)]">
          {error}
        </p>
      )}

      {tidakValid && (
        <div className="mt-10 grid gap-6 md:grid-cols-12">
          <div className="md:col-span-7">
            <LabelStatus
              status="TIDAK VALID"
              catatan="Berkas hasil pindai atau simpan ulang tidak akan cocok. Gunakan berkas asli, atau pindai kode QR pada ijazah kertas."
            />
          </div>
          <dl className="md:col-span-5">
            {[
              ["Berkas", tidakValid.nama],
              ["Sidik jari", tidakValid.hash],
              ["Waktu periksa", `${tidakValid.detik} detik`],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-[var(--color-rule)] py-3">
                <dt className="label">{k}</dt>
                <dd className="data mt-1 break-all">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
