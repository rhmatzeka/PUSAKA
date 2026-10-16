use axum::Json;
use pusaka_core::heks::ke_hex;
use serde::Serialize;

use crate::auth::{Pengguna, Peran};

#[derive(Serialize)]
pub struct JawabanSesi {
    did: String,
    wallet: Vec<String>,
    peran: Peran,
}

/// `GET /api/sesi`: siapa saya, wallet apa saja, peran apa.
pub async fn sesi(p: Pengguna) -> Json<JawabanSesi> {
    Json(JawabanSesi {
        wallet: p.wallet.iter().map(|w| ke_hex(w)).collect(),
        did: p.did,
        peran: p.peran,
    })
}
