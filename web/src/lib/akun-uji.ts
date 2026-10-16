//! Akun uji untuk E2E (Anvil lokal). Semua kunci di berkas ini publik dan khusus tes.

import { privateKeyToAccount } from 'viem/accounts';
import { tandaTanganJwt } from './jwt-uji';
import type { Jaringan } from './konfigurasi';
import { buatPenanda, type Sesi } from './sesi';

export type PeranUji = 'operator' | 'rektor' | 'alumni';

/** Kunci ES256 tes (pasangan publiknya di `e2e/siapkan.ts`, dipakai API saat E2E). */
export const KUNCI_JWT_UJI = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg7L+TaFQGQvFH+hnv
dmFKEZhR0j0yN9UnNTNTeHMIFPGhRANCAATlz5G9oISvfhp79ny7Fq/rVZ6a8RtP
l4DBLYR1z+jIy6yRvGZM+TQ89WAkEythJBI5WXMtxKtm85Ge+eLYQ3UV
-----END PRIVATE KEY-----`;

export const AKUN_UJI: Record<PeranUji, { label: string; did: string; kunci: `0x${string}` }> = {
  operator: {
    label: 'Operator BAAK',
    did: 'did:privy:uji-operator',
    kunci: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
  rektor: {
    label: 'Rektor',
    did: 'did:privy:uji-rektor',
    kunci: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  },
  alumni: {
    label: 'Alumni',
    did: 'did:privy:uji-alumni',
    kunci: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  },
};

const KUNCI_SIMPAN = 'pusaka:akun-uji';

export function masukUji(peran: PeranUji): void {
  sessionStorage.setItem(KUNCI_SIMPAN, peran);
}

export function sesiUji(j: Jaringan, appId: string): Sesi {
  const peran = sessionStorage.getItem(KUNCI_SIMPAN) as PeranUji | null;
  const akun = peran ? AKUN_UJI[peran] : null;
  return {
    status: akun ? 'masuk' : 'keluar',
    async token() {
      if (!akun) throw new Error('Belum masuk');
      const kini = Math.floor(Date.now() / 1000);
      return tandaTanganJwt({ sub: akun.did, aud: appId, iss: 'privy.io', sid: 'sesi-uji', iat: kini, exp: kini + 600 }, KUNCI_JWT_UJI);
    },
    async penanda() {
      if (!akun) throw new Error('Belum masuk');
      return buatPenanda(j, privateKeyToAccount(akun.kunci));
    },
    async keluar() {
      sessionStorage.removeItem(KUNCI_SIMPAN);
    },
  };
}
