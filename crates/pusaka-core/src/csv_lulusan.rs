//! Pembaca CSV lulusan untuk unggah batch. Galat per baris dikumpulkan;
//! baris yang valid tetap dikembalikan.

use std::collections::HashSet;

use serde::Serialize;

use crate::amplop::DataLulusan;

pub const KOLOM: [&str; 8] = [
    "nama",
    "nim",
    "prodi",
    "gelar",
    "nomor_ijazah",
    "tanggal_lulus",
    "email",
    "file_pdf",
];
pub const MAKS_BARIS: usize = 50;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BarisLulusan {
    pub nomor_baris: usize,
    pub data: DataLulusan,
    pub email: String,
    pub file_pdf: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GalatBaris {
    pub nomor_baris: usize,
    pub pesan: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Default)]
pub struct HasilCsv {
    pub baris: Vec<BarisLulusan>,
    pub galat: Vec<GalatBaris>,
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum GalatCsv {
    #[error("berkas CSV kosong")]
    Kosong,
    #[error("kolom CSV harus: {}; ditemukan: {ditemukan}", KOLOM.join(","))]
    KolomSalah { ditemukan: String },
    #[error("maksimal {MAKS_BARIS} baris per batch, berkas berisi {0}")]
    TerlaluBanyak(usize),
    #[error("CSV rusak: {0}")]
    Rusak(String),
}

pub fn baca(teks: &str) -> Result<HasilCsv, GalatCsv> {
    let teks = teks.strip_prefix('\u{feff}').unwrap_or(teks);
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .trim(csv::Trim::All)
        .flexible(true)
        .from_reader(teks.as_bytes());

    let kepala = rdr
        .headers()
        .map_err(|e| GalatCsv::Rusak(e.to_string()))?
        .clone();
    if kepala.is_empty() || kepala.iter().all(str::is_empty) {
        return Err(GalatCsv::Kosong);
    }
    if kepala.len() != KOLOM.len() || kepala.iter().zip(KOLOM).any(|(a, b)| a != b) {
        return Err(GalatCsv::KolomSalah {
            ditemukan: kepala.iter().collect::<Vec<_>>().join(","),
        });
    }

    let rekaman: Vec<csv::StringRecord> = rdr
        .records()
        .collect::<Result<_, _>>()
        .map_err(|e| GalatCsv::Rusak(e.to_string()))?;
    let rekaman: Vec<_> = rekaman
        .into_iter()
        .filter(|r| r.iter().any(|f| !f.is_empty()))
        .collect();
    if rekaman.is_empty() {
        return Err(GalatCsv::Kosong);
    }
    if rekaman.len() > MAKS_BARIS {
        return Err(GalatCsv::TerlaluBanyak(rekaman.len()));
    }

    let mut hasil = HasilCsv::default();
    let mut nim_terpakai = HashSet::new();
    let mut nomor_terpakai = HashSet::new();
    for r in rekaman {
        let nomor_baris = r.position().map_or(0, |p| p.line() as usize);
        match periksa_baris(&r, nomor_baris, &mut nim_terpakai, &mut nomor_terpakai) {
            Ok(b) => hasil.baris.push(b),
            Err(pesan) => hasil.galat.push(GalatBaris { nomor_baris, pesan }),
        }
    }
    Ok(hasil)
}

fn periksa_baris(
    r: &csv::StringRecord,
    nomor_baris: usize,
    nim_terpakai: &mut HashSet<String>,
    nomor_terpakai: &mut HashSet<String>,
) -> Result<BarisLulusan, String> {
    let ambil = |i: usize| r.get(i).unwrap_or("").to_string();
    let [
        nama,
        nim,
        prodi,
        gelar,
        nomor_ijazah,
        tanggal_lulus,
        email,
        file_pdf,
    ] = std::array::from_fn(ambil);

    if let Some(k) = [
        &nama,
        &nim,
        &prodi,
        &gelar,
        &nomor_ijazah,
        &tanggal_lulus,
        &email,
        &file_pdf,
    ]
    .iter()
    .position(|v| v.is_empty())
    {
        return Err(format!("kolom {} kosong", KOLOM[k]));
    }
    if !nim.chars().all(|c| c.is_ascii_digit()) {
        return Err("NIM hanya boleh berisi angka".into());
    }
    if !tanggal_valid(&tanggal_lulus) {
        return Err("tanggal_lulus harus berformat YYYY-MM-DD".into());
    }
    if !email_valid(&email) {
        return Err("email tidak valid".into());
    }
    if !file_pdf.to_ascii_lowercase().ends_with(".pdf") {
        return Err("file_pdf harus berkas PDF".into());
    }
    if !nim_terpakai.insert(nim.clone()) {
        return Err(format!("NIM {nim} ganda di berkas ini"));
    }
    if !nomor_terpakai.insert(nomor_ijazah.clone()) {
        return Err(format!("nomor ijazah {nomor_ijazah} ganda di berkas ini"));
    }
    Ok(BarisLulusan {
        nomor_baris,
        data: DataLulusan {
            nama,
            nim,
            prodi,
            gelar,
            nomor_ijazah,
            tanggal_lulus,
        },
        email,
        file_pdf,
    })
}

fn tanggal_valid(s: &str) -> bool {
    let b = s.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return false;
    }
    let angka = |r: std::ops::Range<usize>| s[r].parse::<u32>().ok();
    match (angka(0..4), angka(5..7), angka(8..10)) {
        (Some(_), Some(m), Some(d)) => (1..=12).contains(&m) && (1..=31).contains(&d),
        _ => false,
    }
}

fn email_valid(s: &str) -> bool {
    match s.split_once('@') {
        Some((lokal, domain)) => {
            !lokal.is_empty()
                && !domain.contains('@')
                && domain.contains('.')
                && !domain.starts_with('.')
                && !domain.ends_with('.')
                && !s.chars().any(char::is_whitespace)
        }
        None => false,
    }
}
