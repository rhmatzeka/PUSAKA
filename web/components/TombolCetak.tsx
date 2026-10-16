"use client";

export default function TombolCetak() {
  return (
    <button className="act-text no-print" onClick={() => window.print()}>
      Cetak lembar verifikasi
    </button>
  );
}
