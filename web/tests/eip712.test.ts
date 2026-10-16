import { readFileSync } from 'node:fs';
import { hashTypedData, type Hex } from 'viem';
import { beforeAll, expect, test } from 'vitest';
import { batasBaru, domainPusaka, MASA_TTD_DETIK, TIPE_EIP712, ttdPencabutan, ttdPenerbitan } from '../src/lib/eip712';
import { digest_pencabutan_hex, digest_penerbitan_hex, initSync } from '../src/wasm/pusaka_core.js';

const J = { rpcUrl: '', kontrak: '0x5FbDB2315678afecb367f032d93F642f64180aa3', chainId: 31337, gateway: '' } as const;

beforeAll(() => {
  initSync({ module: readFileSync(new URL('../src/wasm/pusaka_core_bg.wasm', import.meta.url)) });
});

test('digest viem untuk Penerbitan sama dengan vektor bersama dan pusaka-core', () => {
  const d = ttdPenerbitan(
    {
      penerima: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      doc_hash: '0x413538c95b60dfa9a17c6008dda06f5589538080ef91043561f8668fde026edb',
      metadata_hash: '0x14ecfb0c60c4bdfac4451a0238994b0b8024f8e018440289db82f5b6e4cf9e5f',
    },
    1793000000n,
  );
  const viem = hashTypedData({ domain: domainPusaka(J), types: TIPE_EIP712, ...d });
  expect(viem).toBe('0x069e362cc547e60dc1beb36e2f4502c5e07a3689275ac21faaaa791b024f9be5');
  if (d.primaryType !== 'Penerbitan') throw new Error('jenis');
  const m = d.message;
  expect(digest_penerbitan_hex(31337n, J.kontrak, m.penerima, m.docHash, m.metadataHash, m.batasWaktu)).toBe(viem);
});

test('digest viem untuk Pencabutan sama dengan vektor bersama', () => {
  const d = ttdPencabutan({ token_id: 7, alasan: 'salah nama ibu' }, 1793000000n);
  const viem = hashTypedData({ domain: domainPusaka(J), types: TIPE_EIP712, ...d });
  expect(viem).toBe('0xd9bc14d3408df457dab6f74a5d04e5c5768e3526573c85bbf7080d0ae73e8bc6');
  if (d.primaryType !== 'Pencabutan') throw new Error('jenis');
  expect(digest_pencabutan_hex(31337n, J.kontrak, 7n, d.message.alasanHash as Hex, 1793000000n)).toBe(viem);
});

test('batas waktu bawaan 7 hari', () => {
  expect(batasBaru(1_000_000_000_000)).toBe(BigInt(1_000_000_000 + MASA_TTD_DETIK));
});
