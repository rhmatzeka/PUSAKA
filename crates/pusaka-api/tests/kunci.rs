use pusaka_api::kunci::{buka, bungkus};
use uuid::Uuid;

const MASTER: [u8; 32] = [7; 32];
const KUNCI: [u8; 32] = [42; 32];

#[test]
fn bolak_balik() {
    let id = Uuid::new_v4();
    let b = bungkus(&MASTER, id, &KUNCI).unwrap();
    assert_eq!(b.len(), 60);
    assert!(
        !b.windows(32).any(|w| w == KUNCI),
        "kunci polos tidak boleh terlihat"
    );
    assert_eq!(buka(&MASTER, id, &b).unwrap(), KUNCI);
}

#[test]
fn nonce_acak_setiap_bungkus() {
    let id = Uuid::new_v4();
    assert_ne!(
        bungkus(&MASTER, id, &KUNCI).unwrap(),
        bungkus(&MASTER, id, &KUNCI).unwrap()
    );
}

#[test]
fn draf_lain_tidak_bisa_membuka() {
    let b = bungkus(&MASTER, Uuid::new_v4(), &KUNCI).unwrap();
    assert!(buka(&MASTER, Uuid::new_v4(), &b).is_err());
}

#[test]
fn master_lain_atau_data_rusak_ditolak() {
    let id = Uuid::new_v4();
    let mut b = bungkus(&MASTER, id, &KUNCI).unwrap();
    assert!(buka(&[8; 32], id, &b).is_err());
    b[20] ^= 1;
    assert!(buka(&MASTER, id, &b).is_err());
    assert!(buka(&MASTER, id, &b[..59]).is_err());
}
