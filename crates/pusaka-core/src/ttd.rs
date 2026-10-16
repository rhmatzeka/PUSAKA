//! Pemulihan alamat penanda tangan dari tanda tangan ECDSA secp256k1 (65 byte r‖s‖v).
//! Aturannya sama dengan `ECDSA.tryRecover` OpenZeppelin: s tinggi ditolak.

use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};

use crate::hash::keccak256;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum GalatTtd {
    #[error("tanda tangan harus 65 byte, dapat {0}")]
    PanjangSalah(usize),
    #[error("nilai v tidak valid: {0}")]
    VTidakValid(u8),
    #[error("nilai s terlalu tinggi (tanda tangan tidak kanonik)")]
    STinggi,
    #[error("tanda tangan tidak dapat dipulihkan")]
    GagalPulih,
}

/// Alamat Ethereum yang menandatangani `digest` (hash EIP-712 siap tanda tangan).
pub fn pulihkan(digest: &[u8; 32], sig: &[u8]) -> Result<[u8; 20], GalatTtd> {
    let sig: &[u8; 65] = sig
        .try_into()
        .map_err(|_| GalatTtd::PanjangSalah(sig.len()))?;
    let v = match sig[64] {
        27 | 28 => sig[64] - 27,
        0 | 1 => sig[64],
        v => return Err(GalatTtd::VTidakValid(v)),
    };
    let rs = Signature::from_slice(&sig[..64]).map_err(|_| GalatTtd::GagalPulih)?;
    if rs.normalize_s().is_some() {
        return Err(GalatTtd::STinggi);
    }
    let id = RecoveryId::from_byte(v).ok_or(GalatTtd::VTidakValid(sig[64]))?;
    let kunci =
        VerifyingKey::recover_from_prehash(digest, &rs, id).map_err(|_| GalatTtd::GagalPulih)?;
    let titik = kunci.to_encoded_point(false);
    let hash = keccak256(&titik.as_bytes()[1..]);
    let mut alamat = [0u8; 20];
    alamat.copy_from_slice(&hash[12..]);
    Ok(alamat)
}
