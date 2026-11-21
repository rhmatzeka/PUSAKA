import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { alamatKontrak, jaringan } from "@/lib/chain";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PUSAKA - Verifikasi Ijazah UNPAM",
  description: "Verifikasi ijazah digital Universitas Pamulang berbasis smart contract ERC-721 dan IPFS",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-slate-200 bg-white print:hidden">
          <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              PUSAKA <span className="text-sm font-normal text-slate-500">Verifikasi Ijazah UNPAM</span>
            </Link>
            <div className="ml-auto flex gap-5 text-sm">
              <Link href="/verify" className="hover:underline">Verifikasi</Link>
              <Link href="/alumni" className="hover:underline">Alumni</Link>
              <Link href="/admin" className="hover:underline">Admin</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 print:hidden">
          Kontrak{" "}
          {jaringan.explorer ? (
            <a className="font-mono underline" href={`${jaringan.explorer}/address/${alamatKontrak}#code`} target="_blank">
              {alamatKontrak}
            </a>
          ) : (
            <span className="font-mono">{alamatKontrak}</span>
          )}{" "}
          di {jaringan.nama}
        </footer>
      </body>
    </html>
  );
}
