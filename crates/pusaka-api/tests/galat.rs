use axum::http::StatusCode;
use axum::response::IntoResponse;
use http_body_util::BodyExt;
use pusaka_api::galat::Galat;
use serde_json::Value;

async fn urai(g: Galat) -> (StatusCode, Value) {
    let r = g.into_response();
    let status = r.status();
    let b = r.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&b).unwrap())
}

#[tokio::test]
async fn setiap_galat_punya_status_dan_kode() {
    let kasus = [
        (
            Galat::TidakTerautentikasi("x".into()),
            401,
            "TIDAK_TERAUTENTIKASI",
        ),
        (Galat::PeranTidakCukup("x".into()), 403, "PERAN_TIDAK_CUKUP"),
        (Galat::TidakDitemukan("x".into()), 404, "TIDAK_DITEMUKAN"),
        (Galat::InputTidakValid("x".into()), 400, "INPUT_TIDAK_VALID"),
        (Galat::Konflik("x".into()), 409, "KONFLIK"),
        (
            Galat::StatusTidakSesuai("x".into()),
            409,
            "STATUS_TIDAK_SESUAI",
        ),
        (Galat::TerlaluBesar(10), 413, "TERLALU_BESAR"),
        (Galat::TerlaluBanyak, 429, "TERLALU_BANYAK"),
        (Galat::LayananLuar("x".into()), 502, "LAYANAN_LUAR"),
        (
            Galat::KonfigurasiTidakLengkap("x".into()),
            503,
            "KONFIGURASI_TIDAK_LENGKAP",
        ),
        (Galat::Internal("x".into()), 500, "INTERNAL"),
    ];
    for (g, status, kode) in kasus {
        let (s, b) = urai(g).await;
        assert_eq!(s.as_u16(), status, "{kode}");
        assert_eq!(b["kode"], kode);
        assert!(b["pesan"].is_string());
    }
}

#[tokio::test]
async fn galat_internal_tidak_membocorkan_detail() {
    let (_, b) = urai(Galat::Internal("kunci rahasia xyz".into())).await;
    assert_eq!(b["pesan"], "Terjadi kesalahan di server");
    let (s, b) = urai(Galat::from(sqlx::Error::RowNotFound)).await;
    assert_eq!(s, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(b["kode"], "INTERNAL");
    assert_eq!(b["pesan"], "Terjadi kesalahan di server");
}

#[tokio::test]
async fn galat_klien_membawa_pesan() {
    let (_, b) = urai(Galat::InputTidakValid("nim harus angka".into())).await;
    assert_eq!(b["pesan"], "nim harus angka");
}
