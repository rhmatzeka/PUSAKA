//! Konfigurasi dari env, divalidasi sekali saat fungsi mulai.

use std::fmt;

use pusaka_core::heks;

/// Env yang wajib ada. Urutan ini juga urutan di pesan galat.
pub const ENV_WAJIB: [&str; 9] = [
    "DATABASE_URL",
    "PRIVY_APP_ID",
    "PRIVY_APP_SECRET",
    "PRIVY_VERIFICATION_KEY",
    "PINATA_JWT",
    "KUNCI_MASTER",
    "RPC_URL",
    "ALAMAT_KONTRAK",
    "CHAIN_ID",
];

#[derive(Clone)]
pub struct Konfigurasi {
    pub database_url: String,
    pub privy_app_id: String,
    pub privy_app_secret: String,
    /// PEM kunci publik ES256 dari dashboard Privy.
    pub privy_kunci_verifikasi: String,
    pub privy_api_url: String,
    pub pinata_jwt: String,
    pub pinata_upload_url: String,
    pub kunci_master: [u8; 32],
    pub rpc_url: String,
    pub alamat_kontrak: [u8; 20],
    pub chain_id: u64,
}

/// Hanya menampilkan nilai yang tidak rahasia.
impl fmt::Debug for Konfigurasi {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Konfigurasi")
            .field("chain_id", &self.chain_id)
            .field("alamat_kontrak", &heks::ke_hex(&self.alamat_kontrak))
            .finish_non_exhaustive()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum GalatKonfigurasi {
    #[error("env belum diisi: {}", .0.join(", "))]
    Hilang(Vec<&'static str>),
    #[error("env {0} tidak valid: {1}")]
    TidakValid(&'static str, String),
}

impl Konfigurasi {
    pub fn dari_env() -> Result<Self, GalatKonfigurasi> {
        Self::dari(|k| std::env::var(k).ok())
    }

    /// `env` mengembalikan nilai mentah sebuah variabel; nilai kosong dianggap tidak ada.
    pub fn dari(env: impl Fn(&str) -> Option<String>) -> Result<Self, GalatKonfigurasi> {
        let ambil = |k: &str| {
            env(k)
                .map(|v| v.trim().to_owned())
                .filter(|v| !v.is_empty())
        };
        let hilang: Vec<&'static str> = ENV_WAJIB
            .iter()
            .copied()
            .filter(|k| ambil(k).is_none())
            .collect();
        if !hilang.is_empty() {
            return Err(GalatKonfigurasi::Hilang(hilang));
        }
        let wajib = |k: &str| ambil(k).unwrap_or_default();

        let kunci_master = heks::dari_hex32(&wajib("KUNCI_MASTER"))
            .map_err(|e| GalatKonfigurasi::TidakValid("KUNCI_MASTER", e.to_string()))?;
        if kunci_master == [0; 32] {
            return Err(GalatKonfigurasi::TidakValid(
                "KUNCI_MASTER",
                "tidak boleh nol".into(),
            ));
        }
        let alamat_kontrak = heks::alamat(&wajib("ALAMAT_KONTRAK"))
            .map_err(|e| GalatKonfigurasi::TidakValid("ALAMAT_KONTRAK", e.to_string()))?;
        let chain_id = wajib("CHAIN_ID")
            .parse::<u64>()
            .map_err(|e| GalatKonfigurasi::TidakValid("CHAIN_ID", e.to_string()))?;

        Ok(Self {
            database_url: wajib("DATABASE_URL"),
            privy_app_id: wajib("PRIVY_APP_ID"),
            privy_app_secret: wajib("PRIVY_APP_SECRET"),
            // Dashboard Vercel menyimpan PEM satu baris; `\n` literal dikembalikan jadi baris baru.
            privy_kunci_verifikasi: wajib("PRIVY_VERIFICATION_KEY").replace("\\n", "\n"),
            privy_api_url: ambil("PRIVY_API_URL").unwrap_or_else(|| "https://api.privy.io".into()),
            pinata_jwt: wajib("PINATA_JWT"),
            pinata_upload_url: ambil("PINATA_UPLOAD_URL")
                .unwrap_or_else(|| "https://uploads.pinata.cloud".into()),
            kunci_master,
            rpc_url: wajib("RPC_URL"),
            alamat_kontrak,
            chain_id,
        })
    }
}
