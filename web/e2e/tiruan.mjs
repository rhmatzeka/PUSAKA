// Tiruan Privy REST + Pinata v3 untuk E2E. Bentuk jawaban mengikuti dokumentasi resmi (dicek 2026-10-16).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { getAddress, keccak256, toBytes } from 'viem';

const IPFS = new URL('./.data/ipfs/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4330);
mkdirSync(IPFS, { recursive: true });

// Akun uji tetap (lihat src/lib/akun-uji.ts): DID → wallet Anvil.
const DID = {
  'did:privy:uji-operator': '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  'did:privy:uji-rektor': '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  'did:privy:uji-alumni': '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
};
export const EMAIL_ALUMNI_UJI = 'alumni.uji@unpam.ac.id';
const email = new Map([[EMAIL_ALUMNI_UJI, DID['did:privy:uji-alumni']]]);

const walletEmail = (e) => getAddress(`0x${keccak256(toBytes(e)).slice(-40)}`);
const pengguna = (id, alamat, akun = []) => ({
  id,
  linked_accounts: [...akun, { type: 'wallet', chain_type: 'ethereum', address: alamat, connector_type: 'embedded', wallet_client: 'privy' }],
  mfa_methods: [],
  created_at: 0,
  has_accepted_terms: true,
  is_guest: false,
});

function jawab(res, status, isi) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(isi === undefined ? '' : JSON.stringify(isi));
}

async function json(req) {
  let s = '';
  for await (const b of req) s += b;
  return JSON.parse(s || '{}');
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://lokal');
    if (req.method === 'GET' && url.pathname.startsWith('/v1/users/')) {
      const did = decodeURIComponent(url.pathname.slice('/v1/users/'.length));
      return DID[did] ? jawab(res, 200, pengguna(did, DID[did])) : jawab(res, 404, { error: 'User not found' });
    }
    if (req.method === 'POST' && url.pathname === '/v1/users/email/address') {
      const { address } = await json(req);
      const a = email.get(address);
      return a ? jawab(res, 200, pengguna(`did:privy:${address}`, a, [{ type: 'email', address }])) : jawab(res, 404, { error: 'User not found' });
    }
    if (req.method === 'POST' && url.pathname === '/v1/users') {
      const b = await json(req);
      const address = b.linked_accounts?.[0]?.address;
      const a = walletEmail(address);
      email.set(address, a);
      return jawab(res, 200, pengguna(`did:privy:${address}`, a, [{ type: 'email', address }]));
    }
    if (req.method === 'POST' && url.pathname === '/v3/files') {
      const form = await new Request('http://lokal/', { method: 'POST', headers: req.headers, body: Readable.toWeb(req), duplex: 'half' }).formData();
      const berkas = form.get('file');
      if (!(berkas instanceof Blob)) return jawab(res, 400, { error: 'file wajib' });
      const isi = new Uint8Array(await berkas.arrayBuffer());
      const cid = `uji${keccak256(isi).slice(2, 42)}`;
      writeFileSync(`${IPFS}${cid}`, isi);
      return jawab(res, 200, { data: { id: cid, name: String(form.get('name')), cid, size: isi.length } });
    }
    jawab(res, 404, { error: 'tidak dikenal' });
  } catch (e) {
    jawab(res, 500, { error: String(e) });
  }
}).listen(PORT, '127.0.0.1');
