use pusaka_core::hash::keccak256;
use pusaka_core::heks::{GalatHeks, alamat, dari_hex32, ke_hex};

#[test]
fn keccak_vektor_baku() {
    assert_eq!(
        ke_hex(&keccak256(b"")),
        "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    );
    assert_eq!(
        ke_hex(&keccak256(b"abc")),
        "0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"
    );
    assert_eq!(
        ke_hex(&keccak256(b"%PDF-1.7 ijazah PUSAKA")),
        "0x413538c95b60dfa9a17c6008dda06f5589538080ef91043561f8668fde026edb"
    );
}

#[test]
fn dari_hex32_bolak_balik() {
    let h = keccak256(b"abc");
    assert_eq!(dari_hex32(&ke_hex(&h)).unwrap(), h);
    assert_eq!(dari_hex32(ke_hex(&h).trim_start_matches("0x")).unwrap(), h);
    assert_eq!(
        dari_hex32("0x12"),
        Err(GalatHeks::PanjangSalah {
            harus: 32,
            dapat: 1
        })
    );
    assert_eq!(dari_hex32("0xzz"), Err(GalatHeks::BukanHex));
}

#[test]
fn alamat_berbagai_bentuk() {
    let a = alamat("0x70997970C51812dc3A010C7d01b50e0d17dc79C8").unwrap();
    assert_eq!(
        alamat("70997970c51812dc3a010c7d01b50e0d17dc79c8").unwrap(),
        a
    );
    assert_eq!(ke_hex(&a), "0x70997970c51812dc3a010c7d01b50e0d17dc79c8");
    assert_eq!(
        alamat("0x1234"),
        Err(GalatHeks::PanjangSalah {
            harus: 20,
            dapat: 2
        })
    );
}
