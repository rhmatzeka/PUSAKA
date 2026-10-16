//! Amplop terenkripsi berkas ijazah:
//! `0x01 ‖ nonce(12) ‖ AES-256-GCM( u32BE(panjang header) ‖ header JSON ‖ PDF )`.

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use serde::{Deserialize, Serialize};

pub const VERSI: u8 = 1;
pub const PANJANG_NONCE: usize = 12;
pub const PANJANG_TAG: usize = 16;
pub const MAKS_HEADER: usize = 16 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DataLulusan {
    pub nama: String,
    pub nim: String,
    pub prodi: String,
    pub gelar: String,
    pub nomor_ijazah: String,
    pub tanggal_lulus: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IsiAmplop {
    pub data: DataLulusan,
    pub pdf: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum GalatAmplop {
    #[error("amplop terlalu pendek")]
    TerlaluPendek,
    #[error("versi amplop {0} tidak dikenal")]
    VersiTidakDikenal(u8),
    #[error("kunci salah atau amplop rusak")]
    GagalDekripsi,
    #[error("header amplop rusak")]
    HeaderRusak,
    #[error("data lulusan terlalu besar")]
    HeaderTerlaluBesar,
    #[error("enkripsi gagal")]
    GagalEnkripsi,
}

fn cipher(kunci: &[u8; 32]) -> Aes256Gcm {
    Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(kunci))
}

pub fn segel(
    kunci: &[u8; 32],
    nonce: &[u8; PANJANG_NONCE],
    data: &DataLulusan,
    pdf: &[u8],
) -> Result<Vec<u8>, GalatAmplop> {
    let header = serde_json::to_vec(data).map_err(|_| GalatAmplop::HeaderRusak)?;
    if header.len() > MAKS_HEADER {
        return Err(GalatAmplop::HeaderTerlaluBesar);
    }
    let panjang = u32::try_from(header.len()).map_err(|_| GalatAmplop::HeaderTerlaluBesar)?;
    let mut isi = Vec::with_capacity(4 + header.len() + pdf.len());
    isi.extend_from_slice(&panjang.to_be_bytes());
    isi.extend_from_slice(&header);
    isi.extend_from_slice(pdf);

    let rahasia = cipher(kunci)
        .encrypt(Nonce::from_slice(nonce), isi.as_slice())
        .map_err(|_| GalatAmplop::GagalEnkripsi)?;
    let mut out = Vec::with_capacity(1 + PANJANG_NONCE + rahasia.len());
    out.push(VERSI);
    out.extend_from_slice(nonce);
    out.extend_from_slice(&rahasia);
    Ok(out)
}

pub fn buka(kunci: &[u8; 32], amplop: &[u8]) -> Result<IsiAmplop, GalatAmplop> {
    if amplop.len() < 1 + PANJANG_NONCE + PANJANG_TAG {
        return Err(GalatAmplop::TerlaluPendek);
    }
    if amplop[0] != VERSI {
        return Err(GalatAmplop::VersiTidakDikenal(amplop[0]));
    }
    let (nonce, rahasia) = amplop[1..].split_at(PANJANG_NONCE);
    let isi = cipher(kunci)
        .decrypt(Nonce::from_slice(nonce), rahasia)
        .map_err(|_| GalatAmplop::GagalDekripsi)?;

    let (awal, sisa) = isi.split_at_checked(4).ok_or(GalatAmplop::HeaderRusak)?;
    let panjang = u32::from_be_bytes([awal[0], awal[1], awal[2], awal[3]]) as usize;
    if panjang > MAKS_HEADER {
        return Err(GalatAmplop::HeaderRusak);
    }
    let (header, pdf) = sisa
        .split_at_checked(panjang)
        .ok_or(GalatAmplop::HeaderRusak)?;
    let data = serde_json::from_slice(header).map_err(|_| GalatAmplop::HeaderRusak)?;
    Ok(IsiAmplop {
        data,
        pdf: pdf.to_vec(),
    })
}
