"use client";

export default function TombolCetak() {
  return (
    <button className="tombol-garis print:hidden" onClick={() => window.print()}>
      Cetak lembar verifikasi
    </button>
  );
}
