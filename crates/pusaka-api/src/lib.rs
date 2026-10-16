//! Backend PUSAKA. Router yang sama dijalankan di Vercel (`api/index.rs`)
//! dan di laptop (`src/main.rs`).

pub mod auth;
pub mod config;
pub mod db;
pub mod galat;
pub mod kunci;
pub mod layanan;
pub mod masukan;
pub mod negara;
pub mod pinata;
pub mod privy;
pub mod rantai;
pub mod rute;

use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{any, get};
use axum::{Json, Router};
use serde::Serialize;

use crate::galat::{Galat, GalatJson};

#[derive(Serialize)]
struct Kesehatan {
    layanan: &'static str,
    versi: &'static str,
}

/// Router lengkap dengan state.
pub fn router(n: negara::Negara) -> Router {
    akhiri(rute::semua().with_state(n))
}

/// Rute yang selalu ada: kesehatan dan jawaban JSON untuk 404/405.
pub fn router_dasar() -> Router {
    akhiri(Router::new())
}

/// Dipakai saat env belum lengkap: semua `/api/*` selain kesehatan menjawab 503
/// dengan nama env yang kurang (tanpa nilai rahasia).
pub fn router_darurat(pesan: String) -> Router {
    akhiri(Router::new().route(
        "/api/{*sisa}",
        any(move || {
            let pesan = pesan.clone();
            async move { Galat::KonfigurasiTidakLengkap(pesan) }
        }),
    ))
}

fn akhiri(r: Router) -> Router {
    r.route("/api/kesehatan", get(kesehatan))
        .method_not_allowed_fallback(metode_tidak_diizinkan)
        .fallback(tidak_ditemukan)
}

async fn kesehatan() -> Json<Kesehatan> {
    Json(Kesehatan {
        layanan: "pusaka-api",
        versi: env!("CARGO_PKG_VERSION"),
    })
}

async fn tidak_ditemukan() -> Galat {
    Galat::TidakDitemukan("Rute tidak ditemukan".into())
}

async fn metode_tidak_diizinkan() -> impl IntoResponse {
    (
        StatusCode::METHOD_NOT_ALLOWED,
        Json(GalatJson {
            kode: "METODE_TIDAK_DIIZINKAN",
            pesan: "Metode HTTP tidak diizinkan untuk rute ini".into(),
        }),
    )
}
