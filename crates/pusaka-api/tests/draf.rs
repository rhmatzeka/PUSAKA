mod bantu;

use axum::http::StatusCode;
use bantu::*;
use pusaka_core::heks::ke_hex;
use serde_json::json;
use sqlx::PgPool;

async fn jumlah_draf(u: &Uji) -> i64 {
    sqlx::query_scalar("select count(*) from draf")
        .fetch_one(&u.db)
        .await
        .unwrap()
}

#[sqlx::test(migrations = "../../migrations")]
async fn operator_membuat_draf_dengan_wallet_alumni(pool: PgPool) {
    let u = siapkan(pool);
    let badan =
        json!({ "draf": [contoh_draf(1, "Satu@UNPAM.ac.id"), contoh_draf(2, "dua@unpam.ac.id")] });
    let (s, b) = panggil(
        &u.app,
        "POST",
        "/api/draf",
        Some(&token(DID_OPERATOR)),
        Some(badan),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{b}");
    assert_eq!(b["draf"].as_array().unwrap().len(), 2);
    assert_eq!(
        b["draf"][0]["penerima"],
        ke_hex(&alamat_alumni("satu@unpam.ac.id"))
    );

    let id = b["draf"][0]["id"].as_str().unwrap();
    let (s, d) = panggil(
        &u.app,
        "GET",
        &format!("/api/draf/{id}"),
        Some(&token(DID_REKTOR)),
        None,
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(d["status"], "MENUNGGU_TTD");
    assert_eq!(d["email"], "satu@unpam.ac.id");
    assert_eq!(d["kunci"], ke_hex(&[1; 32]));
    assert_eq!(d["ttd"], serde_json::Value::Null);
    assert_eq!(d["dibuat_oleh"], DID_OPERATOR);

    let tersimpan: Vec<u8> =
        sqlx::query_scalar("select kunci_terenkripsi from kunci_ijazah limit 1")
            .fetch_one(&u.db)
            .await
            .unwrap();
    assert_eq!(tersimpan.len(), 60);
}

#[sqlx::test(migrations = "../../migrations")]
async fn hanya_operator_yang_membuat(pool: PgPool) {
    let u = siapkan(pool);
    for did in [DID_REKTOR, DID_TAMU] {
        let (s, _) = panggil(
            &u.app,
            "POST",
            "/api/draf",
            Some(&token(did)),
            Some(json!({ "draf": [contoh_draf(1, "a@b.id")] })),
        )
        .await;
        assert_eq!(s, StatusCode::FORBIDDEN);
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn jumlah_dan_isi_batch_divalidasi(pool: PgPool) {
    let u = siapkan(pool);
    let t = token(DID_OPERATOR);
    let banyak: Vec<_> = (1..=51).map(|i| contoh_draf(i, "a@b.id")).collect();
    for badan in [json!({ "draf": [] }), json!({ "draf": banyak })] {
        let (s, b) = panggil(&u.app, "POST", "/api/draf", Some(&t), Some(badan)).await;
        assert_eq!(s, StatusCode::BAD_REQUEST, "{b}");
    }
    let mut salah = contoh_draf(2, "a@b.id");
    salah["nim"] = json!("21a");
    let (s, b) = panggil(
        &u.app,
        "POST",
        "/api/draf",
        Some(&t),
        Some(json!({ "draf": [contoh_draf(1, "a@b.id"), salah] })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    assert!(
        b["pesan"].as_str().unwrap().starts_with("draf[1]: nim"),
        "{b}"
    );
    assert_eq!(jumlah_draf(&u).await, 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn doc_hash_ganda_ditolak_tanpa_menyimpan_sebagian(pool: PgPool) {
    let u = siapkan(pool);
    let t = token(DID_OPERATOR);
    let (s, _) = panggil(
        &u.app,
        "POST",
        "/api/draf",
        Some(&t),
        Some(json!({ "draf": [contoh_draf(1, "a@b.id"), contoh_draf(1, "c@d.id")] })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    buat_draf(&u, contoh_draf(1, "a@b.id")).await;
    let (s, b) = panggil(
        &u.app,
        "POST",
        "/api/draf",
        Some(&t),
        Some(json!({ "draf": [contoh_draf(2, "a@b.id"), contoh_draf(1, "a@b.id")] })),
    )
    .await;
    assert_eq!(s, StatusCode::CONFLICT);
    assert_eq!(b["kode"], "KONFLIK");
    assert_eq!(jumlah_draf(&u).await, 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn privy_gagal_tidak_ada_yang_tersimpan(pool: PgPool) {
    let u = siapkan(pool);
    let badan = json!({ "draf": [contoh_draf(1, "a@b.id"), contoh_draf(2, "gagal@b.id")] });
    let (s, b) = panggil(
        &u.app,
        "POST",
        "/api/draf",
        Some(&token(DID_OPERATOR)),
        Some(badan),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_GATEWAY);
    assert_eq!(b["kode"], "LAYANAN_LUAR");
    assert_eq!(jumlah_draf(&u).await, 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn daftar_menyaring_mencari_dan_berhalaman(pool: PgPool) {
    let u = siapkan(pool);
    let t = token(DID_OPERATOR);
    let semua: Vec<_> = (1..=25).map(|i| contoh_draf(i, "a@b.id")).collect();
    let (s, _) = panggil(
        &u.app,
        "POST",
        "/api/draf",
        Some(&t),
        Some(json!({ "draf": semua })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED);

    let (_, b) = panggil(
        &u.app,
        "GET",
        "/api/draf?status=MENUNGGU_TTD",
        Some(&t),
        None,
    )
    .await;
    assert_eq!(b["total"], 25);
    assert_eq!(b["data"].as_array().unwrap().len(), 20);
    let (_, b) = panggil(&u.app, "GET", "/api/draf?halaman=2", Some(&t), None).await;
    assert_eq!(b["data"].as_array().unwrap().len(), 5);
    let (_, b) = panggil(&u.app, "GET", "/api/draf?cari=21110007", Some(&t), None).await;
    assert_eq!(b["total"], 1);
    assert_eq!(b["data"][0]["nim"], "21110007");
    let (_, b) = panggil(&u.app, "GET", "/api/draf?cari=%25", Some(&t), None).await;
    assert_eq!(
        b["total"], 0,
        "% harus dicari sebagai huruf, bukan wildcard"
    );
    let (_, b) = panggil(&u.app, "GET", "/api/draf?status=TERBIT", Some(&t), None).await;
    assert_eq!(b["total"], 0);
    for salah in [
        "/api/draf?status=NGAWUR",
        "/api/draf?halaman=0",
        "/api/draf?halaman=x",
    ] {
        let (s, _) = panggil(&u.app, "GET", salah, Some(&t), None).await;
        assert_eq!(s, StatusCode::BAD_REQUEST, "{salah}");
    }
    let (s, _) = panggil(&u.app, "GET", "/api/draf", Some(&token(DID_TAMU)), None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}

#[sqlx::test(migrations = "../../migrations")]
async fn detail_404_400_403(pool: PgPool) {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(1, "a@b.id")).await;
    let t = token(DID_OPERATOR);
    let (s, _) = panggil(
        &u.app,
        "GET",
        "/api/draf/67e55044-10b1-426f-9247-bb680e5fe0c8",
        Some(&t),
        None,
    )
    .await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    let (s, _) = panggil(&u.app, "GET", "/api/draf/bukan-uuid", Some(&t), None).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let uri = format!("/api/draf/{}", d["id"].as_str().unwrap());
    let (s, b) = panggil(&u.app, "GET", &uri, Some(&token(DID_TAMU)), None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    assert!(b.get("kunci").is_none());
}

#[sqlx::test(migrations = "../../migrations")]
async fn pejabat_menolak_lalu_operator_mengirim_ulang(pool: PgPool) {
    let u = siapkan(pool);
    let d = buat_draf(&u, contoh_draf(1, "a@b.id")).await;
    let id = d["id"].as_str().unwrap();
    let tolak = format!("/api/draf/{id}/tolak");
    let ulang = format!("/api/draf/{id}/kirim-ulang");

    let (s, _) = panggil(
        &u.app,
        "POST",
        &tolak,
        Some(&token(DID_OPERATOR)),
        Some(json!({ "alasan": "x" })),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) = panggil(
        &u.app,
        "POST",
        &tolak,
        Some(&token(DID_REKTOR)),
        Some(json!({ "alasan": "  " })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = panggil(
        &u.app,
        "POST",
        &ulang,
        Some(&token(DID_OPERATOR)),
        Some(contoh_draf(9, "a@b.id")),
    )
    .await;
    assert_eq!(
        s,
        StatusCode::CONFLICT,
        "kirim ulang hanya untuk draf DITOLAK"
    );

    let (s, b) = panggil(
        &u.app,
        "POST",
        &tolak,
        Some(&token(DID_REKTOR)),
        Some(json!({ "alasan": "nama ibu salah" })),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{b}");
    let (s, b) = panggil(
        &u.app,
        "POST",
        &tolak,
        Some(&token(DID_REKTOR)),
        Some(json!({ "alasan": "lagi" })),
    )
    .await;
    assert_eq!(s, StatusCode::CONFLICT);
    assert_eq!(b["kode"], "STATUS_TIDAK_SESUAI");
    let (_, b) = panggil(
        &u.app,
        "GET",
        &format!("/api/draf/{id}"),
        Some(&token(DID_OPERATOR)),
        None,
    )
    .await;
    assert_eq!(b["status"], "DITOLAK");
    assert_eq!(b["alasan_tolak"], "nama ibu salah");

    let (s, b) = panggil(
        &u.app,
        "POST",
        &ulang,
        Some(&token(DID_OPERATOR)),
        Some(contoh_draf(9, "a@b.id")),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{b}");
    let (_, b) = panggil(
        &u.app,
        "GET",
        &format!("/api/draf/{id}"),
        Some(&token(DID_OPERATOR)),
        None,
    )
    .await;
    assert_eq!(b["status"], "MENUNGGU_TTD");
    assert_eq!(b["alasan_tolak"], serde_json::Value::Null);
    assert_eq!(b["nim"], "21110009");
    assert_eq!(b["kunci"], ke_hex(&[9; 32]));
}
