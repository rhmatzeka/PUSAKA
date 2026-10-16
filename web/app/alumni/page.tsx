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
    <div className="shell pb-20 pt-12">
      <header className="grid gap-x-8 gap-y-4 md:grid-cols-12">
        <h1 className="display-s md:col-span-5">ijazah saya</h1>
        <p className="prose md:col-span-6 md:col-start-7">
          Ambil salinan resmi dan kode QR ijazah Anda dari sini, lalu lampirkan saat melamar kerja. Ijazah terikat pada
          wallet Anda dan tidak dapat dipindahtangankan.
        </p>
      </header>

      {!daftar ? (
        <section className="mt-14 grid gap-x-8 gap-y-5 border-t-2 border-[var(--color-ink)] pt-6 md:grid-cols-12">
          <p className="prose md:col-span-6">
            Hubungkan wallet MetaMask yang Anda daftarkan ke BAAK saat wisuda. Menghubungkan wallet tidak memindahkan
            apa pun dan tidak dikenai biaya.
          </p>
          <div className="md:col-span-4 md:col-start-9">
            <button className="act" onClick={masuk} disabled={sedang}>
              {sedang ? "Menunggu MetaMask…" : "Hubungkan wallet"}
            </button>
            {error && (
              <p role="alert" className="mt-4 border-2 border-[var(--color-state-invalid)] p-3 text-[var(--text-sm)] font-semibold text-[var(--color-state-invalid)]">
                {error}
              </p>
            )}
          </div>
        </section>
      ) : (
        <>
          <p className="data mt-10 border-t-2 border-[var(--color-ink)] pt-3 text-[var(--color-muted)]">
            Wallet {singkat(alamat)} · {daftar.length} ijazah
          </p>

          {daftar.length === 0 && (
            <p className="prose mt-8">
              Belum ada ijazah untuk wallet ini. Pastikan Anda memakai wallet yang didaftarkan ke BAAK saat wisuda.
            </p>
          )}

          {daftar.map((x) => (
            <section key={x.id} className="grid gap-x-8 gap-y-6 border-t border-[var(--color-rule)] py-8 md:grid-cols-12">
              <div className="md:col-span-7">
                <p className="label">{x.status === "VALID" ? "■ Aktif" : `▲ ${x.status}`}</p>
                <h2 className="display-s mt-1">{x.metadata?.name.replace(/^Ijazah - /, "") ?? `ijazah #${x.id}`}</h2>
                <dl className="mt-5">
                  {[
                    ["Program studi", atribut(x, "Program Studi")],
                    ["NIM", atribut(x, "NIM")],
                    ["Nomor ijazah", atribut(x, "Nomor Ijazah")],
                    ["Token", `#${x.id}`],
                  ].map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[9rem_1fr] gap-4 border-t border-[var(--color-rule)] py-2 text-[var(--text-sm)]">
                      <dt className="label">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                {x.dicabut && (
                  <p className="mt-4 border-2 border-[var(--color-state-revoked)] p-3 text-[var(--text-sm)] font-semibold text-[var(--color-state-revoked)]">
                    Dicabut: {x.alasanCabut}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                  {x.metadata && (
                    <a className="act" href={gatewayUrl(x.metadata.document)} download={`ijazah-${x.id}.pdf`} target="_blank">
                      Unduh PDF
                    </a>
                  )}
                  <a className="act-text" href={x.qr} download={`qr-ijazah-${x.id}.png`}>
                    Unduh QR
                  </a>
                  <Link className="act-text" href={`/verify/${x.id}`}>
                    Halaman verifikasi
                  </Link>
                </div>
                <p className="prose mt-5 text-[var(--text-sm)]">
                  Kirim berkas PDF ini apa adanya. Berkas yang dicetak ulang, dikompres, atau dipindai tidak akan
                  cocok; untuk ijazah kertas, pakai kode QR.
                </p>
              </div>
              <figure className="md:col-span-3 md:col-start-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.qr} alt={`Kode QR token ${x.id}`} width={200} height={200} className="w-full max-w-50" />
                <figcaption className="label mt-2">Token #{x.id}</figcaption>
              </figure>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
