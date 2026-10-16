mod bantu;

use std::sync::{Arc, Mutex};

use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use pusaka_api::galat::Galat;
use pusaka_api::layanan::Privy;
use pusaka_api::privy::PrivyHttp;
use pusaka_core::heks::alamat;
use serde_json::{Value, json};

const OPERATOR: &str = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const REKTOR: &str = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const BARU: &str = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

type Catatan = Arc<Mutex<Vec<String>>>;

fn header_benar(h: &HeaderMap) -> bool {
    h.get("privy-app-id").is_some_and(|v| v == "app")
        && h.get("authorization")
            .is_some_and(|v| v == "Basic YXBwOnJhaGFzaWE=")
}

fn pengguna(akun: Value) -> Value {
    json!({ "id": "did:privy:x", "linked_accounts": akun, "mfa_methods": [],
            "created_at": 0, "has_accepted_terms": false, "is_guest": false })
}

fn dompet(alamat: &str, rantai: &str, konektor: &str) -> Value {
    json!({ "type": "wallet", "address": alamat, "chain_type": rantai, "connector_type": konektor })
}

async fn privy_tiruan() -> (String, Catatan) {
    let catatan: Catatan = Arc::default();
    let app = Router::new()
        .route(
            "/v1/users/{did}",
            get(|h: HeaderMap, Path(did): Path<String>| async move {
                if !header_benar(&h) {
                    return StatusCode::UNAUTHORIZED.into_response();
                }
                if did != "did:privy:ada" {
                    return StatusCode::NOT_FOUND.into_response();
                }
                Json(pengguna(json!([
                    { "type": "email", "address": "a@b.id" },
                    dompet("So11111111111111111111111111111111111111112", "solana", "embedded"),
                    dompet(OPERATOR, "ethereum", "injected"),
                    dompet(REKTOR, "ethereum", "embedded"),
                ])))
                .into_response()
            }),
        )
        .route(
            "/v1/users/email/address",
            post(|State(c): State<Catatan>, h: HeaderMap, Json(b): Json<Value>| async move {
                c.lock().unwrap().push(format!("cari {}", b["address"]));
                if !header_benar(&h) {
                    return StatusCode::UNAUTHORIZED.into_response();
                }
                if b["address"] != "lama@unpam.ac.id" {
                    return StatusCode::NOT_FOUND.into_response();
                }
                Json(pengguna(json!([dompet(OPERATOR, "ethereum", "injected"), dompet(REKTOR, "ethereum", "embedded")])))
                    .into_response()
            }),
        )
        .route(
            "/v1/users",
            post(|State(c): State<Catatan>, h: HeaderMap, Json(b): Json<Value>| async move {
                c.lock().unwrap().push(format!("buat {b}"));
                if !header_benar(&h) {
                    return StatusCode::UNAUTHORIZED.into_response();
                }
                Json(pengguna(json!([{ "type": "email", "address": b["linked_accounts"][0]["address"] }, dompet(BARU, "ethereum", "embedded")])))
                    .into_response()
            }),
        )
        .with_state(catatan.clone());
    (bantu::layani(app).await, catatan)
}

fn klien(url: String, secret: &str) -> PrivyHttp {
    PrivyHttp::baru(reqwest::Client::new(), url, "app".into(), secret.into())
}

#[tokio::test]
async fn wallet_pengguna_hanya_ethereum() {
    let (url, _) = privy_tiruan().await;
    let w = klien(url, "rahasia")
        .wallet_pengguna("did:privy:ada")
        .await
        .unwrap();
    assert_eq!(w, vec![alamat(OPERATOR).unwrap(), alamat(REKTOR).unwrap()]);
}

#[tokio::test]
async fn did_tidak_dikenal_tanpa_wallet() {
    let (url, _) = privy_tiruan().await;
    assert!(
        klien(url, "rahasia")
            .wallet_pengguna("did:privy:hilang")
            .await
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn kredensial_salah_jadi_layanan_luar() {
    let (url, _) = privy_tiruan().await;
    let r = klien(url, "salah").wallet_pengguna("did:privy:ada").await;
    assert!(matches!(r, Err(Galat::LayananLuar(_))));
}

#[tokio::test]
async fn alumni_lama_memakai_wallet_tertanam() {
    let (url, catatan) = privy_tiruan().await;
    let w = klien(url, "rahasia")
        .wallet_alumni(" Lama@UNPAM.ac.id ")
        .await
        .unwrap();
    assert_eq!(w, alamat(REKTOR).unwrap());
    let c = catatan.lock().unwrap();
    assert_eq!(c.as_slice(), [r#"cari "lama@unpam.ac.id""#]);
}

#[tokio::test]
async fn alumni_baru_dibuatkan_wallet_ethereum() {
    let (url, catatan) = privy_tiruan().await;
    let w = klien(url, "rahasia")
        .wallet_alumni("baru@unpam.ac.id")
        .await
        .unwrap();
    assert_eq!(w, alamat(BARU).unwrap());
    let c = catatan.lock().unwrap();
    assert_eq!(c.len(), 2);
    let badan: Value = serde_json::from_str(c[1].strip_prefix("buat ").unwrap()).unwrap();
    assert_eq!(
        badan,
        json!({ "linked_accounts": [{ "type": "email", "address": "baru@unpam.ac.id" }],
                "wallets": [{ "chain_type": "ethereum" }] })
    );
}

#[tokio::test]
async fn privy_mati_jadi_layanan_luar() {
    let r = klien("http://127.0.0.1:1".into(), "rahasia")
        .wallet_alumni("x@y.id")
        .await;
    assert!(matches!(r, Err(Galat::LayananLuar(_))));
}
