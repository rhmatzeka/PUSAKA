//! Kunci AES ijazah di fragmen URL: `#k=<base64url 32 byte>` (spec 6.1). Fragmen tidak pernah dikirim ke server.

const POLA = /^[A-Za-z0-9_-]{43}$/;

export function kunciDariFragmen(hash: string): Uint8Array | null {
  const k = new URLSearchParams(hash.replace(/^#/, '')).get('k');
  if (!k || !POLA.test(k)) return null;
  const biner = atob(`${k.replace(/-/g, '+').replace(/_/g, '/')}=`);
  if (biner.length !== 32) return null;
  return Uint8Array.from(biner, (c) => c.charCodeAt(0));
}

export function kunciKeFragmen(kunci: Uint8Array): string {
  let s = '';
  for (const b of kunci) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
