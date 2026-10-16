use axum::Json;
use axum::extract::State;
use pusaka_core::heks::ke_hex;
use serde_json::{Value, json};

use crate::auth::Pengguna;
use crate::db;
use crate::galat::Galat;
use crate::negara::Negara;

/// `GET /api/milik`: ijazah tercatat milik wallet pengguna (tanpa kunci; kunci lewat `/api/kunci`).
/// Status di sini hanya indeks; halaman alumni tetap membaca status dari kontrak.
pub async fn daftar(State(n): State<Negara>, p: Pengguna) -> Result<Json<Value>, Galat> {
    let wallet: Vec<String> = p.wallet.iter().map(|w| ke_hex(w)).collect();
    let data: Vec<Value> = db::ijazah_milik(&n.db, &wallet)
        .await?
        .into_iter()
        .map(|d| {
            json!({
                "token_id": d.token_id,
                "status": d.status,
                "nama": d.nama,
                "nomor_ijazah": d.nomor_ijazah,
                "prodi": d.prodi,
                "gelar": d.gelar,
                "tanggal_lulus": d.tanggal_lulus,
            })
        })
        .collect();
    Ok(Json(json!({ "data": data })))
}
