//! Klien JSON-RPC minimal untuk kontrak PusakaIjazah: cek peran dan baca receipt.

use async_trait::async_trait;
use pusaka_core::hash::keccak256;
use pusaka_core::heks;
use serde_json::{Value, json};

use crate::galat::Galat;
use crate::layanan::{Log, Rantai, Receipt};

pub const PERAN_ADMIN: [u8; 32] = [0; 32];
const SELEKTOR_HAS_ROLE: [u8; 4] = [0x91, 0xd1, 0x48, 0x54];

pub fn peran_operator() -> [u8; 32] {
    keccak256(b"OPERATOR_ROLE")
}

pub fn peran_penandatangan() -> [u8; 32] {
    keccak256(b"PENANDATANGAN_ROLE")
}

pub fn topik_diterbitkan() -> [u8; 32] {
    keccak256(b"Diterbitkan(uint256,address,bytes32,address)")
}

pub fn topik_dicabut() -> [u8; 32] {
    keccak256(b"Dicabut(uint256,string)")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Terbit {
    pub token_id: u64,
    pub penerima: [u8; 20],
    pub doc_hash: [u8; 32],
}

fn kata_ke_u64(w: &[u8; 32]) -> Option<u64> {
    if w[..24].iter().any(|b| *b != 0) {
        return None;
    }
    let mut b = [0u8; 8];
    b.copy_from_slice(&w[24..]);
    Some(u64::from_be_bytes(b))
}

fn kata_ke_alamat(w: &[u8; 32]) -> [u8; 20] {
    let mut a = [0u8; 20];
    a.copy_from_slice(&w[12..]);
    a
}

/// Event `Diterbitkan` yang dipancarkan kontrak PUSAKA (log kontrak lain diabaikan).
pub fn event_terbit(r: &Receipt, kontrak: &[u8; 20]) -> Vec<Terbit> {
    let topik = topik_diterbitkan();
    r.log
        .iter()
        .filter(|l| &l.alamat == kontrak && l.topik.len() == 4 && l.topik[0] == topik)
        .filter_map(|l| {
            Some(Terbit {
                token_id: kata_ke_u64(&l.topik[1])?,
                penerima: kata_ke_alamat(&l.topik[2]),
                doc_hash: l.topik[3],
            })
        })
        .collect()
}

/// `tokenId` dari event `Dicabut` kontrak PUSAKA.
pub fn event_cabut(r: &Receipt, kontrak: &[u8; 20]) -> Vec<u64> {
    let topik = topik_dicabut();
    r.log
        .iter()
        .filter(|l| &l.alamat == kontrak && l.topik.len() == 2 && l.topik[0] == topik)
        .filter_map(|l| kata_ke_u64(&l.topik[1]))
        .collect()
}

pub fn calldata_has_role(peran: &[u8; 32], akun: &[u8; 20]) -> Vec<u8> {
    let mut d = Vec::with_capacity(68);
    d.extend_from_slice(&SELEKTOR_HAS_ROLE);
    d.extend_from_slice(peran);
    d.extend_from_slice(&[0u8; 12]);
    d.extend_from_slice(akun);
    d
}

/// Receipt JSON-RPC → `Receipt`; `None` bila bentuknya tidak dikenal.
pub fn urai_receipt(v: &Value) -> Option<Receipt> {
    let status = v.get("status")?.as_str()?;
    let sukses = u64::from_str_radix(status.trim_start_matches("0x"), 16).ok()? == 1;
    let log = v
        .get("logs")?
        .as_array()?
        .iter()
        .map(|l| {
            Some(Log {
                alamat: heks::alamat(l.get("address")?.as_str()?).ok()?,
                topik: l
                    .get("topics")?
                    .as_array()?
                    .iter()
                    .map(|t| heks::dari_hex32(t.as_str()?).ok())
                    .collect::<Option<Vec<_>>>()?,
                data: hex::decode(l.get("data")?.as_str()?.trim_start_matches("0x")).ok()?,
            })
        })
        .collect::<Option<Vec<_>>>()?;
    Some(Receipt { sukses, log })
}

pub struct RantaiRpc {
    http: reqwest::Client,
    url: String,
    kontrak: [u8; 20],
}

impl RantaiRpc {
    pub fn baru(http: reqwest::Client, url: String, kontrak: [u8; 20]) -> Self {
        Self { http, url, kontrak }
    }

    async fn panggil(&self, metode: &str, params: Value) -> Result<Value, Galat> {
        let res = self
            .http
            .post(&self.url)
            .json(&json!({ "jsonrpc": "2.0", "id": 1, "method": metode, "params": params }))
            .send()
            .await
            .map_err(|e| {
                Galat::LayananLuar(format!("RPC tidak terjangkau: {}", e.without_url()))
            })?;
        if !res.status().is_success() {
            return Err(Galat::LayananLuar(format!("RPC menjawab {}", res.status())));
        }
        let mut v: Value = res
            .json()
            .await
            .map_err(|e| Galat::LayananLuar(format!("jawaban RPC rusak: {}", e.without_url())))?;
        if let Some(g) = v.get("error") {
            return Err(Galat::LayananLuar(format!("RPC galat: {g}")));
        }
        Ok(v["result"].take())
    }
}

#[async_trait]
impl Rantai for RantaiRpc {
    async fn punya_peran(&self, peran: [u8; 32], akun: [u8; 20]) -> Result<bool, Galat> {
        let data = calldata_has_role(&peran, &akun);
        let hasil = self
            .panggil(
                "eth_call",
                json!([{ "to": heks::ke_hex(&self.kontrak), "data": heks::ke_hex(&data) }, "latest"]),
            )
            .await?;
        let kata = hasil
            .as_str()
            .and_then(|s| heks::dari_hex32(s).ok())
            .ok_or_else(|| Galat::LayananLuar("hasil hasRole bukan 32 byte".into()))?;
        Ok(kata[31] == 1)
    }

    async fn receipt(&self, tx: [u8; 32]) -> Result<Option<Receipt>, Galat> {
        let v = self
            .panggil("eth_getTransactionReceipt", json!([heks::ke_hex(&tx)]))
            .await?;
        if v.is_null() {
            return Ok(None);
        }
        urai_receipt(&v)
            .map(Some)
            .ok_or_else(|| Galat::LayananLuar("receipt dari RPC tidak dikenali".into()))
    }
}
