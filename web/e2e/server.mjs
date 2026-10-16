// Server statis E2E: meniru rewrite dan header vercel.json, plus "IPFS" lokal di /ipfs/<cid>.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const IPFS = new URL('./.data/ipfs/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4329);
const JENIS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  let jalur = decodeURIComponent(new URL(req.url ?? '/', 'http://lokal').pathname);
  try {
    if (jalur.startsWith('/ipfs/')) {
      const isi = await readFile(join(IPFS, jalur.slice(6).replace(/[^A-Za-z0-9]/g, '')));
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      return res.end(isi);
    }
    const header = {};
    if (/^\/i\/\d+\/?$/.test(jalur)) {
      jalur = '/i/';
      header['referrer-policy'] = 'no-referrer';
    }
    if (jalur.endsWith('/')) jalur += 'index.html';
    else if (!extname(jalur)) jalur += '/index.html';
    const berkas = normalize(join(DIST, jalur));
    if (!berkas.startsWith(DIST)) throw new Error('di luar dist');
    const isi = await readFile(berkas);
    res.writeHead(200, { 'content-type': JENIS[extname(berkas)] ?? 'application/octet-stream', ...header });
    res.end(isi);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Tidak ditemukan');
  }
}).listen(PORT, '127.0.0.1');
