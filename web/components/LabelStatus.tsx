import type { Status } from "@/lib/server/ijazah";

// Status dibawa oleh tiga hal sekaligus: kata, geometri, dan warna — bukan warna saja.
const GAYA: Record<Status, { kelas: string; tanda: string; teks: string }> = {
  VALID: {
    kelas: "stamp-valid",
    tanda: "■",
    teks: "Tercatat di rantai dan isinya tidak berubah sejak diterbitkan.",
  },
  DICABUT: {
    kelas: "stamp-revoked",
    tanda: "▲",
    teks: "Pernah diterbitkan, lalu dicabut oleh BAAK. Jejak penerbitannya tetap ada.",
  },
  "TIDAK VALID": {
    kelas: "stamp-invalid",
    tanda: "✕",
    teks: "Tidak cocok dengan satu pun ijazah yang pernah diterbitkan.",
  },
};

export default function LabelStatus({ status, catatan }: { status: Status; catatan?: string }) {
  const g = GAYA[status];
  return (
    <div role="status" className={`stamp ${g.kelas}`}>
      <p className="label" style={{ color: "currentColor" }}>
        Hasil pemeriksaan
      </p>
      <p className="display-s flex items-baseline gap-3">
        <span aria-hidden className="text-[0.5em]">
          {g.tanda}
        </span>
        {status}
      </p>
      <p className="stamp-body mt-1 max-w-[52ch] text-[var(--text-sm)] leading-relaxed">{g.teks}</p>
      {catatan && <p className="stamp-body max-w-[52ch] text-[var(--text-sm)] font-semibold leading-relaxed">{catatan}</p>}
    </div>
  );
}
