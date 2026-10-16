/** `ipfs://<cid>[/jalur]` → URL gateway HTTP. */
export function keUrlGateway(uri: string, gateway: string): string {
  const m = /^ipfs:\/\/([A-Za-z0-9]+)(\/\S*)?$/.exec(uri);
  if (!m) throw new Error(`Alamat IPFS tidak dikenal: ${uri}`);
  return `${gateway.replace(/\/+$/, '')}/ipfs/${m[1]}${m[2] ?? ''}`;
}
