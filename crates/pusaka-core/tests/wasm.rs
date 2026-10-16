#![cfg(all(target_arch = "wasm32", feature = "wasm"))]

use pusaka_core::wasm::{
    baca_csv, buka_amplop, digest_penerbitan_hex, keccak256_hex, segel_amplop,
};
use wasm_bindgen_test::wasm_bindgen_test;

#[wasm_bindgen_test]
fn keccak_di_wasm() {
    assert_eq!(
        keccak256_hex(b"abc"),
        "0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"
    );
}

#[wasm_bindgen_test]
fn amplop_di_wasm() {
    let data = r#"{"nama":"A","nim":"1","prodi":"TI","gelar":"S.Kom","nomor_ijazah":"1","tanggal_lulus":"2027-02-20"}"#;
    let a = segel_amplop(&[7; 32], &[9; 12], data, b"pdf").unwrap();
    let h = buka_amplop(&[7; 32], &a).unwrap();
    assert_eq!(h.pdf(), b"pdf".to_vec());
    assert!(h.data_json().contains("\"nama\":\"A\""));
    assert!(buka_amplop(&[8; 32], &a).is_err());
    assert!(segel_amplop(&[7; 31], &[9; 12], data, b"").is_err());
}

#[wasm_bindgen_test]
fn digest_di_wasm() {
    let d = digest_penerbitan_hex(
        31337,
        "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x413538c95b60dfa9a17c6008dda06f5589538080ef91043561f8668fde026edb",
        "0x14ecfb0c60c4bdfac4451a0238994b0b8024f8e018440289db82f5b6e4cf9e5f",
        1_793_000_000,
    )
    .unwrap();
    assert_eq!(
        d,
        "0x069e362cc547e60dc1beb36e2f4502c5e07a3689275ac21faaaa791b024f9be5"
    );
}

#[wasm_bindgen_test]
fn csv_di_wasm() {
    let j = baca_csv("nama,nim,prodi,gelar,nomor_ijazah,tanggal_lulus,email,file_pdf\nA,1,TI,S.Kom,1/U,2027-02-20,a@b.id,a.pdf\n").unwrap();
    assert!(j.contains("\"nama\":\"A\""));
    assert!(baca_csv("x\n").is_err());
}
