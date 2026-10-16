import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { useMemo, type ReactNode } from 'react';
import { dompetDiingat, lupakanDompet, temukanDompet } from '../../lib/eip6963';
import type { Jaringan } from '../../lib/konfigurasi';
import { buatPenanda, rantaiViem, type Sesi } from '../../lib/sesi';
import { KonteksSesi } from './konteks';

function Jembatan({ j, children }: { j: Jaringan; children: ReactNode }) {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();
  const { wallets } = useWallets();
  const sesi = useMemo<Sesi>(
    () => ({
      status: !ready ? 'memuat' : authenticated ? 'masuk' : 'keluar',
      async token() {
        const t = await getAccessToken();
        if (!t) throw new Error('Sesi Privy berakhir. Masuk lagi.');
        return t;
      },
      async penanda() {
        // Wallet luar yang dipakai masuk (EIP-6963) diutamakan; selain itu wallet tertanam Privy.
        const rdns = dompetDiingat();
        if (rdns) {
          const d = (await temukanDompet()).find((x) => x.rdns === rdns);
          if (d) {
            const [alamat] = (await d.provider.request({ method: 'eth_requestAccounts' })) as `0x${string}`[];
            if (alamat) {
              await d.provider
                .request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${j.chainId.toString(16)}` }] })
                .catch(() => undefined);
              return buatPenanda(j, alamat, d.provider);
            }
          }
        }
        const w = wallets.find((x) => x.walletClientType === 'privy') ?? wallets[0];
        if (!w) throw new Error('Akun ini belum punya wallet. Masuk ulang supaya Privy membuatkan wallet.');
        await w.switchChain(j.chainId);
        return buatPenanda(j, w.address as `0x${string}`, await w.getEthereumProvider());
      },
      async keluar() {
        lupakanDompet();
        await logout();
      },
    }),
    [ready, authenticated, getAccessToken, logout, wallets, j],
  );
  return <KonteksSesi.Provider value={sesi}>{children}</KonteksSesi.Provider>;
}

export default function PenyediaPrivy({ j, appId, children }: { j: Jaringan; appId: string; children: ReactNode }) {
  // Privy memakai salinan tipe `Chain` viem yang berbeda di `exactOptionalPropertyTypes`; isinya sama.
  const rantai = rantaiViem(j) as never;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'google', 'apple', 'twitter', 'discord', 'wallet'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: rantai,
        supportedChains: [rantai],
        appearance: { theme: 'dark' },
      }}
    >
      <Jembatan j={j}>{children}</Jembatan>
    </PrivyProvider>
  );
}
