use pusaka_core::heks::{alamat, dari_hex32};
use pusaka_core::ttd::{GalatTtd, pulihkan};

// Vektor bersama (peta jalan): dibuat ethers v6 dengan kunci Anvil #2.
const DIGEST: &str = "0x069e362cc547e60dc1beb36e2f4502c5e07a3689275ac21faaaa791b024f9be5";
const SIG: &str = "005375b038da81be905bbe4ab2ddd240a489ccd90e34c85ac7d6a1913e33859358dbb04ecdd2f170e730c5813a49cc71b3fca320e102dd263359a15e40448fae1b";
const REKTOR: &str = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
// n - s untuk s di atas (varian s tinggi dari tanda tangan yang sama).
const S_TINGGI: &str = "a7244fb1322d0e8f18cf3a7ec5b6338d06b239c5ce45c3158c78bd2e8ff1b193";

fn sig() -> Vec<u8> {
    hex::decode(SIG).unwrap()
}

#[test]
fn pulihkan_rektor_dari_vektor_bersama() {
    let d = dari_hex32(DIGEST).unwrap();
    assert_eq!(pulihkan(&d, &sig()), Ok(alamat(REKTOR).unwrap()));
}

#[test]
fn v_nol_atau_satu_juga_diterima() {
    let d = dari_hex32(DIGEST).unwrap();
    let mut s = sig();
    s[64] -= 27;
    assert_eq!(pulihkan(&d, &s), Ok(alamat(REKTOR).unwrap()));
}

#[test]
fn s_tinggi_ditolak_seperti_openzeppelin() {
    let d = dari_hex32(DIGEST).unwrap();
    let s = sig();
    let tinggi = [&s[..32], &hex::decode(S_TINGGI).unwrap(), &[0x1c]].concat();
    assert_eq!(pulihkan(&d, &tinggi), Err(GalatTtd::STinggi));
}

#[test]
fn panjang_salah_ditolak() {
    let d = dari_hex32(DIGEST).unwrap();
    assert_eq!(pulihkan(&d, &sig()[..64]), Err(GalatTtd::PanjangSalah(64)));
}

#[test]
fn v_tidak_dikenal_ditolak() {
    let d = dari_hex32(DIGEST).unwrap();
    let mut s = sig();
    s[64] = 29;
    assert_eq!(pulihkan(&d, &s), Err(GalatTtd::VTidakValid(29)));
}

#[test]
fn digest_lain_menghasilkan_alamat_lain() {
    let mut d = dari_hex32(DIGEST).unwrap();
    d[0] ^= 1;
    assert_ne!(pulihkan(&d, &sig()), Ok(alamat(REKTOR).unwrap()));
}
