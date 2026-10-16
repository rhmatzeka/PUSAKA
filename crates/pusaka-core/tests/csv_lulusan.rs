use pusaka_core::csv_lulusan::{GalatCsv, MAKS_BARIS, baca};

const KEPALA: &str = "nama,nim,prodi,gelar,nomor_ijazah,tanggal_lulus,email,file_pdf";

fn baris(nama: &str, nim: &str, nomor: &str, email: &str) -> String {
    format!("{nama},{nim},Teknik Informatika,S.Kom,{nomor},2027-02-20,{email},{nim}.pdf")
}

#[test]
fn dua_baris_valid_dengan_kutip() {
    let teks = format!(
        "{KEPALA}\n{}\n\"Santoso, Budi\",231011402533,Teknik Informatika,S.Kom,0412/UNPAM/2026,2027-02-20,budi@gmail.com,b.pdf\n",
        baris(
            "Rahmat Eka Satria",
            "231011402890",
            "0411/UNPAM/2026",
            "rahmat@gmail.com"
        )
    );
    let h = baca(&teks).unwrap();
    assert!(
        h.galat.is_empty(),
        "{:?}",
        h.galat.iter().map(|g| &g.pesan).collect::<Vec<_>>()
    );
    assert_eq!(h.baris.len(), 2);
    assert_eq!(h.baris[0].nomor_baris, 2);
    assert_eq!(h.baris[1].data.nama, "Santoso, Budi");
    assert_eq!(h.baris[1].file_pdf, "b.pdf");
}

#[test]
fn bom_dan_crlf_diterima() {
    let teks = format!(
        "\u{feff}{KEPALA}\r\n{}\r\n",
        baris("A", "231011402890", "1/UNPAM/2026", "a@b.id")
    );
    let h = baca(&teks).unwrap();
    assert_eq!(h.baris.len(), 1);
    assert!(h.galat.is_empty());
}

#[test]
fn kolom_salah_ditolak() {
    let e = baca("nama,nim\nA,1\n").err().unwrap();
    assert!(matches!(e, GalatCsv::KolomSalah { .. }));
}

#[test]
fn kosong_ditolak() {
    assert_eq!(baca("").err(), Some(GalatCsv::Kosong));
    assert_eq!(baca(&format!("{KEPALA}\n")).err(), Some(GalatCsv::Kosong));
}

#[test]
fn baris_salah_dilaporkan_baris_lain_tetap() {
    let teks = format!(
        "{KEPALA}\n{}\n{}\n{}\n",
        baris("A", "231011402890", "1/UNPAM/2026", "bukan-email"),
        baris("B", "23101140A", "2/UNPAM/2026", "b@b.id"),
        baris("C", "231011402891", "3/UNPAM/2026", "c@c.id"),
    );
    let h = baca(&teks).unwrap();
    assert_eq!(h.baris.len(), 1);
    assert_eq!(h.baris[0].data.nama, "C");
    assert_eq!(h.galat.len(), 2);
    assert_eq!(h.galat[0].nomor_baris, 2);
    assert!(h.galat[0].pesan.contains("email"));
    assert_eq!(h.galat[1].nomor_baris, 3);
    assert!(h.galat[1].pesan.contains("NIM"));
}

#[test]
fn tanggal_dan_pdf_divalidasi() {
    let teks = format!(
        "{KEPALA}\nA,231011402890,TI,S.Kom,1/U/2026,20-02-2027,a@b.id,a.pdf\nB,231011402891,TI,S.Kom,2/U/2026,2027-02-20,b@b.id,b.docx\n"
    );
    let h = baca(&teks).unwrap();
    assert!(h.baris.is_empty());
    assert!(h.galat[0].pesan.contains("tanggal"));
    assert!(h.galat[1].pesan.contains("PDF"));
}

#[test]
fn nim_ganda_dilaporkan() {
    let teks = format!(
        "{KEPALA}\n{}\n{}\n",
        baris("A", "231011402890", "1/UNPAM/2026", "a@b.id"),
        baris("B", "231011402890", "2/UNPAM/2026", "b@b.id"),
    );
    let h = baca(&teks).unwrap();
    assert_eq!(h.baris.len(), 1);
    assert_eq!(h.galat.len(), 1);
    assert_eq!(h.galat[0].nomor_baris, 3);
    assert!(h.galat[0].pesan.contains("ganda"));
}

#[test]
fn lebih_dari_maks_ditolak() {
    let mut teks = format!("{KEPALA}\n");
    for i in 0..=MAKS_BARIS {
        teks.push_str(&baris(
            "A",
            &format!("2310114{i:05}"),
            &format!("{i}/UNPAM/2026"),
            "a@b.id",
        ));
        teks.push('\n');
    }
    assert_eq!(
        baca(&teks).err(),
        Some(GalatCsv::TerlaluBanyak(MAKS_BARIS + 1))
    );
}

// ---- temuan review rencana 03 ----

fn satu(tanggal: &str) -> pusaka_core::csv_lulusan::HasilCsv {
    baca(&format!(
        "{KEPALA}\nA,231011402890,TI,S.Kom,1/U/2026,{tanggal},a@b.id,a.pdf\n"
    ))
    .unwrap()
}

#[test]
fn tanggal_kalender_diperiksa() {
    for salah in [
        "2027-02-31",
        "2027-04-31",
        "2027-02-29",
        "2027-+2-+5",
        "+202-02-10",
        "0000-01-01",
        "2027-13-01",
    ] {
        assert_eq!(satu(salah).baris.len(), 0, "{salah} seharusnya ditolak");
    }
    for benar in ["2028-02-29", "2027-12-31", "2000-02-29"] {
        assert_eq!(satu(benar).baris.len(), 1, "{benar} seharusnya diterima");
    }
}

#[test]
fn kolom_berlebih_per_baris_ditolak() {
    let h = baca(&format!(
        "{KEPALA}\nA,231011402890,TI,S.Kom,1/U/2026,2027-02-20,a@b.id,a.pdf,lebih\n"
    ))
    .unwrap();
    assert!(h.baris.is_empty());
    assert!(h.galat[0].pesan.contains("8 kolom"));
}

#[test]
fn pemisah_titik_koma_diberi_pesan_jelas() {
    let teks = "nama;nim;prodi;gelar;nomor_ijazah;tanggal_lulus;email;file_pdf\nA;1;TI;S.Kom;1;2027-02-20;a@b.id;a.pdf\n";
    assert_eq!(baca(teks).err(), Some(GalatCsv::PemisahTitikKoma));
}

#[test]
fn baris_ditolak_tidak_memesan_nim() {
    let teks = format!(
        "{KEPALA}\n{}\n{}\n{}\n",
        baris("A", "231011402890", "1/UNPAM/2026", "a@b.id"),
        baris("B", "231011402891", "1/UNPAM/2026", "b@b.id"),
        baris("C", "231011402891", "3/UNPAM/2026", "c@c.id"),
    );
    let h = baca(&teks).unwrap();
    assert_eq!(h.galat.len(), 1, "{:?}", h.galat);
    assert_eq!(h.galat[0].nomor_baris, 3);
    assert_eq!(
        h.baris
            .iter()
            .map(|b| b.data.nama.as_str())
            .collect::<Vec<_>>(),
        ["A", "C"]
    );
}
