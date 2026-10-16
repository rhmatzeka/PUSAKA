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
