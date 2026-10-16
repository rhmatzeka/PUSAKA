//! Klien REST Privy: wallet milik pengguna dan wallet tertanam alumni dari email.

use async_trait::async_trait;
use pusaka_core::heks;
use reqwest::{Method, RequestBuilder, StatusCode};
use serde::Deserialize;
use serde_json::json;

use crate::galat::Galat;
use crate::layanan::Privy;

pub struct PrivyHttp {
    http: reqwest::Client,
    url: String,
    app_id: String,
    secret: String,
}

#[derive(Deserialize)]
struct PenggunaPrivy {
    linked_accounts: Vec<Akun>,
}

#[derive(Deserialize)]
struct Akun {
    #[serde(rename = "type")]
    jenis: String,
    #[serde(default)]
    address: Option<String>,
    #[serde(default)]
    chain_type: Option<String>,
    #[serde(default)]
    connector_type: Option<String>,
}

/// Wallet Ethereum milik pengguna, berpasangan dengan penanda "tertanam" (dibuat Privy).
fn wallet_ethereum(p: &PenggunaPrivy) -> Vec<([u8; 20], bool)> {
    p.linked_accounts
        .iter()
        .filter(|a| a.jenis == "wallet" && a.chain_type.as_deref() == Some("ethereum"))
        .filter_map(|a| {
            let alamat = heks::alamat(a.address.as_deref()?).ok()?;
            Some((alamat, a.connector_type.as_deref() == Some("embedded")))
        })
        .collect()
}

/// Utamakan wallet tertanam; bila tidak ada, wallet Ethereum pertama.
fn wallet_utama(p: &PenggunaPrivy, email: &str) -> Result<[u8; 20], Galat> {
    let w = wallet_ethereum(p);
    w.iter()
        .find(|(_, tertanam)| *tertanam)
        .or_else(|| w.first())
        .map(|(a, _)| *a)
        .ok_or_else(|| Galat::Konflik(format!("akun Privy {email} belum punya wallet Ethereum")))
}

impl PrivyHttp {
    pub fn baru(http: reqwest::Client, url: String, app_id: String, secret: String) -> Self {
        Self {
            http,
            url,
            app_id,
            secret,
        }
    }

    fn minta(&self, metode: Method, jalur: &str) -> RequestBuilder {
        self.http
            .request(metode, format!("{}{jalur}", self.url.trim_end_matches('/')))
            .basic_auth(&self.app_id, Some(&self.secret))
            .header("privy-app-id", &self.app_id)
    }

    /// Kirim permintaan; 404 → `None`, sukses → isi, selain itu galat layanan luar.
    async fn kirim(&self, rb: RequestBuilder) -> Result<Option<PenggunaPrivy>, Galat> {
        let res = rb
            .send()
            .await
            .map_err(|e| Galat::LayananLuar(format!("Privy tidak terjangkau: {e}")))?;
        match res.status() {
            StatusCode::NOT_FOUND => Ok(None),
            s if s.is_success() => res
                .json()
                .await
                .map(Some)
                .map_err(|e| Galat::LayananLuar(format!("jawaban Privy rusak: {e}"))),
            s => Err(Galat::LayananLuar(format!("Privy menjawab {s}"))),
        }
    }

    async fn cari_email(&self, email: &str) -> Result<Option<PenggunaPrivy>, Galat> {
        self.kirim(
            self.minta(Method::POST, "/v1/users/email/address")
                .json(&json!({ "address": email })),
        )
        .await
    }
}

#[async_trait]
impl Privy for PrivyHttp {
    async fn wallet_pengguna(&self, did: &str) -> Result<Vec<[u8; 20]>, Galat> {
        let p = self
            .kirim(self.minta(Method::GET, &format!("/v1/users/{did}")))
            .await?;
        Ok(
            p.map(|p| wallet_ethereum(&p).into_iter().map(|(a, _)| a).collect())
                .unwrap_or_default(),
        )
    }

    async fn wallet_alumni(&self, email: &str) -> Result<[u8; 20], Galat> {
        let email = email.trim().to_lowercase();
        if let Some(p) = self.cari_email(&email).await? {
            return wallet_utama(&p, &email);
        }
        let badan = json!({
            "linked_accounts": [{ "type": "email", "address": email }],
            "wallets": [{ "chain_type": "ethereum" }],
        });
        match self
            .kirim(self.minta(Method::POST, "/v1/users").json(&badan))
            .await
        {
            Ok(Some(p)) => wallet_utama(&p, &email),
            // Balapan: pengguna dibuat proses lain di antara cari dan buat → cari ulang.
            Ok(None) | Err(Galat::LayananLuar(_)) => match self.cari_email(&email).await? {
                Some(p) => wallet_utama(&p, &email),
                None => Err(Galat::LayananLuar(format!(
                    "Privy gagal membuat akun {email}"
                ))),
            },
            Err(e) => Err(e),
        }
    }
}
