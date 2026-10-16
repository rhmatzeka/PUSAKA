//! Ekspor untuk peramban (`wasm-bindgen`). Struktur kompleks dikirim sebagai string JSON;
//! bilangan 64-bit menjadi `bigint` di JavaScript.

use wasm_bindgen::prelude::*;

use crate::amplop::{self, DataLulusan, PANJANG_NONCE};
use crate::csv_lulusan;
use crate::eip712::{self, Domain, Pencabutan, Penerbitan};
use crate::hash::keccak256;
use crate::heks::{alamat, dari_hex32, ke_hex};

fn galat(e: impl std::fmt::Display) -> JsError {
    JsError::new(&e.to_string())
}

fn kunci32(b: &[u8]) -> Result<[u8; 32], JsError> {
    b.try_into()
        .map_err(|_| JsError::new("kunci harus 32 byte"))
}

/// Keccak-256 berkas, hasil `0x…` (64 hex).
#[wasm_bindgen]
pub fn keccak256_hex(data: &[u8]) -> String {
    ke_hex(&keccak256(data))
}

#[wasm_bindgen]
pub fn segel_amplop(
    kunci: &[u8],
    nonce: &[u8],
    data_json: &str,
    pdf: &[u8],
) -> Result<Vec<u8>, JsError> {
    let kunci = kunci32(kunci)?;
    let nonce: [u8; PANJANG_NONCE] = nonce
        .try_into()
        .map_err(|_| JsError::new("nonce harus 12 byte"))?;
    let data: DataLulusan = serde_json::from_str(data_json).map_err(galat)?;
    amplop::segel(&kunci, &nonce, &data, pdf).map_err(galat)
}

#[wasm_bindgen]
pub struct HasilBuka {
    data_json: String,
    pdf: Vec<u8>,
}

#[wasm_bindgen]
impl HasilBuka {
    #[wasm_bindgen(getter)]
    pub fn data_json(&self) -> String {
        self.data_json.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn pdf(&self) -> Vec<u8> {
        self.pdf.clone()
    }
}

#[wasm_bindgen]
pub fn buka_amplop(kunci: &[u8], amplop: &[u8]) -> Result<HasilBuka, JsError> {
    let isi = amplop::buka(&kunci32(kunci)?, amplop).map_err(galat)?;
    Ok(HasilBuka {
        data_json: serde_json::to_string(&isi.data).map_err(galat)?,
        pdf: isi.pdf,
    })
}

#[wasm_bindgen]
pub fn digest_penerbitan_hex(
    chain_id: u64,
    kontrak: &str,
    penerima: &str,
    doc_hash: &str,
    metadata_hash: &str,
    batas_waktu: u64,
) -> Result<String, JsError> {
    let d = Domain {
        chain_id,
        kontrak: alamat(kontrak).map_err(galat)?,
    };
    let p = Penerbitan {
        penerima: alamat(penerima).map_err(galat)?,
        doc_hash: dari_hex32(doc_hash).map_err(galat)?,
        metadata_hash: dari_hex32(metadata_hash).map_err(galat)?,
        batas_waktu,
    };
    Ok(ke_hex(&eip712::digest_penerbitan(&d, &p)))
}

#[wasm_bindgen]
pub fn digest_pencabutan_hex(
    chain_id: u64,
    kontrak: &str,
    token_id: u64,
    alasan_hash: &str,
    batas_waktu: u64,
) -> Result<String, JsError> {
    let d = Domain {
        chain_id,
        kontrak: alamat(kontrak).map_err(galat)?,
    };
    let c = Pencabutan {
        token_id,
        alasan_hash: dari_hex32(alasan_hash).map_err(galat)?,
        batas_waktu,
    };
    Ok(ke_hex(&eip712::digest_pencabutan(&d, &c)))
}

/// Hasil: JSON `{ "baris": [...], "galat": [...] }`.
#[wasm_bindgen]
pub fn baca_csv(teks: &str) -> Result<String, JsError> {
    let h = csv_lulusan::baca(teks).map_err(galat)?;
    serde_json::to_string(&h).map_err(galat)
}
