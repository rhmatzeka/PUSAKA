use axum::Json;
use axum::extract::State;
use pusaka_core::heks;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::auth::Pengguna;
use crate::db;
use crate::galat::Galat;
use crate::masukan::JsonMasuk;
use crate::negara::Negara;
use crate::rantai;

#[derive(Deserialize)]
pub struct CatatTx {
    pub tx_hash: String,
}

/// Ambil receipt yang sukses; galat yang jelas bila belum ditambang atau revert.
pub(crate) async fn receipt_sukses(
    n: &Negara,
    tx_hash: &str,
) -> Result<crate::layanan::Receipt, Galat> {
    let tx = heks::dari_hex32(tx_hash)
        .map_err(|_| Galat::InputTidakValid("tx_hash harus 32 byte hex".into()))?;
    let r = n.rantai.receipt(tx).await?.ok_or_else(|| {
        Galat::StatusTidakSesuai("transaksi belum dikonfirmasi; coba lagi sebentar".into())
    })?;
    if !r.sukses {
        return Err(Galat::InputTidakValid(
            "transaksi gagal (revert) di blockchain".into(),
        ));
    }
    Ok(r)
}

/// `POST /api/terbit`: baca receipt `terbitkan`/`terbitkanBatch`, tandai draf TERBIT.
pub async fn catat(
    State(n): State<Negara>,
    p: Pengguna,
    JsonMasuk(b): JsonMasuk<CatatTx>,
) -> Result<Json<Value>, Galat> {
    p.wajib_operator()?;
    db::cek_batas(&n.db, &p.did).await?;
    let r = receipt_sukses(&n, &b.tx_hash).await?;
    let event = rantai::event_terbit(&r, &n.domain.kontrak);
    if event.is_empty() {
        return Err(Galat::InputTidakValid(
            "transaksi tidak memuat event Diterbitkan dari kontrak PUSAKA".into(),
        ));
    }
    let mut tx = n.db.begin().await?;
    let mut terbit = Vec::with_capacity(event.len());
    let mut tidak_dikenal = 0usize;
    for e in &event {
        let token = i64::try_from(e.token_id)
            .map_err(|_| Galat::Internal("token_id melebihi i64".into()))?;
        match db::tandai_terbit(&mut *tx, &e.doc_hash, token).await? {
            Some((id, penerima)) => {
                if penerima != heks::ke_hex(&e.penerima) {
                    tracing::warn!(%id, %penerima, "penerima on-chain berbeda dengan draf");
                }
                terbit.push(json!({ "id": id, "token_id": e.token_id }));
            }
            None => tidak_dikenal += 1,
        }
    }
    db::audit(
        &mut *tx,
        &p.did,
        "draf.terbit",
        b.tx_hash.trim(),
        json!({ "jumlah": terbit.len(), "tidak_dikenal": tidak_dikenal }),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(
        json!({ "terbit": terbit, "tidak_dikenal": tidak_dikenal }),
    ))
}
