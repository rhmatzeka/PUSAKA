import type { ReactNode } from 'react';
import { ringkas } from '../lib/format';

export interface ItemDok {
  href: string;
  ikon: string;
  label: string;
}

export const DOK_OPERATOR: ItemDok[] = [
  { href: '/op', ikon: '⬢', label: 'Buku Induk' },
  { href: '/op/unggah', ikon: '⇪', label: 'Unggah draf' },
  { href: '/op/cabut', ikon: '⛓', label: 'Pencabutan' },
];

/** Kerangka halaman dalam: baris HUD (kode, status, wallet), garis skala berangka nyata, isi, dok. */
export default function Kerangka({
  peran,
  kode,
  status,
  wallet,
  skala = [],
  dok = [],
  keluar,
  children,
}: {
  peran: string;
  kode: string;
  status: ReactNode;
  wallet: string | undefined;
  skala?: string[];
  dok?: ItemDok[];
  keluar: () => void;
  children: ReactNode;
}) {
  const kini = typeof location === 'undefined' ? '' : location.pathname.replace(/\/$/, '') || '/';
  return (
    <div className="aplikasi" data-siap="">
      {skala.length > 0 && (
        <div className="skala" aria-hidden="true">
          {skala.map((s, i) => (
            <span key={s} style={{ top: `${22 + i * 22}%` }}>
              — {s}
            </span>
          ))}
        </div>
      )}
      <div className="baris-hud">
        <div className="hud">
          {peran}
          <b>⬢</b>
        </div>
        <div className="hud" style={{ textAlign: 'center' }}>
          {kode}
          <b>{status}</b>
        </div>
        <div className="hud" style={{ textAlign: 'right' }}>
          Wallet
          <b className="mono">{wallet ? ringkas(wallet) : '—'}</b>
        </div>
      </div>
      {children}
      <nav className="dok" aria-label="Navigasi">
        {dok.map((d) => (
          <a key={d.href} href={d.href} title={d.label} aria-label={d.label} aria-current={kini === d.href ? 'page' : undefined}>
            {d.ikon}
          </a>
        ))}
        <button type="button" title="Keluar" aria-label="Keluar" onClick={keluar}>
          ⏻
        </button>
      </nav>
    </div>
  );
}
