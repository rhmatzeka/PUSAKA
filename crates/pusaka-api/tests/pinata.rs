mod bantu;

use std::sync::{Arc, Mutex};

use axum::extract::{Multipart, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::post;
use axum::{Json, Router};
use pusaka_api::galat::Galat;
use pusaka_api::layanan::Ipfs;
use pusaka_api::pinata::PinataHttp;
use serde_json::json;

type Bagian = Arc<Mutex<Vec<(String, Vec<u8>)>>>;

async fn pinata_tiruan(cid: &'static str) -> (String, Bagian) {
    let bagian: Bagian = Arc::default();
    let app = Router::new()
        .route(
            "/v3/files",
            post(
                move |State(b): State<Bagian>, h: HeaderMap, mut m: Multipart| async move {
                    if h.get("authorization").is_none_or(|v| v != "Bearer JWT-UJI") {
                        return StatusCode::UNAUTHORIZED.into_response();
                    }
                    while let Some(f) = m.next_field().await.unwrap() {
                        let nama = f.name().unwrap_or_default().to_owned();
                        let isi = f.bytes().await.unwrap().to_vec();
                        b.lock().unwrap().push((nama, isi));
                    }
                    Json(json!({ "data": { "id": "1", "name": "x", "cid": cid, "size": 3 } }))
                        .into_response()
                },
            ),
        )
        .with_state(bagian.clone());
    (bantu::layani(app).await, bagian)
}

#[tokio::test]
async fn unggah_mengirim_multipart_ke_jaringan_publik() {
    let (url, bagian) = pinata_tiruan("bafkreiuji").await;
    let cid = PinataHttp::baru(reqwest::Client::new(), url, "JWT-UJI".into())
        .unggah("amplop-1.bin", vec![1, 2, 3])
        .await
        .unwrap();
    assert_eq!(cid, "bafkreiuji");
    let b = bagian.lock().unwrap();
    assert!(b.contains(&("file".into(), vec![1, 2, 3])));
    assert!(b.contains(&("network".into(), b"public".to_vec())));
    assert!(b.contains(&("name".into(), b"amplop-1.bin".to_vec())));
}

#[tokio::test]
async fn jwt_salah_jadi_layanan_luar() {
    let (url, _) = pinata_tiruan("bafkreiuji").await;
    let r = PinataHttp::baru(reqwest::Client::new(), url, "SALAH".into())
        .unggah("a.bin", vec![1])
        .await;
    assert!(matches!(r, Err(Galat::LayananLuar(_))));
}

#[tokio::test]
async fn cid_kosong_ditolak() {
    let (url, _) = pinata_tiruan("").await;
    let r = PinataHttp::baru(reqwest::Client::new(), url, "JWT-UJI".into())
        .unggah("a.bin", vec![1])
        .await;
    assert!(matches!(r, Err(Galat::LayananLuar(_))));
}
