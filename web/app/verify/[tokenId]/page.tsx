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
      <div className="shell grid gap-6 pb-20 pt-12 md:grid-cols-12">
        <div className="md:col-span-7">
          <LabelStatus status="TIDAK VALID" catatan={`Ijazah dengan token ${tokenId} tidak ditemukan di register ini.`} />
        </div>
        <div className="md:col-span-5 md:self-end">
          <Link href="/verify" className="act-line">
            Periksa ijazah lain
          </Link>
        </div>
      </div>
    );
  }

  const h = await headers();
  const asal = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const qr = await QRCode.toDataURL(`${asal}/verify/${ijazah.id}`, { margin: 1, width: 240 });
  const m = ijazah.metadata;
  const baris: [string, React.ReactNode][] = [
    ["Nama", namaLulusan(m)],
    ["NIM", atribut(m, "NIM")],
    ["Program studi", atribut(m, "Program Studi")],
    ["Nomor ijazah", atribut(m, "Nomor Ijazah")],
    ["Tanggal lulus", atribut(m, "Tanggal Lulus")],
    [
      "Diterbitkan",
      <>
        {tanggal(ijazah.diterbitkan)} oleh <span className="data">{singkat(ijazah.penerbit)}</span>
      </>,
    ],
    ["Token", `#${ijazah.id}`],
    ["Sidik jari", <span key="h" className="data break-all">{ijazah.docHash}</span>],
  ];

  return (
    <article className="shell pb-20 pt-12">
      <div className="grid gap-x-8 gap-y-10 md:grid-cols-12">
        {/* Status + catatan kecocokan */}
        <div className="md:col-span-7">
          <LabelStatus
            status={ijazah.status}
            catatan={
              ijazah.dicabut
                ? `Alasan pencabutan: ${ijazah.alasanCabut || "tidak dicantumkan"}`
                : hash === ijazah.docHash
                  ? "Berkas yang Anda unggah sama persis dengan yang tercatat."
                  : undefined
            }
          />
        </div>

        {/* QR di kolom margin */}
        <figure className="md:col-span-4 md:col-start-9">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`Kode QR verifikasi token ${ijazah.id}`} width={240} height={240} className="w-full max-w-60" />
          <figcaption className="label mt-3 border-t border-[var(--color-rule)] pt-3">
            Token #{ijazah.id} · pindai untuk membuka halaman ini
          </figcaption>
        </figure>

        {/* Rekaman: dokumen, bukan kartu */}
        <section className="md:col-span-12">
          <h2 className="label border-t-2 border-[var(--color-ink)] pt-4">Rekaman ijazah</h2>
          <dl className="mt-2">
            {baris.map(([k, v]) => (
              <div key={k} className="grid gap-1 border-t border-[var(--color-rule)] py-3 md:grid-cols-12 md:gap-8">
                <dt className="label md:col-span-3">{k}</dt>
                <dd className="font-medium md:col-span-9">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {!m && (
          <p className="md:col-span-8">
            <span className="border-2 border-[var(--color-state-revoked)] px-4 py-3 text-[var(--text-sm)] font-semibold text-[var(--color-state-revoked)]">
              Metadata IPFS belum bisa diambil. Status di atas tetap dibaca langsung dari rantai.
            </span>
          </p>
        )}

        {/* Tindakan: tautan bergaris, bukan tumpukan tombol */}
        <div className="no-print flex flex-wrap items-center gap-x-8 gap-y-4 md:col-span-12">
          {m && (
            <a className="act" href={gatewayUrl(m.document)} target="_blank">
              Lihat berkas PDF
            </a>
          )}
          {jaringan.explorer && (
            <>
              <a className="act-text" href={`${jaringan.explorer}/nft/${alamatKontrak}/${ijazah.id}`} target="_blank">
                Token di penjelajah blok
              </a>
              <a className="act-text" href={`${jaringan.explorer}/address/${alamatKontrak}#code`} target="_blank">
                Kode kontrak
              </a>
            </>
          )}
          <TombolCetak />
        </div>

        <div className="md:col-span-8">
          <CocokkanPdf docHash={ijazah.docHash} />
        </div>

        <p className="prose no-print text-[var(--text-sm)] md:col-span-8">
          Hasil ini dibaca langsung dari kontrak {singkat(alamatKontrak)} di {jaringan.nama}. Anda bisa mengeceknya
          sendiri di penjelajah blok tanpa melewati situs ini.
        </p>
      </div>
    </article>
  );
}
