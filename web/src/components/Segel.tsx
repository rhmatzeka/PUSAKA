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
