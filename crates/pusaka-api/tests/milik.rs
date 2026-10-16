mod bantu;

use axum::http::StatusCode;
use bantu::*;
use serde_json::json;
use sqlx::PgPool;

#[sqlx::test(migrations = "../../migrations")]
async fn alumni_melihat_ijazah_miliknya_saja(pool: PgPool) {
    let u = siapkan(pool);
    let milik = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    terbitkan(&u, &milik, 1).await;
    let lain = buat_draf(&u, contoh_draf(2, "orang.lain@unpam.ac.id")).await;
    terbitkan(&u, &lain, 2).await;
    buat_draf(&u, contoh_draf(3, EMAIL_ALUMNI)).await; // belum terbit: tidak ikut

    let (s, b) = panggil(&u.app, "GET", "/api/milik", Some(&token(DID_ALUMNI)), None).await;
    assert_eq!(s, StatusCode::OK, "{b}");
    assert_eq!(
        b,
        json!({ "data": [{
            "token_id": 1, "status": "TERBIT", "nama": "Lulusan 1", "nomor_ijazah": "UNPAM/2027/0001",
            "prodi": "Teknik Informatika", "gelar": "S.Kom.", "tanggal_lulus": "2027-08-30"
        }] })
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn pengguna_tanpa_ijazah_dapat_daftar_kosong(pool: PgPool) {
    let u = siapkan(pool);
    let (s, b) = panggil(&u.app, "GET", "/api/milik", Some(&token(DID_TAMU)), None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(b, json!({ "data": [] }));
    let (s, _) = panggil(&u.app, "GET", "/api/milik", None, None).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
}
