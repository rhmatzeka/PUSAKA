mod bantu;

use axum::http::StatusCode;
use bantu::*;
use pusaka_core::heks::ke_hex;
use sqlx::PgPool;

async fn siap(pool: PgPool) -> Uji {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(4, EMAIL_ALUMNI)).await;
    terbitkan(&u, &d, 1).await;
    u
}

#[sqlx::test(migrations = "../../migrations")]
async fn alumni_mendapat_kunci_ijazahnya(pool: PgPool) {
    let u = siap(pool).await;
    let (s, b) = panggil(
        &u.app,
        "GET",
        "/api/kunci/1",
        Some(&token(DID_ALUMNI)),
        None,
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{b}");
    assert_eq!(b["kunci"], ke_hex(&[4; 32]));
    assert_eq!(b["status"], "TERBIT");
}

#[sqlx::test(migrations = "../../migrations")]
async fn operator_juga_boleh(pool: PgPool) {
    let u = siap(pool).await;
    let (s, _) = panggil(
        &u.app,
        "GET",
        "/api/kunci/1",
        Some(&token(DID_OPERATOR)),
        None,
    )
    .await;
    assert_eq!(s, StatusCode::OK);
}

#[sqlx::test(migrations = "../../migrations")]
async fn tamu_tidak_dapat_kunci(pool: PgPool) {
    let u = siap(pool).await;
    for did in [DID_TAMU, DID_REKTOR] {
        let (s, b) = panggil(&u.app, "GET", "/api/kunci/1", Some(&token(did)), None).await;
        assert_eq!(s, StatusCode::FORBIDDEN);
        assert!(b.get("kunci").is_none());
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn token_salah_atau_tak_ada(pool: PgPool) {
    let u = siap(pool).await;
    let (s, _) = panggil(
        &u.app,
        "GET",
        "/api/kunci/2",
        Some(&token(DID_ALUMNI)),
        None,
    )
    .await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    let (s, _) = panggil(
        &u.app,
        "GET",
        "/api/kunci/abc",
        Some(&token(DID_ALUMNI)),
        None,
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = panggil(&u.app, "GET", "/api/kunci/1", None, None).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
}

#[sqlx::test(migrations = "../../migrations")]
async fn operator_dicabut_tidak_bisa_membaca_kunci(pool: PgPool) {
    use pusaka_api::rantai::peran_operator;
    let u = siap(pool).await;
    let t = token(DID_OPERATOR);
    assert_eq!(
        panggil(&u.app, "GET", "/api/sesi", Some(&t), None).await.0,
        StatusCode::OK
    );
    u.rantai.cabut_peran(peran_operator(), a(OPERATOR));
    let (s, b) = panggil(&u.app, "GET", "/api/kunci/1", Some(&t), None).await;
    assert_eq!(s, StatusCode::FORBIDDEN, "{b}");
    let id: uuid::Uuid = sqlx::query_scalar("select id from draf limit 1")
        .fetch_one(&u.db)
        .await
        .unwrap();
    let (s, b) = panggil(&u.app, "GET", &format!("/api/draf/{id}"), Some(&t), None).await;
    assert_eq!(s, StatusCode::FORBIDDEN, "{b}");
    assert!(b.get("kunci").is_none());
}
