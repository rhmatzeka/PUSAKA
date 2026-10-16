mod bantu;

use pusaka_api::config::{GalatKonfigurasi, Konfigurasi};
use pusaka_api::negara::Negara;

fn konfig(pem: &str) -> Konfigurasi {
    let pem = pem.replace('\n', "\\n");
    Konfigurasi::dari(|k| {
        Some(match k {
            "DATABASE_URL" => "postgres://u:p@127.0.0.1:1/db".to_owned(),
            "PRIVY_VERIFICATION_KEY" => pem.clone(),
            "KUNCI_MASTER" => "11".repeat(32),
            "ALAMAT_KONTRAK" => bantu::KONTRAK.to_owned(),
            "CHAIN_ID" => "31337".to_owned(),
            _ => "x".to_owned(),
        })
    })
    .unwrap()
}

#[tokio::test]
async fn negara_terbentuk_dari_konfigurasi_sah() {
    let n = Negara::dari_konfigurasi(konfig(bantu::KUNCI_JWT_PUBLIK)).unwrap();
    assert_eq!(n.domain.chain_id, 31337);
}

#[tokio::test]
async fn pem_rusak_ditolak_saat_mulai() {
    let r = Negara::dari_konfigurasi(konfig("bukan pem"));
    assert!(matches!(
        r,
        Err(GalatKonfigurasi::TidakValid("PRIVY_VERIFICATION_KEY", _))
    ));
}
