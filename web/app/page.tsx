import Link from "next/link";

export default function Beranda() {
  return (
    <div className="space-y-8">
      <section className="kartu space-y-4 p-8">
        <h1 className="text-3xl font-bold">Cek keaslian ijazah Universitas Pamulang</h1>
        <p className="text-slate-600">
          Setiap ijazah digital dicatat di blockchain sebagai token ERC-721 yang tidak dapat dipindahtangankan.
          Sidik jari dokumen (hash Keccak-256) dan tanda tangan digital BAAK (ECDSA) disimpan permanen, sehingga
          perubahan sekecil apa pun pada berkas ijazah akan langsung terdeteksi.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/verify" className="tombol">Verifikasi ijazah</Link>
          <Link href="/alumni" className="tombol-garis">Portal alumni</Link>
        </div>
        <p className="text-sm text-slate-500">Tidak perlu login, tidak perlu wallet, dan gratis.</p>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["1. Diterbitkan", "BAAK menandatangani sidik jari PDF ijazah dengan wallet-nya, lalu mencatatnya di smart contract."],
          ["2. Dibagikan", "Alumni membagikan berkas PDF asli atau kode QR kepada pemberi kerja."],
          ["3. Diverifikasi", "Siapa pun mengunggah PDF atau memindai QR dan langsung melihat status VALID, DICABUT, atau TIDAK VALID."],
        ].map(([judul, isi]) => (
          <div key={judul} className="kartu">
            <h2 className="mb-1 font-semibold">{judul}</h2>
            <p className="text-sm text-slate-600">{isi}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
