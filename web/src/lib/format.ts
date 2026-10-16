/** `0x7c1e…a94f`: cukup untuk dicocokkan mata, tidak memenuhi layar ponsel. */
export function ringkas(hex: string, kepala = 4, ekor = 4): string {
  const h = hex.replace(/^0x/, '');
  return h.length <= kepala + ekor ? h : `${h.slice(0, kepala)}…${h.slice(-ekor)}`;
}

export function tanggal(detik: number): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(detik * 1000));
}

export function angka(n: bigint | number): string {
  return new Intl.NumberFormat('id-ID').format(n);
}
