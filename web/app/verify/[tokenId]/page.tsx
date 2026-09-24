// Hasil verifikasi: selalu baca data terbaru dari chain
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import CocokkanPdf from "@/components/CocokkanPdf";
import LabelStatus from "@/components/LabelStatus";
import TombolCetak from "@/components/TombolCetak";
import { alamatKontrak, jaringan, singkat } from "@/lib/chain";
import { gatewayUrl } from "@/lib/ipfs";
import { ambilIjazah, atribut, namaLulusan } from "@/lib/server/ijazah";

export const dynamic = "force-dynamic"; // WAJIB: tanpa ini status DICABUT bisa tertahan di cache

const tanggal = (detik: number) =>
  new Date(detik * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function HasilVerifikasi({ params, searchParams }: PageProps<"/verify/[tokenId]">) {
  const { tokenId } = await params;
  const { hash } = await searchParams;
  const ijazah = /^\d+$/.test(tokenId) ? await ambilIjazah(Number(tokenId)) : null;

  if (!ijazah) {
    return (
      <div className="space-y-4">
        <LabelStatus status="TIDAK VALID" catatan={`Ijazah dengan token ID ${tokenId} tidak ditemukan.`} />
        <Link href="/verify" className="tombol-garis">Periksa ijazah lain</Link>
      </div>
    );
  }

  const h = await headers();
  const asal = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const qr = await QRCode.toDataURL(`${asal}/verify/${ijazah.id}`, { margin: 1, width: 180 });
  const m = ijazah.metadata;
  const baris: [string, React.ReactNode][] = [
    ["Nama", namaLulusan(m)],
    ["NIM", atribut(m, "NIM")],
    ["Program Studi", atribut(m, "Program Studi")],
    ["Nomor Ijazah", atribut(m, "Nomor Ijazah")],
    ["Tanggal Lulus", atribut(m, "Tanggal Lulus")],
    ["Diterbitkan", <>{tanggal(ijazah.diterbitkan)} oleh <span className="font-mono">{singkat(ijazah.penerbit)}</span></>],
    ["Token ID", `#${ijazah.id}`],
    ["Sidik jari", <span key="h" className="break-all font-mono text-xs">{ijazah.docHash}</span>],
  ];

  return (
    <div className="space-y-6">
      <LabelStatus
        status={ijazah.status}
        catatan={
          ijazah.dicabut
            ? `Alasan pencabutan: ${ijazah.alasanCabut || "-"}`
            : hash === ijazah.docHash
              ? "✔ PDF yang Anda unggah sama persis dengan ijazah yang tercatat."
              : undefined
        }
      />

      <div className="kartu grid gap-6 sm:grid-cols-[1fr_auto]">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
          {baris.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-500">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR verifikasi token ${ijazah.id}`} className="mx-auto" width={180} height={180} />
          <p className="text-xs text-slate-500">Token ID #{ijazah.id}</p>
        </div>
      </div>

      {!m && <p className="text-sm text-amber-700">Metadata IPFS belum bisa diambil. Status di atas tetap dibaca langsung dari blockchain.</p>}

      <div className="flex flex-wrap gap-3 print:hidden">
        {m && <a className="tombol-garis" href={gatewayUrl(m.document)} target="_blank">Lihat PDF</a>}
        {jaringan.explorer && (
          <>
            <a className="tombol-garis" href={`${jaringan.explorer}/nft/${alamatKontrak}/${ijazah.id}`} target="_blank">Lihat transaksi di Polygonscan</a>
            <a className="tombol-garis" href={`${jaringan.explorer}/address/${alamatKontrak}#code`} target="_blank">Cek kontrak di Polygonscan</a>
          </>
        )}
        <TombolCetak />
      </div>
      <CocokkanPdf docHash={ijazah.docHash} />
      <p className="text-xs text-slate-500 print:hidden">
        Hasil ini dibaca langsung dari smart contract {singkat(alamatKontrak)} di {jaringan.nama}. Anda juga bisa mengeceknya sendiri di
        penjelajah blok tanpa melalui website ini.
      </p>
    </div>
  );
}
