# PUSAKA v2 — Rencana 05: `/periksa` dan `/i/[tokenId]`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tiga jalur verifikasi publik (unggah PDF, QR berkunci, nomor token) yang membaca langsung dari kontrak dan IPFS tanpa server PUSAKA, teruji E2E terhadap Anvil.

**Architecture:** Logika verifikasi murni di `web/src/lib/verifikasi.ts` dengan semua I/O di balik antarmuka `Sumber`; implementasi asli (`sumber.ts`) memakai viem (RPC publik), `fetch` ke gateway IPFS, dan `pusaka-core.wasm`. Dua island React (`Periksa`, `Hasil`) di halaman Astro statis; `/i/<token>` dilayani satu halaman `/i/` lewat rewrite Vercel. E2E Playwright menyalakan Anvil, men-deploy kontrak, menerbitkan dua ijazah (satu dicabut), lalu menguji halaman hasil build.

**Tech Stack:** Astro 7 (static), React 19, TypeScript strictest, Tailwind 4 + CSS token, viem 2.57, @fontsource Sora + Space Mono, Vitest 5, Playwright 1.64 (Chrome sistem), Foundry (anvil, forge script).

**Spec:** `docs/superpowers/specs/2026-10-16-pusaka-v2-design.md` (bagian 6.1, 6.2, 8.1, 8.4, 9 "Verifikasi", 10, 11)

**Branch:** `feat/pusaka-v2-periksa` dari `feat/pusaka-v2-api`, ditambah merge `feat/pusaka-v2-kontrak` (E2E butuh kontrak + ABI). PR ke `feat/pusaka-v2-api`.

## Global Constraints

- Verifikasi publik tidak melewati backend: hanya RPC publik + gateway IPFS (spec 3).
- Status selalu kata + simbol + warna (spec 8.4): `↑ Asli · tercatat`, `↓ Dicabut`, `✕ Tidak tercatat`.
- Huruf Sora (teks) dan Space Mono (HUD, angka, hash), di-host sendiri lewat @fontsource.
- Animasi halaman dalam hanya transisi 150–250 ms (`--cepat: 180ms`), mati saat `prefers-reduced-motion`.
- Responsif tanpa geser horizontal di 320, 375, 414, 768 px; `/i/*` punya stylesheet cetak terang.
- Kunci hanya di fragmen `#k=` (base64url 32 byte); halaman `/i/*` memasang `Referrer-Policy: no-referrer` (header + meta).
- Env build: `PUBLIC_RPC_URL`, `PUBLIC_ALAMAT_KONTRAK`, `PUBLIC_CHAIN_ID`, `PUBLIC_GATEWAY_URL`.
- `npm --prefix web run check` (astro check strictest) 0 galat; tanpa atribusi AI di commit/PR.

## Keputusan terhadap spec

1. **Segel 2D (CSS) di halaman dalam**, bukan three.js. Mockup v3 yang disetujui juga memakai segel CSS; three.js hanya di beranda (rencana 08) supaya halaman periksa ringan. Komponen `Segel` bisa diganti versi 3D nanti tanpa mengubah pemanggil.
2. **Pindai QR memakai `BarcodeDetector`** bawaan peramban. Peramban tanpa dukungan diarahkan ke aplikasi kamera ponsel (QR berisi URL yang langsung membuka `/i/...`). Tidak ada pustaka QR tambahan.
3. **`/i/[tokenId]` = satu halaman statis `/i/`** + rewrite (`vercel.json`, middleware dev, server E2E), karena output Astro statis tidak bisa membuat halaman untuk token yang belum ada.
4. **Folder `contracts/deployments/` ditambah `.gitkeep`**: `Deploy.s.sol` gagal di checkout bersih karena foldernya tidak ada (temuan saat menyiapkan E2E).

## Review Focus

1. Gateway IPFS mengembalikan berkas lain/rusak untuk CID yang benar → tampil "Jangan percayai berkas ini", bukan data (unit `berkas IPFS tidak cocok…`).
2. Fragmen `#k=` cacat (terlalu pendek/panjang, karakter `+`) → dianggap tanpa kunci, bukan crash (unit `fragmen … tidak menghasilkan kunci`).
3. QR berisi tautan ke domain lain → tidak diikuti (unit `QR hanya diikuti bila tautan ijazah di asal yang sama`).
4. RPC/gateway mati → pesan yang bisa ditindaklanjuti, bukan layar kosong (`pesanGalat`, cabang `galat` di kedua island).
5. Token yang tidak pernah terbit (`IjazahTidakAda`) → "Token #999 tidak ada" (E2E `token yang tidak ada`).

---

## Peta file

```
contracts/deployments/.gitkeep
vercel.json                          + rewrite /i/:token, header Referrer-Policy
web/package.json                     + viem, @fontsource/*, vitest, @playwright/test, @types/node; skrip test, e2e
web/astro.config.mjs                 + middleware dev /i/<token> → /i/
web/vitest.config.ts
web/playwright.config.ts
web/src/lib/jenis.ts                 tipe Ijazah, DataLulusan, Sumber, HasilBerkas, HasilToken
web/src/lib/verifikasi.ts            cekBerkas, cekToken, statusIjazah
web/src/lib/kunci.ts                 kunciDariFragmen, kunciKeFragmen
web/src/lib/ipfs.ts                  keUrlGateway
web/src/lib/format.ts                ringkas, tanggal, angka
web/src/lib/jalur.ts                 tokenDariJalur, tautanIjazah
web/src/lib/abi.ts | core.ts | konfigurasi.ts | sumber.ts   Sumber asli (viem + WASM + fetch)
web/src/lib/tampilan.ts              kosakata status, pesanGalat
web/src/styles/global.css            token + komponen + cetak
web/src/layouts/Ruang.astro
web/src/components/Segel.tsx | BarisBukti.tsx
web/src/islands/Periksa.tsx | PindaiQr.tsx | Hasil.tsx
web/src/pages/periksa.astro | i/index.astro
web/tests/*.test.ts                  Vitest
web/e2e/pdf.ts | siapkan.ts | server.mjs | periksa.spec.ts
.github/workflows/ci.yml             web: + vitest; job baru e2e
```

---

### Task 1: Branch, kontrak, dependensi web

**Files:**
- Create: `contracts/deployments/.gitkeep`, `web/vitest.config.ts`
- Modify: `web/package.json`, `web/package-lock.json`, `web/.gitignore`

**Interfaces:**
- Produces: `npm --prefix web test` (Vitest), `npm --prefix web run e2e` (Playwright), dependensi `viem`, `@fontsource/sora`, `@fontsource/space-mono`.

- [ ] **Step 1: Branch dan gabung kontrak**

```bash
git switch -c feat/pusaka-v2-periksa feat/pusaka-v2-api
git merge --no-edit feat/pusaka-v2-kontrak
mkdir -p contracts/deployments && touch contracts/deployments/.gitkeep
```

Expected: merge otomatis tanpa konflik (`ci.yml` dan spec digabung otomatis); `contracts/`, `abi/PusakaIjazah.json` ada.

- [ ] **Step 2: Dependensi**

```bash
npm --prefix web i viem@^2.57 @fontsource/sora@^5.3 @fontsource/space-mono@^5.3
npm --prefix web i -D vitest@^5.0 @playwright/test@^1.64 @types/node@^24
```

Tambahkan ke `scripts` di `web/package.json`: `"test": "vitest run"` dan `"e2e": "playwright test"`. Tambahkan ke `web/.gitignore`:

```
e2e/.data/
test-results/
playwright-report/
```

`web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/**/*.test.ts'], environment: 'node' } });
```

- [ ] **Step 3: Verifikasi**

Run: `npm --prefix web run check && npm --prefix web run build`
Expected: 0 galat; build sukses.

- [ ] **Step 4: Commit**

```bash
git add contracts/deployments/.gitkeep web/package.json web/package-lock.json web/.gitignore web/vitest.config.ts
git commit -m "chore(web): dependensi verifikasi (viem, font, vitest, playwright) dan folder deployments"
```

---

### Task 2: Logika verifikasi murni + tes unit

**Files:**
- Create: `web/src/lib/{jenis,verifikasi,kunci,ipfs,format,jalur}.ts`
- Test: `web/tests/{verifikasi,kunci,ipfs,format,jalur}.test.ts`

**Interfaces:**
- Produces: tipe `Ijazah`, `DataLulusan`, `Sumber`, `HasilBerkas`, `HasilToken` (`jenis.ts`); `cekBerkas(pdf, s)`, `cekToken(tokenId, kunci|null, s)`, `statusIjazah(i)`; `kunciDariFragmen(hash)`, `kunciKeFragmen(k)`; `keUrlGateway(uri, gateway)`; `ringkas`, `tanggal`, `angka`; `tokenDariJalur`, `tautanIjazah`.

- [ ] **Step 1: Tulis tes yang gagal**

`web/tests/verifikasi.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import type { Hex } from 'viem';
import { beforeAll, describe, expect, test } from 'vitest';
import type { Ijazah, Sumber } from '../src/lib/jenis';
import { cekBerkas, cekToken, statusIjazah } from '../src/lib/verifikasi';
import { buka_amplop, initSync, keccak256_hex, segel_amplop } from '../src/wasm/pusaka_core.js';

const KUNCI = new Uint8Array(32).fill(4);
const NONCE = new Uint8Array(12).fill(1);
const PDF = new TextEncoder().encode('%PDF-1.4 ijazah uji');
const DATA = {
  nama: 'Dewi Lestari',
  nim: '231011400001',
  prodi: 'Teknik Informatika',
  gelar: 'S.Kom.',
  nomor_ijazah: 'UNPAM/2026/0001',
  tanggal_lulus: '2026-08-30',
};

beforeAll(() => {
  initSync({ module: readFileSync(new URL('../src/wasm/pusaka_core_bg.wasm', import.meta.url)) });
});

function ijazah(docHash: Hex, waktuCabut = 0): Ijazah {
  return { docHash, penandaTangan: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', waktuTerbit: 1793000000, waktuCabut };
}

/** Sumber tiruan: satu token (#1) dengan amplop asli di "IPFS". */
function tiruan(ubah: Partial<Sumber> = {}, docHash?: Hex): Sumber & { diambil: string[] } {
  const amplop = segel_amplop(KUNCI, NONCE, JSON.stringify(DATA), PDF);
  const hash = docHash ?? (keccak256_hex(PDF) as Hex);
  const ipfs: Record<string, Uint8Array> = {
    'ipfs://meta': new TextEncoder().encode(JSON.stringify({ pusaka: { versi: 2, berkas: 'ipfs://amplop' } })),
    'ipfs://amplop': amplop,
  };
  const diambil: string[] = [];
  return {
    diambil,
    periksa: async (h) =>
      h === hash ? { status: 1, tokenId: 1n, data: ijazah(hash) } : { status: 0, tokenId: 0n, data: ijazah(h) },
    ijazah: async (id) => (id === 1n ? ijazah(hash) : null),
    tokenUri: async () => 'ipfs://meta',
    ambil: async (uri) => {
      diambil.push(uri);
      const isi = ipfs[uri];
      if (!isi) throw new Error(`tidak ada ${uri}`);
      return isi;
    },
    keccak: (isi) => keccak256_hex(isi) as Hex,
    buka: (kunci, a) => {
      const h = buka_amplop(kunci, a);
      try {
        return { data: JSON.parse(h.data_json), pdf: h.pdf };
      } finally {
        h.free();
      }
    },
    ...ubah,
  };
}

describe('cekBerkas', () => {
  test('PDF asli tercatat VALID', async () => {
    const h = await cekBerkas(PDF, tiruan());
    expect(h).toMatchObject({ jenis: 'ada', status: 'VALID', tokenId: 1n });
  });

  test('PDF diubah satu bita tidak tercatat', async () => {
    const palsu = PDF.slice();
    palsu[5] = (palsu[5] ?? 0) ^ 1;
    const h = await cekBerkas(palsu, tiruan());
    expect(h).toEqual({ jenis: 'tidak-ada', docHash: keccak256_hex(palsu) });
  });

  test('status 2 dari kontrak berarti DICABUT', async () => {
    const s = tiruan({ periksa: async (h) => ({ status: 2, tokenId: 7n, data: ijazah(h, 1793100000) }) });
    expect(await cekBerkas(PDF, s)).toMatchObject({ jenis: 'ada', status: 'DICABUT', tokenId: 7n });
  });
});

describe('cekToken', () => {
  test('token tidak ada', async () => {
    expect(await cekToken(9n, KUNCI, tiruan())).toEqual({ jenis: 'tidak-ada', tokenId: 9n });
  });

  test('tanpa kunci hanya status, tidak mengambil apa pun dari IPFS', async () => {
    const s = tiruan();
    expect(await cekToken(1n, null, s)).toMatchObject({ jenis: 'terkunci', tokenId: 1n });
    expect(s.diambil).toEqual([]);
  });

  test('kunci benar membuka data dan PDF yang cocok dengan docHash', async () => {
    const h = await cekToken(1n, KUNCI, tiruan());
    expect(h.jenis).toBe('lengkap');
    if (h.jenis !== 'lengkap') return;
    expect(h.data).toEqual(DATA);
    expect(h.pdf).toEqual(PDF);
  });

  test('kunci salah', async () => {
    expect(await cekToken(1n, new Uint8Array(32).fill(5), tiruan())).toMatchObject({ jenis: 'kunci-salah' });
  });

  test('berkas IPFS tidak cocok dengan sidik jari on-chain', async () => {
    const lain = keccak256_hex(new TextEncoder().encode('lain')) as Hex;
    const h = await cekToken(1n, KUNCI, tiruan({}, lain));
    expect(h).toMatchObject({ jenis: 'berkas-tidak-cocok', hashBerkas: keccak256_hex(PDF) });
  });

  test('metadata tanpa alamat berkas melempar galat', async () => {
    const s = tiruan({ ambil: async () => new TextEncoder().encode('{"name":"x"}') });
    await expect(cekToken(1n, KUNCI, s)).rejects.toThrow(/alamat berkas/);
  });
});

test('statusIjazah dari waktuCabut', () => {
  expect(statusIjazah(ijazah('0x01'))).toBe('VALID');
  expect(statusIjazah(ijazah('0x01', 5))).toBe('DICABUT');
});
```

`web/tests/kunci.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { kunciDariFragmen, kunciKeFragmen } from '../src/lib/kunci';

describe('kunci di fragmen', () => {
  test('bolak-balik 32 byte', () => {
    const k = Uint8Array.from({ length: 32 }, (_, i) => i * 7 + 250);
    const f = kunciKeFragmen(k);
    expect(f).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(kunciDariFragmen(`#k=${f}`)).toEqual(k);
  });

  test('parameter lain di fragmen tidak mengganggu', () => {
    const f = kunciKeFragmen(new Uint8Array(32).fill(9));
    expect(kunciDariFragmen(`#x=1&k=${f}`)).toEqual(new Uint8Array(32).fill(9));
  });

  test.each(['', '#', '#k=', '#k=abc', `#k=${'A'.repeat(44)}`, `#k=${'A'.repeat(42)}+`, '#kunci=x'])(
    'fragmen %j tidak menghasilkan kunci',
    (h) => expect(kunciDariFragmen(h)).toBeNull(),
  );
});
```

`web/tests/ipfs.test.ts`:

```ts
import { expect, test } from 'vitest';
import { keUrlGateway } from '../src/lib/ipfs';

test('ipfs:// menjadi URL gateway', () => {
  expect(keUrlGateway('ipfs://bafkreiabc', 'https://g.example/')).toBe('https://g.example/ipfs/bafkreiabc');
  expect(keUrlGateway('ipfs://bafy/a/b.json', 'https://g.example')).toBe('https://g.example/ipfs/bafy/a/b.json');
});

test.each(['https://x/ipfs/abc', 'ipfs://', 'ipfs://a b', 'ipfs://../x'])('%j ditolak', (u) => {
  expect(() => keUrlGateway(u, 'https://g')).toThrow(/IPFS/);
});
```

`web/tests/format.test.ts`:

```ts
import { expect, test } from 'vitest';
import { angka, ringkas, tanggal } from '../src/lib/format';

test('ringkas hash dan alamat', () => {
  expect(ringkas('0x7c1e00000000000000000000000000000000a94f')).toBe('7c1e…a94f');
  expect(ringkas('0xabcd')).toBe('abcd');
});

test('tanggal dan angka gaya Indonesia', () => {
  expect(tanggal(1793000000)).toBe('26 Oktober 2026');
  expect(angka(18204551n)).toBe('18.204.551');
});
```

`web/tests/jalur.test.ts`:

```ts
import { expect, test } from 'vitest';
import { tautanIjazah, tokenDariJalur } from '../src/lib/jalur';

test('nomor token dari jalur /i/*', () => {
  expect(tokenDariJalur('/i/1284')).toBe(1284n);
  expect(tokenDariJalur('/i/7/')).toBe(7n);
  for (const salah of ['/i/', '/i/abc', '/i/1/2', '/periksa', `/i/${'9'.repeat(21)}`]) expect(tokenDariJalur(salah)).toBeNull();
});

test('QR hanya diikuti bila tautan ijazah di asal yang sama', () => {
  const asal = 'https://pusaka.rahmateka.my.id';
  expect(tautanIjazah(`${asal}/i/5#k=abc`, asal)).toBe(`${asal}/i/5#k=abc`);
  expect(tautanIjazah('https://penipu.example/i/5', asal)).toBeNull();
  expect(tautanIjazah(`${asal}/periksa`, asal)).toBeNull();
  expect(tautanIjazah('teks biasa', asal)).toBeNull();
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npm --prefix web test`
Expected: FAIL, modul `../src/lib/...` tidak ditemukan.

- [ ] **Step 3: Implementasi**

`web/src/lib/jenis.ts`:

```ts
import type { Address, Hex } from 'viem';

/** Isi struct `Ijazah` di kontrak (waktu dalam detik Unix; 0 = belum terjadi). */
export interface Ijazah {
  docHash: Hex;
  penandaTangan: Address;
  waktuTerbit: number;
  waktuCabut: number;
}

/** Header amplop terenkripsi (spec 6.1). */
export interface DataLulusan {
  nama: string;
  nim: string;
  prodi: string;
  gelar: string;
  nomor_ijazah: string;
  tanggal_lulus: string;
}

/** Semua yang dibutuhkan verifikasi; implementasi asli di `sumber.ts`, tiruan di tes. */
export interface Sumber {
  periksa(docHash: Hex): Promise<{ status: number; tokenId: bigint; data: Ijazah }>;
  /** `null` bila kontrak menolak dengan `IjazahTidakAda`. */
  ijazah(tokenId: bigint): Promise<Ijazah | null>;
  tokenUri(tokenId: bigint): Promise<string>;
  ambil(uri: string): Promise<Uint8Array>;
  keccak(isi: Uint8Array): Hex;
  /** Melempar galat bila kunci salah atau amplop rusak. */
  buka(kunci: Uint8Array, amplop: Uint8Array): { data: DataLulusan; pdf: Uint8Array };
}

export type HasilBerkas =
  | { jenis: 'tidak-ada'; docHash: Hex }
  | { jenis: 'ada'; status: 'VALID' | 'DICABUT'; tokenId: bigint; docHash: Hex; ijazah: Ijazah };

export type HasilToken =
  | { jenis: 'tidak-ada'; tokenId: bigint }
  | { jenis: 'terkunci'; tokenId: bigint; ijazah: Ijazah }
  | { jenis: 'lengkap'; tokenId: bigint; ijazah: Ijazah; data: DataLulusan; pdf: Uint8Array }
  | { jenis: 'kunci-salah'; tokenId: bigint; ijazah: Ijazah }
  | { jenis: 'berkas-tidak-cocok'; tokenId: bigint; ijazah: Ijazah; hashBerkas: Hex };
```

`web/src/lib/verifikasi.ts`:

```ts
//! Tiga jalur verifikasi (spec 9). Murni: semua I/O lewat `Sumber`.

import type { Hex } from 'viem';
import type { HasilBerkas, HasilToken, Ijazah, Sumber } from './jenis';

const STATUS_TIDAK_ADA = 0;
const STATUS_DICABUT = 2;

export function statusIjazah(i: Ijazah): 'VALID' | 'DICABUT' {
  return i.waktuCabut > 0 ? 'DICABUT' : 'VALID';
}

/** Jalur unggah PDF: sidik jari dihitung lokal lalu dicocokkan dengan `periksa()`. */
export async function cekBerkas(pdf: Uint8Array, s: Sumber): Promise<HasilBerkas> {
  const docHash = s.keccak(pdf);
  const r = await s.periksa(docHash);
  if (r.status === STATUS_TIDAK_ADA) return { jenis: 'tidak-ada', docHash };
  return {
    jenis: 'ada',
    status: r.status === STATUS_DICABUT ? 'DICABUT' : 'VALID',
    tokenId: r.tokenId,
    docHash,
    ijazah: r.data,
  };
}

function alamatBerkas(metadata: unknown): string {
  const berkas = (metadata as { pusaka?: { berkas?: unknown } } | null)?.pusaka?.berkas;
  if (typeof berkas !== 'string') throw new Error('Metadata ijazah tidak memuat alamat berkas');
  return berkas;
}

/**
 * Jalur nomor token (dan QR berkunci). Tanpa kunci hanya status on-chain; dengan kunci,
 * amplop dari IPFS didekripsi dan Keccak PDF-nya wajib sama dengan `docHash` on-chain.
 */
export async function cekToken(tokenId: bigint, kunci: Uint8Array | null, s: Sumber): Promise<HasilToken> {
  const ijazah = await s.ijazah(tokenId);
  if (!ijazah) return { jenis: 'tidak-ada', tokenId };
  if (!kunci) return { jenis: 'terkunci', tokenId, ijazah };

  const metadata: unknown = JSON.parse(new TextDecoder().decode(await s.ambil(await s.tokenUri(tokenId))));
  const amplop = await s.ambil(alamatBerkas(metadata));
  let isi: ReturnType<Sumber['buka']>;
  try {
    isi = s.buka(kunci, amplop);
  } catch {
    return { jenis: 'kunci-salah', tokenId, ijazah };
  }
  const hashBerkas: Hex = s.keccak(isi.pdf);
  if (hashBerkas.toLowerCase() !== ijazah.docHash.toLowerCase()) {
    return { jenis: 'berkas-tidak-cocok', tokenId, ijazah, hashBerkas };
  }
  return { jenis: 'lengkap', tokenId, ijazah, data: isi.data, pdf: isi.pdf };
}
```

`web/src/lib/kunci.ts`:

```ts
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
```

`web/src/lib/ipfs.ts`:

```ts
/** `ipfs://<cid>[/jalur]` → URL gateway HTTP. */
export function keUrlGateway(uri: string, gateway: string): string {
  const m = /^ipfs:\/\/([A-Za-z0-9]+)(\/\S*)?$/.exec(uri);
  if (!m) throw new Error(`Alamat IPFS tidak dikenal: ${uri}`);
  return `${gateway.replace(/\/+$/, '')}/ipfs/${m[1]}${m[2] ?? ''}`;
}
```

`web/src/lib/format.ts`:

```ts
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
```

`web/src/lib/jalur.ts`:

```ts
/** `/i/1284` → 1284n. Halaman `/i/` dilayani untuk semua `/i/*` lewat rewrite. */
export function tokenDariJalur(jalur: string): bigint | null {
  const m = /^\/i\/(\d{1,20})\/?$/.exec(jalur);
  return m?.[1] ? BigInt(m[1]) : null;
}

/** Isi QR → alamat ijazah PUSAKA di asal yang sama, atau `null` (QR lain tidak diikuti). */
export function tautanIjazah(teks: string, asal: string): string | null {
  try {
    const u = new URL(teks, asal);
    return u.origin === asal && tokenDariJalur(u.pathname) !== null ? u.href : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npm --prefix web test && npm --prefix web run check`
Expected: 28 tes lulus; 0 galat tipe.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib web/tests
git commit -m "feat(web): logika verifikasi berkas dan token (murni, teruji dengan WASM asli)"
```

---

### Task 3: Sumber asli — kontrak (viem), IPFS, WASM

**Files:**
- Create: `web/src/lib/{abi,core,konfigurasi,sumber}.ts`

**Interfaces:**
- Consumes: `Sumber` (Task 2), `keUrlGateway`.
- Produces: `jaringan(env?) -> Jaringan` (melempar bila `PUBLIC_ALAMAT_KONTRAK` kosong); `buatSumber(j) -> Promise<SumberRantai>` (`Sumber` + `blok()`); `muatCore()`; `abiPusaka`.

Kode ini diuji ujung-ke-ujung oleh E2E (Task 5–7); di sini cukup pemeriksaan tipe.

`web/src/lib/abi.ts`:

```ts
import { parseAbi } from 'viem';

/** Bagian ABI PusakaIjazah yang dibaca peramban (lengkap: `abi/PusakaIjazah.json`). */
export const abiPusaka = parseAbi([
  'struct Ijazah { bytes32 docHash; address penandaTangan; uint64 waktuTerbit; uint64 waktuCabut; }',
  'function periksa(bytes32 docHash) view returns (uint8 status, uint256 tokenId, Ijazah data)',
  'function ijazah(uint256 tokenId) view returns (Ijazah)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'error IjazahTidakAda(uint256 tokenId)',
]);
```

`web/src/lib/core.ts`:

```ts
import init, * as core from '../wasm/pusaka_core.js';

let siap: Promise<typeof core> | null = null;

/** Muat `pusaka-core.wasm` sekali, saat pertama dibutuhkan. */
export function muatCore(): Promise<typeof core> {
  siap ??= init().then(() => core);
  return siap;
}
```

`web/src/lib/konfigurasi.ts`:

```ts
import type { Address } from 'viem';

export interface Jaringan {
  rpcUrl: string;
  kontrak: Address;
  chainId: number;
  gateway: string;
}

type Env = Partial<Record<string, string>>;

/** Nilai PUBLIC_* dibakar ke bundel saat build. */
export function jaringan(env: Env = import.meta.env as unknown as Env): Jaringan {
  const kontrak = env['PUBLIC_ALAMAT_KONTRAK'] ?? '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(kontrak)) {
    throw new Error('Alamat kontrak belum diatur di build ini (PUBLIC_ALAMAT_KONTRAK)');
  }
  return {
    rpcUrl: env['PUBLIC_RPC_URL'] || 'http://127.0.0.1:8545',
    kontrak: kontrak as Address,
    chainId: Number(env['PUBLIC_CHAIN_ID'] || 31337),
    gateway: (env['PUBLIC_GATEWAY_URL'] || 'https://gateway.pinata.cloud').replace(/\/+$/, ''),
  };
}
```

`web/src/lib/sumber.ts`:

```ts
//! `Sumber` asli: kontrak lewat RPC publik (viem), berkas lewat gateway IPFS, kripto lewat WASM.

import { BaseError, ContractFunctionRevertedError, createPublicClient, http, type Address, type Hex } from 'viem';
import { abiPusaka } from './abi';
import { muatCore } from './core';
import { keUrlGateway } from './ipfs';
import type { Ijazah, Sumber } from './jenis';
import type { Jaringan } from './konfigurasi';

/** Amplop maksimal 4 MiB (batas API); metadata jauh lebih kecil. */
export const MAKS_UNDUH = 8 * 1024 * 1024;

interface IjazahMentah {
  docHash: Hex;
  penandaTangan: Address;
  waktuTerbit: bigint;
  waktuCabut: bigint;
}

function keIjazah(d: IjazahMentah): Ijazah {
  return {
    docHash: d.docHash,
    penandaTangan: d.penandaTangan,
    waktuTerbit: Number(d.waktuTerbit),
    waktuCabut: Number(d.waktuCabut),
  };
}

function namaGalatKontrak(e: unknown): string | undefined {
  if (!(e instanceof BaseError)) return undefined;
  const r = e.walk((x) => x instanceof ContractFunctionRevertedError);
  return r instanceof ContractFunctionRevertedError ? r.data?.errorName : undefined;
}

export type SumberRantai = Sumber & { blok(): Promise<bigint> };

export async function buatSumber(j: Jaringan): Promise<SumberRantai> {
  const core = await muatCore();
  const klien = createPublicClient({ transport: http(j.rpcUrl) });
  const kontrak = { address: j.kontrak, abi: abiPusaka } as const;
  return {
    async periksa(docHash) {
      const [status, tokenId, data] = await klien.readContract({ ...kontrak, functionName: 'periksa', args: [docHash] });
      return { status, tokenId, data: keIjazah(data) };
    },
    async ijazah(tokenId) {
      try {
        return keIjazah(await klien.readContract({ ...kontrak, functionName: 'ijazah', args: [tokenId] }));
      } catch (e) {
        if (namaGalatKontrak(e) === 'IjazahTidakAda') return null;
        throw e;
      }
    },
    tokenUri: (tokenId) => klien.readContract({ ...kontrak, functionName: 'tokenURI', args: [tokenId] }),
    async ambil(uri) {
      const r = await fetch(keUrlGateway(uri, j.gateway));
      if (!r.ok) throw new Error(`Gateway IPFS menjawab ${r.status}`);
      const isi = new Uint8Array(await r.arrayBuffer());
      if (isi.length > MAKS_UNDUH) throw new Error('Berkas di IPFS lebih besar dari batas ijazah');
      return isi;
    },
    keccak: (isi) => core.keccak256_hex(isi) as Hex,
    buka(kunci, amplop) {
      const h = core.buka_amplop(kunci, amplop);
      try {
        return { data: JSON.parse(h.data_json), pdf: h.pdf };
      } finally {
        h.free();
      }
    },
    blok: () => klien.getBlockNumber(),
  };
}
```

- [ ] **Step 2: Verifikasi**

Run: `npm --prefix web run check`
Expected: 0 galat (tipe hasil `readContract` dari `parseAbi` cocok dengan `IjazahMentah`).

- [ ] **Step 3: Commit**

```bash
git add web/src/lib
git commit -m "feat(web): sumber verifikasi asli (viem ke kontrak, gateway IPFS, pusaka-core WASM)"
```

---

### Task 4: Bahasa visual — token, layout ruang, segel, baris bukti

**Files:**
- Modify: `web/src/styles/global.css` (ganti seluruhnya)
- Create: `web/src/layouts/Ruang.astro`, `web/src/components/Segel.tsx`, `web/src/components/BarisBukti.tsx`, `web/src/lib/tampilan.ts`

**Interfaces:**
- Produces: layout `Ruang` (props `judul`, `deskripsi`, `tanpaReferer?`, slot `hud`); `<Segel nada>` (`'diam'|'ok'|'bad'|'tunggu'|'seret'`); `<BarisBukti bukti>` dengan tipe `Bukti`; `STATUS.{VALID,DICABUT,TIDAK_ADA,PERINGATAN}`, `pesanGalat(e)`; kelas CSS `.br`, `.aksi`, `.hud`, `.panggung`, `.panggung-kanan`, `.judul`, `.sub`, `.catatan`, `.bukti`, `.data`, `.isian`, `.pilih-pdf`, `.pratinjau`, `.kamera`, `.tidak-dicetak`.

Token warna, HUD, dan tombol berkurung diambil dari mockup v3 (`.superpowers/brainstorm/…/desain-3-halaman-v3.html`).

`web/src/styles/global.css`:

```css
@import "tailwindcss";

/* Token dari mockup v3 (Quantum app × Raycast). */
:root {
  --void: #03060c;
  --ink: #e9eef8;
  --ink2: #8c9ab3;
  --ink3: #56637b;
  --garis: rgba(160, 190, 240, 0.16);
  --garis-halus: rgba(255, 255, 255, 0.07);
  --ok: #6ee7b7;
  --bad: #ff6b7d;
  --tunggu: #f6c06b;
  --biru: #7fb2ff;
  --sans: "Sora", system-ui, sans-serif;
  --mono: "Space Mono", ui-monospace, monospace;
  --cepat: 180ms;
  color-scheme: dark;
}

html {
  background: var(--void);
}

body.ruang {
  margin: 0;
  min-height: 100dvh;
  color: var(--ink);
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.55;
  background:
    radial-gradient(620px 420px at 50% 28%, rgba(40, 110, 200, 0.42), rgba(10, 40, 90, 0.18) 45%, transparent 70%),
    radial-gradient(1200px 700px at 50% 120%, rgba(20, 60, 120, 0.35), transparent 60%),
    var(--void);
  background-attachment: fixed;
}

/* Titik bintang: satu lapisan statis, tidak bergerak. */
body.ruang::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.7;
  background-image:
    radial-gradient(1px 1px at 12% 22%, #9cc3ff 50%, transparent 51%),
    radial-gradient(1px 1px at 78% 14%, #9cc3ff 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 64% 72%, #bcd6ff 50%, transparent 51%),
    radial-gradient(1px 1px at 30% 80%, #9cc3ff 50%, transparent 51%),
    radial-gradient(1px 1px at 90% 58%, #9cc3ff 50%, transparent 51%),
    radial-gradient(1px 1px at 8% 64%, #9cc3ff 50%, transparent 51%),
    radial-gradient(1px 1px at 46% 8%, #9cc3ff 50%, transparent 51%);
}

:focus-visible {
  outline: 1px solid var(--biru);
  outline-offset: 4px;
  border-radius: 4px;
}

/* ---------------------------------------------------------------- HUD */

.atas {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 22px clamp(16px, 4vw, 40px) 8px;
}

.merek {
  color: var(--ink);
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
  line-height: 1.1;
}

.merek small {
  display: block;
  color: var(--ink2);
  font-weight: 400;
  font-size: 12px;
  margin-top: 3px;
}

.hud {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink2);
}

.hud b {
  display: block;
  margin-top: 2px;
  color: var(--ink);
  font-weight: 400;
  font-size: 13px;
  letter-spacing: 0.14em;
}

[data-nada="ok"] {
  color: var(--ok);
}

[data-nada="bad"] {
  color: var(--bad);
}

[data-nada="tunggu"] {
  color: var(--tunggu);
}

.mono {
  font-family: var(--mono);
  letter-spacing: 0.04em;
}

/* ---------------------------------------------------------------- tombol berkurung ‹ … › */

.br {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 8px 4px;
  border: 0;
  background: none;
  color: var(--ink);
  font: 500 14px/1 var(--sans);
  text-decoration: none;
  cursor: pointer;
}

.br::before,
.br::after {
  font: 300 26px/1 var(--sans);
  color: var(--ink3);
  transition: transform var(--cepat), color var(--cepat);
}

.br::before {
  content: "‹";
}

.br::after {
  content: "›";
}

.br:hover::before {
  transform: translateX(-3px);
  color: var(--ink2);
}

.br:hover::after {
  transform: translateX(3px);
  color: var(--ink2);
}

.br[data-utama] {
  color: #fff;
  font-weight: 600;
}

.br:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.aksi {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 22px;
  margin-top: 22px;
}

/* ---------------------------------------------------------------- segel */

.segel {
  position: relative;
  display: grid;
  place-items: center;
  width: min(80vw, 320px);
  aspect-ratio: 1;
  margin-inline: auto;
  --pendar: rgba(60, 130, 230, 0.55);
}

.segel::before {
  content: "";
  position: absolute;
  inset: 12%;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--pendar), transparent);
  filter: blur(18px);
  transition: background var(--cepat);
}

.segel[data-nada="ok"] {
  --pendar: rgba(110, 231, 183, 0.32);
}

.segel[data-nada="bad"] {
  --pendar: rgba(255, 107, 125, 0.34);
}

.segel[data-nada="tunggu"] {
  --pendar: rgba(246, 192, 107, 0.3);
}

.segel[data-nada="seret"] {
  --pendar: rgba(127, 178, 255, 0.8);
}

.segel-keping {
  position: relative;
  display: grid;
  place-items: center;
  width: 62%;
  aspect-ratio: 1.15;
  padding: 0 14%;
  text-align: center;
  clip-path: polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%);
  background:
    linear-gradient(150deg, rgba(255, 255, 255, 0.16), transparent 38%),
    repeating-linear-gradient(90deg, rgba(127, 178, 255, 0.14) 0 1px, transparent 1px 10px),
    linear-gradient(150deg, #2a3a55, #0b111b 62%);
  transition: transform var(--cepat);
}

.segel[data-nada="seret"] .segel-keping {
  transform: scale(1.04);
}

.segel-orbit {
  position: absolute;
  border: 1px solid rgba(190, 215, 255, 0.32);
  border-radius: 50%;
  pointer-events: none;
}

.segel-orbit-a {
  width: 100%;
  height: 30%;
  transform: rotate(-13deg);
}

.segel-orbit-b {
  width: 84%;
  height: 84%;
  opacity: 0.45;
  border-style: dashed;
}

/* ---------------------------------------------------------------- tata letak dua kolom */

.panggung {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: clamp(20px, 4vw, 56px);
  max-width: 1080px;
  margin: 0 auto;
  padding: 16px clamp(16px, 4vw, 40px) 56px;
}

.panggung-kanan {
  min-width: 0;
  border-left: 1px solid var(--garis);
  padding-left: clamp(16px, 3vw, 36px);
}

/* Segel tetap terlihat saat kolom kanan (rincian + pratinjau PDF) di-scroll. */
@media (min-width: 768px) {
  .panggung > section:first-child {
    position: sticky;
    top: 24px;
    align-self: start;
  }
}

@media (max-width: 767px) {
  .panggung {
    grid-template-columns: minmax(0, 1fr);
  }

  .segel {
    width: min(62vw, 260px);
  }

  .panggung-kanan {
    border-left: 0;
    border-top: 1px solid var(--garis);
    padding: 24px 0 0;
  }
}

.baris-hud {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.judul {
  margin: 22px 0 4px;
  font-size: clamp(26px, 4.4vw, 38px);
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.sub {
  margin: 0;
  color: var(--ink2);
}

.catatan {
  max-width: 48ch;
  margin: 14px 0 0;
  color: var(--ink2);
  font-size: 13.5px;
}

/* ---------------------------------------------------------------- baris bukti (daftar aset Quantum) */

.bukti {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
}

.bukti li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-top: 1px solid var(--garis-halus);
}

.bukti .ikon {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  font-size: 14px;
}

.bukti .nama {
  flex: 1;
  min-width: 0;
}

.bukti .ket {
  display: block;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.bukti .nilai {
  font-family: var(--mono);
  font-size: 12.5px;
  color: var(--ink2);
  text-align: right;
}

.data {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  margin: 18px 0 0;
}

.data dt,
.data dd {
  margin: 0;
  padding: 8px 0;
  border-top: 1px solid var(--garis-halus);
}

.data dt {
  padding-right: 18px;
  color: var(--ink2);
  font-weight: 500;
}

.data dd {
  text-align: right;
  overflow-wrap: anywhere;
}

/* ---------------------------------------------------------------- masukan */

.isian {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  border-bottom: 1px solid var(--garis);
}

.isian input {
  flex: 1;
  min-width: 0;
  padding: 10px 0;
  border: 0;
  background: none;
  color: var(--ink);
  font: 16px var(--mono);
}

.isian input:focus {
  outline: none;
}

.isian:focus-within {
  border-color: var(--biru);
}

.pilih-pdf {
  display: block;
  cursor: pointer;
}

.pilih-pdf:has(input:focus-visible) .segel-keping {
  outline: 1px solid var(--biru);
}

.pratinjau {
  display: none;
  width: 100%;
  height: 72vh;
  margin-top: 26px;
  border: 1px solid var(--garis);
  border-radius: 10px;
  background: #fff;
}

@media (min-width: 768px) {
  .pratinjau {
    display: block;
  }
}

.kamera {
  width: 100%;
  margin-top: 14px;
  border-radius: 10px;
  background: #000;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0s !important;
    animation: none !important;
  }
}

/* ---------------------------------------------------------------- cetak: terang, tanpa hiasan */

@media print {
  body.ruang {
    background: #fff !important;
    color: #111;
  }

  body.ruang::before,
  .aksi,
  .segel,
  .pratinjau,
  .tidak-dicetak {
    display: none !important;
  }

  .panggung {
    grid-template-columns: minmax(0, 1fr);
    padding: 0;
  }

  .panggung-kanan {
    border: 0;
    padding: 0;
  }

  .hud,
  .sub,
  .catatan,
  .bukti .nilai,
  .data dt {
    color: #333 !important;
  }

  [data-nada="ok"] {
    color: #06603f;
  }

  [data-nada="bad"] {
    color: #a3112a;
  }

  .judul,
  .hud b,
  .merek {
    color: #000;
  }
}
```

`web/src/layouts/Ruang.astro`:

```astro
---
import '@fontsource/sora/400.css';
import '@fontsource/sora/500.css';
import '@fontsource/sora/600.css';
import '@fontsource/space-mono/400.css';
import '../styles/global.css';

interface Props {
  judul: string;
  deskripsi: string;
  /** Halaman yang alamatnya bisa membawa kunci (#k=) tidak boleh mengirim Referer. */
  tanpaReferer?: boolean;
}

const { judul, deskripsi, tanpaReferer = false } = Astro.props;
---

<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={deskripsi} />
    <meta name="theme-color" content="#03060c" />
    {tanpaReferer && <meta name="referrer" content="no-referrer" />}
    <title>{judul} · PUSAKA</title>
  </head>
  <body class="ruang">
    <header class="atas">
      <a class="merek" href="/">Pusaka ⬢<small>Universitas Pamulang</small></a>
      <slot name="hud" />
    </header>
    <main>
      <slot />
    </main>
  </body>
</html>
```

`web/src/components/Segel.tsx`:

```tsx
import type { ReactNode } from 'react';

export type NadaSegel = 'diam' | 'ok' | 'bad' | 'tunggu' | 'seret';

/** Segel Pusaka 2D (keping heksagon + orbit). Versi 3D menyusul di rencana beranda. */
export default function Segel({ nada = 'diam', children }: { nada?: NadaSegel; children?: ReactNode }) {
  return (
    <div className="segel" data-nada={nada}>
      <span className="segel-orbit segel-orbit-a" aria-hidden="true" />
      <span className="segel-orbit segel-orbit-b" aria-hidden="true" />
      <div className="segel-keping">{children}</div>
    </div>
  );
}
```

`web/src/components/BarisBukti.tsx`:

```tsx
import type { ReactNode } from 'react';

export interface Bukti {
  ikon: string;
  nama: string;
  ket: string;
  nada: 'ok' | 'bad' | 'tunggu';
  nilai?: ReactNode;
}

/** Daftar bukti gaya daftar aset Quantum: ikon bulat, nama, keterangan mono berwarna, nilai di kanan. */
export default function BarisBukti({ bukti }: { bukti: Bukti[] }) {
  return (
    <ul className="bukti" aria-label="Bukti">
      {bukti.map((b) => (
        <li key={b.nama}>
          <span className="ikon" aria-hidden="true">
            {b.ikon}
          </span>
          <span className="nama">
            {b.nama}
            <span className="ket" data-nada={b.nada}>
              {b.ket}
            </span>
          </span>
          {b.nilai !== undefined && <span className="nilai">{b.nilai}</span>}
        </li>
      ))}
    </ul>
  );
}
```

`web/src/lib/tampilan.ts`:

```ts
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
```

- [ ] **Step 2: Verifikasi**

Run: `npm --prefix web run check && npm --prefix web run build`
Expected: 0 galat; build sukses (berkas font `.woff2` ikut di `dist/_astro`).

- [ ] **Step 3: Commit**

```bash
git add web/src/styles web/src/layouts web/src/components web/src/lib/tampilan.ts
git commit -m "feat(web): bahasa visual halaman dalam (ruang, HUD, segel, baris bukti, cetak)"
```

---

### Task 5: Harness E2E (Anvil + kontrak + IPFS lokal) dan skenario

**Files:**
- Create: `web/playwright.config.ts`, `web/e2e/pdf.ts`, `web/e2e/siapkan.ts`, `web/e2e/server.mjs`, `web/e2e/periksa.spec.ts`

**Interfaces:**
- Consumes: `contracts/script/Deploy.s.sol`, `abi/PusakaIjazah.json`, `kunciKeFragmen`, WASM `segel_amplop`/`keccak256_hex`.
- Produces: `e2e/.data/{asli,ubah,dicabut}.pdf`, `e2e/.data/fixture.json` (`{kunci: [token1, token2]}`), `e2e/.data/ipfs/<cid>`; token #1 VALID (Dewi Lestari Anggraini), token #2 DICABUT (Budi Santoso); Anvil di port 8555, kontrak `0x5FbDB2315678afecb367f032d93F642f64180aa3`.

Server E2E meniru `vercel.json` (rewrite `/i/<token>`, header `Referrer-Policy`) dan menyajikan `/ipfs/<cid>` dari `e2e/.data/ipfs`. Seeding gagal jelas bila port 8555 sudah dipakai (Anvil lama akan menggeser alamat kontrak).

`web/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

const PORT = 4329;
const ENV = [
  'PUBLIC_RPC_URL=http://127.0.0.1:8555',
  'PUBLIC_ALAMAT_KONTRAK=0x5FbDB2315678afecb367f032d93F642f64180aa3',
  'PUBLIC_CHAIN_ID=31337',
  `PUBLIC_GATEWAY_URL=http://127.0.0.1:${PORT}`,
].join(' ');

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  reporter: 'list',
  globalSetup: './e2e/siapkan.ts',
  use: { baseURL: `http://127.0.0.1:${PORT}`, channel: 'chrome', trace: 'retain-on-failure' },
  webServer: {
    command: `${ENV} npx astro build && PORT=${PORT} node e2e/server.mjs`,
    url: `http://127.0.0.1:${PORT}/periksa/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
```

`web/e2e/pdf.ts`:

```ts
/** PDF satu halaman yang sah (dibaca penampil PDF biasa), cukup untuk data uji. */
export function buatPdf(baris: string[]): Uint8Array {
  const teks = baris
    .map((b, i) => `BT /F1 16 Tf 72 ${760 - i * 26} Td (${b.replace(/[()\\]/g, '\\$&')}) Tj ET`)
    .join('\n');
  const objek = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${teks.length} >>\nstream\n${teks}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let isi = '%PDF-1.4\n';
  const posisi: number[] = [];
  objek.forEach((o, i) => {
    posisi.push(isi.length);
    isi += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = isi.length;
  isi += `xref\n0 ${objek.length + 1}\n0000000000 65535 f \n`;
  isi += posisi.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  isi += `trailer\n<< /Size ${objek.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(isi);
}
```

`web/e2e/siapkan.ts`:

```ts
//! Global setup E2E: Anvil + deploy PusakaIjazah + terbitkan dua ijazah (satu lalu dicabut),
//! amplop & metadata ditaruh di "IPFS" lokal (e2e/.data/ipfs) yang dilayani server.mjs.

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, keccak256, toBytes, type Abi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { kunciKeFragmen } from '../src/lib/kunci';
import { initSync, keccak256_hex, segel_amplop } from '../src/wasm/pusaka_core.js';
import { buatPdf } from './pdf';

export const PORT_RPC = 8555;
export const KONTRAK = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const RPC = `http://127.0.0.1:${PORT_RPC}`;
// Kunci Anvil bawaan (publik): #0 admin/deployer, #1 operator, #2 rektor.
const DEPLOYER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const OPERATOR = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const REKTOR = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
const ALUMNI = ['0x90F79bf6EB2c4f870365E785982E1f101E93b906', '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'] as const;

const DATA = new URL('./.data/', import.meta.url).pathname;
const KONTRAK_DIR = new URL('../../contracts/', import.meta.url).pathname;
const ABI = JSON.parse(readFileSync(new URL('../../abi/PusakaIjazah.json', import.meta.url), 'utf8')) as Abi;

const domain = { name: 'PUSAKA', version: '2', chainId: foundry.id, verifyingContract: KONTRAK } as const;

async function rpcHidup(): Promise<boolean> {
  try {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}',
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function tungguRpc(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (await rpcHidup()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Anvil tidak menyala');
}

function simpanIpfs(isi: Uint8Array): string {
  const cid = `uji${keccak256(isi).slice(2, 42)}`;
  writeFileSync(`${DATA}ipfs/${cid}`, isi);
  return cid;
}

export default async function siapkan(): Promise<() => Promise<void>> {
  // Anvil lama di port yang sama akan membuat alamat kontrak bergeser; lebih baik gagal jelas.
  if (await rpcHidup()) throw new Error(`Port ${PORT_RPC} sudah dipakai proses lain (Anvil lama?). Matikan dulu.`);
  rmSync(DATA, { recursive: true, force: true });
  mkdirSync(`${DATA}ipfs`, { recursive: true });
  initSync({ module: readFileSync(new URL('../src/wasm/pusaka_core_bg.wasm', import.meta.url)) });

  mkdirSync(`${KONTRAK_DIR}deployments`, { recursive: true });
  const anvil = spawn('anvil', ['--silent', '--port', String(PORT_RPC)], { stdio: 'ignore' });
  try {
    await isi();
  } catch (e) {
    anvil.kill();
    throw e;
  }
  return async () => {
    anvil.kill();
  };
}

/** Deploy kontrak dan terbitkan data uji ke Anvil yang baru dinyalakan. */
async function isi(): Promise<void> {
  await tungguRpc();
  execFileSync('forge', ['script', 'script/Deploy.s.sol', '--rpc-url', RPC, '--broadcast', '--silent'], {
    cwd: KONTRAK_DIR,
    stdio: 'ignore',
    env: {
      ...process.env,
      DEPLOYER_PK: DEPLOYER,
      OPERATOR: privateKeyToAccount(OPERATOR).address,
      PENANDATANGAN: privateKeyToAccount(REKTOR).address,
    },
  });

  const publik = createPublicClient({ chain: foundry, transport: http(RPC) });
  const operator = createWalletClient({ account: privateKeyToAccount(OPERATOR), chain: foundry, transport: http(RPC) });
  const rektor = privateKeyToAccount(REKTOR);
  const batasWaktu = BigInt(Math.floor(Date.now() / 1000) + 86_400);

  const lulusan = [
    { nama: 'Dewi Lestari Anggraini', nim: '231011400001', nomor_ijazah: 'UNPAM/2026/0001' },
    { nama: 'Budi Santoso', nim: '231011400002', nomor_ijazah: 'UNPAM/2026/0002' },
  ];
  const kunci: string[] = [];
  const penerbitan = [];
  const sig: Hex[] = [];
  const uri: string[] = [];
  for (const [i, l] of lulusan.entries()) {
    const data = { ...l, prodi: 'Teknik Informatika', gelar: 'S.Kom.', tanggal_lulus: '2026-08-30' };
    const pdf = buatPdf(['IJAZAH UNIVERSITAS PAMULANG', l.nama, `NIM ${l.nim}`, l.nomor_ijazah]);
    writeFileSync(`${DATA}${i === 0 ? 'asli' : 'dicabut'}.pdf`, pdf);
    const k = crypto.getRandomValues(new Uint8Array(32));
    kunci.push(kunciKeFragmen(k));
    const docHash = keccak256_hex(pdf) as Hex;
    const cidAmplop = simpanIpfs(segel_amplop(k, crypto.getRandomValues(new Uint8Array(12)), JSON.stringify(data), pdf));
    const metadata = {
      name: 'Ijazah Universitas Pamulang',
      description: 'Ijazah digital PUSAKA. Data lulusan terenkripsi.',
      attributes: [{ trait_type: 'Institusi', value: 'Universitas Pamulang' }],
      pusaka: { versi: 2, berkas: `ipfs://${cidAmplop}`, doc_keccak256: docHash, enkripsi: 'AES-256-GCM' },
    };
    const u = `ipfs://${simpanIpfs(new TextEncoder().encode(JSON.stringify(metadata)))}`;
    const p = { penerima: ALUMNI[i] ?? ALUMNI[0], docHash, metadataHash: keccak256(toBytes(u)), batasWaktu };
    penerbitan.push(p);
    uri.push(u);
    sig.push(
      await rektor.signTypedData({
        domain,
        primaryType: 'Penerbitan',
        types: {
          Penerbitan: [
            { name: 'penerima', type: 'address' },
            { name: 'docHash', type: 'bytes32' },
            { name: 'metadataHash', type: 'bytes32' },
            { name: 'batasWaktu', type: 'uint64' },
          ],
        },
        message: p,
      }),
    );
  }
  await publik.waitForTransactionReceipt({
    hash: await operator.writeContract({ address: KONTRAK, abi: ABI, functionName: 'terbitkanBatch', args: [penerbitan, sig, uri] }),
  });

  const alasan = 'Uji pencabutan';
  const cabut = { tokenId: 2n, alasanHash: keccak256(toBytes(alasan)), batasWaktu };
  const sigCabut = await rektor.signTypedData({
    domain,
    primaryType: 'Pencabutan',
    types: {
      Pencabutan: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'alasanHash', type: 'bytes32' },
        { name: 'batasWaktu', type: 'uint64' },
      ],
    },
    message: cabut,
  });
  await publik.waitForTransactionReceipt({
    hash: await operator.writeContract({ address: KONTRAK, abi: ABI, functionName: 'cabut', args: [cabut, sigCabut, alasan] }),
  });

  const asli = readFileSync(`${DATA}asli.pdf`);
  const ubah = Uint8Array.from(asli);
  ubah[ubah.length - 10] = (ubah[ubah.length - 10] ?? 0) ^ 1;
  writeFileSync(`${DATA}ubah.pdf`, ubah);
  writeFileSync(`${DATA}fixture.json`, JSON.stringify({ kunci }));
}
```

`web/e2e/server.mjs`:

```js
// Server statis E2E: meniru rewrite dan header vercel.json, plus "IPFS" lokal di /ipfs/<cid>.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const IPFS = new URL('./.data/ipfs/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4329);
const JENIS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  let jalur = decodeURIComponent(new URL(req.url ?? '/', 'http://lokal').pathname);
  try {
    if (jalur.startsWith('/ipfs/')) {
      const isi = await readFile(join(IPFS, jalur.slice(6).replace(/[^A-Za-z0-9]/g, '')));
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      return res.end(isi);
    }
    const header = {};
    if (/^\/i\/\d+\/?$/.test(jalur)) {
      jalur = '/i/';
      header['referrer-policy'] = 'no-referrer';
    }
    if (jalur.endsWith('/')) jalur += 'index.html';
    else if (!extname(jalur)) jalur += '/index.html';
    const berkas = normalize(join(DIST, jalur));
    if (!berkas.startsWith(DIST)) throw new Error('di luar dist');
    const isi = await readFile(berkas);
    res.writeHead(200, { 'content-type': JENIS[extname(berkas)] ?? 'application/octet-stream', ...header });
    res.end(isi);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Tidak ditemukan');
  }
}).listen(PORT, '127.0.0.1');
```

`web/e2e/periksa.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const DATA = new URL('./.data/', import.meta.url).pathname;
const kunci = (): string[] => (JSON.parse(readFileSync(`${DATA}fixture.json`, 'utf8')) as { kunci: string[] }).kunci;

async function bukaPeriksa(page: Page) {
  await page.goto('/periksa/');
  await expect(page.locator('[data-siap]')).toBeAttached();
}

test.describe('unggah PDF', () => {
  test('PDF asli → asli dan tercatat', async ({ page }) => {
    await bukaPeriksa(page);
    await page.locator('input[type=file]').setInputFiles(`${DATA}asli.pdf`);
    await expect(page.getByTestId('status')).toHaveText('↑ Asli · tercatat');
    await expect(page.getByRole('link', { name: 'Lihat rincian ijazah #1' })).toHaveAttribute('href', '/i/1');
  });

  test('PDF diubah satu bita → tidak tercatat', async ({ page }) => {
    await bukaPeriksa(page);
    await page.locator('input[type=file]').setInputFiles(`${DATA}ubah.pdf`);
    await expect(page.getByTestId('status')).toHaveText('✕ Tidak tercatat');
  });

  test('PDF ijazah yang dicabut → dicabut', async ({ page }) => {
    await bukaPeriksa(page);
    await page.locator('input[type=file]').setInputFiles(`${DATA}dicabut.pdf`);
    await expect(page.getByTestId('status')).toHaveText('↓ Dicabut');
  });

  test('nomor token membuka halaman hasil', async ({ page }) => {
    await bukaPeriksa(page);
    await page.getByRole('button', { name: 'Nomor token' }).click();
    await page.getByPlaceholder('Nomor token, misalnya 1284').fill('1');
    await page.getByRole('button', { name: 'Buka' }).click();
    await expect(page).toHaveURL(/\/i\/1$/);
    await expect(page.getByTestId('terkunci')).toBeVisible();
  });
});

test.describe('halaman /i/[tokenId]', () => {
  test('QR berkunci → nama, sidik jari cocok, unduh PDF', async ({ page }) => {
    await page.goto(`/i/1#k=${kunci()[0]}`);
    await expect(page.getByTestId('nama')).toHaveText('Dewi Lestari Anggraini');
    await expect(page.getByText('↑ Cocok 100%')).toBeVisible();
    const unduhan = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Unduh PDF' }).click();
    expect((await unduhan).suggestedFilename()).toBe('ijazah-UNPAM-2026-0001.pdf');
  });

  test('tanpa kunci → status saja, data terkunci', async ({ page }) => {
    await page.goto('/i/1');
    await expect(page.getByTestId('status')).toHaveText('↑ Asli · tercatat');
    await expect(page.getByTestId('terkunci')).toBeVisible();
    await expect(page.getByTestId('nama')).toHaveCount(0);
  });

  test('kunci salah → tidak bisa membuka berkas', async ({ page }) => {
    await page.goto(`/i/1#k=${'A'.repeat(43)}`);
    await expect(page.getByText('✕ Tidak cocok')).toBeVisible();
    await expect(page.getByTestId('nama')).toHaveCount(0);
  });

  test('token dicabut tetap terbaca sebagai dicabut', async ({ page }) => {
    await page.goto(`/i/2#k=${kunci()[1]}`);
    await expect(page.getByTestId('status')).toHaveText('↓ Dicabut');
    await expect(page.getByTestId('nama')).toHaveText('Budi Santoso');
  });

  test('token yang tidak ada', async ({ page }) => {
    await page.goto('/i/999');
    await expect(page.getByRole('heading', { name: 'Token #999 tidak ada' })).toBeVisible();
  });

  test('header Referrer-Policy no-referrer', async ({ page }) => {
    const r = await page.goto('/i/1');
    expect(r?.headers()['referrer-policy']).toBe('no-referrer');
  });
});

test.describe('tampilan', () => {
  for (const lebar of [320, 375, 414, 768]) {
    test(`tanpa geser horizontal di lebar ${lebar} px`, async ({ page }) => {
      await page.setViewportSize({ width: lebar, height: 820 });
      for (const alamat of ['/periksa/', `/i/1#k=${kunci()[0]}`]) {
        await page.goto(alamat);
        await expect(page.locator('[data-siap]')).toBeAttached();
        const lebih = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(lebih, alamat).toBeLessThanOrEqual(0);
      }
    });
  }

  test('reduced motion mematikan transisi', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await bukaPeriksa(page);
    const durasi = await page.locator('.segel-keping').evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(durasi).toBe('0s');
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npm --prefix web run e2e`
Expected: seeding sukses (Anvil + deploy + 2 ijazah), lalu 15 tes gagal karena `/periksa/` dan `/i/` belum ada (server menjawab 404 / `[data-siap]` tidak ada).

- [ ] **Step 3: Commit**

```bash
git add web/playwright.config.ts web/e2e
git commit -m "test(web): harness E2E Anvil + IPFS lokal dan skenario verifikasi"
```

---

### Task 6: Halaman `/periksa` (unggah PDF, pindai QR, nomor token)

**Files:**
- Create: `web/src/islands/Periksa.tsx`, `web/src/islands/PindaiQr.tsx`, `web/src/pages/periksa.astro`

**Interfaces:**
- Consumes: `cekBerkas`, `buatSumber`, `jaringan`, `STATUS`, `pesanGalat`, `tautanIjazah`, `Segel`, `BarisBukti`.
- Produces: `/periksa/` dengan `input[type=file]`, `[data-testid=status]`, tautan "Lihat rincian ijazah #N" ke `/i/N`, form nomor token ke `/i/N`; atribut `data-siap` setelah hidrasi.

`web/src/islands/Periksa.tsx`:

```tsx
import { useEffect, useState, type DragEvent, type FormEvent } from 'react';
import BarisBukti from '../components/BarisBukti';
import Segel, { type NadaSegel } from '../components/Segel';
import { ringkas, tanggal } from '../lib/format';
import type { HasilBerkas } from '../lib/jenis';
import { jaringan } from '../lib/konfigurasi';
import { buatSumber } from '../lib/sumber';
import { STATUS, pesanGalat } from '../lib/tampilan';
import { cekBerkas } from '../lib/verifikasi';
import PindaiQr from './PindaiQr';

/** Ijazah PUSAKA selalu di bawah 4 MiB; batas ini hanya mencegah peramban menghitung berkas raksasa. */
export const MAKS_PDF = 8 * 1024 * 1024;

type Keadaan =
  | { tahap: 'siap' }
  | { tahap: 'menghitung'; nama: string }
  | { tahap: 'hasil'; nama: string; hasil: HasilBerkas }
  | { tahap: 'galat'; pesan: string };

type Panel = 'tidak-ada' | 'token' | 'qr';

function HasilBerkasView({ nama, hasil, ulang }: { nama: string; hasil: HasilBerkas; ulang: () => void }) {
  if (hasil.jenis === 'tidak-ada') {
    const t = STATUS.TIDAK_ADA;
    return (
      <>
        <div className="hud">
          PSK-VR
          <b data-nada={t.nada} data-testid="status">
            {t.simbol} {t.kata}
          </b>
        </div>
        <h1 className="judul">Tidak tercatat</h1>
        <p className="sub">{nama}</p>
        <BarisBukti
          bukti={[
            { ikon: '⌗', nama: 'Sidik jari berkas', ket: '✕ Tidak ada di blockchain', nada: 'bad', nilai: ringkas(hasil.docHash) },
          ]}
        />
        <p className="catatan">
          Berkas ini tidak cocok dengan ijazah mana pun yang diterbitkan lewat PUSAKA. Satu bita yang berubah sudah cukup
          membuat sidik jarinya berbeda.
        </p>
        <div className="aksi">
        <button type="button" className="br" onClick={ulang}>
          Periksa berkas lain
        </button>
        </div>
      </>
    );
  }
  const t = STATUS[hasil.status];
  const dicabut = hasil.status === 'DICABUT';
  return (
    <>
      <div className="hud">
        PSK-{hasil.tokenId.toString()}
        <b data-nada={t.nada} data-testid="status">
          {t.simbol} {t.kata}
        </b>
      </div>
      <h1 className="judul">Ijazah #{hasil.tokenId.toString()}</h1>
      <p className="sub">Diterbitkan {tanggal(hasil.ijazah.waktuTerbit)}</p>
      <BarisBukti
        bukti={[
          { ikon: '⌗', nama: 'Sidik jari berkas', ket: '↑ Cocok 100%', nada: 'ok', nilai: ringkas(hasil.docHash) },
          { ikon: '✍', nama: 'Tanda tangan Rektor', ket: '↑ Sah · EIP-712', nada: 'ok', nilai: ringkas(hasil.ijazah.penandaTangan) },
          dicabut
            ? { ikon: '⛓', nama: 'Status di blockchain', ket: `↓ Dicabut ${tanggal(hasil.ijazah.waktuCabut)}`, nada: 'bad' }
            : { ikon: '⛓', nama: 'Status di blockchain', ket: '↑ Tidak dicabut', nada: 'ok' },
        ]}
      />
      <p className="catatan">
        {dicabut
          ? 'Ijazah ini sudah dicabut universitas dan tidak berlaku lagi.'
          : 'Nama dan data lulusan tidak disimpan terbuka. Untuk melihatnya, buka tautan atau QR berkunci dari pemilik ijazah.'}
      </p>
      <div className="aksi">
        <a className="br" data-utama href={`/i/${hasil.tokenId.toString()}`}>
          Lihat rincian ijazah #{hasil.tokenId.toString()}
        </a>
        <button type="button" className="br" onClick={ulang}>
          Periksa berkas lain
        </button>
      </div>
    </>
  );
}

export default function Periksa() {
  const [k, setK] = useState<Keadaan>({ tahap: 'siap' });
  const [seret, setSeret] = useState(false);
  const [panel, setPanel] = useState<Panel>('tidak-ada');
  const [nomor, setNomor] = useState('');
  const [siap, setSiap] = useState(false);
  useEffect(() => setSiap(true), []);

  async function periksa(f: File) {
    if (f.size > MAKS_PDF) {
      setK({ tahap: 'galat', pesan: 'Berkas lebih dari 8 MB. Ijazah PUSAKA selalu di bawah 4 MB; pastikan ini PDF ijazahnya.' });
      return;
    }
    setK({ tahap: 'menghitung', nama: f.name });
    try {
      const s = await buatSumber(jaringan());
      setK({ tahap: 'hasil', nama: f.name, hasil: await cekBerkas(new Uint8Array(await f.arrayBuffer()), s) });
    } catch (e) {
      setK({ tahap: 'galat', pesan: pesanGalat(e) });
    }
  }

  function jatuhkan(e: DragEvent) {
    e.preventDefault();
    setSeret(false);
    const f = e.dataTransfer.files[0];
    if (f) void periksa(f);
  }

  function bukaToken(e: FormEvent) {
    e.preventDefault();
    if (/^\d{1,20}$/.test(nomor)) location.assign(`/i/${nomor}`);
  }

  const nada: NadaSegel = seret
    ? 'seret'
    : k.tahap === 'hasil'
      ? k.hasil.jenis === 'ada'
        ? STATUS[k.hasil.status].nada
        : 'bad'
      : k.tahap === 'menghitung'
        ? 'tunggu'
        : 'diam';

  return (
    <div className="panggung" data-siap={siap ? '' : undefined}>
      <section aria-label="Periksa berkas">
        <div className="hud">
          PSK-VR<b>{k.tahap === 'menghitung' ? 'Menghitung sidik jari…' : 'Letakkan PDF'}</b>
        </div>
        <label
          className="pilih-pdf"
          onDragOver={(e) => {
            e.preventDefault();
            setSeret(true);
          }}
          onDragLeave={() => setSeret(false)}
          onDrop={jatuhkan}
        >
          <input
            className="sr-only"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) void periksa(f);
              e.currentTarget.value = '';
            }}
          />
          <Segel nada={nada}>
            <span className="hud">
              Tarik PDF
              <br />
              ke segel
              <b>atau pilih berkas</b>
            </span>
          </Segel>
        </label>
        <div className="aksi" style={{ justifyContent: 'center' }}>
          <button type="button" className="br" aria-expanded={panel === 'qr'} onClick={() => setPanel(panel === 'qr' ? 'tidak-ada' : 'qr')}>
            Pindai QR
          </button>
          <button type="button" className="br" aria-expanded={panel === 'token'} onClick={() => setPanel(panel === 'token' ? 'tidak-ada' : 'token')}>
            Nomor token
          </button>
        </div>
        {panel === 'token' && (
          <form onSubmit={bukaToken}>
            <label className="isian">
              <span className="sr-only">Nomor token ijazah</span>
              <span className="hud" aria-hidden="true">
                #
              </span>
              <input
                inputMode="numeric"
                pattern="\d{1,20}"
                autoFocus
                required
                placeholder="Nomor token, misalnya 1284"
                value={nomor}
                onChange={(e) => setNomor(e.currentTarget.value.replace(/\D/g, ''))}
              />
              <button type="submit" className="br">
                Buka
              </button>
            </label>
          </form>
        )}
        {panel === 'qr' && <PindaiQr tutup={() => setPanel('tidak-ada')} />}
      </section>

      <section className="panggung-kanan" aria-live="polite">
        {k.tahap === 'hasil' ? (
          <HasilBerkasView nama={k.nama} hasil={k.hasil} ulang={() => setK({ tahap: 'siap' })} />
        ) : k.tahap === 'galat' ? (
          <>
            <div className="hud">
              PSK-VR<b data-nada="bad">! Gagal memeriksa</b>
            </div>
            <p className="catatan">{k.pesan}</p>
          </>
        ) : (
          <>
            <div className="hud">
              PSK-VR<b>{k.tahap === 'menghitung' ? k.nama : 'Siap memeriksa'}</b>
            </div>
            <h1 className="judul">Periksa ijazah</h1>
            <p className="sub">Unggah PDF ijazah, pindai QR-nya, atau masukkan nomor token.</p>
            <p className="catatan">
              Berkas tidak dikirim ke mana pun. Sidik jarinya dihitung di peramban ini lalu dicocokkan dengan catatan di
              blockchain Polygon, tanpa melewati server PUSAKA.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
```

`web/src/islands/PindaiQr.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { tautanIjazah } from '../lib/jalur';

interface Deteksi {
  rawValue: string;
}
interface Pendeteksi {
  detect(sumber: CanvasImageSource): Promise<Deteksi[]>;
}
type KelasPendeteksi = new (opsi: { formats: string[] }) => Pendeteksi;

const KelasBarcode = (globalThis as { BarcodeDetector?: KelasPendeteksi }).BarcodeDetector;

/** Pindai QR lewat kamera (BarcodeDetector). Peramban tanpa dukungan diarahkan ke aplikasi kamera ponsel. */
export default function PindaiQr({ tutup }: { tutup: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [pesan, setPesan] = useState(
    KelasBarcode ? 'Arahkan kamera ke QR di ijazah.' : 'Peramban ini tidak bisa memindai QR. Buka aplikasi kamera ponsel dan arahkan ke QR; tautannya langsung membuka halaman hasil.',
  );

  useEffect(() => {
    if (!KelasBarcode) return;
    const pendeteksi = new KelasBarcode({ formats: ['qr_code'] });
    let aliran: MediaStream | null = null;
    let jalan = true;
    (async () => {
      try {
        aliran = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = video.current;
        if (!v || !jalan) return;
        v.srcObject = aliran;
        await v.play();
        while (jalan) {
          const [hasil] = await pendeteksi.detect(v);
          if (hasil) {
            const tautan = tautanIjazah(hasil.rawValue, location.origin);
            if (tautan) {
              location.assign(tautan);
              return;
            }
            setPesan('QR ini bukan tautan ijazah PUSAKA.');
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setPesan('Kamera tidak bisa dibuka. Izinkan akses kamera atau masukkan nomor token.');
      }
    })();
    return () => {
      jalan = false;
      aliran?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div>
      {KelasBarcode && <video ref={video} className="kamera" muted playsInline />}
      <p className="catatan">{pesan}</p>
      <div className="aksi">
        <button type="button" className="br" onClick={tutup}>
          Tutup kamera
        </button>
      </div>
    </div>
  );
}
```

`web/src/pages/periksa.astro`:

```astro
---
import Periksa from '../islands/Periksa';
import Ruang from '../layouts/Ruang.astro';
---

<Ruang judul="Periksa ijazah" deskripsi="Periksa keaslian ijazah Universitas Pamulang langsung dari blockchain.">
  <Periksa client:load />
</Ruang>
```

- [ ] **Step 2: Jalankan E2E unggah**

Run: `npm --prefix web run e2e -- -g "unggah PDF"`
Expected: 3 tes unggah lulus; `nomor token membuka halaman hasil` masih gagal (halaman `/i/` belum ada).

- [ ] **Step 3: Commit**

```bash
git add web/src/islands/Periksa.tsx web/src/islands/PindaiQr.tsx web/src/pages/periksa.astro
git commit -m "feat(web): halaman /periksa (segel unggah PDF, pindai QR, nomor token)"
```

---

### Task 7: Halaman `/i/[tokenId]` + rewrite

**Files:**
- Create: `web/src/islands/Hasil.tsx`, `web/src/pages/i/index.astro`
- Modify: `web/astro.config.mjs`, `vercel.json`

**Interfaces:**
- Consumes: `cekToken`, `statusIjazah`, `kunciDariFragmen`, `tokenDariJalur`, `buatSumber`, `STATUS`.
- Produces: `/i/<token>[#k=…]` dengan `[data-testid=status|nama|terkunci]`, tautan "Unduh PDF" (`ijazah-<nomor>.pdf`), "Salin tautan", "Cetak", HUD blok terkini.

`web/src/islands/Hasil.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import BarisBukti, { type Bukti } from '../components/BarisBukti';
import Segel, { type NadaSegel } from '../components/Segel';
import { angka, ringkas, tanggal } from '../lib/format';
import type { HasilToken, Ijazah } from '../lib/jenis';
import { jaringan } from '../lib/konfigurasi';
import { tokenDariJalur } from '../lib/jalur';
import { kunciDariFragmen } from '../lib/kunci';
import { buatSumber } from '../lib/sumber';
import { STATUS, pesanGalat, type Tampilan } from '../lib/tampilan';
import { cekToken, statusIjazah } from '../lib/verifikasi';

type Keadaan =
  | { tahap: 'memuat'; tokenId: string }
  | { tahap: 'hasil'; hasil: HasilToken; blok: bigint }
  | { tahap: 'alamat-salah' }
  | { tahap: 'galat'; tokenId: string; pesan: string };

function buktiRantai(i: Ijazah): Bukti[] {
  const dicabut = statusIjazah(i) === 'DICABUT';
  return [
    { ikon: '✍', nama: 'Tanda tangan Rektor', ket: '↑ Sah · EIP-712', nada: 'ok', nilai: ringkas(i.penandaTangan) },
    dicabut
      ? { ikon: '⛓', nama: 'Status di blockchain', ket: `↓ Dicabut ${tanggal(i.waktuCabut)}`, nada: 'bad' }
      : { ikon: '⛓', nama: 'Status di blockchain', ket: '↑ Tidak dicabut', nada: 'ok', nilai: tanggal(i.waktuTerbit) },
  ];
}

function tampilanHasil(h: HasilToken): Tampilan {
  if (h.jenis === 'tidak-ada') return STATUS.TIDAK_ADA;
  if (h.jenis === 'berkas-tidak-cocok') return STATUS.PERINGATAN;
  return STATUS[statusIjazah(h.ijazah)];
}

function Pdf({ pdf, nama }: { pdf: Uint8Array; nama: string }) {
  const url = useMemo(() => URL.createObjectURL(new Blob([pdf.slice()], { type: 'application/pdf' })), [pdf]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [disalin, setDisalin] = useState(false);
  return (
    <>
      <div className="aksi">
        <a className="br" data-utama href={url} download={`ijazah-${nama}.pdf`}>
          Unduh PDF
        </a>
        <button
          type="button"
          className="br"
          onClick={() => {
            void navigator.clipboard.writeText(location.href).then(() => setDisalin(true));
          }}
        >
          {disalin ? 'Tautan disalin' : 'Salin tautan'}
        </button>
        <button type="button" className="br" onClick={() => window.print()}>
          Cetak
        </button>
      </div>
      <p className="catatan tidak-dicetak">Tautan ini membawa kunci berkas. Bagikan hanya ke pihak yang perlu memeriksa.</p>
      <iframe className="pratinjau" src={url} title="Pratinjau PDF ijazah" />
    </>
  );
}

function Isi({ hasil }: { hasil: HasilToken }) {
  const id = hasil.tokenId.toString();
  switch (hasil.jenis) {
    case 'tidak-ada':
      return (
        <>
          <h1 className="judul">Token #{id} tidak ada</h1>
          <p className="catatan">
            Nomor token ini belum pernah diterbitkan PUSAKA. Periksa kembali nomornya, atau unggah PDF ijazah di halaman Periksa.
          </p>
          <div className="aksi">
            <a className="br" data-utama href="/periksa">
              Periksa ijazah lain
            </a>
          </div>
        </>
      );
    case 'terkunci':
      return (
        <>
          <h1 className="judul">Ijazah #{id}</h1>
          <p className="sub">Diterbitkan {tanggal(hasil.ijazah.waktuTerbit)}</p>
          <BarisBukti bukti={buktiRantai(hasil.ijazah)} />
          <p className="catatan" data-testid="terkunci">
            Data lulusan terkunci. Nama dan berkas hanya tampil bila halaman ini dibuka dari tautan atau QR berkunci milik
            alumni.
          </p>
        </>
      );
    case 'kunci-salah':
      return (
        <>
          <h1 className="judul">Ijazah #{id}</h1>
          <BarisBukti
            bukti={[{ ikon: '⚿', nama: 'Kunci berkas', ket: '✕ Tidak cocok', nada: 'bad' }, ...buktiRantai(hasil.ijazah)]}
          />
          <p className="catatan">
            Kunci di tautan ini tidak bisa membuka berkas ijazah. Minta tautan atau QR baru dari pemilik ijazah. Status di
            blockchain di atas tetap berlaku.
          </p>
        </>
      );
    case 'berkas-tidak-cocok':
      return (
        <>
          <h1 className="judul">Jangan percayai berkas ini</h1>
          <BarisBukti
            bukti={[
              { ikon: '⌗', nama: 'Sidik jari berkas', ket: '✕ Tidak cocok', nada: 'bad', nilai: ringkas(hasil.hashBerkas) },
              ...buktiRantai(hasil.ijazah),
            ]}
          />
          <p className="catatan">
            Berkas di IPFS tidak sama dengan sidik jari yang dicatat di blockchain saat ijazah diterbitkan. Laporkan ke BAAK
            Universitas Pamulang.
          </p>
        </>
      );
    case 'lengkap': {
      const d = hasil.data;
      return (
        <>
          <h1 className="judul" data-testid="nama">
            {d.nama}
          </h1>
          <p className="sub">
            {d.gelar} · {d.prodi} · Universitas Pamulang
          </p>
          <BarisBukti
            bukti={[
              { ikon: '⌗', nama: 'Sidik jari berkas', ket: '↑ Cocok 100%', nada: 'ok', nilai: ringkas(hasil.ijazah.docHash) },
              ...buktiRantai(hasil.ijazah),
            ]}
          />
          <dl className="data">
            <dt>NIM</dt>
            <dd className="mono">{d.nim}</dd>
            <dt>Nomor ijazah</dt>
            <dd className="mono">{d.nomor_ijazah}</dd>
            <dt>Tanggal lulus</dt>
            <dd>{tanggal(Date.parse(`${d.tanggal_lulus}T00:00:00+07:00`) / 1000)}</dd>
          </dl>
          <Pdf pdf={hasil.pdf} nama={d.nomor_ijazah.replace(/[^A-Za-z0-9]+/g, '-')} />
        </>
      );
    }
  }
}

export default function Hasil() {
  const [k, setK] = useState<Keadaan>({ tahap: 'memuat', tokenId: '' });

  useEffect(() => {
    const tokenId = tokenDariJalur(location.pathname);
    if (tokenId === null) {
      setK({ tahap: 'alamat-salah' });
      return;
    }
    setK({ tahap: 'memuat', tokenId: tokenId.toString() });
    let batal = false;
    (async () => {
      try {
        const s = await buatSumber(jaringan());
        const [hasil, blok] = await Promise.all([cekToken(tokenId, kunciDariFragmen(location.hash), s), s.blok()]);
        if (!batal) setK({ tahap: 'hasil', hasil, blok });
      } catch (e) {
        if (!batal) setK({ tahap: 'galat', tokenId: tokenId.toString(), pesan: pesanGalat(e) });
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  if (k.tahap === 'alamat-salah') {
    return (
      <div className="panggung">
        <section className="panggung-kanan">
          <h1 className="judul">Alamat ijazah tidak lengkap</h1>
          <p className="catatan">Alamat yang benar berbentuk /i/ diikuti nomor token, misalnya /i/1284.</p>
          <div className="aksi">
            <a className="br" data-utama href="/periksa">
              Ke halaman Periksa
            </a>
          </div>
        </section>
      </div>
    );
  }

  const t = k.tahap === 'hasil' ? tampilanHasil(k.hasil) : null;
  const nada: NadaSegel = t ? t.nada : k.tahap === 'galat' ? 'bad' : 'tunggu';
  const id = k.tahap === 'hasil' ? k.hasil.tokenId.toString() : k.tokenId;

  return (
    <div className="panggung" data-siap={k.tahap === 'memuat' ? undefined : ''}>
      <section aria-hidden="true">
        <Segel nada={nada}>
          <span className="hud">
            Ijazah
            <b>#{id}</b>
          </span>
        </Segel>
      </section>
      <section className="panggung-kanan" aria-live="polite">
        <div className="baris-hud">
          <div className="hud">
            PSK-{id}
            {t ? (
              <b data-nada={t.nada} data-testid="status">
                {t.simbol} {t.kata}
              </b>
            ) : k.tahap === 'galat' ? (
              <b data-nada="bad">! Gagal membaca</b>
            ) : (
              <b>Membaca blockchain…</b>
            )}
          </div>
          {k.tahap === 'hasil' && (
            <div className="hud" style={{ textAlign: 'right' }}>
              Blok<b>{angka(k.blok)}</b>
            </div>
          )}
        </div>
        {k.tahap === 'hasil' && <Isi hasil={k.hasil} />}
        {k.tahap === 'galat' && <p className="catatan">{k.pesan}</p>}
      </section>
    </div>
  );
}
```

`web/src/pages/i/index.astro`:

```astro
---
import Hasil from '../../islands/Hasil';
import Ruang from '../../layouts/Ruang.astro';
---

<Ruang judul="Hasil verifikasi ijazah" deskripsi="Status ijazah Universitas Pamulang di blockchain." tanpaReferer>
  <Hasil client:load />
</Ruang>
```

`web/astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

/** Dev server meniru rewrite vercel.json: `/i/<token>` dilayani halaman `/i/`. */
const rewriteIjazah = {
  name: 'pusaka-rewrite-ijazah',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/i\/\d+\/?(\?.*)?$/.test(req.url)) req.url = '/i/';
      next();
    });
  },
};

export default defineConfig({
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), rewriteIjazah],
    server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  },
});
```

`vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "installCommand": "npm --prefix web ci",
  "buildCommand": "npm --prefix web run build",
  "outputDirectory": "web/dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index"
    },
    {
      "source": "/i/:token(\\d+)",
      "destination": "/i/index.html"
    }
  ],
  "headers": [
    {
      "source": "/i/(.*)",
      "headers": [
        {
          "key": "Referrer-Policy",
          "value": "no-referrer"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Jalankan semua tes**

Run: `npm --prefix web test && npm --prefix web run check && npm --prefix web run e2e`
Expected: 28 unit lulus, 0 galat tipe, 15 E2E lulus.

Run (dev rewrite): `npx --prefix web astro dev --port 4398` lalu `curl -s localhost:4398/i/5 | grep -o '<title>[^<]*'`, lalu `npx --prefix web astro dev stop`
Expected: `<title>Hasil verifikasi ijazah · PUSAKA`

- [ ] **Step 3: Commit**

```bash
git add web/src/islands/Hasil.tsx web/src/pages/i web/astro.config.mjs vercel.json
git commit -m "feat(web): halaman /i/[tokenId] (status, QR berkunci, PDF) dengan rewrite Vercel dan dev"
```

---

### Task 8: CI, dokumentasi, preview, PR

**Files:**
- Modify: `.github/workflows/ci.yml`, `README.md`, `docs/superpowers/specs/2026-10-16-pusaka-v2-design.md` (8.4), `docs/superpowers/plans/2026-10-16-pusaka-v2-00-peta-jalan.md`

- [ ] **Step 1: CI** — di job `web` tambahkan `- run: npm --prefix web test` setelah `npm --prefix web ci`. Tambahkan job:

```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm, cache-dependency-path: web/package-lock.json }
      - run: npm --prefix web ci
      - run: npm --prefix web run e2e
```

- [ ] **Step 2: Dokumentasi**
  - README, bagian "Uji": tambah `npm --prefix web test` dan `npm --prefix web run e2e   # Anvil + Chrome sistem`.
  - Spec 8.4 **Objek**: "Segel Pusaka (keping heksagon CSS dengan orbit di halaman dalam; versi three.js di beranda)".
  - Peta jalan: baris 05 → `✅ 2026-10-16-pusaka-v2-05-periksa.md`.

- [ ] **Step 3: Push, preview, PR**

```bash
git push -u origin feat/pusaka-v2-periksa
npx vercel@latest deploy --yes
npx vercel@latest curl /periksa/ --deployment <url-preview> | grep -o '<title>[^<]*'
gh pr create --base feat/pusaka-v2-api --head feat/pusaka-v2-periksa --title "PUSAKA v2: halaman /periksa dan /i/[tokenId]" --body-file <ringkasan>
```

Expected: preview menyajikan `/periksa/` (`<title>Periksa ijazah · PUSAKA`); halaman menampilkan "Alamat kontrak belum diatur" sampai env `PUBLIC_*` diisi di rencana 09.
