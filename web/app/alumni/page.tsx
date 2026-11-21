"use client";
// Portal alumni: ijazah milik wallet + unduh PDF + QR
import Link from "next/link";
import QRCode from "qrcode";
import { useState } from "react";
import { singkat } from "@/lib/chain";
import { pesanError } from "@/lib/errors";
import { gatewayUrl } from "@/lib/ipfs";
import { connect, kontrakDengan } from "@/lib/wallet";
import type { Ijazah } from "@/lib/server/ijazah";

type Kartu = Ijazah & { qr: string };

const atribut = (x: Ijazah, nama: string) => x.metadata?.attributes.find((a) => a.trait_type === nama)?.value ?? "-";

export default function PortalAlumni() {
  const [alamat, setAlamat] = useState("");
  const [daftar, setDaftar] = useState<Kartu[] | null>(null);
  const [error, setError] = useState("");
  const [sedang, setSedang] = useState(false);

  async function masuk() {
    setError("");
    setSedang(true);
    try {
      const signer = await connect();
      const a = await signer.getAddress();
      const ids: bigint[] = await kontrakDengan(signer).tokensOf(a);
      const kartu = await Promise.all(
        ids.map(async (id) => {
          const x: Ijazah = await (await fetch(`/api/ijazah/${id}`)).json();
          const qr = await QRCode.toDataURL(`${location.origin}/verify/${id}`, { margin: 1, width: 360 });
          return { ...x, qr };
        }),
      );
      setAlamat(a);
      setDaftar(kartu);
    } catch (e) {
      setError(pesanError(e));
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Portal Alumni</h1>
      {!daftar ? (
        <div className="kartu space-y-3">
          <p className="text-sm text-slate-600">Hubungkan wallet MetaMask yang Anda daftarkan saat wisuda untuk melihat ijazah Anda.</p>
          <button className="tombol" onClick={masuk} disabled={sedang}>{sedang ? "Menunggu MetaMask…" : "Hubungkan wallet"}</button>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">Wallet <span className="font-mono">{singkat(alamat)}</span></p>
          {daftar.length === 0 && <p className="kartu text-slate-600">Belum ada ijazah untuk wallet ini.</p>}
          {daftar.map((x) => (
            <div key={x.id} className="kartu grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1 text-sm">
                <p className="text-lg font-semibold">{x.metadata?.name.replace(/^Ijazah - /, "") ?? `Ijazah #${x.id}`}</p>
                <p>{atribut(x, "Program Studi")} · NIM {atribut(x, "NIM")}</p>
                <p>No. Ijazah {atribut(x, "Nomor Ijazah")} · Token #{x.id}</p>
                <p className={x.status === "VALID" ? "text-emerald-700" : "text-amber-700"}>
                  Status: {x.status}{x.dicabut && ` (${x.alasanCabut})`}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {x.metadata && <a className="tombol" href={gatewayUrl(x.metadata.document)} download={`ijazah-${x.id}.pdf`} target="_blank">Unduh PDF</a>}
                  <a className="tombol-garis" href={x.qr} download={`qr-ijazah-${x.id}.png`}>Unduh QR (PNG)</a>
                  <Link className="tombol-garis" href={`/verify/${x.id}`}>Halaman verifikasi</Link>
                </div>
                <p className="pt-2 text-xs text-slate-500">
                  Kirim PDF ini apa adanya ke pemberi kerja. PDF yang dicetak ulang, dikompres, atau hasil scan tidak akan cocok; gunakan QR untuk ijazah kertas.
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.qr} alt={`QR token ${x.id}`} width={160} height={160} className="mx-auto" />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
