//! State bersama semua handler.

use std::sync::Arc;
use std::time::Duration;

use pusaka_core::eip712::Domain;
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;

use crate::auth::{CacheSesi, PemeriksaToken};
use crate::config::{GalatKonfigurasi, Konfigurasi};
use crate::layanan::{Ipfs, Privy, Rantai};
use crate::pinata::PinataHttp;
use crate::privy::PrivyHttp;
use crate::rantai::RantaiRpc;

#[derive(Clone)]
pub struct Negara {
    pub db: PgPool,
    pub privy: Arc<dyn Privy>,
    pub ipfs: Arc<dyn Ipfs>,
    pub rantai: Arc<dyn Rantai>,
    pub token: Arc<PemeriksaToken>,
    pub cache: Arc<CacheSesi>,
    pub kunci_master: [u8; 32],
    pub domain: Domain,
}

impl Negara {
    /// Tidak membuka koneksi apa pun (pool malas), jadi aman dipanggil saat cold start.
    pub fn dari_konfigurasi(k: Konfigurasi) -> Result<Self, GalatKonfigurasi> {
        let token = PemeriksaToken::baru(&k.privy_kunci_verifikasi, &k.privy_app_id)
            .map_err(|e| GalatKonfigurasi::TidakValid("PRIVY_VERIFICATION_KEY", e))?;
        let db = PgPoolOptions::new()
            .max_connections(3)
            .acquire_timeout(Duration::from_secs(8))
            .connect_lazy(&k.database_url)
            .map_err(|e| GalatKonfigurasi::TidakValid("DATABASE_URL", e.to_string()))?;
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .map_err(|e| GalatKonfigurasi::TidakValid("HTTP", e.to_string()))?;
        Ok(Self {
            db,
            privy: Arc::new(PrivyHttp::baru(
                http.clone(),
                k.privy_api_url,
                k.privy_app_id,
                k.privy_app_secret,
            )),
            ipfs: Arc::new(PinataHttp::baru(
                http.clone(),
                k.pinata_upload_url,
                k.pinata_jwt,
            )),
            rantai: Arc::new(RantaiRpc::baru(http, k.rpc_url, k.alamat_kontrak)),
            token: Arc::new(token),
            cache: Arc::new(CacheSesi::baru(Duration::from_secs(300))),
            kunci_master: k.kunci_master,
            domain: Domain {
                chain_id: k.chain_id,
                kontrak: k.alamat_kontrak,
            },
        })
    }
}
