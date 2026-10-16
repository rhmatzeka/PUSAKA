//! Token "Privy" uji, ditandatangani ES256 di peramban dengan kunci KHUSUS TES. Hanya dipakai build
//! `PUBLIC_MODE_UJI=1`; API produksi memverifikasi dengan kunci Privy asli sehingga token ini ditolak.

function b64url(b: Uint8Array | string): string {
  const s = typeof b === 'string' ? b : String.fromCharCode(...b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemKeDer(pem: string): ArrayBuffer {
  const isi = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(isi), (c) => c.charCodeAt(0)).buffer;
}

export async function tandaTanganJwt(klaim: Record<string, unknown>, pemPkcs8: string): Promise<string> {
  const kunci = await crypto.subtle.importKey('pkcs8', pemKeDer(pemPkcs8), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const kepala = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT' }));
  const isi = b64url(JSON.stringify(klaim));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kunci, new TextEncoder().encode(`${kepala}.${isi}`));
  return `${kepala}.${isi}.${b64url(new Uint8Array(sig))}`;
}
