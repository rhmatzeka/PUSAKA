import { expect, test } from 'vitest';
import { keUrlGateway } from '../src/lib/ipfs';

test('ipfs:// menjadi URL gateway', () => {
  expect(keUrlGateway('ipfs://bafkreiabc', 'https://g.example/')).toBe('https://g.example/ipfs/bafkreiabc');
  expect(keUrlGateway('ipfs://bafy/a/b.json', 'https://g.example')).toBe('https://g.example/ipfs/bafy/a/b.json');
});

test.each(['https://x/ipfs/abc', 'ipfs://', 'ipfs://a b', 'ipfs://../x'])('%j ditolak', (u) => {
  expect(() => keUrlGateway(u, 'https://g')).toThrow(/IPFS/);
});
