// Teks pesan login admin (dipakai browser dan server)
export const pesanLogin = (issuedAt: string, nonce: string) =>
  `PUSAKA - login admin\nWaktu: ${issuedAt}\nNonce: ${nonce}`;
