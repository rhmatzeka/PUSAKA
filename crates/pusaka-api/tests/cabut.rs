mod bantu;

use axum::http::StatusCode;
use bantu::*;
use pusaka_api::layanan::Receipt;
use pusaka_core::hash::keccak256;
use pusaka_core::heks::ke_hex;
use serde_json::{Value, json};
use sqlx::PgPool;

const ALASAN: &str = "salah nama ibu";

async fn ijazah_terbit(u: &Uji) -> Value {
    let d = buat_draf(u, contoh_draf(1, EMAIL_ALUMNI)).await;
    terbitkan(u, &d, 1).await;
    d
}

async fn minta_cabut(u: &Uji, token_id: u64) -> (StatusCode, Value) {
    panggil(
        &u.app,
        "POST",
        "/api/cabut",
        Some(&token(DID_OPERATOR)),
        Some(json!({ "token_id": token_id, "alasan": format!("  {ALASAN} ") })),
    )
    .await
}

async fn setujui_cabut(u: &Uji, id: &str) -> (StatusCode, Value) {
    let batas = sekarang() + 3600;
    let sig = ttd_pencabutan(KUNCI_REKTOR, 1, ALASAN, batas);
    panggil(
        &u.app,
        "POST",
        &format!("/api/cabut/{id}/setujui"),
        Some(&token(DID_REKTOR)),
        Some(json!({ "sig": sig, "batas_waktu": batas })),
    )
    .await
}

#[sqlx::test(migrations = "../../migrations")]
async fn alur_cabut_lengkap(pool: PgPool) {
    let u = siapkan(pool);
    let d = ijazah_terbit(&u).await;

    let (s, b) = minta_cabut(&u, 1).await;
    assert_eq!(s, StatusCode::CREATED, "{b}");
    let id = b["id"].as_str().unwrap().to_owned();
    assert_eq!(
        minta_cabut(&u, 1).await.0,
        StatusCode::CONFLICT,
        "satu permintaan aktif per token"
    );

    let (_, l) = panggil(
        &u.app,
        "GET",
        "/api/cabut?status=MENUNGGU_TTD",
        Some(&token(DID_REKTOR)),
        None,
    )
    .await;
    assert_eq!(l["data"][0]["alasan"], ALASAN);
    assert_eq!(
        l["data"][0]["alasan_hash"],
        ke_hex(&keccak256(ALASAN.as_bytes()))
    );
    assert_eq!(l["data"][0]["nim"], "21110001");

    let (s, b) = setujui_cabut(&u, &id).await;
    assert_eq!(s, StatusCode::OK, "{b}");
    let (_, l) = panggil(
        &u.app,
        "GET",
        "/api/cabut?status=DITANDATANGANI",
        Some(&token(DID_OPERATOR)),
        None,
    )
    .await;
    assert_eq!(l["data"][0]["ttd"]["penanda_tangan"], REKTOR);

    let selesai = format!("/api/cabut/{id}/selesai");
    u.rantai.pasang_receipt(
        [3; 32],
        Receipt {
            sukses: true,
            log: vec![log_dicabut(2, ALASAN)],
        },
    );
    let (s, _) = panggil(
        &u.app,
        "POST",
        &selesai,
        Some(&token(DID_OPERATOR)),
        Some(json!({ "tx_hash": ke_hex(&[3; 32]) })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "event untuk token lain");

    let tx = keccak256(b"tx-cabut");
    u.rantai.pasang_receipt(
        tx,
        Receipt {
            sukses: true,
            log: vec![log_dicabut(1, ALASAN)],
        },
    );
    let (s, b) = panggil(
        &u.app,
        "POST",
        &selesai,
        Some(&token(DID_OPERATOR)),
        Some(json!({ "tx_hash": ke_hex(&tx) })),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{b}");

    let (_, dd) = panggil(
        &u.app,
        "GET",
        &format!("/api/draf/{}", d["id"].as_str().unwrap()),
        Some(&token(DID_OPERATOR)),
        None,
    )
    .await;
    assert_eq!(dd["status"], "DICABUT");
    let (_, l) = panggil(
        &u.app,
        "GET",
        "/api/cabut?status=SELESAI",
        Some(&token(DID_OPERATOR)),
        None,
    )
    .await;
    assert_eq!(l["data"].as_array().unwrap().len(), 1);
    assert_eq!(
        minta_cabut(&u, 1).await.0,
        StatusCode::NOT_FOUND,
        "token sudah dicabut"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn token_tak_dikenal_dan_peran_salah(pool: PgPool) {
    let u = siapkan(pool);
    ijazah_terbit(&u).await;
    assert_eq!(minta_cabut(&u, 99).await.0, StatusCode::NOT_FOUND);
    let (s, _) = panggil(
        &u.app,
        "POST",
        "/api/cabut",
        Some(&token(DID_REKTOR)),
        Some(json!({ "token_id": 1, "alasan": ALASAN })),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) = panggil(
        &u.app,
        "POST",
        "/api/cabut",
        Some(&token(DID_OPERATOR)),
        Some(json!({ "token_id": 1, "alasan": "" })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = panggil(
        &u.app,
        "GET",
        "/api/cabut?status=NGAWUR",
        Some(&token(DID_OPERATOR)),
        None,
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
}

#[sqlx::test(migrations = "../../migrations")]
async fn tanda_tangan_cabut_atas_alasan_lain_ditolak(pool: PgPool) {
    let u = siapkan(pool);
    ijazah_terbit(&u).await;
    let (_, b) = minta_cabut(&u, 1).await;
    let id = b["id"].as_str().unwrap();
    let batas = sekarang() + 3600;
    let sig = ttd_pencabutan(KUNCI_REKTOR, 1, "alasan lain", batas);
    let (s, _) = panggil(
        &u.app,
        "POST",
        &format!("/api/cabut/{id}/setujui"),
        Some(&token(DID_REKTOR)),
        Some(json!({ "sig": sig, "batas_waktu": batas })),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    assert_eq!(setujui_cabut(&u, id).await.0, StatusCode::OK);
    assert_eq!(setujui_cabut(&u, id).await.0, StatusCode::CONFLICT);
}
