// Alamat berkas IPFS untuk browser. CID berawalan "lokal" = mode lokal (tanpa Pinata).
export const cidDari = (uri: string) => uri.replace(/^ipfs:\/\//, "");

export function gatewayUrl(uri: string) {
  const cid = cidDari(uri);
  if (cid.startsWith("lokal")) return `/api/ipfs/lokal/${cid}`;
  const gateway = process.env.NEXT_PUBLIC_GATEWAY_URL;
  return gateway ? `https://${gateway}/ipfs/${cid}` : `https://ipfs.io/ipfs/${cid}`;
}
