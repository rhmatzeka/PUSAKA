//! Semua rute `/api/*` yang butuh state.

pub mod ipfs;
pub mod sesi;

use axum::Router;
use axum::routing::{get, post};

use crate::negara::Negara;

pub fn semua() -> Router<Negara> {
    Router::new()
        .route("/api/sesi", get(sesi::sesi))
        .route("/api/ipfs", post(ipfs::unggah))
}
