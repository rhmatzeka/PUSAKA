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
