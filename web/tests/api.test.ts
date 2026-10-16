import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { buatApi, GalatApi } from '../src/lib/api';

let server: Server;
let dasar = '';
const diterima: { metode: string; url: string; auth: string; jenis: string; badan: string }[] = [];

async function bacaBadan(req: IncomingMessage): Promise<string> {
  const bagian: Buffer[] = [];
  for await (const b of req) bagian.push(b as Buffer);
  return Buffer.concat(bagian).toString('latin1');
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    diterima.push({
      metode: req.method ?? '',
      url: req.url ?? '',
      auth: req.headers.authorization ?? '',
      jenis: req.headers['content-type'] ?? '',
      badan: await bacaBadan(req),
    });
    if (req.url === '/api/draf/x/setujui') {
      res.writeHead(409, { 'content-type': 'application/json' });
      res.end('{"kode":"STATUS_TIDAK_SESUAI","pesan":"draf berstatus DITOLAK, harus MENUNGGU_TTD"}');
      return;
    }
    if (req.url === '/api/kunci/9') {
      res.writeHead(502, { 'content-type': 'text/html' });
      res.end('<html>Bad gateway</html>');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  dasar = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => server.close());

const api = () => buatApi(async () => 'TOKEN-UJI', dasar);

test('token Privy dikirim sebagai Bearer', async () => {
  await api().sesi();
  expect(diterima.at(-1)).toMatchObject({ metode: 'GET', url: '/api/sesi', auth: 'Bearer TOKEN-UJI' });
});

test('kueri daftar draf hanya memuat nilai yang diisi', async () => {
  await api().daftarDraf({ status: 'MENUNGGU_TTD', cari: 'Budi Santoso' });
  expect(diterima.at(-1)?.url).toBe('/api/draf?status=MENUNGGU_TTD&cari=Budi+Santoso');
  await api().daftarDraf();
  expect(diterima.at(-1)?.url).toBe('/api/draf');
});

test('badan JSON memakai kunci snake_case', async () => {
  await api().setujui('abc', '0x12', 1793000000n);
  expect(JSON.parse(diterima.at(-1)?.badan ?? '')).toEqual({ sig: '0x12', batas_waktu: 1793000000 });
  await api().mintaCabut(7, 'salah nama');
  expect(JSON.parse(diterima.at(-1)?.badan ?? '')).toEqual({ token_id: 7, alasan: 'salah nama' });
});

test('unggah IPFS mengirim byte mentah', async () => {
  await api().unggahIpfs('amplop-1.bin', new Uint8Array([0, 255, 7]));
  const t = diterima.at(-1);
  expect(t?.url).toBe('/api/ipfs?nama=amplop-1.bin');
  expect(t?.jenis).toBe('application/octet-stream');
  expect(Buffer.from(t?.badan ?? '', 'latin1')).toEqual(Buffer.from([0, 255, 7]));
});

test('galat API menjadi GalatApi dengan kode dan pesan dari server', async () => {
  const g = await api().setujui('x', '0x', 1n).catch((e: unknown) => e);
  expect(g).toBeInstanceOf(GalatApi);
  expect(g).toMatchObject({ status: 409, kode: 'STATUS_TIDAK_SESUAI', message: 'draf berstatus DITOLAK, harus MENUNGGU_TTD' });
});

test('galat tanpa JSON tetap terbaca', async () => {
  await expect(api().kunci(9)).rejects.toMatchObject({ status: 502, kode: 'GALAT', message: 'Server menjawab 502' });
});
