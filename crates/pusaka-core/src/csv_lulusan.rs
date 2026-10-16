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
    #[error(
        "pemisah kolom harus koma (,), bukan titik koma (;). Di Excel pilih \"CSV UTF-8 (dipisahkan koma)\""
    )]
    PemisahTitikKoma,
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
    if kepala.len() == 1 && kepala.get(0).is_some_and(|k| k.contains(';')) {
        return Err(GalatCsv::PemisahTitikKoma);
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
    if r.len() != KOLOM.len() {
        return Err(format!("harus {} kolom, ada {}", KOLOM.len(), r.len()));
    }
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
    // Periksa dulu, catat belakangan: baris yang ditolak tidak boleh "memesan" NIM/nomor.
    if nim_terpakai.contains(&nim) {
        return Err(format!("NIM {nim} ganda di berkas ini"));
    }
    if nomor_terpakai.contains(&nomor_ijazah) {
        return Err(format!("nomor ijazah {nomor_ijazah} ganda di berkas ini"));
    }
    nim_terpakai.insert(nim.clone());
    nomor_terpakai.insert(nomor_ijazah.clone());
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

/// `YYYY-MM-DD` dengan tanggal kalender yang benar (tahun ≥ 1900, kabisat diperhitungkan).
fn tanggal_valid(s: &str) -> bool {
    let b = s.as_bytes();
    let pola_ok = b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit());
    if !pola_ok {
        return false;
    }
    let angka = |r: std::ops::Range<usize>| s[r].parse::<u32>().unwrap_or(0);
    let (tahun, bulan, hari) = (angka(0..4), angka(5..7), angka(8..10));
    let kabisat = (tahun % 4 == 0 && tahun % 100 != 0) || tahun % 400 == 0;
    let maks_hari = match bulan {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if kabisat => 29,
        2 => 28,
        _ => return false,
    };
    tahun >= 1900 && (1..=maks_hari).contains(&hari)
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
