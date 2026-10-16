//! Galat API. Setiap varian punya status HTTP dan kode tetap; badan selalu JSON `{kode, pesan}`.

use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum Galat {
    #[error("{0}")]
    TidakTerautentikasi(String),
    #[error("{0}")]
    PeranTidakCukup(String),
    #[error("{0}")]
    TidakDitemukan(String),
    #[error("{0}")]
    InputTidakValid(String),
    #[error("{0}")]
    Konflik(String),
    #[error("{0}")]
    StatusTidakSesuai(String),
    #[error("berkas melebihi batas {0} byte")]
    TerlaluBesar(usize),
    #[error("terlalu banyak permintaan; coba lagi dalam satu menit")]
    TerlaluBanyak,
    #[error("{0}")]
    LayananLuar(String),
    #[error("konfigurasi server belum lengkap: {0}")]
    KonfigurasiTidakLengkap(String),
    #[error("basis data: {0}")]
    Basisdata(#[from] sqlx::Error),
    #[error("{0}")]
    Internal(String),
}

#[derive(Debug, Serialize)]
pub struct GalatJson {
    pub kode: &'static str,
    pub pesan: String,
}

impl Galat {
    pub fn kode(&self) -> &'static str {
        match self {
            Self::TidakTerautentikasi(_) => "TIDAK_TERAUTENTIKASI",
            Self::PeranTidakCukup(_) => "PERAN_TIDAK_CUKUP",
            Self::TidakDitemukan(_) => "TIDAK_DITEMUKAN",
            Self::InputTidakValid(_) => "INPUT_TIDAK_VALID",
            Self::Konflik(_) => "KONFLIK",
            Self::StatusTidakSesuai(_) => "STATUS_TIDAK_SESUAI",
            Self::TerlaluBesar(_) => "TERLALU_BESAR",
            Self::TerlaluBanyak => "TERLALU_BANYAK",
            Self::LayananLuar(_) => "LAYANAN_LUAR",
            Self::KonfigurasiTidakLengkap(_) => "KONFIGURASI_TIDAK_LENGKAP",
            Self::Basisdata(_) | Self::Internal(_) => "INTERNAL",
        }
    }

    pub fn status(&self) -> StatusCode {
        match self {
            Self::TidakTerautentikasi(_) => StatusCode::UNAUTHORIZED,
            Self::PeranTidakCukup(_) => StatusCode::FORBIDDEN,
            Self::TidakDitemukan(_) => StatusCode::NOT_FOUND,
            Self::InputTidakValid(_) => StatusCode::BAD_REQUEST,
            Self::Konflik(_) | Self::StatusTidakSesuai(_) => StatusCode::CONFLICT,
            Self::TerlaluBesar(_) => StatusCode::PAYLOAD_TOO_LARGE,
            Self::TerlaluBanyak => StatusCode::TOO_MANY_REQUESTS,
            Self::LayananLuar(_) => StatusCode::BAD_GATEWAY,
            Self::KonfigurasiTidakLengkap(_) => StatusCode::SERVICE_UNAVAILABLE,
            Self::Basisdata(_) | Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for Galat {
    fn into_response(self) -> Response {
        let pesan = match &self {
            Self::Basisdata(_) | Self::Internal(_) => {
                tracing::error!(galat = %self, "galat internal");
                "Terjadi kesalahan di server".to_owned()
            }
            Self::LayananLuar(_) => {
                tracing::warn!(galat = %self, "layanan luar gagal");
                self.to_string()
            }
            _ => self.to_string(),
        };
        (
            self.status(),
            Json(GalatJson {
                kode: self.kode(),
                pesan,
            }),
        )
            .into_response()
    }
}
