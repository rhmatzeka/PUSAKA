import type { Status } from "@/lib/server/ijazah";

const GAYA: Record<Status, { warna: string; ikon: string; teks: string }> = {
  VALID: { warna: "border-emerald-300 bg-emerald-50 text-emerald-800", ikon: "✅", teks: "Ijazah ini tercatat di blockchain dan tidak diubah." },
  DICABUT: { warna: "border-amber-300 bg-amber-50 text-amber-800", ikon: "⚠️", teks: "Ijazah ini pernah diterbitkan, tetapi sudah dicabut oleh BAAK." },
  "TIDAK VALID": { warna: "border-red-300 bg-red-50 text-red-800", ikon: "❌", teks: "Berkas ini tidak cocok dengan ijazah mana pun yang diterbitkan." },
};

export default function LabelStatus({ status, catatan }: { status: Status; catatan?: string }) {
  const g = GAYA[status];
  return (
    <div className={`rounded-xl border p-5 ${g.warna}`}>
      <p className="text-2xl font-bold">{g.ikon} {status}</p>
      <p className="mt-1 text-sm">{g.teks}</p>
      {catatan && <p className="mt-2 text-sm font-medium">{catatan}</p>}
    </div>
  );
}
