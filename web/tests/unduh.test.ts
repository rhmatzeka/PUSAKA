import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { ambilTerbatas } from '../src/lib/ipfs';

let server: Server;
let dasar = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/macet') return; // tidak pernah menjawab
    if (req.url === '/besar') {
      res.writeHead(200);
      res.end(Buffer.alloc(2048, 1));
      return;
    }
    if (req.url === '/hilang') {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200);
    res.end(Buffer.from([1, 2, 3]));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  dasar = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

test('mengambil isi kecil', async () => {
  expect(await ambilTerbatas(`${dasar}/ok`, { batasMs: 1000, maks: 100 })).toEqual(new Uint8Array([1, 2, 3]));
});

test('gateway macet berhenti di batas waktu', async () => {
  await expect(ambilTerbatas(`${dasar}/macet`, { batasMs: 200, maks: 100 })).rejects.toThrow(/tidak menjawab/);
});

test('isi melebihi batas ditolak', async () => {
  await expect(ambilTerbatas(`${dasar}/besar`, { batasMs: 1000, maks: 1024 })).rejects.toThrow(/lebih besar/);
});

test('status bukan 2xx ditolak', async () => {
  await expect(ambilTerbatas(`${dasar}/hilang`, { batasMs: 1000, maks: 100 })).rejects.toThrow(/404/);
});
