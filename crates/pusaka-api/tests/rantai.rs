mod bantu;

use axum::routing::post;
use axum::{Json, Router};
use pusaka_api::galat::Galat;
use pusaka_api::layanan::{Log, Rantai, Receipt};
use pusaka_api::rantai::*;
use pusaka_core::hash::keccak256;
use pusaka_core::heks::{alamat, ke_hex};
use serde_json::{Value, json};

const KONTRAK: &str = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const REKTOR: &str = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const PENERIMA: &str = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

fn kata_u64(x: u64) -> [u8; 32] {
    let mut w = [0u8; 32];
    w[24..].copy_from_slice(&x.to_be_bytes());
    w
}

fn kata_alamat(a: [u8; 20]) -> [u8; 32] {
    let mut w = [0u8; 32];
    w[12..].copy_from_slice(&a);
    w
}

fn log_terbit(kontrak: &str, token: u64) -> Log {
    Log {
        alamat: alamat(kontrak).unwrap(),
        topik: vec![
            topik_diterbitkan(),
            kata_u64(token),
            kata_alamat(alamat(PENERIMA).unwrap()),
            [token as u8; 32],
        ],
        data: kata_alamat(alamat(REKTOR).unwrap()).to_vec(),
    }
}

#[test]
fn konstanta_sama_dengan_cast() {
    assert_eq!(
        ke_hex(&peran_operator()),
        "0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929"
    );
    assert_eq!(
        ke_hex(&peran_penandatangan()),
        "0x49099d864b56301001d07afea5a9d3c2182ae7bb9e6e6f81d8b27ca279a8b017"
    );
    assert_eq!(
        ke_hex(&topik_diterbitkan()),
        "0x3e25f65feaf4a76ea7c2db7aaa42d06528d7ee6bef6caf13a997b89f842f62fa"
    );
    assert_eq!(
        ke_hex(&topik_dicabut()),
        "0xcc72b7bb64658cefc20575b50792ca1ee2f544c53b12b457c7b9551bef6951f6"
    );
    assert_eq!(PERAN_ADMIN, [0u8; 32]);
}

#[test]
fn calldata_has_role_sama_dengan_cast() {
    assert_eq!(
        ke_hex(&calldata_has_role(
            &peran_penandatangan(),
            &alamat(REKTOR).unwrap()
        )),
        "0x91d1485449099d864b56301001d07afea5a9d3c2182ae7bb9e6e6f81d8b27ca279a8b0170000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc"
    );
}

#[test]
fn event_terbit_hanya_dari_kontrak_pusaka() {
    let locked = Log {
        alamat: alamat(KONTRAK).unwrap(),
        topik: vec![keccak256(b"Locked(uint256)")],
        data: kata_u64(1).to_vec(),
    };
    let r = Receipt {
        sukses: true,
        log: vec![
            log_terbit(KONTRAK, 1),
            locked,
            log_terbit("0x0000000000000000000000000000000000000bad", 9),
            log_terbit(KONTRAK, 2),
        ],
    };
    let ev = event_terbit(&r, &alamat(KONTRAK).unwrap());
    assert_eq!(ev.len(), 2);
    assert_eq!(
        ev[0],
        Terbit {
            token_id: 1,
            penerima: alamat(PENERIMA).unwrap(),
            doc_hash: [1; 32]
        }
    );
    assert_eq!(ev[1].token_id, 2);
}

#[test]
fn token_id_di_luar_u64_dilewati() {
    let mut l = log_terbit(KONTRAK, 1);
    l.topik[1][0] = 1;
    let r = Receipt {
        sukses: true,
        log: vec![l],
    };
    assert!(event_terbit(&r, &alamat(KONTRAK).unwrap()).is_empty());
}

#[test]
fn event_cabut_terbaca() {
    let l = Log {
        alamat: alamat(KONTRAK).unwrap(),
        topik: vec![topik_dicabut(), kata_u64(7)],
        data: b"salah nama ibu".to_vec(),
    };
    let r = Receipt {
        sukses: true,
        log: vec![l],
    };
    assert_eq!(event_cabut(&r, &alamat(KONTRAK).unwrap()), vec![7]);
}

#[test]
fn urai_receipt_dari_json_rpc() {
    let v = json!({
        "status": "0x1",
        "logs": [{ "address": KONTRAK, "topics": [ke_hex(&topik_dicabut()), ke_hex(&kata_u64(7))], "data": "0x" }]
    });
    let r = urai_receipt(&v).unwrap();
    assert!(r.sukses);
    assert_eq!(r.log[0].topik.len(), 2);
    assert!(
        !urai_receipt(&json!({ "status": "0x0", "logs": [] }))
            .unwrap()
            .sukses
    );
    assert!(urai_receipt(&json!({ "status": "0x1" })).is_none());
}

async fn rpc_tiruan(jawab: fn(&Value) -> Value) -> String {
    let app = Router::new().route(
        "/",
        post(move |Json(v): Json<Value>| async move { Json(jawab(&v)) }),
    );
    bantu::layani(app).await
}

fn klien(url: String) -> RantaiRpc {
    RantaiRpc::baru(reqwest::Client::new(), url, alamat(KONTRAK).unwrap())
}

#[tokio::test]
async fn rpc_has_role_membaca_hasil_eth_call() {
    let url = rpc_tiruan(|v| {
        assert_eq!(v["method"], "eth_call");
        assert_eq!(v["params"][0]["to"], KONTRAK.to_lowercase());
        let benar = ke_hex(&calldata_has_role(
            &peran_penandatangan(),
            &alamat(REKTOR).unwrap(),
        ));
        let hasil = if v["params"][0]["data"] == benar.as_str() {
            1
        } else {
            0
        };
        json!({ "jsonrpc": "2.0", "id": 1, "result": ke_hex(&kata_u64(hasil)) })
    })
    .await;
    let k = klien(url);
    assert!(
        k.punya_peran(peran_penandatangan(), alamat(REKTOR).unwrap())
            .await
            .unwrap()
    );
    assert!(
        !k.punya_peran(peran_penandatangan(), alamat(PENERIMA).unwrap())
            .await
            .unwrap()
    );
}

#[tokio::test]
async fn rpc_receipt_null_berarti_belum_ada() {
    let url = rpc_tiruan(|v| {
        assert_eq!(v["method"], "eth_getTransactionReceipt");
        json!({ "jsonrpc": "2.0", "id": 1, "result": null })
    })
    .await;
    assert_eq!(klien(url).receipt([1; 32]).await.unwrap(), None);
}

#[tokio::test]
async fn rpc_galat_jadi_layanan_luar() {
    let url = rpc_tiruan(
        |_| json!({ "jsonrpc": "2.0", "id": 1, "error": { "code": -32000, "message": "x" } }),
    )
    .await;
    let r = klien(url)
        .punya_peran(PERAN_ADMIN, alamat(REKTOR).unwrap())
        .await;
    assert!(matches!(r, Err(Galat::LayananLuar(_))));
}

#[tokio::test]
async fn rpc_tidak_terjangkau_jadi_layanan_luar() {
    let r = klien("http://127.0.0.1:1".into()).receipt([1; 32]).await;
    assert!(matches!(r, Err(Galat::LayananLuar(_))));
}
