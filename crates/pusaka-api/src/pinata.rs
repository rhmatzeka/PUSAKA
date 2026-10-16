//! Klien Pinata v3: unggah berkas ke IPFS publik.

use async_trait::async_trait;
use reqwest::multipart::{Form, Part};
use serde::Deserialize;

use crate::galat::Galat;
use crate::layanan::Ipfs;

pub struct PinataHttp {
    http: reqwest::Client,
    url: String,
    jwt: String,
}

#[derive(Deserialize)]
struct Jawaban {
    data: DataJawaban,
}

#[derive(Deserialize)]
struct DataJawaban {
    cid: String,
}

impl PinataHttp {
    pub fn baru(http: reqwest::Client, url: String, jwt: String) -> Self {
        Self { http, url, jwt }
    }
}

#[async_trait]
impl Ipfs for PinataHttp {
    async fn unggah(&self, nama: &str, isi: Vec<u8>) -> Result<String, Galat> {
        let berkas = Part::bytes(isi)
            .file_name(nama.to_owned())
            .mime_str("application/octet-stream")
            .map_err(|e| Galat::Internal(format!("mime: {e}")))?;
        let form = Form::new()
            .part("file", berkas)
            .text("network", "public")
            .text("name", nama.to_owned());
        let res = self
            .http
            .post(format!("{}/v3/files", self.url.trim_end_matches('/')))
            .bearer_auth(&self.jwt)
            .multipart(form)
            .send()
            .await
            .map_err(|e| {
                Galat::LayananLuar(format!("Pinata tidak terjangkau: {}", e.without_url()))
            })?;
        if !res.status().is_success() {
            return Err(Galat::LayananLuar(format!(
                "Pinata menjawab {}",
                res.status()
            )));
        }
        let j: Jawaban = res.json().await.map_err(|e| {
            Galat::LayananLuar(format!("jawaban Pinata rusak: {}", e.without_url()))
        })?;
        if j.data.cid.is_empty() {
            return Err(Galat::LayananLuar("Pinata tidak mengembalikan CID".into()));
        }
        Ok(j.data.cid)
    }
}
