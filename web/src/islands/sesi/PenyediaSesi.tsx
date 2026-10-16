import { useMemo, type ReactNode } from 'react';
import { sesiUji } from '../../lib/akun-uji';
import { jaringan } from '../../lib/konfigurasi';
import { KonteksSesi } from './konteks';
import PenyediaPrivy from './PenyediaPrivy';

const env = import.meta.env as unknown as Partial<Record<string, string>>;
export const MODE_UJI = env['PUBLIC_MODE_UJI'] === '1';
export const APP_ID = env['PUBLIC_PRIVY_APP_ID'] ?? '';

function PenyediaUji({ children }: { children: ReactNode }) {
  const sesi = useMemo(() => sesiUji(jaringan(), APP_ID), []);
  return <KonteksSesi.Provider value={sesi}>{children}</KonteksSesi.Provider>;
}

/** Penyedia sesi: Privy di produksi, akun Anvil saat `PUBLIC_MODE_UJI=1` (E2E). */
export default function PenyediaSesi({ children }: { children: ReactNode }) {
  if (MODE_UJI) return <PenyediaUji>{children}</PenyediaUji>;
  if (!APP_ID) {
    return <p className="catatan">Login belum dikonfigurasi di build ini (PUBLIC_PRIVY_APP_ID).</p>;
  }
  return (
    <PenyediaPrivy j={jaringan()} appId={APP_ID}>
      {children}
    </PenyediaPrivy>
  );
}
