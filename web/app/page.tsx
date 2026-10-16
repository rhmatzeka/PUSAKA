import Link from "next/link";
import { jaringan } from "@/lib/chain";

const TAHAP = [
  {
    no: "1.0",
    judul: "terbit",
    aktor: "BAAK",
    isi: "Berkas PDF ijazah dihitung sidik jarinya dengan Keccak-256. Sidik jari itu ditandatangani wallet resmi BAAK memakai ECDSA, lalu dicatat sebagai token ERC-721 yang tidak bisa dipindahtangankan.",
    rinci: ["Keccak-256 atas seluruh bita berkas", "Tanda tangan ECDSA secp256k1", "Berkas dan metadata ke IPFS"],
  },
  {
    no: "2.0",
    judul: "bagikan",
    aktor: "Alumni",
    isi: "Alumni mengambil salinan PDF resmi beserta kode QR-nya dari portal, lalu melampirkannya saat melamar kerja. Ijazah tetap milik alumni; token tidak dapat dijual atau dipindahkan.",
    rinci: ["Unduh PDF asli", "Unduh QR untuk ijazah kertas", "Bagikan tautan verifikasi"],
  },
  {
    no: "3.0",
    judul: "periksa",
    aktor: "Pemberi kerja",
    isi: "Pemeriksa mengunggah berkas atau memindai QR. Sidik jari dihitung ulang di peramban dan dicocokkan dengan catatan di rantai. Hasilnya keluar saat itu juga, tanpa akun dan tanpa biaya.",
    rinci: ["Tanpa wallet, tanpa login", "Berkas tidak dikirim ke server", "Bisa dicek ulang di penjelajah blok"],
  },
];

const JAMINAN = [
  ["Satu bita berubah", "Sidik jari ikut berubah. Berkas yang disunting, dipindai ulang, atau dikompres tidak akan cocok."],
  ["Bukan BAAK", "Kontrak menolak penerbitan dari wallet tanpa peran ISSUER, dan memeriksa tanda tangan penerbitnya."],
  ["Bukan pemiliknya", "Token bersifat soulbound. Tidak ada jalur transfer, jadi ijazah tidak bisa diklaim orang lain."],
  ["Dicabut", "Ijazah bermasalah ditandai DICABUT beserta alasannya. Riwayat penerbitannya tetap tersimpan."],
];

const TANYA = [
  [
    "Perlu wallet atau akun untuk memeriksa?",
    "Tidak. Pemeriksaan terbuka untuk siapa saja, tanpa login dan tanpa biaya. Wallet hanya dipakai BAAK untuk menerbitkan dan alumni untuk membuka portalnya.",
  ],
  [
    "Kenapa hasil pindai saya TIDAK VALID?",
    "Yang dicatat adalah sidik jari berkas asli dari kampus. Memindai, mencetak ulang, atau mengompres menghasilkan berkas baru dengan sidik jari berbeda. Pakai berkas asli, atau pindai kode QR pada ijazah kertas.",
  ],
  [
    "Apakah data pribadi ikut tersimpan di rantai?",
    "Tidak. Di rantai hanya ada sidik jari dokumen, tanda tangan penerbit, dan status. Metadata memuat data yang memang tercetak pada ijazah, tanpa NIK, alamat, atau nomor telepon.",
  ],
  [
    "Kalau situs ini mati?",
    "Catatannya tetap ada di rantai. Siapa pun bisa membacanya lewat penjelajah blok memakai alamat kontrak di kaki halaman ini.",
  ],
];

export default function Beranda() {
  return (
    <>
      {/* Hero — left-slam display, asymmetric occupancy (7 of 12 columns) */}
      <section className="shell grid gap-x-8 gap-y-10 pb-16 pt-12 md:grid-cols-12 md:pb-24 md:pt-20">
        <div className="md:col-span-7">
          <h1 className="display">ijazah yang bisa dibuktikan</h1>
          <p className="lede mt-8 text-[var(--color-ink-2)]">
            Register ijazah digital Universitas Pamulang. Sidik jari tiap berkas dan tanda tangan BAAK tercatat di
            rantai, jadi keasliannya bisa diperiksa siapa pun dalam hitungan detik.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/verify" className="act">
              Periksa ijazah
            </Link>
            <Link href="/alumni" className="act-line">
              Portal alumni
            </Link>
          </div>
        </div>

        {/* Constructed figure: stepped bars on the column tracks */}
        <figure className="md:col-span-4 md:col-start-9 md:self-end">
          <div className="flex h-40 items-end gap-2" aria-hidden>
            {[28, 46, 100, 62, 18].map((t, i) => (
              <span
                key={t}
                className="block flex-1"
                style={{
                  height: `${t}%`,
                  background: i === 2 ? "var(--color-signal)" : "var(--color-paper-3)",
                }}
              />
            ))}
          </div>
          <figcaption className="label mt-3 block border-t border-[var(--color-rule)] pt-3">
            Satu berkas → satu sidik jari 256 bit → satu token
          </figcaption>
        </figure>
      </section>

      {/* The plate: one loud move per page */}
      <section className="plate">
        <div className="shell grid gap-6 md:grid-cols-12 md:items-center">
          <p className="display-s md:col-span-8">ubah satu huruf, hasilnya tidak valid</p>
          <p className="md:col-span-4 md:text-right">
            <span className="data text-[var(--color-on-signal)] opacity-80">Keccak-256 · ECDSA secp256k1 · ERC-721</span>
          </p>
        </div>
      </section>

      {/* Narrative Workflow: three ordinal stages, numeral as object */}
      {TAHAP.map((t) => (
        <section key={t.no} className="band overflow-clip">
          <div className="shell grid gap-x-8 gap-y-6 md:grid-cols-12">
            <div className="md:col-span-3">
              <p className="label">{t.aktor}</p>
              <p className="display-s mt-2">
                {t.no} {t.judul}
              </p>
            </div>
            <p className="prose md:col-span-5">{t.isi}</p>
            <ul className="md:col-span-3 md:col-start-10">
              {t.rinci.map((r) => (
                <li key={r} className="border-t border-[var(--color-rule)] py-2 text-[var(--text-sm)] first:border-0 first:pt-0">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      {/* Guarantee matrix — one ruled object, not four tiles */}
      <section className="band-tight">
        <div className="shell">
          <h2 className="display-s">yang dijaga sistem</h2>
          <div className="cells mt-8 md:grid-cols-4">
            {JAMINAN.map(([judul, isi]) => (
              <div key={judul} className="cell">
                <h3 className="heading text-[var(--text-lg)]">{judul}</h3>
                <p className="mt-2 text-[var(--text-sm)] leading-relaxed text-[var(--color-ink-2)]">{isi}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ as an index of rows */}
      <section className="band-tight">
        <div className="shell grid gap-x-8 gap-y-6 md:grid-cols-12">
          <h2 className="display-s md:col-span-4">pertanyaan</h2>
          <div className="md:col-span-8">
            {TANYA.map(([t, j]) => (
              <details key={t} className="group border-t border-[var(--color-rule)] py-4 first:border-t-0">
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 font-semibold">
                  {t}
                  <span aria-hidden className="text-[var(--color-signal)] transition-transform duration-150 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="prose mt-3 text-[var(--text-sm)]">{j}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing action */}
      <section className="band-tight pb-20">
        <div className="shell flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="display-s">periksa sekarang</p>
            <p className="data mt-2 text-[var(--color-muted)]">Dibaca langsung dari {jaringan.nama}</p>
          </div>
          <Link href="/verify" className="act">
            Buka halaman verifikasi
          </Link>
        </div>
      </section>
    </>
  );
}
