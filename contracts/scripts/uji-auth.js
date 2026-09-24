// Uji logika lib/auth.ts (versi JS): tantangan stateless HMAC + tanda tangan wallet
const crypto = require("crypto");
const { Wallet, verifyMessage } = require("ethers");
const SECRET = "rahasia-uji";
const BERLAKU_MS = 5 * 60 * 1000;

function buatTantangan(now = Date.now()) {
  const issuedAt = new Date(now).toISOString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const tag = crypto.createHmac("sha256", SECRET).update(`${issuedAt}|${nonce}`).digest("hex");
  return { issuedAt, nonce, tag };
}
const pesan = ({ issuedAt, nonce }) => `PUSAKA - login admin\nWaktu: ${issuedAt}\nNonce: ${nonce}`;

function periksa({ issuedAt, nonce, tag, signature }, now = Date.now()) {
  const harus = crypto.createHmac("sha256", SECRET).update(`${issuedAt}|${nonce}`).digest("hex");
  if (tag.length !== harus.length || !crypto.timingSafeEqual(Buffer.from(tag), Buffer.from(harus))) return { ok: false, alasan: "tantangan palsu" };
  const umur = now - Date.parse(issuedAt);
  if (!(umur >= 0 && umur <= BERLAKU_MS)) return { ok: false, alasan: "kedaluwarsa" };
  return { ok: true, alamat: verifyMessage(pesan({ issuedAt, nonce }), signature) }; // lalu cek hasRole(ISSUER_ROLE, alamat) via RPC
}

(async () => {
  const admin = Wallet.createRandom();
  const t = buatTantangan();
  const signature = await admin.signMessage(pesan(t));
  const r1 = periksa({ ...t, signature });
  console.log("sah        :", r1.ok && r1.alamat === admin.address);
  console.log("tag palsu  :", periksa({ ...t, tag: "0".repeat(64), signature }).alasan);
  console.log("kedaluwarsa:", periksa({ ...t, signature }, Date.now() + 6 * 60 * 1000).alasan);
  const t2 = { ...t, nonce: "ubah" + t.nonce.slice(4) };
  console.log("nonce diubah:", periksa({ ...t2, signature }).alasan);
})();
