use pusaka_api::validasi::{DrafBaru, alasan, sahkan};

fn dasar() -> DrafBaru {
    DrafBaru {
        nama: " Budi Santoso ".into(),
        nim: "211011400001".into(),
        prodi: "Teknik Informatika".into(),
        gelar: "S.Kom.".into(),
        nomor_ijazah: "UNPAM/2027/0001".into(),
        tanggal_lulus: "2027-08-30".into(),
        email: " Budi@UNPAM.ac.id ".into(),
        doc_hash: format!("0x{}", "ab".repeat(32)),
        uri: "ipfs://bafymeta".into(),
        cid_amplop: "bafyamplop".into(),
        kunci: "cd".repeat(32),
    }
}

#[test]
fn draf_sah_dirapikan() {
    let d = sahkan(&dasar()).unwrap();
    assert_eq!(d.nama, "Budi Santoso");
    assert_eq!(d.email, "budi@unpam.ac.id");
    assert_eq!(d.doc_hash, [0xab; 32]);
    assert_eq!(d.kunci, [0xcd; 32]);
    assert_eq!(d.tanggal_lulus.to_string(), "2027-08-30");
}

type Ubah = fn(&mut DrafBaru);

#[test]
fn setiap_kolom_salah_menyebut_namanya() {
    let kasus: [(&str, Ubah); 13] = [
        ("nama", |d| d.nama = "  ".into()),
        ("nama", |d| d.nama = "x".repeat(201)),
        ("nim", |d| d.nim = "21a".into()),
        ("nim", |d| d.nim = "1".repeat(21)),
        ("tanggal_lulus", |d| d.tanggal_lulus = "2027-02-31".into()),
        ("tanggal_lulus", |d| d.tanggal_lulus = "2027-+2-+5".into()),
        ("tanggal_lulus", |d| d.tanggal_lulus = "1899-12-31".into()),
        ("email", |d| d.email = "budi".into()),
        ("email", |d| d.email = "a@b@c.id".into()),
        ("doc_hash", |d| d.doc_hash = "00".repeat(32)),
        ("uri", |d| d.uri = "https://x".into()),
        ("cid_amplop", |d| d.cid_amplop = "../x".into()),
        ("kunci", |d| d.kunci = "12".into()),
    ];
    for (kolom, ubah) in kasus {
        let mut d = dasar();
        ubah(&mut d);
        let g = sahkan(&d).unwrap_err();
        assert!(g.starts_with(kolom), "{kolom}: {g}");
    }
}

#[test]
fn tanggal_kabisat_dihormati() {
    let mut d = dasar();
    d.tanggal_lulus = "2028-02-29".into();
    assert!(sahkan(&d).is_ok());
    d.tanggal_lulus = "2027-02-29".into();
    assert!(sahkan(&d).is_err());
}

#[test]
fn alasan_dibatasi() {
    assert_eq!(alasan("  salah nama ibu ").unwrap(), "salah nama ibu");
    assert!(alasan("   ").is_err());
    assert!(alasan(&"x".repeat(501)).is_err());
}
