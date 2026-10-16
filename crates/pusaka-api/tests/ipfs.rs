mod bantu;

use axum::http::StatusCode;
use bantu::*;
use sqlx::PgPool;

#[sqlx::test(migrations = "../../migrations")]
async fn operator_mengunggah_dan_tercatat_di_audit(pool: PgPool) {
    let u = siapkan(pool);
    let (s, b) = panggil_mentah(
        &u.app,
        "/api/ipfs?nama=amplop-1.bin",
        Some(&token(DID_OPERATOR)),
        vec![1, 2, 3],
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{b}");
    let cid = b["cid"].as_str().unwrap();
    assert!(cid.starts_with("bafy"));
    assert_eq!(b["uri"], format!("ipfs://{cid}"));
    assert_eq!(
        u.ipfs.unggahan.lock().unwrap()[0],
        ("amplop-1.bin".to_owned(), vec![1, 2, 3])
    );
    let (aksi,): (String,) = sqlx::query_as("select aksi from audit_log where pelaku = $1")
        .bind(DID_OPERATOR)
        .fetch_one(&u.db)
        .await
        .unwrap();
    assert_eq!(aksi, "ipfs.unggah");
}

#[sqlx::test(migrations = "../../migrations")]
async fn selain_operator_ditolak(pool: PgPool) {
    let u = siapkan(pool);
    for did in [DID_REKTOR, DID_TAMU] {
        let (s, b) =
            panggil_mentah(&u.app, "/api/ipfs?nama=a.bin", Some(&token(did)), vec![1]).await;
        assert_eq!(s, StatusCode::FORBIDDEN);
        assert_eq!(b["kode"], "PERAN_TIDAK_CUKUP");
    }
    assert!(u.ipfs.unggahan.lock().unwrap().is_empty());
}

#[sqlx::test(migrations = "../../migrations")]
async fn nama_dan_isi_divalidasi(pool: PgPool) {
    let u = siapkan(pool);
    let t = token(DID_OPERATOR);
    for uri in [
        "/api/ipfs",
        "/api/ipfs?nama=../x",
        "/api/ipfs?nama=.env",
        "/api/ipfs?nama=a%20b",
    ] {
        let (s, b) = panggil_mentah(&u.app, uri, Some(&t), vec![1]).await;
        assert_eq!(s, StatusCode::BAD_REQUEST, "{uri}");
        assert_eq!(b["kode"], "INPUT_TIDAK_VALID");
    }
    let (s, _) = panggil_mentah(&u.app, "/api/ipfs?nama=a.bin", Some(&t), vec![]).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
}

#[sqlx::test(migrations = "../../migrations")]
async fn berkas_di_atas_4_mib_ditolak(pool: PgPool) {
    let u = siapkan(pool);
    let besar = vec![0u8; 4 * 1024 * 1024 + 1];
    let (s, b) = panggil_mentah(
        &u.app,
        "/api/ipfs?nama=a.bin",
        Some(&token(DID_OPERATOR)),
        besar,
    )
    .await;
    assert_eq!(s, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(b["kode"], "TERLALU_BESAR");
}

#[sqlx::test(migrations = "../../migrations")]
async fn batas_laju_per_pengguna(pool: PgPool) {
    let u = siapkan(pool);
    sqlx::query(
        "insert into audit_log (pelaku, aksi) select $1, 'uji' from generate_series(1, 120)",
    )
    .bind(DID_OPERATOR)
    .execute(&u.db)
    .await
    .unwrap();
    let (s, b) = panggil_mentah(
        &u.app,
        "/api/ipfs?nama=a.bin",
        Some(&token(DID_OPERATOR)),
        vec![1],
    )
    .await;
    assert_eq!(s, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(b["kode"], "TERLALU_BANYAK");
}
