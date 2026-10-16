mod bantu;

use axum::http::StatusCode;
use bantu::*;
use pusaka_api::rantai::peran_penandatangan;
use serde_json::{Value, json};
use sqlx::PgPool;

fn uri(d: &Value) -> String {
    format!("/api/draf/{}/setujui", d["id"].as_str().unwrap())
}

async fn jumlah_ttd(u: &Uji) -> i64 {
    sqlx::query_scalar("select count(*) from tanda_tangan")
        .fetch_one(&u.db)
        .await
        .unwrap()
}

#[sqlx::test(migrations = "../../migrations")]
async fn rektor_menyetujui_dengan_tanda_tangan_sah(pool: PgPool) {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    let batas = sekarang() + 86_400;
    let sig = ttd_penerbitan(KUNCI_REKTOR, &d, batas);
    let (s, b) = panggil(
        &u.app,
        "POST",
        &uri(&d),
        Some(&token(DID_REKTOR)),
        Some(json!({ "sig": sig, "batas_waktu": batas })),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{b}");
    assert_eq!(b["penanda_tangan"], REKTOR);

    let (_, l) = panggil(
        &u.app,
        "GET",
        "/api/draf?status=DITANDATANGANI",
        Some(&token(DID_OPERATOR)),
        None,
    )
    .await;
    assert_eq!(l["total"], 1);
    assert_eq!(
        l["data"][0]["ttd"],
        json!({ "penanda_tangan": REKTOR, "sig": sig, "batas_waktu": batas })
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn hanya_pejabat_yang_boleh_menyetujui(pool: PgPool) {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    let batas = sekarang() + 86_400;
    let sig = ttd_penerbitan(KUNCI_OPERATOR, &d, batas);
    let (s, _) = panggil(
        &u.app,
        "POST",
        &uri(&d),
        Some(&token(DID_OPERATOR)),
        Some(json!({ "sig": sig, "batas_waktu": batas })),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}

#[sqlx::test(migrations = "../../migrations")]
async fn tanda_tangan_wallet_orang_lain_ditolak(pool: PgPool) {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    let batas = sekarang() + 86_400;
    // Rektor login, tetapi tanda tangan dibuat kunci operator.
    let sig = ttd_penerbitan(KUNCI_OPERATOR, &d, batas);
    let (s, b) = panggil(
        &u.app,
        "POST",
        &uri(&d),
        Some(&token(DID_REKTOR)),
        Some(json!({ "sig": sig, "batas_waktu": batas })),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    assert!(
        b["pesan"].as_str().unwrap().contains("bukan wallet Anda"),
        "{b}"
    );
    assert_eq!(jumlah_ttd(&u).await, 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn tanda_tangan_atas_batas_waktu_lain_ditolak(pool: PgPool) {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    let batas = sekarang() + 86_400;
    let sig = ttd_penerbitan(KUNCI_REKTOR, &d, batas);
    let (s, _) = panggil(
        &u.app,
        "POST",
        &uri(&d),
        Some(&token(DID_REKTOR)),
        Some(json!({ "sig": sig, "batas_waktu": batas + 1 })),
    )
    .await;
    assert_eq!(
        s,
        StatusCode::FORBIDDEN,
        "alamat hasil pemulihan berubah → bukan wallet rektor"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn peran_dicabut_saat_cache_tetap_ditolak(pool: PgPool) {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    panggil(&u.app, "GET", "/api/sesi", Some(&token(DID_REKTOR)), None).await;
    u.rantai.cabut_peran(peran_penandatangan(), a(REKTOR));
    let (s, b) = setujui(&u, &d).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    assert!(
        b["pesan"].as_str().unwrap().contains("PENANDATANGAN_ROLE"),
        "{b}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn sig_dan_batas_waktu_divalidasi(pool: PgPool) {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    let t = token(DID_REKTOR);
    let kini = sekarang();
    let s_tinggi = format!(
        "0x{}{}1c",
        "00".repeat(31) + "01",
        "a7244fb1322d0e8f18cf3a7ec5b6338d06b239c5ce45c3158c78bd2e8ff1b193"
    );
    let kasus = [
        json!({ "sig": "bukan-hex", "batas_waktu": kini + 3600 }),
        json!({ "sig": "0x1234", "batas_waktu": kini + 3600 }),
        json!({ "sig": s_tinggi, "batas_waktu": kini + 3600 }),
        json!({ "sig": ttd_penerbitan(KUNCI_REKTOR, &d, kini - 10), "batas_waktu": kini - 10 }),
        json!({ "sig": ttd_penerbitan(KUNCI_REKTOR, &d, kini + 31 * 86_400), "batas_waktu": kini + 31 * 86_400 }),
        json!({ "batas_waktu": kini + 3600 }),
    ];
    for badan in kasus {
        let (s, b) = panggil(&u.app, "POST", &uri(&d), Some(&t), Some(badan.clone())).await;
        assert_eq!(s, StatusCode::BAD_REQUEST, "{badan} → {b}");
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn hanya_draf_menunggu_yang_bisa_disetujui(pool: PgPool) {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    assert_eq!(setujui(&u, &d).await.0, StatusCode::OK);
    let (s, b) = setujui(&u, &d).await;
    assert_eq!(s, StatusCode::CONFLICT);
    assert_eq!(b["kode"], "STATUS_TIDAK_SESUAI");
    let (s, _) = panggil(
        &u.app,
        "POST",
        "/api/draf/67e55044-10b1-426f-9247-bb680e5fe0c8/setujui",
        Some(&token(DID_REKTOR)),
        Some(json!({ "sig": "0x00", "batas_waktu": sekarang() + 3600 })),
    )
    .await;
    assert_eq!(s, StatusCode::NOT_FOUND);
}

#[sqlx::test(migrations = "../../migrations")]
async fn setujui_bersamaan_hanya_satu(pool: PgPool) {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    let batas = sekarang() + 86_400;
    let badan = json!({ "sig": ttd_penerbitan(KUNCI_REKTOR, &d, batas), "batas_waktu": batas });
    let t = token(DID_REKTOR);
    let u1 = uri(&d);
    let (a1, a2) = tokio::join!(
        panggil(&u.app, "POST", &u1, Some(&t), Some(badan.clone())),
        panggil(&u.app, "POST", &u1, Some(&t), Some(badan)),
    );
    let mut status = [a1.0.as_u16(), a2.0.as_u16()];
    status.sort_unstable();
    assert_eq!(status, [200, 409]);
    assert_eq!(jumlah_ttd(&u).await, 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn tanda_tangan_kedaluwarsa_mengembalikan_draf(pool: PgPool) {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    assert_eq!(setujui(&u, &d).await.0, StatusCode::OK);
    sqlx::query("update tanda_tangan set batas_waktu = now() - interval '1 second'")
        .execute(&u.db)
        .await
        .unwrap();
    let (_, l) = panggil(
        &u.app,
        "GET",
        "/api/draf?status=MENUNGGU_TTD",
        Some(&token(DID_REKTOR)),
        None,
    )
    .await;
    assert_eq!(l["total"], 1);
    assert_eq!(l["data"][0]["ttd"], Value::Null);
    assert_eq!(
        setujui(&u, &d).await.0,
        StatusCode::OK,
        "bisa ditandatangani ulang"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn setujui_dan_tolak_langsung_setelah_kedaluwarsa(pool: PgPool) {
    let u = siapkan(pool);
    let d1 = buat_draf(&u, contoh_draf(1, EMAIL_ALUMNI)).await;
    let d2 = buat_draf(&u, contoh_draf(2, EMAIL_ALUMNI)).await;
    assert_eq!(setujui(&u, &d1).await.0, StatusCode::OK);
    assert_eq!(setujui(&u, &d2).await.0, StatusCode::OK);
    sqlx::query("update tanda_tangan set batas_waktu = now() - interval '1 second'")
        .execute(&u.db)
        .await
        .unwrap();
    // Tanpa GET daftar/detail lebih dulu.
    assert_eq!(setujui(&u, &d1).await.0, StatusCode::OK);
    let tolak = format!("/api/draf/{}/tolak", d2["id"].as_str().unwrap());
    let (s, b) = panggil(
        &u.app,
        "POST",
        &tolak,
        Some(&token(DID_REKTOR)),
        Some(json!({ "alasan": "data salah" })),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{b}");
}
