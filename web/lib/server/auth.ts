// HANYA server: HMAC tantangan, verifyMessage, hasRole (jangan diimpor dari komponen "use client")
import crypto from "node:crypto";
import { verifyMessage } from "ethers";
import { pesanLogin } from "../pesan";
import { kontrakBaca } from "./kontrak";

const BERLAKU_MS = 15 * 60 * 1000;
const tagOf = (issuedAt: string, nonce: string) =>
  crypto.createHmac("sha256", process.env.AUTH_SECRET!).update(`${issuedAt}|${nonce}`).digest("hex");

export function buatTantangan() {
  const issuedAt = new Date().toISOString();
  const nonce = crypto.randomBytes(16).toString("hex");
  return { issuedAt, nonce, tag: tagOf(issuedAt, nonce) };
}

export async function periksaAdmin(h: Headers): Promise<string | null> {
  const issuedAt = h.get("x-pusaka-issued-at") ?? "", nonce = h.get("x-pusaka-nonce") ?? "";
  const tag = h.get("x-pusaka-tag") ?? "", signature = h.get("x-pusaka-signature") ?? "";
  const harus = tagOf(issuedAt, nonce);
  if (tag.length !== harus.length || !crypto.timingSafeEqual(Buffer.from(tag), Buffer.from(harus))) return null;
  const umur = Date.now() - Date.parse(issuedAt);
  if (!(umur >= 0 && umur <= BERLAKU_MS)) return null;
  let alamat: string;
  try { alamat = verifyMessage(pesanLogin(issuedAt, nonce), signature); } catch { return null; }
  const c = kontrakBaca();
  return (await c.hasRole(await c.ISSUER_ROLE(), alamat)) ? alamat : null;
}
