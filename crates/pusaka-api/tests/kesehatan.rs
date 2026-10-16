use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

async fn panggil(uri: &str) -> (StatusCode, Value) {
    let res = pusaka_api::router()
        .oneshot(Request::get(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap())
}

#[tokio::test]
async fn kesehatan_mengembalikan_nama_dan_versi() {
    let (status, body) = panggil("/api/kesehatan").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "layanan": "pusaka-api", "versi": "0.1.0" }));
}

#[tokio::test]
async fn rute_tidak_dikenal_404_json() {
    let (status, body) = panggil("/api/tidak-ada").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["kode"], "TIDAK_DITEMUKAN");
}

#[tokio::test]
async fn metode_salah_405_json() {
    let res = pusaka_api::router()
        .oneshot(Request::post("/api/kesehatan").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::METHOD_NOT_ALLOWED);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: Value = serde_json::from_slice(&bytes).expect("body 405 harus JSON");
    assert_eq!(body["kode"], "METODE_TIDAK_DIIZINKAN");
}
