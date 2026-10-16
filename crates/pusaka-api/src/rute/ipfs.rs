use axum::Json;
use axum::body::Body;
use axum::extract::State;
use axum::http::StatusCode;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::auth::Pengguna;
use crate::db;
use crate::galat::Galat;
use crate::masukan::QueryMasuk;
use crate::negara::Negara;

/// Body fungsi Vercel dibatasi 4,5 MB; amplop = PDF + header + 29 byte.
pub const MAKS_BERKAS: usize = 4 * 1024 * 1024;

#[derive(Deserialize)]
pub struct Kueri {
    nama: String,
}

fn nama_sah(nama: &str) -> bool {
    (1..=100).contains(&nama.len())
        && !nama.starts_with('.')
        && nama
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
}

/// `POST /api/ipfs?nama=…`: unggah amplop atau metadata (badan mentah) ke IPFS publik.
pub async fn unggah(
    State(n): State<Negara>,
    p: Pengguna,
    QueryMasuk(q): QueryMasuk<Kueri>,
    badan: Body,
) -> Result<(StatusCode, Json<Value>), Galat> {
    p.wajib_operator()?;
    if !nama_sah(&q.nama) {
        return Err(Galat::InputTidakValid(
            "nama berkas hanya boleh huruf, angka, titik, garis bawah, dan strip (maks 100)".into(),
        ));
    }
    db::cek_batas(&n.db, &p.did).await?;
    let isi = axum::body::to_bytes(badan, MAKS_BERKAS)
        .await
        .map_err(|_| Galat::TerlaluBesar(MAKS_BERKAS))?;
    if isi.is_empty() {
        return Err(Galat::InputTidakValid("berkas kosong".into()));
    }
    let ukuran = isi.len();
    let cid = n.ipfs.unggah(&q.nama, isi.to_vec()).await?;
    db::audit(
        &n.db,
        &p.did,
        "ipfs.unggah",
        &cid,
        json!({ "nama": q.nama, "ukuran": ukuran }),
    )
    .await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "cid": cid, "uri": format!("ipfs://{cid}") })),
    ))
}
