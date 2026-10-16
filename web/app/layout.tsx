import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Geist_Mono } from "next/font/google";
import TautanNav from "@/components/TautanNav";
import { alamatKontrak, jaringan, singkat } from "@/lib/chain";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PUSAKA — Register Ijazah Digital UNPAM",
  description: "Register ijazah digital Universitas Pamulang: sidik jari Keccak-256 dan tanda tangan ECDSA dicatat sebagai token ERC-721.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${archivo.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {/* N6 masthead · knobs: wordmark=left-slam, meta-row=above, rule=double */}
        <header className="no-print">
          <div className="border-b border-[var(--color-rule)]">
            <div className="shell flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2">
              <p className="label">Register Ijazah Digital · Universitas Pamulang</p>
              <p className="data text-[var(--color-muted)]">
                {jaringan.nama} · {singkat(alamatKontrak)}
              </p>
            </div>
          </div>

          <div className="shell flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-4 pt-6">
            <Link href="/" className="display-s leading-none">
              pusaka<span className="mark-square ml-1 align-baseline" aria-hidden />
            </Link>
            <nav aria-label="Utama" className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <TautanNav href="/verify">Verifikasi</TautanNav>
              <TautanNav href="/alumni">Alumni</TautanNav>
              <TautanNav href="/admin">Admin</TautanNav>
            </nav>
          </div>
          <div className="border-b-2 border-[var(--color-ink)]" />
          <div className="mt-[3px] border-b border-[var(--color-rule)]" />
        </header>

        <main className="sheet flex-1">{children}</main>

        {/* Ft4 dense colophon */}
        <footer className="no-print border-t-2 border-[var(--color-ink)]">
          <div className="shell py-8">
            <p className="data max-w-[78ch] leading-relaxed text-[var(--color-muted)]">
              PUSAKA · register ijazah digital Universitas Pamulang. Sidik jari dokumen Keccak-256, tanda tangan
              penerbit ECDSA secp256k1, token ERC-721 non-transferable. Kontrak{" "}
              {jaringan.explorer ? (
                <a
                  className="text-[var(--color-signal)] underline underline-offset-2"
                  href={`${jaringan.explorer}/address/${alamatKontrak}#code`}
                  target="_blank"
                >
                  {alamatKontrak}
                </a>
              ) : (
                <span className="text-[var(--color-ink-2)]">{alamatKontrak}</span>
              )}{" "}
              di {jaringan.nama}. Berkas ijazah disimpan di IPFS; verifikasi membaca langsung dari rantai, tanpa akun
              dan tanpa biaya. Skripsi Teknik Informatika, Fakultas Ilmu Komputer, 2026.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
