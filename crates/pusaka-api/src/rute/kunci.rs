use axum::Json;
use axum::extract::{Path, State};
use pusaka_core::heks::{self, ke_hex};
use serde_json::{Value, json};

use crate::auth::Pengguna;
use crate::db;
use crate::galat::Galat;
use crate::kunci;
use crate::masukan::token_dari;
use crate::negara::Negara;

/// `GET /api/kunci/{token_id}`: kunci AES ijazah untuk pemilik token atau operator.
pub async fn ambil(
    State(n): State<Negara>,
    p: Pengguna,
    Path(token_id): Path<String>,
) -> Result<Json<Value>, Galat> {
    let token = token_dari(&token_id)?;
    let d = db::draf_dari_token(&n.db, i64::try_from(token).unwrap_or(i64::MAX))
        .await?
        .ok_or_else(|| Galat::TidakDitemukan("ijazah tidak ditemukan".into()))?;
    let pemilik = heks::alamat(&d.penerima)
        .map_err(|_| Galat::Internal("penerima tersimpan rusak".into()))?;
    if !(p.peran.operator || p.punya_wallet(&pemilik)) {
        return Err(Galat::PeranTidakCukup(
            "hanya pemilik ijazah atau operator".into(),
        ));
    }
    db::cek_batas(&n.db, &p.did).await?;
    let bungkus = db::ambil_kunci(&n.db, d.id)
        .await?
        .ok_or_else(|| Galat::Internal("kunci ijazah hilang".into()))?;
    let k = kunci::buka(&n.kunci_master, d.id, &bungkus)?;
    db::audit(&n.db, &p.did, "kunci.ambil", &token.to_string(), json!({})).await?;
    Ok(Json(
        json!({ "token_id": token, "status": d.status, "kunci": ke_hex(&k) }),
    ))
}
