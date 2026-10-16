//! Tanda tangan pejabat (penerbitan dan pencabutan): batas waktu dan pemulihan penanda tangan.

use chrono::{DateTime, Utc};
use pusaka_core::heks::ke_hex;
use pusaka_core::ttd;
use serde::Deserialize;

use crate::auth::Pengguna;
use crate::galat::Galat;
use crate::negara::Negara;
use crate::rantai::peran_penandatangan;

/// Batas waktu tanda tangan paling lama 30 hari (spec: bawaan 7 hari di antarmuka).
pub const MAKS_MASA_TTD: u64 = 30 * 24 * 60 * 60;
/// Sisa waktu minimal supaya operator sempat mengirim transaksi.
pub const JEDA_MIN: u64 = 60;

#[derive(Debug, Deserialize)]
pub struct Persetujuan {
    pub sig: String,
    pub batas_waktu: u64,
}

pub struct PenandaTangan {
    pub alamat: [u8; 20],
    pub sig: Vec<u8>,
}

pub fn sekarang() -> u64 {
    u64::try_from(Utc::now().timestamp()).unwrap_or(0)
}

pub fn cek_batas_waktu(batas: u64, kini: u64) -> Result<DateTime<Utc>, Galat> {
    if batas < kini.saturating_add(JEDA_MIN) {
        return Err(Galat::InputTidakValid(
            "batas_waktu sudah lewat atau kurang dari 1 menit lagi".into(),
        ));
    }
    if batas > kini.saturating_add(MAKS_MASA_TTD) {
        return Err(Galat::InputTidakValid(
            "batas_waktu maksimal 30 hari dari sekarang".into(),
        ));
    }
    i64::try_from(batas)
        .ok()
        .and_then(|b| DateTime::from_timestamp(b, 0))
        .ok_or_else(|| Galat::InputTidakValid("batas_waktu tidak valid".into()))
}

/// Pulihkan penanda tangan `digest`, lalu wajibkan: wallet itu milik pengguna yang login
/// dan (dicek ulang on-chain, tanpa cache) memegang PENANDATANGAN_ROLE.
pub async fn pulihkan(
    n: &Negara,
    p: &Pengguna,
    digest: &[u8; 32],
    sig_hex: &str,
) -> Result<PenandaTangan, Galat> {
    let sig = hex::decode(sig_hex.trim().trim_start_matches("0x"))
        .map_err(|_| Galat::InputTidakValid("sig harus hex".into()))?;
    let alamat = ttd::pulihkan(digest, &sig)
        .map_err(|e| Galat::InputTidakValid(format!("tanda tangan tidak valid: {e}")))?;
    if !p.punya_wallet(&alamat) {
        return Err(Galat::PeranTidakCukup(format!(
            "tanda tangan berasal dari {} yang bukan wallet Anda",
            ke_hex(&alamat)
        )));
    }
    if !n.rantai.punya_peran(peran_penandatangan(), alamat).await? {
        return Err(Galat::PeranTidakCukup(
            "wallet penanda tangan tidak memegang PENANDATANGAN_ROLE".into(),
        ));
    }
    Ok(PenandaTangan { alamat, sig })
}
