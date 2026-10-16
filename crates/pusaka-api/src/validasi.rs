//! Validasi masukan dari operator. Pesan galat diawali nama kolomnya.

use chrono::{Datelike, NaiveDate};
use pusaka_core::heks;
use serde::Deserialize;

pub const MAKS_TEKS: usize = 200;
pub const MAKS_ALASAN: usize = 500;

#[derive(Debug, Clone, Deserialize)]
pub struct DrafBaru {
    pub nama: String,
    pub nim: String,
    pub prodi: String,
    pub gelar: String,
    pub nomor_ijazah: String,
    pub tanggal_lulus: String,
    pub email: String,
    pub doc_hash: String,
    pub uri: String,
    pub cid_amplop: String,
    pub kunci: String,
}

#[derive(Debug, Clone)]
pub struct DrafSah {
    pub nama: String,
    pub nim: String,
    pub prodi: String,
    pub gelar: String,
    pub nomor_ijazah: String,
    pub tanggal_lulus: NaiveDate,
    pub email: String,
    pub doc_hash: [u8; 32],
    pub uri: String,
    pub cid_amplop: String,
    pub kunci: [u8; 32],
}

fn teks(kolom: &str, v: &str) -> Result<String, String> {
    let v = v.trim();
    if v.is_empty() {
        return Err(format!("{kolom} wajib diisi"));
    }
    if v.chars().count() > MAKS_TEKS {
        return Err(format!("{kolom} maksimal {MAKS_TEKS} karakter"));
    }
    Ok(v.to_owned())
}

fn nim(v: &str) -> Result<String, String> {
    let v = v.trim();
    if v.is_empty() || v.len() > 20 || !v.bytes().all(|b| b.is_ascii_digit()) {
        return Err("nim harus 1–20 digit angka".into());
    }
    Ok(v.to_owned())
}

fn tanggal(v: &str) -> Result<NaiveDate, String> {
    let v = v.trim();
    let b = v.as_bytes();
    let bentuk = b.len() == 10
        && b.iter().enumerate().all(|(i, c)| {
            if i == 4 || i == 7 {
                *c == b'-'
            } else {
                c.is_ascii_digit()
            }
        });
    let t = bentuk
        .then(|| NaiveDate::parse_from_str(v, "%Y-%m-%d").ok())
        .flatten()
        .ok_or_else(|| "tanggal_lulus harus tanggal YYYY-MM-DD yang ada di kalender".to_owned())?;
    if t.year() < 1900 {
        return Err("tanggal_lulus minimal tahun 1900".into());
    }
    Ok(t)
}

fn email(v: &str) -> Result<String, String> {
    let v = v.trim().to_lowercase();
    let sah = v.len() <= 254
        && !v.chars().any(char::is_whitespace)
        && match v.split_once('@') {
            Some((lokal, domain)) => {
                !lokal.is_empty()
                    && !domain.contains('@')
                    && domain.contains('.')
                    && !domain.starts_with('.')
                    && !domain.ends_with('.')
            }
            None => false,
        };
    if sah {
        Ok(v)
    } else {
        Err("email tidak valid".into())
    }
}

fn hash(kolom: &str, v: &str) -> Result<[u8; 32], String> {
    let h = heks::dari_hex32(v.trim()).map_err(|_| format!("{kolom} harus 32 byte hex"))?;
    if h == [0; 32] {
        return Err(format!("{kolom} tidak boleh nol"));
    }
    Ok(h)
}

fn uri(v: &str) -> Result<String, String> {
    let v = v.trim();
    let sah = v.len() <= MAKS_TEKS
        && v.len() > "ipfs://".len()
        && v.starts_with("ipfs://")
        && !v.chars().any(char::is_whitespace);
    if sah {
        Ok(v.to_owned())
    } else {
        Err("uri harus berbentuk ipfs://<cid>".into())
    }
}

fn cid(v: &str) -> Result<String, String> {
    let v = v.trim();
    if v.is_empty() || v.len() > 100 || !v.bytes().all(|b| b.is_ascii_alphanumeric()) {
        return Err("cid_amplop tidak valid".into());
    }
    Ok(v.to_owned())
}

pub fn sahkan(d: &DrafBaru) -> Result<DrafSah, String> {
    Ok(DrafSah {
        nama: teks("nama", &d.nama)?,
        nim: nim(&d.nim)?,
        prodi: teks("prodi", &d.prodi)?,
        gelar: teks("gelar", &d.gelar)?,
        nomor_ijazah: teks("nomor_ijazah", &d.nomor_ijazah)?,
        tanggal_lulus: tanggal(&d.tanggal_lulus)?,
        email: email(&d.email)?,
        doc_hash: hash("doc_hash", &d.doc_hash)?,
        uri: uri(&d.uri)?,
        cid_amplop: cid(&d.cid_amplop)?,
        kunci: hash("kunci", &d.kunci)?,
    })
}

/// Alasan tolak/cabut. Untuk pencabutan, teks ini yang di-hash dan dikirim ke kontrak.
pub fn alasan(v: &str) -> Result<String, String> {
    let v = v.trim();
    if v.is_empty() || v.chars().count() > MAKS_ALASAN {
        return Err(format!(
            "alasan wajib diisi, maksimal {MAKS_ALASAN} karakter"
        ));
    }
    Ok(v.to_owned())
}
