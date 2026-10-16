use std::collections::HashMap;

use pusaka_api::config::{ENV_WAJIB, GalatKonfigurasi, Konfigurasi};

fn env_lengkap() -> HashMap<&'static str, String> {
    HashMap::from([
        ("DATABASE_URL", "postgres://u:p@h/db".to_owned()),
        ("PRIVY_APP_ID", "app".to_owned()),
        ("PRIVY_APP_SECRET", "RAHASIA-PRIVY".to_owned()),
        (
            "PRIVY_VERIFICATION_KEY",
            "-----BEGIN PUBLIC KEY-----\\nABC\\n-----END PUBLIC KEY-----".to_owned(),
        ),
        ("PINATA_JWT", "JWT-PINATA".to_owned()),
        ("KUNCI_MASTER", format!("0x{}", "11".repeat(32))),
        ("RPC_URL", "http://127.0.0.1:8545".to_owned()),
        (
            "ALAMAT_KONTRAK",
            "0x5FbDB2315678afecb367f032d93F642f64180aa3".to_owned(),
        ),
        ("CHAIN_ID", "31337".to_owned()),
    ])
}

fn dari(m: &HashMap<&'static str, String>) -> Result<Konfigurasi, GalatKonfigurasi> {
    Konfigurasi::dari(|k| m.get(k).cloned())
}

#[test]
fn env_lengkap_terbaca_dengan_bawaan() {
    let k = dari(&env_lengkap()).unwrap();
    assert_eq!(k.chain_id, 31337);
    assert_eq!(k.kunci_master, [0x11; 32]);
    assert_eq!(k.alamat_kontrak[0], 0x5f);
    assert_eq!(k.privy_api_url, "https://api.privy.io");
    assert_eq!(k.pinata_upload_url, "https://uploads.pinata.cloud");
    assert_eq!(
        k.privy_kunci_verifikasi,
        "-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----"
    );
}

#[test]
fn env_kosong_menyebut_semua_yang_hilang() {
    let mut m = HashMap::new();
    m.insert("PINATA_JWT", "   ".to_owned());
    assert_eq!(
        dari(&m).unwrap_err(),
        GalatKonfigurasi::Hilang(ENV_WAJIB.to_vec())
    );
}

#[test]
fn kunci_master_salah_ditolak() {
    let mut m = env_lengkap();
    m.insert("KUNCI_MASTER", "abc".into());
    assert!(matches!(
        dari(&m),
        Err(GalatKonfigurasi::TidakValid("KUNCI_MASTER", _))
    ));
    m.insert("KUNCI_MASTER", "00".repeat(32));
    assert!(matches!(
        dari(&m),
        Err(GalatKonfigurasi::TidakValid("KUNCI_MASTER", _))
    ));
}

#[test]
fn alamat_kontrak_dan_chain_id_divalidasi() {
    let mut m = env_lengkap();
    m.insert("ALAMAT_KONTRAK", "0x1234".into());
    assert!(matches!(
        dari(&m),
        Err(GalatKonfigurasi::TidakValid("ALAMAT_KONTRAK", _))
    ));
    let mut m = env_lengkap();
    m.insert("CHAIN_ID", "amoy".into());
    assert!(matches!(
        dari(&m),
        Err(GalatKonfigurasi::TidakValid("CHAIN_ID", _))
    ));
}

#[test]
fn debug_tidak_membocorkan_rahasia() {
    let teks = format!("{:?}", dari(&env_lengkap()).unwrap());
    for rahasia in ["RAHASIA-PRIVY", "JWT-PINATA", "1111", "postgres://"] {
        assert!(!teks.contains(rahasia), "{rahasia} bocor di {teks}");
    }
}
