use pusaka_core::amplop::{DataLulusan, GalatAmplop, MAKS_HEADER, buka, segel};

const KUNCI: [u8; 32] = [7; 32];
const NONCE: [u8; 12] = [9; 12];

fn data(nama: &str) -> DataLulusan {
    DataLulusan {
        nama: nama.into(),
        nim: "231011402890".into(),
        prodi: "Teknik Informatika".into(),
        gelar: "S.Kom".into(),
        nomor_ijazah: "0411/UNPAM/2026".into(),
        tanggal_lulus: "2027-02-20".into(),
    }
}

#[test]
fn roundtrip() {
    let pdf = b"%PDF-1.7 ijazah PUSAKA".to_vec();
    let a = segel(&KUNCI, &NONCE, &data("Rahmat Eka Satria"), &pdf).unwrap();
    assert_eq!(a[0], 1);
    assert_eq!(&a[1..13], &NONCE);
    let isi = buka(&KUNCI, &a).unwrap();
    assert_eq!(isi.data, data("Rahmat Eka Satria"));
    assert_eq!(isi.pdf, pdf);
}

#[test]
fn deterministik_untuk_kunci_dan_nonce_sama() {
    let a = segel(&KUNCI, &NONCE, &data("A"), b"x").unwrap();
    let b = segel(&KUNCI, &NONCE, &data("A"), b"x").unwrap();
    assert_eq!(a, b);
}

#[test]
fn roundtrip_unicode_dan_koma() {
    let d = data("Ni Luh Putu Ayu, S.Kom · Ñañez");
    let isi = buka(&KUNCI, &segel(&KUNCI, &NONCE, &d, b"").unwrap()).unwrap();
    assert_eq!(isi.data.nama, "Ni Luh Putu Ayu, S.Kom · Ñañez");
    assert!(isi.pdf.is_empty());
}

#[test]
fn kunci_salah_gagal() {
    let a = segel(&KUNCI, &NONCE, &data("A"), b"pdf").unwrap();
    assert_eq!(buka(&[8; 32], &a).err(), Some(GalatAmplop::GagalDekripsi));
}

#[test]
fn satu_bit_dibalik_gagal() {
    let mut a = segel(&KUNCI, &NONCE, &data("A"), b"pdf").unwrap();
    let akhir = a.len() - 1;
    a[akhir] ^= 0x01;
    assert_eq!(buka(&KUNCI, &a).err(), Some(GalatAmplop::GagalDekripsi));
}

#[test]
fn versi_tidak_dikenal() {
    let mut a = segel(&KUNCI, &NONCE, &data("A"), b"pdf").unwrap();
    a[0] = 2;
    assert_eq!(
        buka(&KUNCI, &a).err(),
        Some(GalatAmplop::VersiTidakDikenal(2))
    );
}

#[test]
fn amplop_terpotong() {
    let a = segel(&KUNCI, &NONCE, &data("A"), b"pdf").unwrap();
    assert_eq!(
        buka(&KUNCI, &a[..20]).err(),
        Some(GalatAmplop::TerlaluPendek)
    );
    assert_eq!(buka(&KUNCI, &[]).err(), Some(GalatAmplop::TerlaluPendek));
}

#[test]
fn header_terlalu_besar_ditolak() {
    let d = data(&"x".repeat(MAKS_HEADER));
    assert_eq!(
        segel(&KUNCI, &NONCE, &d, b"").err(),
        Some(GalatAmplop::HeaderTerlaluBesar)
    );
}

#[test]
fn byte_versi_diautentikasi_sebagai_aad() {
    use aes_gcm::aead::{Aead, KeyInit};
    use aes_gcm::{Aes256Gcm, Key, Nonce};
    let a = segel(&KUNCI, &NONCE, &data("A"), b"pdf").unwrap();
    let tanpa_aad = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&KUNCI))
        .decrypt(Nonce::from_slice(&a[1..13]), &a[13..]);
    assert!(
        tanpa_aad.is_err(),
        "amplop harus mengikat byte versi sebagai AAD"
    );
}
