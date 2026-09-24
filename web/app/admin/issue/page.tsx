"use client";
// Terbitkan ijazah: tunggal atau batch dari CSV (maks 25 per transaksi)
import Link from "next/link";
import { useState } from "react";
import { useSesi } from "@/components/SesiAdmin";
import { pesanError } from "@/lib/errors";
import { cekPdf, hashPdf } from "@/lib/hash";
import { bacaCsv, cekData, hashBaru, tandatanganiDanUnggah, tokenDariReceipt, type DataLulusan } from "@/lib/terbit";

const MAKS_BATCH = 25;
const KOSONG: DataLulusan = { nama: "", nim: "", prodi: "Teknik Informatika", nomor_ijazah: "", tanggal_lulus: "", wallet: "" };

export default function Terbitkan() {
  const [mode, setMode] = useState<"tunggal" | "batch">("tunggal");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Terbitkan Ijazah</h1>
      <div className="flex gap-4 text-sm">
        {(["tunggal", "batch"] as const).map((m) => (
          <label key={m} className="flex items-center gap-2">
            <input type="radio" checked={mode === m} onChange={() => setMode(m)} /> {m === "tunggal" ? "Tunggal" : "Batch CSV"}
          </label>
        ))}
      </div>
      {mode === "tunggal" ? <FormTunggal /> : <FormBatch />}
    </div>
  );
}

function Hasil({ ids, detik }: { ids: number[]; detik: string }) {
  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
      <p className="font-semibold">✔ Berhasil diterbitkan dalam {detik} detik.</p>
      <p className="mt-1 flex flex-wrap gap-x-3">
        Token:{" "}
        {ids.map((id) => (
          <Link key={id} href={`/verify/${id}`} className="underline">#{id}</Link>
        ))}
      </p>
    </div>
  );
}

function FormTunggal() {
  const { sesi } = useSesi();
  const [d, setD] = useState<DataLulusan>(KOSONG);
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState("");
  const [langkah, setLangkah] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [hasil, setHasil] = useState<{ ids: number[]; detik: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [kunciInput, setKunciInput] = useState(0); // ganti key = kosongkan input file setelah berhasil

  async function pilihPdf(f?: File) {
    setHash("");
    setFile(null);
    if (!f) return;
    const salah = cekPdf(f);
    if (salah) return setError(salah);
    setError("");
    setFile(f);
    setHash(await hashPdf(f));
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setHasil(null);
    const salah = !file ? "Pilih PDF ijazah." : cekData(d);
    if (salah) return setError(salah);
    setSibuk(true);
    setLangkah(["hash"]);
    const t0 = Date.now();
    try {
      const h = await hashBaru(sesi, file!);
      const a = await tandatanganiDanUnggah(sesi, file!, h, d, (l) => setLangkah((x) => [...x, l]));
      setLangkah((x) => [...x, "transaksi"]);
      const tx = await sesi.kontrak.issue(a.to, a.uri, a.hash, a.sig);
      const r = await tx.wait();
      setLangkah((x) => [...x, "selesai"]);
      setHasil({ ids: tokenDariReceipt(sesi, r), detik: ((Date.now() - t0) / 1000).toFixed(1) });
      setD(KOSONG);
      setFile(null);
      setHash("");
      setKunciInput((k) => k + 1);
    } catch (err) {
      setError(pesanError(err));
    } finally {
      setSibuk(false);
    }
  }

  const isian = (k: keyof DataLulusan, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input id={k} className="input" value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value.trimStart() })} {...extra} />
    </div>
  );

  return (
    <form className="kartu space-y-4" onSubmit={kirim}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pdf">PDF ijazah (maks 4 MB)</label>
          <input key={kunciInput} id="pdf" type="file" accept="application/pdf" className="input" onChange={(e) => pilihPdf(e.target.files?.[0])} />
        </div>
        {isian("wallet", "Wallet alumni", { placeholder: "0x…" })}
        {isian("nama", "Nama")}
        {isian("nim", "NIM")}
        {isian("prodi", "Program Studi")}
        {isian("nomor_ijazah", "Nomor Ijazah")}
        {isian("tanggal_lulus", "Tanggal Lulus", { type: "date" })}
      </div>
      <p className="break-all text-xs text-slate-500">Sidik jari: <span className="font-mono">{hash || "-"}</span> (dihitung otomatis)</p>
      <button className="tombol" disabled={sibuk}>{sibuk ? "Memproses…" : "Tanda tangani & Terbitkan"}</button>
      {langkah.length > 0 && (
        <p className="text-sm text-slate-600">
          Progres:{" "}
          {["hash", "tanda tangan", "IPFS", "transaksi"].map((l) => (
            <span key={l} className="mr-3">{langkah.includes(l) ? (sibuk && langkah.at(-1) === l ? "⏳" : "✔") : "○"} {l}</span>
          ))}
        </p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {hasil && <Hasil {...hasil} />}
    </form>
  );
}

function FormBatch() {
  const { sesi } = useSesi();
  const [csv, setCsv] = useState<File | null>(null);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progres, setProgres] = useState("");
  const [hasil, setHasil] = useState<{ ids: number[]; detik: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setHasil(null);
    if (!csv) return setErrors(["Pilih berkas CSV."]);
    const { baris, error } = bacaCsv(await csv.text());
    if (error) return setErrors([error]);
    if (baris.length === 0) return setErrors(["CSV tidak berisi data."]);
    if (baris.length > MAKS_BATCH) return setErrors([`Maksimal ${MAKS_BATCH} ijazah per batch (CSV berisi ${baris.length}).`]);

    // Validasi semua baris sebelum mulai; kalau ada yang salah, tidak ada transaksi
    setSibuk(true);
    setProgres("Memvalidasi…");
    const salah: string[] = [];
    const nim = new Set<string>();
    const hashSet = new Set<string>();
    const siap: { file: File; hash: string; d: DataLulusan }[] = [];
    for (const [i, b] of baris.entries()) {
      const no = `Baris ${i + 2}`;
      const e1 = cekData(b);
      if (e1) { salah.push(`${no}: ${e1}`); continue; }
      if (nim.has(b.nim)) salah.push(`${no}: NIM ${b.nim} ganda.`);
      nim.add(b.nim);
      const file = pdfs.find((f) => f.name === b.file_pdf);
      if (!file) { salah.push(`${no}: berkas ${b.file_pdf} belum diunggah.`); continue; }
      const e2 = cekPdf(file);
      if (e2) { salah.push(`${no}: ${e2}`); continue; }
      const hash = await hashPdf(file);
      if (hashSet.has(hash)) salah.push(`${no}: PDF sama dengan baris lain.`);
      else if ((await sesi.kontrak.tokenOfHash(hash)) !== 0n) salah.push(`${no}: ijazah ini sudah pernah diterbitkan.`);
      hashSet.add(hash);
      siap.push({ file, hash, d: b });
    }
    if (salah.length) {
      setErrors(salah);
      setSibuk(false);
      setProgres("");
      return;
    }

    const t0 = Date.now();
    try {
      const args = [];
      for (const [i, s] of siap.entries()) {
        setProgres(`${i}/${siap.length} ditandatangani`);
        args.push(await tandatanganiDanUnggah(sesi, s.file, s.hash, s.d, () => {}));
      }
      setProgres(`${siap.length}/${siap.length} ditandatangani · menunggu transaksi`);
      const tx = await sesi.kontrak.batchIssue(args.map((a) => a.to), args.map((a) => a.uri), args.map((a) => a.hash), args.map((a) => a.sig));
      const r = await tx.wait();
      setHasil({ ids: tokenDariReceipt(sesi, r), detik: ((Date.now() - t0) / 1000).toFixed(1) });
      setProgres("");
    } catch (err) {
      setErrors([pesanError(err)]);
      setProgres("");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form className="kartu space-y-4" onSubmit={kirim}>
      <p className="text-sm text-slate-600">
        Kolom CSV: <span className="font-mono">nama,nim,prodi,nomor_ijazah,tanggal_lulus,wallet,file_pdf</span> ·{" "}
        <a href="/templat-lulusan.csv" className="underline">unduh templat</a>. MetaMask akan meminta tanda tangan sekali per ijazah, lalu satu
        transaksi untuk semuanya.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="csv">Berkas CSV</label>
          <input id="csv" type="file" accept=".csv,text/csv" className="input" onChange={(e) => setCsv(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label className="label" htmlFor="pdfs">PDF ijazah (pilih semua sekaligus)</label>
          <input id="pdfs" type="file" accept="application/pdf" multiple className="input" onChange={(e) => setPdfs(Array.from(e.target.files ?? []))} />
        </div>
      </div>
      <button className="tombol" disabled={sibuk}>{sibuk ? "Memproses…" : "Tanda tangani & Terbitkan batch"}</button>
      {progres && <p className="text-sm text-slate-600">Progres: {progres}</p>}
      {errors.length > 0 && (
        <ul className="list-inside list-disc text-sm text-red-700">{errors.map((x) => <li key={x}>{x}</li>)}</ul>
      )}
      {hasil && <Hasil {...hasil} />}
    </form>
  );
}
