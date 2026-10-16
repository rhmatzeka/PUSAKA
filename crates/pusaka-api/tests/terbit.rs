mod bantu;

use axum::http::StatusCode;
use bantu::*;
use pusaka_api::layanan::Receipt;
use pusaka_core::hash::keccak256;
use pusaka_core::heks::{dari_hex32, ke_hex};
use serde_json::{Value, json};
use sqlx::PgPool;

fn doc(d: &Value) -> [u8; 32] {
    dari_hex32(d["doc_hash"].as_str().unwrap()).unwrap()
}

async fn catat(u: &Uji, tx: [u8; 32]) -> (StatusCode, Value) {
    panggil(
        &u.app,
        "POST",
        "/api/terbit",
        Some(&token(DID_OPERATOR)),
        Some(json!({ "tx_hash": ke_hex(&tx) })),
    )
    .await
}

async fn status(u: &Uji, d: &Value) -> Value {
    let (_, b) = panggil(
        &u.app,
        "GET",
        &format!("/api/draf/{}", d["id"].as_str().unwrap()),
        Some(&token(DID_OPERATOR)),
        None,
    )
    .await;
    b
}

#[sqlx::test(migrations = "../../migrations")]
async fn batch_terbit_menandai_semua_draf(pool: PgPool) {
    let u = siapkan(pool);
    let d1 = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    let d2 = buat_draf(&u, contoh_draf(2, "dua@unpam.ac.id")).await;
    assert_eq!(setujui(&u, &d1).await.0, StatusCode::OK);
    assert_eq!(setujui(&u, &d2).await.0, StatusCode::OK);
    let tx = keccak256(b"tx-batch");
    u.rantai.pasang_receipt(
        tx,
        Receipt {
            sukses: true,
            log: vec![
                log_diterbitkan(1, alamat_alumni(EMAIL_ALUMNI), doc(&d1)),
                log_diterbitkan(2, alamat_alumni("dua@unpam.ac.id"), doc(&d2)),
            ],
        },
    );
    let (s, b) = catat(&u, tx).await;
    assert_eq!(s, StatusCode::OK, "{b}");
    assert_eq!(b["terbit"].as_array().unwrap().len(), 2);
    assert_eq!(b["tidak_dikenal"], 0);
    let s1 = status(&u, &d1).await;
    assert_eq!(s1["status"], "TERBIT");
    assert_eq!(s1["token_id"], 1);
    assert_eq!(status(&u, &d2).await["token_id"], 2);

    let (s, b2) = catat(&u, tx).await;
    assert_eq!(s, StatusCode::OK, "idempoten");
    assert_eq!(b2["terbit"], b["terbit"]);
}

#[sqlx::test(migrations = "../../migrations")]
async fn event_kontrak_lain_diabaikan(pool: PgPool) {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    assert_eq!(setujui(&u, &d).await.0, StatusCode::OK);
    let mut palsu = log_diterbitkan(1, alamat_alumni(EMAIL_ALUMNI), doc(&d));
    palsu.alamat = a(TAMU);
    let tx = keccak256(b"tx-palsu");
    u.rantai.pasang_receipt(
        tx,
        Receipt {
            sukses: true,
            log: vec![palsu],
        },
    );
    let (s, b) = catat(&u, tx).await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "{b}");
    assert_eq!(status(&u, &d).await["status"], "DITANDATANGANI");
}

#[sqlx::test(migrations = "../../migrations")]
async fn transaksi_belum_ada_gagal_atau_tanpa_event(pool: PgPool) {
    let u = siapkan(pool);
    let (s, b) = catat(&u, [9; 32]).await;
    assert_eq!(s, StatusCode::CONFLICT);
    assert_eq!(b["kode"], "STATUS_TIDAK_SESUAI");
    u.rantai.pasang_receipt(
        [8; 32],
        Receipt {
            sukses: false,
            log: vec![],
        },
    );
    assert_eq!(catat(&u, [8; 32]).await.0, StatusCode::BAD_REQUEST);
    u.rantai.pasang_receipt(
        [7; 32],
        Receipt {
            sukses: true,
            log: vec![],
        },
    );
    assert_eq!(catat(&u, [7; 32]).await.0, StatusCode::BAD_REQUEST);
}

#[sqlx::test(migrations = "../../migrations")]
async fn doc_hash_tak_dikenal_dihitung(pool: PgPool) {
    let u = siapkan(pool);
    let tx = keccak256(b"tx-asing");
    u.rantai.pasang_receipt(
        tx,
        Receipt {
            sukses: true,
            log: vec![log_diterbitkan(5, a(TAMU), [5; 32])],
        },
    );
    let (s, b) = catat(&u, tx).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(b, json!({ "terbit": [], "tidak_dikenal": 1 }));
}

#[sqlx::test(migrations = "../../migrations")]
async fn masukan_dan_peran_divalidasi(pool: PgPool) {
    let u = siapkan(pool);
    let (s, _) = panggil(
        &u.app,
        "POST",
        "/api/terbit",
        Some(&token(DID_OPERATOR)),
        Some(json!({ "tx_hash": "0x12" })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = panggil(
        &u.app,
        "POST",
        "/api/terbit",
        Some(&token(DID_REKTOR)),
        Some(json!({ "tx_hash": ke_hex(&[1; 32]) })),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}
