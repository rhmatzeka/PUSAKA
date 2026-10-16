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
