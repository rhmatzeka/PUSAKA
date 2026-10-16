use std::collections::HashMap;

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use pusaka_core::eip712::{self, Penerbitan};
use pusaka_core::hash::keccak256;
use pusaka_core::heks::{self, ke_hex};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::auth::Pengguna;
use crate::db::{self, BarisDraf};
use crate::galat::Galat;
use crate::kunci;
use crate::masukan::{JsonMasuk, QueryMasuk, id_dari};
use crate::negara::Negara;
use crate::rute::ttd::{self as ttd_rute, Persetujuan};
use crate::validasi::{self, DrafBaru, DrafSah};

pub const MAKS_BATCH: usize = 50;

#[derive(Deserialize)]
pub struct BuatDraf {
    draf: Vec<DrafBaru>,
}

#[derive(Deserialize)]
pub struct KueriDaftar {
    status: Option<String>,
    cari: Option<String>,
    halaman: Option<i64>,
}

#[derive(Deserialize)]
pub struct Tolak {
    alasan: String,
}

/// 404 bila draf tidak ada, 409 bila statusnya bukan `harus`.
pub(crate) async fn galat_status(n: &Negara, id: Uuid, harus: &str) -> Galat {
    match db::status_draf(&n.db, id).await {
        Ok(Some(s)) => Galat::StatusTidakSesuai(format!("draf berstatus {s}, harus {harus}")),
        Ok(None) => Galat::TidakDitemukan("draf tidak ditemukan".into()),
        Err(e) => e,
    }
}

/// `POST /api/draf`: 1..50 draf; wallet alumni diambil/dibuat lewat Privy sebelum menyimpan.
pub async fn buat(
    State(n): State<Negara>,
    p: Pengguna,
    JsonMasuk(b): JsonMasuk<BuatDraf>,
) -> Result<(StatusCode, Json<Value>), Galat> {
    p.wajib_operator()?;
    if b.draf.is_empty() || b.draf.len() > MAKS_BATCH {
        return Err(Galat::InputTidakValid(format!(
            "jumlah draf harus 1–{MAKS_BATCH}"
        )));
    }
    let sah: Vec<DrafSah> = b
        .draf
        .iter()
        .enumerate()
        .map(|(i, d)| validasi::sahkan(d).map_err(|e| format!("draf[{i}]: {e}")))
        .collect::<Result<_, _>>()
        .map_err(Galat::InputTidakValid)?;
    let mut dilihat = HashMap::new();
    for (i, d) in sah.iter().enumerate() {
        if let Some(j) = dilihat.insert(d.doc_hash, i) {
            return Err(Galat::InputTidakValid(format!(
                "draf[{i}]: doc_hash sama dengan draf[{j}]"
            )));
        }
    }
    db::cek_batas(&n.db, &p.did).await?;
    // Tolak doc_hash yang sudah terdaftar sebelum membuat akun Privy apa pun.
    let semua: Vec<[u8; 32]> = sah.iter().map(|d| d.doc_hash).collect();
    if let Some(h) = db::doc_hash_terdaftar(&n.db, &semua).await? {
        return Err(Galat::Konflik(format!(
            "doc_hash {} sudah pernah didaftarkan",
            ke_hex(&h)
        )));
    }

    let mut penerima = Vec::with_capacity(sah.len());
    for d in &sah {
        penerima.push(n.privy.wallet_alumni(&d.email).await?);
    }

    let mut tx = n.db.begin().await?;
    let mut hasil = Vec::with_capacity(sah.len());
    for (d, w) in sah.iter().zip(&penerima) {
        let id = Uuid::new_v4();
        db::sisip_draf(&mut *tx, id, d, w, &p.did).await?;
        db::simpan_kunci(
            &mut *tx,
            id,
            &kunci::bungkus(&n.kunci_master, id, &d.kunci)?,
        )
        .await?;
        hasil.push(json!({ "id": id, "penerima": ke_hex(w) }));
    }
    db::audit(
        &mut *tx,
        &p.did,
        "draf.buat",
        "",
        json!({ "jumlah": hasil.len() }),
    )
    .await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "draf": hasil }))))
}

/// `GET /api/draf?status=&cari=&halaman=`
pub async fn daftar(
    State(n): State<Negara>,
    p: Pengguna,
    QueryMasuk(q): QueryMasuk<KueriDaftar>,
) -> Result<Json<Value>, Galat> {
    p.wajib_operator_atau_penandatangan()?;
    db::kedaluwarsakan(&n.db).await?;
    if let Some(s) = &q.status
        && !db::STATUS_DRAF.contains(&s.as_str())
    {
        return Err(Galat::InputTidakValid(format!(
            "status harus salah satu dari {}",
            db::STATUS_DRAF.join(", ")
        )));
    }
    let halaman = q.halaman.unwrap_or(1);
    if !(1..=10_000).contains(&halaman) {
        return Err(Galat::InputTidakValid("halaman harus 1–10000".into()));
    }
    let cari = q.cari.as_deref().map(str::trim).filter(|c| !c.is_empty());
    let h = db::daftar_draf(&n.db, q.status.as_deref(), cari, halaman).await?;
    Ok(Json(json!({
        "data": h.data.iter().map(BarisDraf::ke_json).collect::<Vec<_>>(),
        "halaman": halaman,
        "per_halaman": db::PER_HALAMAN,
        "total": h.total,
    })))
}

/// `GET /api/draf/{id}`: detail + kunci AES untuk pratinjau.
pub async fn detail(
    State(n): State<Negara>,
    p: Pengguna,
    Path(id): Path<String>,
) -> Result<Json<Value>, Galat> {
    p.wajib_operator_atau_penandatangan()?;
    p.wajib_peran_langsung(&n).await?;
    db::kedaluwarsakan(&n.db).await?;
    let id = id_dari(&id)?;
    let d = db::ambil_draf(&n.db, id)
        .await?
        .ok_or_else(|| Galat::TidakDitemukan("draf tidak ditemukan".into()))?;
    let bungkus = db::ambil_kunci(&n.db, id)
        .await?
        .ok_or_else(|| Galat::Internal("kunci draf hilang".into()))?;
    let k = kunci::buka(&n.kunci_master, id, &bungkus)?;
    db::audit(&n.db, &p.did, "draf.lihat", &id.to_string(), json!({})).await?;
    let mut v = d.ke_json();
    v["kunci"] = json!(ke_hex(&k));
    Ok(Json(v))
}

/// `POST /api/draf/{id}/tolak`
pub async fn tolak(
    State(n): State<Negara>,
    p: Pengguna,
    Path(id): Path<String>,
    JsonMasuk(b): JsonMasuk<Tolak>,
) -> Result<Json<Value>, Galat> {
    p.wajib_penandatangan()?;
    let id = id_dari(&id)?;
    let alasan = validasi::alasan(&b.alasan).map_err(Galat::InputTidakValid)?;
    db::cek_batas(&n.db, &p.did).await?;
    db::kedaluwarsakan(&n.db).await?;
    let mut tx = n.db.begin().await?;
    if !db::tolak_draf(&mut *tx, id, &alasan).await? {
        drop(tx);
        return Err(galat_status(&n, id, "MENUNGGU_TTD").await);
    }
    db::audit(
        &mut *tx,
        &p.did,
        "draf.tolak",
        &id.to_string(),
        json!({ "alasan": alasan }),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "id": id, "status": "DITOLAK" })))
}

/// `POST /api/draf/{id}/kirim-ulang`: isi baru untuk draf DITOLAK.
pub async fn kirim_ulang(
    State(n): State<Negara>,
    p: Pengguna,
    Path(id): Path<String>,
    JsonMasuk(b): JsonMasuk<DrafBaru>,
) -> Result<Json<Value>, Galat> {
    p.wajib_operator()?;
    let id = id_dari(&id)?;
    let d = validasi::sahkan(&b).map_err(Galat::InputTidakValid)?;
    db::cek_batas(&n.db, &p.did).await?;
    let penerima = n.privy.wallet_alumni(&d.email).await?;
    let mut tx = n.db.begin().await?;
    if !db::perbaiki_draf(&mut *tx, id, &d, &penerima).await? {
        drop(tx);
        return Err(galat_status(&n, id, "DITOLAK").await);
    }
    db::simpan_kunci(
        &mut *tx,
        id,
        &kunci::bungkus(&n.kunci_master, id, &d.kunci)?,
    )
    .await?;
    db::audit(
        &mut *tx,
        &p.did,
        "draf.kirim_ulang",
        &id.to_string(),
        json!({}),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(
        json!({ "id": id, "status": "MENUNGGU_TTD", "penerima": ke_hex(&penerima) }),
    ))
}

/// `POST /api/draf/{id}/setujui`: tanda tangan EIP-712 `Penerbitan` dari pejabat.
pub async fn setujui(
    State(n): State<Negara>,
    p: Pengguna,
    Path(id): Path<String>,
    JsonMasuk(b): JsonMasuk<Persetujuan>,
) -> Result<Json<Value>, Galat> {
    p.wajib_penandatangan()?;
    let id = id_dari(&id)?;
    let batas = ttd_rute::cek_batas_waktu(b.batas_waktu, ttd_rute::sekarang())?;
    db::cek_batas(&n.db, &p.did).await?;
    db::kedaluwarsakan(&n.db).await?;
    let d = db::ambil_draf(&n.db, id)
        .await?
        .ok_or_else(|| Galat::TidakDitemukan("draf tidak ditemukan".into()))?;
    if d.status != "MENUNGGU_TTD" {
        return Err(Galat::StatusTidakSesuai(format!(
            "draf berstatus {}, harus MENUNGGU_TTD",
            d.status
        )));
    }
    let penerbitan = Penerbitan {
        penerima: heks::alamat(&d.penerima)
            .map_err(|_| Galat::Internal("penerima tersimpan rusak".into()))?,
        doc_hash: d.doc_hash32()?,
        metadata_hash: keccak256(d.uri.as_bytes()),
        batas_waktu: b.batas_waktu,
    };
    let digest = eip712::digest_penerbitan(&n.domain, &penerbitan);
    let pt = ttd_rute::pulihkan(&n, &p, &digest, &b.sig).await?;

    let mut tx = n.db.begin().await?;
    db::sisip_ttd(&mut *tx, "penerbitan", id, &pt.alamat, &pt.sig, batas).await?;
    if !db::tandai_draf_ditandatangani(&mut *tx, id).await? {
        drop(tx);
        return Err(galat_status(&n, id, "MENUNGGU_TTD").await);
    }
    db::audit(
        &mut *tx,
        &p.did,
        "draf.setujui",
        &id.to_string(),
        json!({ "penanda_tangan": ke_hex(&pt.alamat) }),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(
        json!({ "id": id, "status": "DITANDATANGANI", "penanda_tangan": ke_hex(&pt.alamat) }),
    ))
}
