import { expect, test } from 'vitest';
import { KUNCI_JWT_UJI } from '../src/lib/akun-uji';
import { tandaTanganJwt } from '../src/lib/jwt-uji';

// Pasangan publik KUNCI_JWT_UJI (sama dengan yang dipakai API saat E2E).
const PUBLIK = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE5c+RvaCEr34ae/Z8uxav61WemvEbT5eAwS2Edc/oyMuskbxmTPk0PPVgJBMrYSQSOVlzLcSrZvORnvni2EN1FQ==';

function dariB64url(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
}

test('JWT ES256 uji bisa diverifikasi dengan kunci publik pasangannya', async () => {
  const t = await tandaTanganJwt({ sub: 'did:privy:uji-operator', aud: 'app-uji', iss: 'privy.io', exp: 2_000_000_000 }, KUNCI_JWT_UJI);
  const [kepala, isi, sig] = t.split('.') as [string, string, string];
  expect(JSON.parse(new TextDecoder().decode(dariB64url(kepala)))).toEqual({ alg: 'ES256', typ: 'JWT' });
  expect(JSON.parse(new TextDecoder().decode(dariB64url(isi)))).toMatchObject({ sub: 'did:privy:uji-operator', iss: 'privy.io' });
  const kunci = await crypto.subtle.importKey('spki', dariB64url(PUBLIK.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const sah = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kunci, dariB64url(sig), new TextEncoder().encode(`${kepala}.${isi}`));
  expect(sah).toBe(true);
});
