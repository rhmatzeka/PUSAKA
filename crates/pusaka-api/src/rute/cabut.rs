use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use pusaka_core::eip712::{self, Pencabutan};
use pusaka_core::hash::keccak256;
use pusaka_core::heks::ke_hex;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::auth::Pengguna;
use crate::db::{self, BarisCabut};
use crate::galat::Galat;
use crate::masukan::{JsonMasuk, QueryMasuk, id_dari};
use crate::negara::Negara;
use crate::rantai;
use crate::rute::terbit::{CatatTx, receipt_sukses};
use crate::rute::ttd::{self, Persetujuan};
use crate::validasi;

#[derive(Deserialize)]
pub struct MintaCabut {
    token_id: u64,
    alasan: String,
}

#[derive(Deserialize)]
pub struct KueriCabut {
    status: Option<String>,
}

async fn galat_status(n: &Negara, id: Uuid, harus: &str) -> Galat {
    match db::status_cabut(&n.db, id).await {
        Ok(Some(s)) => Galat::StatusTidakSesuai(format!("permintaan berstatus {s}, harus {harus}")),
        Ok(None) => Galat::TidakDitemukan("permintaan cabut tidak ditemukan".into()),
        Err(e) => e,
    }
}

async fn ambil(n: &Negara, id: Uuid) -> Result<BarisCabut, Galat> {
    db::ambil_cabut(&n.db, id)
        .await?
        .ok_or_else(|| Galat::TidakDitemukan("permintaan cabut tidak ditemukan".into()))
}

/// `POST /api/cabut`
pub async fn buat(
    State(n): State<Negara>,
    p: Pengguna,
    JsonMasuk(b): JsonMasuk<MintaCabut>,
) -> Result<(StatusCode, Json<Value>), Galat> {
    p.wajib_operator()?;
    let alasan = validasi::alasan(&b.alasan).map_err(Galat::InputTidakValid)?;
    let token = i64::try_from(b.token_id)
        .map_err(|_| Galat::InputTidakValid("token_id terlalu besar".into()))?;
    db::cek_batas(&n.db, &p.did).await?;
    match db::draf_dari_token(&n.db, token).await? {
        Some(d) if d.status == "TERBIT" => {}
        _ => {
            return Err(Galat::TidakDitemukan(
                "ijazah dengan token_id itu tidak ada atau sudah dicabut".into(),
            ));
        }
    }
    let id = Uuid::new_v4();
    let mut tx = n.db.begin().await?;
    db::sisip_cabut(&mut *tx, id, token, &alasan, &p.did).await?;
    db::audit(
        &mut *tx,
        &p.did,
        "cabut.buat",
        &id.to_string(),
        json!({ "token_id": token, "alasan": alasan }),
    )
    .await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

/// `GET /api/cabut?status=`
pub async fn daftar(
    State(n): State<Negara>,
    p: Pengguna,
    QueryMasuk(q): QueryMasuk<KueriCabut>,
) -> Result<Json<Value>, Galat> {
    p.wajib_operator_atau_penandatangan()?;
    if let Some(s) = &q.status
        && !db::STATUS_CABUT.contains(&s.as_str())
    {
        return Err(Galat::InputTidakValid(format!(
            "status harus salah satu dari {}",
            db::STATUS_CABUT.join(", ")
        )));
    }
    db::kedaluwarsakan(&n.db).await?;
    let data = db::daftar_cabut(&n.db, q.status.as_deref()).await?;
    Ok(Json(
        json!({ "data": data.iter().map(BarisCabut::ke_json).collect::<Vec<_>>() }),
    ))
}

/// `POST /api/cabut/{id}/setujui`: tanda tangan EIP-712 `Pencabutan`.
pub async fn setujui(
    State(n): State<Negara>,
    p: Pengguna,
    Path(id): Path<String>,
    JsonMasuk(b): JsonMasuk<Persetujuan>,
) -> Result<Json<Value>, Galat> {
    p.wajib_penandatangan()?;
    let id = id_dari(&id)?;
    let batas = ttd::cek_batas_waktu(b.batas_waktu, ttd::sekarang())?;
    db::cek_batas(&n.db, &p.did).await?;
    db::kedaluwarsakan(&n.db).await?;
    let c = ambil(&n, id).await?;
    if c.status != "MENUNGGU_TTD" {
        return Err(Galat::StatusTidakSesuai(format!(
            "permintaan berstatus {}, harus MENUNGGU_TTD",
            c.status
        )));
    }
    let pencabutan = Pencabutan {
        token_id: u64::try_from(c.token_id)
            .map_err(|_| Galat::Internal("token_id tersimpan negatif".into()))?,
        alasan_hash: keccak256(c.alasan.as_bytes()),
        batas_waktu: b.batas_waktu,
    };
    let digest = eip712::digest_pencabutan(&n.domain, &pencabutan);
    let pt = ttd::pulihkan(&n, &p, &digest, &b.sig).await?;
    let mut tx = n.db.begin().await?;
    db::sisip_ttd(&mut *tx, "pencabutan", id, &pt.alamat, &pt.sig, batas).await?;
    if !db::tandai_cabut_ditandatangani(&mut *tx, id).await? {
        drop(tx);
        return Err(galat_status(&n, id, "MENUNGGU_TTD").await);
    }
    db::audit(
        &mut *tx,
        &p.did,
        "cabut.setujui",
        &id.to_string(),
        json!({ "penanda_tangan": ke_hex(&pt.alamat) }),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(
        json!({ "id": id, "status": "DITANDATANGANI", "penanda_tangan": ke_hex(&pt.alamat) }),
    ))
}

/// `POST /api/cabut/{id}/selesai`: cocokkan event `Dicabut` lalu tutup permintaan.
pub async fn selesai(
    State(n): State<Negara>,
    p: Pengguna,
    Path(id): Path<String>,
    JsonMasuk(b): JsonMasuk<CatatTx>,
) -> Result<Json<Value>, Galat> {
    p.wajib_operator()?;
    let id = id_dari(&id)?;
    db::cek_batas(&n.db, &p.did).await?;
    let c = ambil(&n, id).await?;
    let r = receipt_sukses(&n, &b.tx_hash).await?;
    let token = u64::try_from(c.token_id)
        .map_err(|_| Galat::Internal("token_id tersimpan negatif".into()))?;
    if !rantai::event_cabut(&r, &n.domain.kontrak).contains(&token) {
        return Err(Galat::InputTidakValid(format!(
            "transaksi tidak mencabut token {token} di kontrak PUSAKA"
        )));
    }
    let mut tx = n.db.begin().await?;
    if !db::selesaikan_cabut(&mut tx, id, c.token_id).await? {
        drop(tx);
        return Err(galat_status(&n, id, "MENUNGGU_TTD atau DITANDATANGANI").await);
    }
    db::audit(
        &mut *tx,
        &p.did,
        "cabut.selesai",
        &id.to_string(),
        json!({ "tx_hash": b.tx_hash.trim() }),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(
        json!({ "id": id, "status": "SELESAI", "token_id": token }),
    ))
}
