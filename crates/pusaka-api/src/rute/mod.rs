//! Semua rute `/api/*` yang butuh state.

pub mod draf;
pub mod ipfs;
pub mod sesi;
pub mod ttd;

use axum::Router;
use axum::routing::{get, post};

use crate::negara::Negara;

pub fn semua() -> Router<Negara> {
    Router::new()
        .route("/api/sesi", get(sesi::sesi))
        .route("/api/ipfs", post(ipfs::unggah))
        .route("/api/draf", post(draf::buat).get(draf::daftar))
        .route("/api/draf/{id}", get(draf::detail))
        .route("/api/draf/{id}/setujui", post(draf::setujui))
        .route("/api/draf/{id}/tolak", post(draf::tolak))
        .route("/api/draf/{id}/kirim-ulang", post(draf::kirim_ulang))
}
