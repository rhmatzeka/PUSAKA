import { createContext, useContext } from 'react';
import type { Sesi } from '../../lib/sesi';

export const KonteksSesi = createContext<Sesi | null>(null);

export function useSesi(): Sesi {
  const s = useContext(KonteksSesi);
  if (!s) throw new Error('useSesi di luar PenyediaSesi');
  return s;
}
