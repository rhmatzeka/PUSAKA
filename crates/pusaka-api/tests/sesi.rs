mod bantu;

use std::sync::atomic::Ordering;

use axum::http::StatusCode;
use bantu::*;
use serde_json::json;

#[tokio::test]
async fn tanpa_token_401() {
    let u = siapkan(pool_malas());
    let (s, b) = panggil(&u.app, "GET", "/api/sesi", None, None).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
    assert_eq!(b["kode"], "TIDAK_TERAUTENTIKASI");
}

#[tokio::test]
async fn token_dipalsukan_kedaluwarsa_atau_salah_klaim_401() {
    let u = siapkan(pool_malas());
    let salah = [
        token_khusus(DID_OPERATOR, APP_ID, "privy.io", 600, KUNCI_JWT_LAIN),
        token_khusus(DID_OPERATOR, APP_ID, "privy.io", -120, KUNCI_JWT),
        token_khusus(DID_OPERATOR, "app-lain", "privy.io", 600, KUNCI_JWT),
        token_khusus(DID_OPERATOR, APP_ID, "penipu.io", 600, KUNCI_JWT),
        "bukan.jwt.sama-sekali".to_owned(),
    ];
    for t in salah {
        let (s, b) = panggil(&u.app, "GET", "/api/sesi", Some(&t), None).await;
        assert_eq!(s, StatusCode::UNAUTHORIZED, "{t}");
        assert_eq!(b["kode"], "TIDAK_TERAUTENTIKASI");
    }
}

#[tokio::test]
async fn sesi_menampilkan_wallet_dan_peran() {
    let u = siapkan(pool_malas());
    let (s, b) = panggil(&u.app, "GET", "/api/sesi", Some(&token(DID_OPERATOR)), None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(
        b,
        json!({ "did": DID_OPERATOR, "wallet": [OPERATOR],
                "peran": { "admin": false, "operator": true, "penandatangan": false } })
    );
    let (_, b) = panggil(&u.app, "GET", "/api/sesi", Some(&token(DID_REKTOR)), None).await;
    assert_eq!(b["peran"]["penandatangan"], true);
    let (_, b) = panggil(&u.app, "GET", "/api/sesi", Some(&token(DID_TAMU)), None).await;
    assert_eq!(
        b["peran"],
        json!({ "admin": false, "operator": false, "penandatangan": false })
    );
}

#[tokio::test]
async fn sesi_di_cache_lima_menit() {
    let u = siapkan(pool_malas());
    let t = token(DID_OPERATOR);
    panggil(&u.app, "GET", "/api/sesi", Some(&t), None).await;
    assert_eq!(u.rantai.panggilan_peran.load(Ordering::SeqCst), 3);
    panggil(&u.app, "GET", "/api/sesi", Some(&t), None).await;
    assert_eq!(u.rantai.panggilan_peran.load(Ordering::SeqCst), 3);
}
