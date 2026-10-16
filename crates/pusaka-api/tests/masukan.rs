use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::routing::{get, post};
use http_body_util::BodyExt;
use pusaka_api::masukan::{JsonMasuk, QueryMasuk, id_dari, token_dari};
use serde::Deserialize;
use serde_json::Value;
use tower::ServiceExt;

#[derive(Deserialize)]
struct Isi {
    angka: u32,
}

fn app() -> Router {
    Router::new()
        .route(
            "/j",
            post(|JsonMasuk(i): JsonMasuk<Isi>| async move { i.angka.to_string() }),
        )
        .route(
            "/q",
            get(|QueryMasuk(i): QueryMasuk<Isi>| async move { i.angka.to_string() }),
        )
}

async fn kirim(req: Request<Body>) -> (StatusCode, String) {
    let r = app().oneshot(req).await.unwrap();
    let s = r.status();
    let b = r.into_body().collect().await.unwrap().to_bytes();
    (s, String::from_utf8(b.to_vec()).unwrap())
}

fn post_json(isi: &str) -> Request<Body> {
    Request::post("/j")
        .header("content-type", "application/json")
        .body(Body::from(isi.to_owned()))
        .unwrap()
}

#[tokio::test]
async fn json_sah_diteruskan() {
    assert_eq!(
        kirim(post_json(r#"{"angka":5}"#)).await,
        (StatusCode::OK, "5".into())
    );
}

#[tokio::test]
async fn json_rusak_atau_salah_tipe_jadi_400_json() {
    for isi in ["{", r#"{"angka":"x"}"#, "{}"] {
        let (s, b) = kirim(post_json(isi)).await;
        assert_eq!(s, StatusCode::BAD_REQUEST, "{isi}");
        let v: Value = serde_json::from_str(&b).unwrap();
        assert_eq!(v["kode"], "INPUT_TIDAK_VALID");
    }
}

#[tokio::test]
async fn json_tanpa_content_type_jadi_400_json() {
    let req = Request::post("/j")
        .body(Body::from(r#"{"angka":5}"#))
        .unwrap();
    let (s, b) = kirim(req).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    assert!(b.contains("INPUT_TIDAK_VALID"));
}

#[tokio::test]
async fn query_sah_dan_hilang() {
    let req = |u: &str| Request::get(u).body(Body::empty()).unwrap();
    assert_eq!(kirim(req("/q?angka=7")).await, (StatusCode::OK, "7".into()));
    let (s, b) = kirim(req("/q")).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    assert!(b.contains("INPUT_TIDAK_VALID"));
}

#[test]
fn id_dan_token_diurai() {
    assert!(id_dari("67e55044-10b1-426f-9247-bb680e5fe0c8").is_ok());
    assert!(id_dari("bukan-uuid").is_err());
    assert_eq!(token_dari("12").unwrap(), 12);
    for salah in ["", "-1", "abc", "99999999999999999999999"] {
        assert!(token_dari(salah).is_err(), "{salah}");
    }
}
