# PUSAKA v2 — Rencana 08: beranda 3D

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beranda `/` dengan koreografi scroll enam babak (spec 8.2) — segel di ruang bintang, cetak biru lima lapis bukti, ponsel yang naik, uji pemalsuan merah, inti kristal dengan `totalTerbit()` langsung dari kontrak, penutup putih — plus versi statis untuk reduced motion / tanpa WebGL.

**Architecture:** Seluruh keadaan adegan adalah fungsi murni dari progres scroll `p ∈ [0,1]` (`babak.ts` untuk babak & warna latar, `adegan.ts` `atur(p)` untuk three.js). GSAP ScrollTrigger (scrub) dan Lenis hanya menghaluskan `p`. Teks tiap babak berada di HTML statis (LCP berupa teks, terbaca tanpa JS); saat animasi hidup, layar babak dipaku `position: fixed` dan hanya babak aktif yang tampil. three.js/GSAP/Lenis dimuat dinamis hanya di `/`.

**Tech Stack:** three 0.186 (+ RoomEnvironment), gsap 3.15 (ScrollTrigger), lenis 1.3, viem (totalTerbit), Astro, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-pusaka-v2-design.md` (8.2)

**Branch:** `feat/pusaka-v2-beranda` dari `feat/pusaka-v2-alumni`.

## Global Constraints

- Tidak menyalin kode, teks, model, atau aset quantumwallet.tech; hanya koreografi dan teknik. Semua geometri dibuat dengan kode.
- `prefers-reduced-motion` atau tanpa WebGL2 → `html.statis`: tanpa kanvas, gulir biasa, semua teks tampil.
- LCP berupa teks; three.js dan GSAP tidak dimuat di halaman lain.
- Tanpa geser horizontal di 375 px.

## Keputusan terhadap spec

1. **Versi statis memakai segel CSS** (komponen keping heksagon yang sama dengan halaman dalam) dan latar per babak, bukan gambar render per babak: tanpa aset biner tambahan, tetap ringan.
2. **Keadaan adegan deterministik dari `p`**, bukan timeline GSAP berlabel: bisa diuji, di-screenshot di titik mana pun, dan tidak menumpuk keadaan saat gulir bolak-balik.

## Review Focus

1. Gulir cepat ke bawah lalu ke atas → babak dan teks konsisten (fungsi murni dari `p`).
2. Reduced motion → tidak ada kanvas dan tidak ada teks tersembunyi (E2E).
3. RPC mati → `totalTerbit` menampilkan `—`, halaman tetap jalan.

---

### Task 1: Babak dan warna latar (murni)

`web/tests/babak.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { BABAK, babakAktif, campur, lokal, warnaLatar } from '../src/beranda/babak';

describe('babak beranda', () => {
  test('enam babak berurutan menutup 0..1', () => {
    expect(BABAK).toHaveLength(6);
    expect(BABAK[0]?.mulai).toBe(0);
    expect(BABAK.at(-1)?.selesai).toBe(1);
    for (let i = 1; i < BABAK.length; i++) expect(BABAK[i]?.mulai).toBe(BABAK[i - 1]?.selesai);
  });

  test('babak aktif dari progres scroll', () => {
    expect(babakAktif(0)).toBe(0);
    expect(babakAktif(0.2)).toBe(1);
    expect(babakAktif(0.999)).toBe(5);
    expect(babakAktif(1)).toBe(5);
    expect(babakAktif(-1)).toBe(0);
  });

  test('progres lokal dijepit 0..1', () => {
    const b = BABAK[1]!;
    expect(lokal(b.mulai, 1)).toBe(0);
    expect(lokal(b.selesai, 1)).toBe(1);
    expect(lokal((b.mulai + b.selesai) / 2, 1)).toBeCloseTo(0.5);
    expect(lokal(0, 3)).toBe(0);
    expect(lokal(1, 3)).toBe(1);
  });

  test('warna latar mengikuti babak: gelap, kertas, gelap, merah, gelap, putih', () => {
    expect(warnaLatar(0.05)).toBe('#03060c');
    expect(warnaLatar((BABAK[1]!.mulai + BABAK[1]!.selesai) / 2)).toBe('#eef1f6');
    expect(warnaLatar(0.995)).toBe('#f7f8fb');
    expect(campur('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});
```

Run: `npm --prefix web test -- babak` → Expected: FAIL (modul belum ada).

`web/src/beranda/babak.ts`:

```ts
//! Pembagian halaman beranda menjadi enam babak (spec 8.2). Semua keadaan adegan dihitung dari
//! satu angka progres scroll 0..1, sehingga bisa diuji dan dirender ulang di titik mana pun.

export interface Babak {
  nama: string;
  mulai: number;
  selesai: number;
  /** Warna latar halaman saat babak ini penuh. */
  latar: string;
  /** Teks gelap di atas latar terang. */
  terang: boolean;
}

export const BABAK: readonly Babak[] = [
  { nama: 'pembuka', mulai: 0, selesai: 0.17, latar: '#03060c', terang: false },
  { nama: 'cetak-biru', mulai: 0.17, selesai: 0.35, latar: '#eef1f6', terang: true },
  { nama: 'ponsel', mulai: 0.35, selesai: 0.53, latar: '#05101f', terang: false },
  { nama: 'pemalsuan', mulai: 0.53, selesai: 0.7, latar: '#2a0509', terang: false },
  { nama: 'inti', mulai: 0.7, selesai: 0.86, latar: '#03060c', terang: false },
  { nama: 'penutup', mulai: 0.86, selesai: 1, latar: '#f7f8fb', terang: true },
];

/** Porsi awal tiap babak yang dipakai untuk peralihan warna dari babak sebelumnya. */
const PERALIHAN = 0.3;

export const jepit = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export function babakAktif(p: number): number {
  const q = jepit(p);
  const i = BABAK.findIndex((b) => q < b.selesai);
  return i === -1 ? BABAK.length - 1 : i;
}

/** Progres di dalam babak `i` (0 di awal, 1 di akhir), dijepit. */
export function lokal(p: number, i: number): number {
  const b = BABAK[i];
  if (!b) return 0;
  return jepit((p - b.mulai) / (b.selesai - b.mulai));
}

const keRgb = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));

export function campur(a: string, b: string, t: number): string {
  const x = keRgb(a);
  const y = keRgb(b);
  return `#${x.map((v, i) => Math.round(v + ((y[i] ?? v) - v) * jepit(t)).toString(16).padStart(2, '0')).join('')}`;
}

export function warnaLatar(p: number): string {
  const i = babakAktif(p);
  const kini = BABAK[i]!;
  const lalu = BABAK[i - 1];
  if (!lalu) return kini.latar;
  return campur(lalu.latar, kini.latar, lokal(p, i) / PERALIHAN);
}

/** Kurva halus untuk gerak di dalam babak. */
export const halus = (t: number) => {
  const x = jepit(t);
  return x * x * (3 - 2 * x);
};
```

Run: `npm --prefix web test` → Expected: lulus. Commit `feat(web): pembagian enam babak beranda (progres scroll → babak, warna latar)`.

---

### Task 2: Adegan, halaman, gaya, E2E

`npm --prefix web i three@^0.186 gsap@^3.15 lenis@^1.3 && npm --prefix web i -D @types/three@^0.186`; tambah `'function totalTerbit() view returns (uint256)'` ke `web/src/lib/abi.ts`.

`web/e2e/beranda.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

async function gulirKe(page: Page, p: number) {
  await page.evaluate((x) => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * x), p);
}

test('judul tampil tanpa menunggu 3D, lalu adegan hidup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Ijazah yang\s*mustahil dipalsukan/);
  await expect(page.locator('html.hidup')).toBeAttached();
  await expect(page.locator('html')).toHaveAttribute('data-babak', 'pembuka');
});

test('gulir sampai bawah melewati babak dan berakhir di penutup', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html.hidup')).toBeAttached();
  await gulirKe(page, 0.27);
  await expect(page.locator('html')).toHaveAttribute('data-babak', 'cetak-biru');
  await gulirKe(page, 1);
  await expect(page.locator('html')).toHaveAttribute('data-babak', 'penutup');
  await expect(page.getByRole('heading', { name: 'Asli atau palsu?' })).toBeVisible();
  await page.locator('[data-untuk="penutup"]').getByRole('link', { name: 'Periksa ijazah' }).click();
  await expect(page).toHaveURL(/\/periksa\/?$/);
});

test('jumlah ijazah tercatat dibaca langsung dari kontrak', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-total-terbit]')).toHaveText(/^\d+$/);
  await expect(page.locator('[data-alamat-kontrak]').first()).toHaveText('0x5FbD…0aa3');
});

test('reduced motion: tanpa kanvas, semua teks tampil, gulir biasa', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html.statis')).toBeAttached();
  await expect(page.locator('#kanvas-beranda')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Langsung ketahuan.' })).toBeVisible();
});

test('tanpa geser horizontal di 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await expect(page.locator('html.hidup')).toBeAttached();
  for (const p of [0, 0.3, 0.45, 0.6, 0.8, 1]) {
    await gulirKe(page, p);
    const lebih = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(lebih, `p=${p}`).toBeLessThanOrEqual(0);
  }
});
```

Run: `npm --prefix web run e2e -- beranda` → Expected: FAIL (beranda masih kerangka).

`web/src/beranda/adegan.ts`:

```ts
//! Adegan three.js beranda: Segel Pusaka dan inti kristal. `atur(p)` menghitung seluruh keadaan
//! dari progres scroll 0..1 (tanpa timeline tersimpan), sehingga lompat ke titik mana pun konsisten.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { halus, lokal } from './babak';

export interface Adegan {
  atur(p: number): void;
  render(): void;
  ukur(lebar: number, tinggi: number): void;
  buang(): void;
}

/** Heksagon datar atas-bawah, sedikit melebar (siluet segel). */
function heksagon(r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const x = Math.cos(a) * r * 1.12;
    const y = Math.sin(a) * r * 0.9;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

const acak = (() => {
  let s = 20261016;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
})();

export function buatAdegan(kanvas: HTMLCanvasElement): Adegan {
  const renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const adegan = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  adegan.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const kamera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  kamera.position.set(0, 0, 11);

  adegan.add(new THREE.AmbientLight(0x6f8cff, 0.35));
  const kunci = new THREE.DirectionalLight(0xbfd6ff, 1.4);
  kunci.position.set(-4, 5, 6);
  adegan.add(kunci);

  // ------------------------------------------------------------ segel (dua keping + tombol)
  const segel = new THREE.Group();
  adegan.add(segel);
  const bahanCangkang = new THREE.MeshPhysicalMaterial({
    color: 0x1a2232,
    metalness: 0.65,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.25,
    transparent: true,
  });
  const ekstrusi = (tebal: number) =>
    new THREE.ExtrudeGeometry(heksagon(1.6), { depth: tebal, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 4 });
  const gBelakang = ekstrusi(0.22);
  const gDepan = ekstrusi(0.22);
  const belakang = new THREE.Mesh(gBelakang, bahanCangkang);
  belakang.position.z = -0.34;
  const depan = new THREE.Mesh(gDepan, bahanCangkang);
  depan.position.z = 0.04;
  segel.add(belakang, depan);

  const bahanTombol = new THREE.MeshPhysicalMaterial({ color: 0x0c111a, metalness: 0.8, roughness: 0.2, emissive: 0xff2b45, emissiveIntensity: 0, transparent: true });
  const tombol = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 48), bahanTombol);
  tombol.rotation.x = Math.PI / 2;
  tombol.position.set(0.62, -0.62, 0.38);
  const cincin = new THREE.Mesh(
    new THREE.TorusGeometry(0.33, 0.02, 12, 64),
    new THREE.MeshBasicMaterial({ color: 0x9cc3ff, transparent: true, opacity: 0.6 }),
  );
  cincin.position.copy(tombol.position);
  depan.add(tombol, cincin);
  tombol.position.z -= 0.04;
  cincin.position.z -= 0.04;

  // garis cetak biru
  const bahanGaris = new THREE.LineBasicMaterial({ color: 0x1f2a3d, transparent: true, opacity: 0 });
  const garisBelakang = new THREE.LineSegments(new THREE.EdgesGeometry(gBelakang, 25), bahanGaris);
  const garisDepan = new THREE.LineSegments(new THREE.EdgesGeometry(gDepan, 25), bahanGaris);
  belakang.add(garisBelakang);
  depan.add(garisDepan);

  // lima lapis bukti (cetak biru): PDF → Keccak → ECDSA → ERC-721 → IPFS
  const lapisan = new THREE.Group();
  const titikHeks = heksagon(1.5).getPoints(6);
  const bahanLapis = new THREE.LineBasicMaterial({ color: 0x3b6bd6, transparent: true, opacity: 0 });
  const lapis: THREE.LineLoop[] = [];
  for (let k = 0; k < 5; k++) {
    const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(titikHeks.map((v) => new THREE.Vector3(v.x, v.y, 0))), bahanLapis);
    lapisan.add(l);
    lapis.push(l);
  }
  segel.add(lapisan);

  // ------------------------------------------------------------ inti kristal, simpul jaringan, berkas
  const bahanKristal = new THREE.MeshPhysicalMaterial({
    color: 0xa8e4ff,
    emissive: 0x3aa8ff,
    emissiveIntensity: 0,
    roughness: 0.08,
    metalness: 0.1,
    transmission: 0.35,
    thickness: 0.6,
    transparent: true,
  });
  const kristal = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), bahanKristal);
  kristal.scale.set(0.8, 1.35, 0.8);
  adegan.add(kristal);
  const cahayaInti = new THREE.PointLight(0x5fb8ff, 0, 12);
  kristal.add(cahayaInti);

  const simpul: THREE.Mesh[] = [];
  const berkas: THREE.Mesh[] = [];
  const bahanSimpul = new THREE.MeshPhysicalMaterial({ color: 0xc9d6ea, metalness: 0.9, roughness: 0.15, transparent: true });
  const bahanBerkas = new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.9 });
  for (const [x, y] of [
    [-3.4, 1.3],
    [3.3, 1.5],
    [-3.1, -1.6],
    [3.6, -1.2],
  ] as const) {
    const s = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.09, 16, 40), bahanSimpul);
    s.position.set(x, y, -0.6);
    simpul.push(s);
    adegan.add(s);
    const panjang = Math.hypot(x, y, 0.6);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 8), bahanBerkas);
    b.userData['panjang'] = panjang;
    b.userData['arah'] = new THREE.Vector3(x, y, -0.6).normalize();
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.userData['arah'] as THREE.Vector3);
    berkas.push(b);
    adegan.add(b);
  }

  // ------------------------------------------------------------ bintang dan pecahan kristal
  const n = 1400;
  const posisi = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    posisi[i * 3] = (acak() - 0.5) * 60;
    posisi[i * 3 + 1] = (acak() - 0.5) * 36;
    posisi[i * 3 + 2] = -10 - acak() * 30;
  }
  const bahanBintang = new THREE.PointsMaterial({ color: 0x9cc3ff, size: 0.06, transparent: true, opacity: 1, sizeAttenuation: true });
  const bintang = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(posisi, 3)), bahanBintang);
  adegan.add(bintang);

  const bahanPecahan = new THREE.MeshPhysicalMaterial({ color: 0xdfeeff, roughness: 0.1, transmission: 0.5, thickness: 0.3, transparent: true, opacity: 0 });
  const pecahan: { m: THREE.Mesh; asal: THREE.Vector3; putar: THREE.Vector3 }[] = [];
  for (let i = 0; i < 46; i++) {
    const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.08 + acak() * 0.16, 0), bahanPecahan);
    const asal = new THREE.Vector3((acak() - 0.5) * 9, (acak() - 0.5) * 5.5, (acak() - 0.5) * 3);
    m.position.copy(asal);
    pecahan.push({ m, asal, putar: new THREE.Vector3(acak(), acak(), acak()) });
    adegan.add(m);
  }

  let lebarLayar = 1;
  const sempit = () => lebarLayar < 768;

  function atur(p: number) {
    const l = [0, 1, 2, 3, 4, 5].map((i) => lokal(p, i)) as [number, number, number, number, number, number];
    const masuk = (i: number) => halus(l[i]! / 0.35); // peralihan di awal babak i

    // Babak 1: segel berputar pelan di ruang bintang, sedikit ke kiri (teks di sudut).
    const geserX = sempit() ? 0 : -0.7;
    segel.position.set(geserX, 0, 0);
    segel.rotation.set(0.42 - p * 0.3, -0.5 + l[0] * 0.55 + l[1] * 0.25, 0.04);
    segel.scale.setScalar(sempit() ? 0.72 : 1);
    bahanBintang.opacity = 1 - masuk(1) + masuk(2) * 0.8 - masuk(3) * 0.8 + masuk(4) * 0.8 - masuk(5) * 0.8;

    // Babak 2: cetak biru — cangkang memudar, garis tampil, lima lapis terurai.
    const biru = masuk(1) * (1 - masuk(2));
    bahanCangkang.opacity = 1 - biru;
    bahanTombol.opacity = 1 - biru;
    (cincin.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - biru);
    bahanGaris.opacity = biru;
    bahanLapis.opacity = biru * 0.85;
    const urai = halus((l[1] - 0.2) / 0.5) * (1 - masuk(2));
    lapis.forEach((x, k) => {
      x.position.z = (k - 2) * 0.9 * urai;
      x.position.x = (k - 2) * 0.35 * urai;
    });
    if (biru > 0) {
      segel.rotation.y += biru * 0.55;
      segel.rotation.x -= biru * 0.15;
    }

    // Babak 3: ponsel naik di kiri; segel bergeser ke kanan dan mengecil.
    const ponsel = masuk(2) * (1 - masuk(3));
    segel.position.x += ponsel * (sempit() ? 0 : 3.3 - geserX);
    segel.position.y += ponsel * (sempit() ? 1.6 : 0.2);
    segel.scale.multiplyScalar(1 - ponsel * 0.28);

    // Babak 4: kamera mendekat ke tombol, mode merah.
    const dekat = masuk(3) * (1 - masuk(4));
    segel.scale.multiplyScalar(1 + dekat * 0.45);
    segel.position.x += dekat * (sempit() ? 0 : 1.6 - segel.position.x);
    segel.position.y += dekat * 0.35;
    segel.rotation.x -= dekat * 0.3;
    bahanTombol.emissiveIntensity = dekat * (0.6 + 0.6 * halus((l[3] - 0.45) / 0.2));

    // Babak 5: segel membuka, inti kristal menyala, berkas cahaya ke simpul jaringan.
    const buka = masuk(4);
    const tutup = masuk(5);
    depan.position.y = buka * 2.3;
    depan.position.z = 0.04 + buka * 0.8;
    depan.rotation.x = -buka * 0.55;
    belakang.position.y = -buka * 2.3;
    belakang.rotation.x = buka * 0.4;
    segel.rotation.x -= buka * 0.3;
    segel.rotation.y -= buka * 0.4;
    bahanCangkang.opacity *= 1 - tutup;
    bahanTombol.opacity *= 1 - tutup;
    (cincin.material as THREE.MeshBasicMaterial).opacity *= 1 - tutup;

    const nyala = halus((l[4] - 0.1) / 0.4) * (1 - tutup * 0.6);
    kristal.position.set(segel.position.x * (1 - buka), 0, 0);
    kristal.scale.set(0.8 * buka * (1 - tutup * 0.7), 1.35 * buka * (1 - tutup * 0.7), 0.8 * buka * (1 - tutup * 0.7));
    kristal.rotation.y = p * 6;
    bahanKristal.emissiveIntensity = 0.4 + nyala * 2.6;
    cahayaInti.intensity = nyala * 30;
    const sebar = halus((l[4] - 0.35) / 0.4) * (1 - tutup);
    for (const s of simpul) {
      (s.material as THREE.MeshPhysicalMaterial).opacity = halus((l[4] - 0.2) / 0.3) * (1 - tutup);
      s.rotation.y = p * 4;
    }
    for (const b of berkas) {
      const panjang = (b.userData['panjang'] as number) * sebar;
      const arah = b.userData['arah'] as THREE.Vector3;
      b.scale.set(1, Math.max(panjang, 0.0001), 1);
      b.position.copy(arah).multiplyScalar(panjang / 2);
      b.visible = sebar > 0.01;
    }

    // Babak 6: putih, pecahan kristal melayang.
    bahanPecahan.opacity = tutup;
    for (const { m, asal, putar } of pecahan) {
      m.position.set(asal.x, asal.y + l[5] * 0.8 * (putar.y - 0.5), asal.z);
      m.rotation.set(p * 9 * putar.x, p * 7 * putar.y, p * 5 * putar.z);
      m.visible = tutup > 0.01;
    }
    bahanSimpul.opacity = (1 - tutup) * halus((l[4] - 0.2) / 0.3);
  }

  return {
    atur,
    render: () => renderer.render(adegan, kamera),
    ukur(lebar, tinggi) {
      lebarLayar = lebar;
      renderer.setSize(lebar, tinggi, false);
      kamera.aspect = lebar / tinggi;
      kamera.position.z = lebar < 768 ? 15 : 11;
      kamera.updateProjectionMatrix();
    },
    buang() {
      renderer.dispose();
      pmrem.dispose();
    },
  };
}
```

`web/src/beranda/mulai.ts`:

```ts
//! Titik masuk beranda: memilih versi bergerak (three.js + GSAP ScrollTrigger + Lenis) atau statis,
//! lalu menghubungkan progres scroll ke adegan, warna latar, dan teks tiap babak.

import { createPublicClient, http } from 'viem';
import { abiPusaka } from '../lib/abi';
import { angka } from '../lib/format';
import { jaringan } from '../lib/konfigurasi';
import { BABAK, babakAktif, lokal, warnaLatar } from './babak';

function dukungWebgl(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

/** `totalTerbit()` langsung dari kontrak (babak 5). */
async function tampilkanTotal() {
  const el = document.querySelector('[data-total-terbit]');
  if (!el) return;
  try {
    const j = jaringan();
    const klien = createPublicClient({ transport: http(j.rpcUrl) });
    const total = await klien.readContract({ address: j.kontrak, abi: abiPusaka, functionName: 'totalTerbit' });
    el.textContent = angka(total);
    document.querySelectorAll('[data-alamat-kontrak]').forEach((x) => {
      x.textContent = `${j.kontrak.slice(0, 6)}…${j.kontrak.slice(-4)}`;
    });
  } catch {
    el.textContent = '—';
  }
}

const HEX = '0123456789abcdef';

/** Babak 4: sidik jari berjalan, lalu satu bita berubah. */
function aturPemalsuan(p: number) {
  const t = lokal(p, 3);
  const asli = '7c1e9a42d0b3f58e61c4a7d2e09b5f3a';
  const ubah = t > 0.5;
  const jejak = document.querySelector<HTMLElement>('[data-sidik]');
  const status = document.querySelector<HTMLElement>('[data-status-palsu]');
  if (!jejak || !status) return;
  const sampai = Math.floor(Math.min(1, t / 0.45) * asli.length);
  jejak.textContent = asli
    .split('')
    .map((c, i) => (i < sampai ? (ubah && i === 9 ? HEX[(HEX.indexOf(c) + 7) % 16] : c) : '·'))
    .join('');
  status.textContent = ubah ? '1 bita berubah → TIDAK VALID' : `Sidik jari cocok ${Math.round(Math.min(1, t / 0.45) * 100)}%`;
  status.dataset['nada'] = ubah ? 'bad' : 'ok';
}

function terapkan(p: number) {
  const html = document.documentElement;
  const i = babakAktif(p);
  html.style.setProperty('--latar-beranda', warnaLatar(p));
  html.style.setProperty('--naik', String(lokal(p, 2)));
  html.dataset['babak'] = BABAK[i]!.nama;
  html.dataset['terang'] = BABAK[i]!.terang ? '1' : '0';
  aturPemalsuan(p);
}

export async function mulai() {
  void tampilkanTotal();
  const html = document.documentElement;
  const kanvas = document.querySelector<HTMLCanvasElement>('#kanvas-beranda');
  if (!kanvas || matchMedia('(prefers-reduced-motion: reduce)').matches || !dukungWebgl()) {
    html.classList.add('statis');
    return;
  }
  const [{ buatAdegan }, { gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
    import('./adegan'),
    import('gsap'),
    import('gsap/ScrollTrigger'),
    import('lenis'),
  ]);
  gsap.registerPlugin(ScrollTrigger);
  const adegan = buatAdegan(kanvas);
  const ukur = () => adegan.ukur(window.innerWidth, window.innerHeight);
  ukur();
  window.addEventListener('resize', ukur);

  const lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((waktu) => lenis.raf(waktu * 1000));
  gsap.ticker.lagSmoothing(0);

  const keadaan = { p: 0 };
  gsap.to(keadaan, {
    p: 1,
    ease: 'none',
    scrollTrigger: { trigger: '#beranda', start: 'top top', end: 'bottom bottom', scrub: 0.8 },
  });
  gsap.ticker.add(() => {
    adegan.atur(keadaan.p);
    adegan.render();
    terapkan(keadaan.p);
  });
  html.classList.add('hidup');
}
```

`web/src/pages/index.astro`:

```astro
---
import '@fontsource/sora/300.css';
import '@fontsource/sora/400.css';
import '@fontsource/sora/500.css';
import '@fontsource/sora/600.css';
import '@fontsource/space-mono/400.css';
import '../styles/global.css';
import '../styles/beranda.css';
import { BABAK } from '../beranda/babak';

const latar = Object.fromEntries(BABAK.map((b) => [b.nama, b.latar]));
const segel = (nada = 'diam') => ({ nada });
---

<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="PUSAKA: ijazah digital Universitas Pamulang yang dijaga blockchain dan bisa diperiksa siapa saja, tanpa akun." />
    <meta name="theme-color" content="#03060c" />
    <title>PUSAKA · Ijazah digital Universitas Pamulang</title>
  </head>
  <body class="beranda">
    <canvas id="kanvas-beranda" aria-hidden="true"></canvas>
    <header class="beranda-atas">
      <a class="merek" href="/">Pusaka ⬢<small>Universitas Pamulang</small></a>
      <nav aria-label="Utama">
        <a class="br" href="/periksa">Periksa ijazah</a>
        <a class="br" href="/masuk">Masuk</a>
      </nav>
    </header>

    <main id="beranda">
      <section class="babak" data-untuk="pembuka" style={`--latar-statis:${latar['pembuka']}`}>
        <div class="layar">
          <div class="isi">
            <h1 class="judul-beranda sudut-kanan-atas">Ijazah yang<br />mustahil dipalsukan</h1>
            <p class="sudut-kiri-bawah lead">Dijaga blockchain.<br />Diperiksa siapa saja, tanpa akun.</p>
            <div class="hud sudut-kanan-bawah">Gulir<b>↓ 6 babak</b></div>
          </div>
          <div class="segel segel-statis" data-nada={segel().nada} aria-hidden="true">
            <span class="segel-orbit segel-orbit-a"></span><span class="segel-orbit segel-orbit-b"></span><div class="segel-keping"></div>
          </div>
        </div>
      </section>

      <section class="babak terang" data-untuk="cetak-biru" style={`--latar-statis:${latar['cetak-biru']}`}>
        <div class="layar">
          <div class="isi">
            <h2 class="judul-beranda sudut-kiri-atas">Satu ijazah,</h2>
            <h2 class="judul-beranda sudut-kanan-atas aksen">lima lapis bukti</h2>
            <ol class="lapis-bukti">
              <li><b>PDF ijazah</b> asli dari BAAK</li>
              <li><b>Sidik jari Keccak-256</b> dari setiap bita berkas</li>
              <li><b>Tanda tangan Rektor</b> ECDSA (EIP-712)</li>
              <li><b>Token ERC-721</b> soulbound di Polygon</li>
              <li><b>Berkas terenkripsi</b> AES-256 di IPFS</li>
            </ol>
          </div>
          <div class="segel segel-statis" aria-hidden="true">
            <span class="segel-orbit segel-orbit-a"></span><div class="segel-keping"></div>
          </div>
        </div>
      </section>

      <section class="babak" data-untuk="ponsel" style={`--latar-statis:${latar['ponsel']}`}>
        <div class="layar">
          <div class="isi">
            <h2 class="judul-beranda sudut-kanan-atas aksen">Periksa dari ponsel mana pun</h2>
            <div class="ponsel" aria-hidden="true">
              <div class="layar-ponsel">
                <div class="hud">PSK-1284<b data-nada="ok">↑ Asli · tercatat</b></div>
                <p class="nama-ponsel">Dewi Lestari Anggraini</p>
                <p class="sub">S.Kom. · Teknik Informatika</p>
                <ul class="bukti">
                  <li><span class="ikon">⌗</span><span class="nama">Sidik jari<span class="ket" data-nada="ok">↑ Cocok 100%</span></span></li>
                  <li><span class="ikon">✍</span><span class="nama">Tanda tangan Rektor<span class="ket" data-nada="ok">↑ Sah · EIP-712</span></span></li>
                  <li><span class="ikon">⛓</span><span class="nama">Status<span class="ket" data-nada="ok">↑ Tidak dicabut</span></span></li>
                </ul>
              </div>
            </div>
            <div class="kartu-beranda sudut-kanan-bawah">
              <h3>Tanpa akun, tanpa biaya</h3>
              <p>Pindai QR di ijazah atau unggah PDF-nya. Hasilnya dibaca langsung dari blockchain, tidak lewat server kampus.</p>
              <a class="br" href="/periksa">Coba periksa</a>
            </div>
          </div>
        </div>
      </section>

      <section class="babak" data-untuk="pemalsuan" style={`--latar-statis:${latar['pemalsuan']}`}>
        <div class="layar">
          <div class="isi">
            <div class="layar-palsu" aria-live="off">
              <div class="hud">Sidik jari berkas</div>
              <p class="mono sidik" data-sidik>7c1e9a42d0b3f58e61c4a7d2e09b5f3a</p>
              <p class="mono status-palsu" data-status-palsu data-nada="bad">1 bita berubah → TIDAK VALID</p>
            </div>
            <h2 class="judul-beranda sudut-kiri-bawah">Bisa dipalsukan?</h2>
            <h2 class="judul-beranda sudut-kanan-bawah merah">Langsung ketahuan.</h2>
          </div>
        </div>
      </section>

      <section class="babak" data-untuk="inti" style={`--latar-statis:${latar['inti']}`}>
        <div class="layar">
          <div class="isi">
            <div class="kartu-beranda sudut-kanan-bawah">
              <h3>Tercatat permanen</h3>
              <p>Setiap ijazah adalah token yang tidak bisa dipindahtangankan. Pencabutan pun tercatat terbuka, lengkap dengan alasannya.</p>
              <dl class="data">
                <dt>Kontrak</dt><dd class="mono" data-alamat-kontrak>—</dd>
                <dt>Ijazah tercatat</dt><dd class="mono" data-total-terbit>—</dd>
              </dl>
            </div>
          </div>
          <div class="segel segel-statis" data-nada="ok" aria-hidden="true">
            <span class="segel-orbit segel-orbit-a"></span><span class="segel-orbit segel-orbit-b"></span><div class="segel-keping"></div>
          </div>
        </div>
      </section>

      <section class="babak terang" data-untuk="penutup" style={`--latar-statis:${latar['penutup']}`}>
        <div class="layar">
          <div class="isi penutup">
            <h2 class="judul-beranda">Asli atau palsu?</h2>
            <p class="lead">Periksa sendiri.</p>
            <div class="aksi">
              <a class="br" data-utama href="/periksa">Periksa ijazah</a>
              <a class="br" href="/masuk">Masuk</a>
            </div>
          </div>
        </div>
      </section>
    </main>

    <script>
      import { mulai } from '../beranda/mulai';
      void mulai();
    </script>
  </body>
</html>
```

`web/src/styles/beranda.css`:

```css
/* Beranda: kanvas three.js tetap di belakang, enam babak dengan layar sticky. */

body.beranda {
  margin: 0;
  color: var(--ink);
  font-family: var(--sans);
  background: var(--latar-beranda, #03060c);
  transition: color var(--cepat);
}

html[data-terang="1"] body.beranda {
  color: #0d1424;
}

#kanvas-beranda {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100dvh;
  pointer-events: none;
}

html.statis #kanvas-beranda {
  display: none;
}

.beranda-atas {
  position: fixed;
  inset: 0 0 auto;
  z-index: 5;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px clamp(16px, 4vw, 40px);
  mix-blend-mode: difference;
}

.beranda-atas .merek,
.beranda-atas .br {
  color: #fff;
}

.beranda-atas nav {
  display: flex;
  gap: 4px 18px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.babak {
  position: relative;
  height: 135vh;
}

.layar {
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow: hidden;
}

.isi {
  position: absolute;
  inset: 0;
  z-index: 1;
  padding: 92px clamp(16px, 4vw, 48px) 40px;
  transition: opacity 400ms, transform 400ms;
}

/* Saat animasi hidup, layar tiap babak dipaku di viewport (bagian hanya penyedia panjang gulir),
   dan hanya babak aktif yang tampil. Tanpa JS/statis: alur biasa, semua tampil. */
html.hidup .layar {
  position: fixed;
  inset: 0;
  height: 100dvh;
  pointer-events: none;
}

html.hidup .isi a,
html.hidup .isi button {
  pointer-events: auto;
}

html.hidup .babak .isi {
  visibility: hidden;
}

html.hidup[data-babak="pembuka"] [data-untuk="pembuka"] .isi,
html.hidup[data-babak="cetak-biru"] [data-untuk="cetak-biru"] .isi,
html.hidup[data-babak="ponsel"] [data-untuk="ponsel"] .isi,
html.hidup[data-babak="pemalsuan"] [data-untuk="pemalsuan"] .isi,
html.hidup[data-babak="inti"] [data-untuk="inti"] .isi,
html.hidup[data-babak="penutup"] [data-untuk="penutup"] .isi {
  visibility: visible;
}

html.hidup .babak .isi {
  opacity: 0;
  transform: translateY(14px);
}

html.hidup[data-babak="pembuka"] [data-untuk="pembuka"] .isi,
html.hidup[data-babak="cetak-biru"] [data-untuk="cetak-biru"] .isi,
html.hidup[data-babak="ponsel"] [data-untuk="ponsel"] .isi,
html.hidup[data-babak="pemalsuan"] [data-untuk="pemalsuan"] .isi,
html.hidup[data-babak="inti"] [data-untuk="inti"] .isi,
html.hidup[data-babak="penutup"] [data-untuk="penutup"] .isi {
  opacity: 1;
  transform: none;
}

.judul-beranda {
  margin: 0;
  font-size: clamp(30px, 5.6vw, 64px);
  font-weight: 400;
  line-height: 1.04;
  letter-spacing: -0.02em;
}

.aksen {
  color: #5b8cff;
}

.merah {
  color: var(--bad);
}

.lead {
  margin: 0;
  font-size: clamp(16px, 1.6vw, 19px);
  font-weight: 300;
  line-height: 1.45;
}

.sudut-kiri-atas,
.sudut-kanan-atas,
.sudut-kiri-bawah,
.sudut-kanan-bawah {
  position: absolute;
  max-width: min(560px, calc(100% - 32px));
}

.sudut-kiri-atas {
  top: 96px;
  left: clamp(16px, 4vw, 48px);
}

.sudut-kanan-atas {
  top: 96px;
  right: clamp(16px, 4vw, 48px);
  text-align: right;
}

.sudut-kiri-bawah {
  bottom: 44px;
  left: clamp(16px, 4vw, 48px);
}

.sudut-kanan-bawah {
  right: clamp(16px, 4vw, 48px);
  bottom: 44px;
}

html[data-terang="1"] .hud,
.terang .hud {
  color: #4a5670;
}

/* Babak 2: daftar lapis bukti di kanan, seperti daftar komponen. */
.lapis-bukti {
  position: absolute;
  right: clamp(16px, 4vw, 48px);
  bottom: 56px;
  width: min(360px, calc(100% - 32px));
  margin: 0;
  padding: 18px 22px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(8px);
  color: #4a5670;
  font-size: 14px;
  list-style: none;
  counter-reset: lapis;
}

.lapis-bukti li {
  padding: 7px 0;
  counter-increment: lapis;
}

.lapis-bukti li::before {
  content: counter(lapis) " ";
  font-family: var(--mono);
  color: #5b8cff;
  margin-right: 8px;
}

.lapis-bukti b {
  color: #0d1424;
  font-weight: 500;
}

/* Babak 3: ponsel naik. */
.ponsel {
  position: absolute;
  left: clamp(16px, 12vw, 180px);
  bottom: -8px;
  width: min(300px, 70vw);
  aspect-ratio: 9 / 18;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 40px;
  background: #0b0f17;
  box-shadow: 0 40px 90px -30px #000;
  transform: translateY(calc((1 - var(--naik, 1)) * 55vh));
}

.layar-ponsel {
  height: 100%;
  padding: 26px 18px;
  border-radius: 30px;
  background:
    radial-gradient(260px 200px at 50% 30%, rgba(40, 110, 200, 0.45), transparent 70%),
    #03060c;
  overflow: hidden;
}

.nama-ponsel {
  margin: 18px 0 2px;
  font-size: 20px;
  font-weight: 500;
}

.layar-ponsel .bukti li {
  padding: 9px 0;
  font-size: 13px;
}

.kartu-beranda {
  width: min(380px, calc(100% - 32px));
  padding: 22px 24px;
  border-radius: 6px;
  background: rgba(14, 19, 28, 0.78);
  backdrop-filter: blur(10px);
}

.kartu-beranda h3 {
  margin: 0 0 8px;
  font-size: 19px;
  font-weight: 500;
}

.kartu-beranda p {
  margin: 0 0 12px;
  color: var(--ink2);
  font-size: 14px;
  line-height: 1.55;
}

/* Babak 4: sidik jari berjalan. */
.layar-palsu {
  position: absolute;
  top: 22%;
  left: 50%;
  width: min(640px, calc(100% - 32px));
  padding: 14px 18px;
  border-radius: 6px;
  background: rgba(20, 4, 8, 0.55);
  backdrop-filter: blur(6px);
  transform: translateX(-50%);
  text-align: center;
}

.sidik {
  margin: 8px 0 0;
  font-size: clamp(14px, 2.4vw, 22px);
  letter-spacing: 0.12em;
  overflow-wrap: anywhere;
}

.status-palsu {
  margin: 10px 0 0;
  font-size: 13px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* Babak 6 */
.penutup {
  display: grid;
  place-content: center;
  text-align: center;
  gap: 10px;
}

.penutup .aksi {
  justify-content: center;
}

.terang .br,
html[data-terang="1"] .isi .br {
  color: #0d1424;
}

/* Versi statis (reduced motion / tanpa WebGL): latar per babak, segel CSS, gulir biasa. */
.segel-statis {
  display: none !important;
}

html.statis .babak {
  height: auto;
  min-height: 100dvh;
  background: var(--latar-statis);
}

html.statis .terang {
  color: #0d1424;
}

html.statis .layar {
  position: relative;
  height: auto;
  min-height: 100dvh;
}

html.statis .segel-statis {
  display: grid !important;
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(60vw, 320px);
  transform: translate(-50%, -50%);
  opacity: 0.55;
}

html.statis .ponsel {
  transform: none;
}

@media (max-width: 767px) {
  .babak {
    height: 150vh;
  }

  .sudut-kiri-atas,
  .sudut-kanan-atas {
    top: 112px;
  }

  .sudut-kanan-bawah.hud {
    display: none;
  }

  .beranda-atas nav {
    flex-direction: column;
    align-items: flex-end;
    gap: 0;
  }

  .ponsel {
    left: 50%;
    width: min(240px, 62vw);
    transform: translate(-50%, calc((1 - var(--naik, 1)) * 55vh));
  }

  html.statis .ponsel {
    transform: translateX(-50%);
  }

  .lapis-bukti,
  .kartu-beranda {
    bottom: 24px;
  }
}
```

Run: `npm --prefix web test && npm --prefix web run check && npm --prefix web run e2e` → Expected: unit lulus, 0 galat, E2E 29/29. Periksa tangkapan layar tiap babak (p = 0.04, 0.27, 0.46, 0.58, 0.66, 0.8, 0.97) di 1280 dan 375 px.

Commit `feat(web): beranda 3D koreografi scroll (three.js + GSAP ScrollTrigger + Lenis) dengan versi statis`.

---

### Task 3: Dokumentasi, preview, PR

Spec 8.2 **Fallback**: "versi statis berupa latar per babak dan segel CSS, gulir biasa". Peta jalan baris 08 → ✅. Push, preview, `gh pr create --base feat/pusaka-v2-alumni`.
