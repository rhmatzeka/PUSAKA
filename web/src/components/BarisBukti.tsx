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
