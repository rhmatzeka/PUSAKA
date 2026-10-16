/** `ipfs://<cid>[/jalur]` → URL gateway HTTP. */
export function keUrlGateway(uri: string, gateway: string): string {
  const m = /^ipfs:\/\/([A-Za-z0-9]+)(\/\S*)?$/.exec(uri);
  if (!m) throw new Error(`Alamat IPFS tidak dikenal: ${uri}`);
  return `${gateway.replace(/\/+$/, '')}/ipfs/${m[1]}${m[2] ?? ''}`;
}

/**
 * `fetch` dengan batas waktu dan batas ukuran (dibaca bertahap, berhenti begitu lewat batas),
 * supaya gateway yang macet atau berkas raksasa tidak membuat halaman menunggu selamanya.
 */
export async function ambilTerbatas(url: string, { batasMs, maks }: { batasMs: number; maks: number }): Promise<Uint8Array> {
  let r: Response;
  try {
    r = await fetch(url, { signal: AbortSignal.timeout(batasMs) });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new Error(`Gateway IPFS tidak menjawab dalam ${Math.round(batasMs / 1000)} detik`);
    }
    throw e;
  }
  if (!r.ok) throw new Error(`Gateway IPFS menjawab ${r.status}`);
  const bagian: Uint8Array[] = [];
  let ukuran = 0;
  const pembaca = r.body?.getReader();
  if (!pembaca) return new Uint8Array(await r.arrayBuffer());
  for (;;) {
    const { done, value } = await pembaca.read();
    if (done) break;
    ukuran += value.length;
    if (ukuran > maks) {
      await pembaca.cancel();
      throw new Error('Berkas di IPFS lebih besar dari batas ijazah');
    }
    bagian.push(value);
  }
  const hasil = new Uint8Array(ukuran);
  let i = 0;
  for (const b of bagian) {
    hasil.set(b, i);
    i += b.length;
  }
  return hasil;
}
