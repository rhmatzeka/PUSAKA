//! Kosakata status di layar: selalu kata + simbol + warna, tidak pernah warna saja (spec 8.4).

export interface Tampilan {
  kata: string;
  simbol: string;
  nada: 'ok' | 'bad' | 'tunggu';
}

export const STATUS = {
  VALID: { kata: 'Asli · tercatat', simbol: '↑', nada: 'ok' },
  DICABUT: { kata: 'Dicabut', simbol: '↓', nada: 'bad' },
  TIDAK_ADA: { kata: 'Tidak tercatat', simbol: '✕', nada: 'bad' },
  PERINGATAN: { kata: 'Berkas tidak cocok', simbol: '!', nada: 'bad' },
} as const satisfies Record<string, Tampilan>;

/** Pesan galat jaringan yang bisa ditindaklanjuti; detail teknis di baris kedua. */
export function pesanGalat(e: unknown): string {
  const detail = e instanceof Error ? e.message.split('\n')[0] : String(e);
  return `Blockchain atau IPFS tidak terjangkau. Periksa koneksi lalu coba lagi. (${detail})`;
}
