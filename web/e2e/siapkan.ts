//! Global setup E2E: Anvil + deploy PusakaIjazah + terbitkan dua ijazah (satu lalu dicabut),
//! amplop & metadata ditaruh di "IPFS" lokal (e2e/.data/ipfs) yang dilayani server.mjs.

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, keccak256, toBytes, type Abi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { kunciKeFragmen } from '../src/lib/kunci';
import { initSync, keccak256_hex, segel_amplop } from '../src/wasm/pusaka_core.js';
import { buatPdf } from './pdf';

export const PORT_RPC = 8555;
export const KONTRAK = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const RPC = `http://127.0.0.1:${PORT_RPC}`;
// Kunci Anvil bawaan (publik): #0 admin/deployer, #1 operator, #2 rektor.
const DEPLOYER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const OPERATOR = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const REKTOR = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
const ALUMNI = ['0x90F79bf6EB2c4f870365E785982E1f101E93b906', '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'] as const;

const DATA = new URL('./.data/', import.meta.url).pathname;
const KONTRAK_DIR = new URL('../../contracts/', import.meta.url).pathname;
const ABI = JSON.parse(readFileSync(new URL('../../abi/PusakaIjazah.json', import.meta.url), 'utf8')) as Abi;

const domain = { name: 'PUSAKA', version: '2', chainId: foundry.id, verifyingContract: KONTRAK } as const;

async function rpcHidup(): Promise<boolean> {
  try {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}',
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function tungguRpc(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (await rpcHidup()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Anvil tidak menyala');
}

function simpanIpfs(isi: Uint8Array): string {
  const cid = `uji${keccak256(isi).slice(2, 42)}`;
  writeFileSync(`${DATA}ipfs/${cid}`, isi);
  return cid;
}

export default async function siapkan(): Promise<() => Promise<void>> {
  // Anvil lama di port yang sama akan membuat alamat kontrak bergeser; lebih baik gagal jelas.
  if (await rpcHidup()) throw new Error(`Port ${PORT_RPC} sudah dipakai proses lain (Anvil lama?). Matikan dulu.`);
  rmSync(DATA, { recursive: true, force: true });
  mkdirSync(`${DATA}ipfs`, { recursive: true });
  initSync({ module: readFileSync(new URL('../src/wasm/pusaka_core_bg.wasm', import.meta.url)) });

  mkdirSync(`${KONTRAK_DIR}deployments`, { recursive: true });
  const anvil = spawn('anvil', ['--silent', '--port', String(PORT_RPC)], { stdio: 'ignore' });
  try {
    await isi();
  } catch (e) {
    anvil.kill();
    throw e;
  }
  return async () => {
    anvil.kill();
  };
}

/** Deploy kontrak dan terbitkan data uji ke Anvil yang baru dinyalakan. */
async function isi(): Promise<void> {
  await tungguRpc();
  execFileSync('forge', ['script', 'script/Deploy.s.sol', '--rpc-url', RPC, '--broadcast', '--silent'], {
    cwd: KONTRAK_DIR,
    stdio: 'ignore',
    env: {
      ...process.env,
      DEPLOYER_PK: DEPLOYER,
      OPERATOR: privateKeyToAccount(OPERATOR).address,
      PENANDATANGAN: privateKeyToAccount(REKTOR).address,
    },
  });

  const publik = createPublicClient({ chain: foundry, transport: http(RPC) });
  const operator = createWalletClient({ account: privateKeyToAccount(OPERATOR), chain: foundry, transport: http(RPC) });
  const rektor = privateKeyToAccount(REKTOR);
  const batasWaktu = BigInt(Math.floor(Date.now() / 1000) + 86_400);

  const lulusan = [
    { nama: 'Dewi Lestari Anggraini', nim: '231011400001', nomor_ijazah: 'UNPAM/2026/0001' },
    { nama: 'Budi Santoso', nim: '231011400002', nomor_ijazah: 'UNPAM/2026/0002' },
  ];
  const kunci: string[] = [];
  const penerbitan = [];
  const sig: Hex[] = [];
  const uri: string[] = [];
  for (const [i, l] of lulusan.entries()) {
    const data = { ...l, prodi: 'Teknik Informatika', gelar: 'S.Kom.', tanggal_lulus: '2026-08-30' };
    const pdf = buatPdf(['IJAZAH UNIVERSITAS PAMULANG', l.nama, `NIM ${l.nim}`, l.nomor_ijazah]);
    writeFileSync(`${DATA}${i === 0 ? 'asli' : 'dicabut'}.pdf`, pdf);
    const k = crypto.getRandomValues(new Uint8Array(32));
    kunci.push(kunciKeFragmen(k));
    const docHash = keccak256_hex(pdf) as Hex;
    const cidAmplop = simpanIpfs(segel_amplop(k, crypto.getRandomValues(new Uint8Array(12)), JSON.stringify(data), pdf));
    const metadata = {
      name: 'Ijazah Universitas Pamulang',
      description: 'Ijazah digital PUSAKA. Data lulusan terenkripsi.',
      attributes: [{ trait_type: 'Institusi', value: 'Universitas Pamulang' }],
      pusaka: { versi: 2, berkas: `ipfs://${cidAmplop}`, doc_keccak256: docHash, enkripsi: 'AES-256-GCM' },
    };
    const u = `ipfs://${simpanIpfs(new TextEncoder().encode(JSON.stringify(metadata)))}`;
    const p = { penerima: ALUMNI[i] ?? ALUMNI[0], docHash, metadataHash: keccak256(toBytes(u)), batasWaktu };
    penerbitan.push(p);
    uri.push(u);
    sig.push(
      await rektor.signTypedData({
        domain,
        primaryType: 'Penerbitan',
        types: {
          Penerbitan: [
            { name: 'penerima', type: 'address' },
            { name: 'docHash', type: 'bytes32' },
            { name: 'metadataHash', type: 'bytes32' },
            { name: 'batasWaktu', type: 'uint64' },
          ],
        },
        message: p,
      }),
    );
  }
  await publik.waitForTransactionReceipt({
    hash: await operator.writeContract({ address: KONTRAK, abi: ABI, functionName: 'terbitkanBatch', args: [penerbitan, sig, uri] }),
  });

  const alasan = 'Uji pencabutan';
  const cabut = { tokenId: 2n, alasanHash: keccak256(toBytes(alasan)), batasWaktu };
  const sigCabut = await rektor.signTypedData({
    domain,
    primaryType: 'Pencabutan',
    types: {
      Pencabutan: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'alasanHash', type: 'bytes32' },
        { name: 'batasWaktu', type: 'uint64' },
      ],
    },
    message: cabut,
  });
  await publik.waitForTransactionReceipt({
    hash: await operator.writeContract({ address: KONTRAK, abi: ABI, functionName: 'cabut', args: [cabut, sigCabut, alasan] }),
  });

  const asli = readFileSync(`${DATA}asli.pdf`);
  const ubah = Uint8Array.from(asli);
  ubah[ubah.length - 10] = (ubah[ubah.length - 10] ?? 0) ^ 1;
  writeFileSync(`${DATA}ubah.pdf`, ubah);
  writeFileSync(`${DATA}fixture.json`, JSON.stringify({ kunci }));
}
