//! Backend PUSAKA. Router yang sama dijalankan di Vercel (`api/index.rs`)
//! dan di laptop (`src/main.rs`).

use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;

#[derive(Serialize)]
struct Kesehatan {
    layanan: &'static str,
    versi: &'static str,
}

#[derive(Serialize)]
struct GalatJson {
    kode: &'static str,
    pesan: &'static str,
}

/// Semua rute HTTP PUSAKA.
pub fn router() -> Router {
    Router::new()
        .route("/api/kesehatan", get(kesehatan))
        .method_not_allowed_fallback(metode_tidak_diizinkan)
        .fallback(tidak_ditemukan)
}

async fn kesehatan() -> Json<Kesehatan> {
    Json(Kesehatan {
        layanan: "pusaka-api",
        versi: env!("CARGO_PKG_VERSION"),
    })
}

async fn tidak_ditemukan() -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        Json(GalatJson {
            kode: "TIDAK_DITEMUKAN",
            pesan: "Rute tidak ditemukan",
        }),
    )
}

async fn metode_tidak_diizinkan() -> impl IntoResponse {
    (
        StatusCode::METHOD_NOT_ALLOWED,
        Json(GalatJson {
            kode: "METODE_TIDAK_DIIZINKAN",
            pesan: "Metode HTTP tidak diizinkan untuk rute ini",
        }),
    )
}
