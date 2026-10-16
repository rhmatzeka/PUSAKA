//! Semua rute `/api/*` yang butuh state.

pub mod sesi;

use axum::Router;
use axum::routing::get;

use crate::negara::Negara;

pub fn semua() -> Router<Negara> {
    Router::new().route("/api/sesi", get(sesi::sesi))
}
