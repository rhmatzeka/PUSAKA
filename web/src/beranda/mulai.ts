//! Titik masuk beranda: memilih versi bergerak (three.js + GSAP ScrollTrigger + Lenis) atau statis,
//! lalu menghubungkan progres scroll ke adegan, warna latar, dan teks tiap babak.

import { createPublicClient, http } from 'viem';
import { abiPusaka } from '../lib/abi';
import { angka } from '../lib/format';
import { jaringan } from '../lib/konfigurasi';
import { BABAK, babakAktif, latarTerang, lokal, warnaLatar } from './babak';

function dukungWebgl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
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
function aturPemalsuan(p: number, jejak: HTMLElement, status: HTMLElement) {
  const t = lokal(p, 3);
  const asli = '7c1e9a42d0b3f58e61c4a7d2e09b5f3a';
  const ubah = t > 0.5;
  const sampai = Math.floor(Math.min(1, t / 0.45) * asli.length);
  let s = '';
  for (let i = 0; i < asli.length; i++) {
    const c = asli[i] ?? '0';
    s += i < sampai ? (ubah && i === 9 ? (HEX[(HEX.indexOf(c) + 7) % 16] ?? c) : c) : '·';
  }
  jejak.textContent = s;
  status.textContent = ubah ? '1 bita berubah → TIDAK VALID' : `Sidik jari cocok ${Math.round(Math.min(1, t / 0.45) * 100)}%`;
  status.dataset['nada'] = ubah ? 'bad' : 'ok';
}

/** Menulis ke DOM hanya bila nilainya berubah (setiap tulisan di <html> memicu hitung ulang gaya). */
function buatPenerap() {
  const html = document.documentElement;
  const bagian = [...document.querySelectorAll<HTMLElement>('.babak')];
  const jejak = document.querySelector<HTMLElement>('[data-sidik]');
  const status = document.querySelector<HTMLElement>('[data-status-palsu]');
  let babakLalu = -1;
  let latarLalu = '';
  let naikLalu = '';
  return (p: number) => {
    const i = babakAktif(p);
    const latar = warnaLatar(p);
    if (latar !== latarLalu) {
      latarLalu = latar;
      html.style.setProperty('--latar-beranda', latar);
      const terang = latarTerang(latar) ? '1' : '0';
      if (html.dataset['terang'] !== terang) html.dataset['terang'] = terang;
    }
    const naik = lokal(p, 2).toFixed(3);
    if (naik !== naikLalu) {
      naikLalu = naik;
      html.style.setProperty('--naik', naik);
    }
    if (i !== babakLalu) {
      babakLalu = i;
      html.dataset['babak'] = BABAK[i]!.nama;
      bagian.forEach((b, k) => {
        b.classList.toggle('aktif', k === i);
        // Tautan babak lain tetap ada untuk pembaca layar, tetapi tidak bisa difokus.
        b.querySelectorAll('a, button').forEach((x) => (k === i ? x.removeAttribute('tabindex') : x.setAttribute('tabindex', '-1')));
      });
    }
    if (i === 3 && jejak && status) aturPemalsuan(p, jejak, status);
  };
}

export async function mulai() {
  void tampilkanTotal();
  const html = document.documentElement;
  const kanvas = document.querySelector<HTMLCanvasElement>('#kanvas-beranda');
  const statis = () => {
    html.classList.remove('hidup');
    html.classList.add('statis');
  };
  // Layar sangat pendek (ponsel mendatar) tidak muat satu babak: pakai versi statis yang bisa digulir.
  if (!kanvas || matchMedia('(prefers-reduced-motion: reduce)').matches || window.innerHeight < 560 || !dukungWebgl()) {
    statis();
    return;
  }
  try {
    const [{ buatAdegan }, { gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
      import('./adegan'),
      import('gsap'),
      import('gsap/ScrollTrigger'),
      import('lenis'),
    ]);
    gsap.registerPlugin(ScrollTrigger);
    const adegan = buatAdegan(kanvas);
    let perluRender = true;
    const ukur = () => {
      if (window.innerWidth === 0 || window.innerHeight === 0) return;
      adegan.ukur(window.innerWidth, window.innerHeight);
      perluRender = true;
    };
    let tunda = 0;
    window.addEventListener('resize', () => {
      clearTimeout(tunda);
      tunda = window.setTimeout(ukur, 150);
    });
    ukur();

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
    const terapkan = buatPenerap();
    let pLalu = -1;
    const detak = () => {
      if (!perluRender && Math.abs(keadaan.p - pLalu) < 1e-4) return;
      pLalu = keadaan.p;
      perluRender = false;
      adegan.atur(keadaan.p);
      adegan.render();
      terapkan(keadaan.p);
    };
    gsap.ticker.add(detak);
    kanvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      gsap.ticker.remove(detak);
      lenis.destroy();
      statis();
    });
    terapkan(0);
    html.classList.add('hidup');
  } catch {
    statis();
  }
}
