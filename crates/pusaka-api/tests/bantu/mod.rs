//! Alat bantu tes integrasi: layanan palsu (Privy, IPFS, rantai), token JWT uji,
//! tanda tangan pejabat, dan pemanggil router.
#![allow(dead_code)]

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use async_trait::async_trait;
use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use k256::ecdsa::SigningKey;
use pusaka_api::auth::{CacheSesi, PemeriksaToken};
use pusaka_api::galat::Galat;
use pusaka_api::layanan::{Ipfs, Log, Privy, Rantai, Receipt};
use pusaka_api::negara::Negara;
use pusaka_api::rantai::{peran_operator, peran_penandatangan, topik_dicabut, topik_diterbitkan};
use pusaka_core::eip712::{self, Domain, Pencabutan, Penerbitan};
use pusaka_core::hash::keccak256;
use pusaka_core::heks::{alamat, dari_hex32, ke_hex};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

pub const APP_ID: &str = "app-uji";

// Pasangan kunci ES256 KHUSUS TES (dibuat openssl untuk rencana ini, tidak dipakai di mana pun).
pub const KUNCI_JWT: &str = "-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg7L+TaFQGQvFH+hnv
dmFKEZhR0j0yN9UnNTNTeHMIFPGhRANCAATlz5G9oISvfhp79ny7Fq/rVZ6a8RtP
l4DBLYR1z+jIy6yRvGZM+TQ89WAkEythJBI5WXMtxKtm85Ge+eLYQ3UV
-----END PRIVATE KEY-----
";
pub const KUNCI_JWT_PUBLIK: &str = "-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE5c+RvaCEr34ae/Z8uxav61WemvEb
T5eAwS2Edc/oyMuskbxmTPk0PPVgJBMrYSQSOVlzLcSrZvORnvni2EN1FQ==
-----END PUBLIC KEY-----
";
/// Kunci lain untuk memalsukan token.
pub const KUNCI_JWT_LAIN: &str = "-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgeEHtwxYfQR5RALDf
gqxAohdDZjkjxPCmr2ovWzOFMq6hRANCAAQX/BW8HbjMzKDoDRmt0kpck+wXbVnA
c7DsFFigvOn0e9+XkbnDlVjJx4gdNro6yrNd3TPBJCQ9v1IasPoi9qFs
-----END PRIVATE KEY-----
";

// Kunci Anvil (publik, hanya untuk tes).
pub const KUNCI_REKTOR: &str = "5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
pub const KUNCI_OPERATOR: &str = "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
pub const OPERATOR: &str = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
pub const REKTOR: &str = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
pub const TAMU: &str = "0x90f79bf6eb2c4f870365e785982e1f101e93b906";
pub const KONTRAK: &str = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

pub const DID_OPERATOR: &str = "did:privy:operator";
pub const DID_REKTOR: &str = "did:privy:rektor";
pub const DID_ALUMNI: &str = "did:privy:alumni";
pub const DID_TAMU: &str = "did:privy:tamu";
pub const EMAIL_ALUMNI: &str = "alumni@unpam.ac.id";
pub const KUNCI_MASTER: [u8; 32] = [7; 32];

pub fn a(s: &str) -> [u8; 20] {
    alamat(s).unwrap()
}

/// Wallet "Privy" alumni yang deterministik dari email.
pub fn alamat_alumni(email: &str) -> [u8; 20] {
    let h = keccak256(email.trim().to_lowercase().as_bytes());
    let mut w = [0u8; 20];
    w.copy_from_slice(&h[12..]);
    w
}

pub fn domain() -> Domain {
    Domain {
        chain_id: 31337,
        kontrak: a(KONTRAK),
    }
}

// ------------------------------------------------------------------ layanan palsu

#[derive(Default)]
pub struct PrivyPalsu {
    pub pengguna: Mutex<HashMap<String, Vec<[u8; 20]>>>,
    pub panggilan_alumni: AtomicUsize,
}

#[async_trait]
impl Privy for PrivyPalsu {
    async fn wallet_pengguna(&self, did: &str) -> Result<Vec<[u8; 20]>, Galat> {
        Ok(self
            .pengguna
            .lock()
            .unwrap()
            .get(did)
            .cloned()
            .unwrap_or_default())
    }

    async fn wallet_alumni(&self, email: &str) -> Result<[u8; 20], Galat> {
        self.panggilan_alumni.fetch_add(1, Ordering::SeqCst);
        if email.contains("gagal") {
            return Err(Galat::LayananLuar("Privy menjawab 500".into()));
        }
        Ok(alamat_alumni(email))
    }
}

#[derive(Default)]
pub struct IpfsPalsu {
    pub unggahan: Mutex<Vec<(String, Vec<u8>)>>,
}

#[async_trait]
impl Ipfs for IpfsPalsu {
    async fn unggah(&self, nama: &str, isi: Vec<u8>) -> Result<String, Galat> {
        let cid = format!("bafy{}", hex::encode(&keccak256(&isi)[..8]));
        self.unggahan.lock().unwrap().push((nama.to_owned(), isi));
        Ok(cid)
    }
}

#[derive(Default)]
pub struct RantaiPalsu {
    pub peran: Mutex<HashSet<([u8; 32], [u8; 20])>>,
    pub receipt: Mutex<HashMap<[u8; 32], Receipt>>,
    pub panggilan_peran: AtomicUsize,
}

impl RantaiPalsu {
    pub fn beri(&self, peran: [u8; 32], akun: [u8; 20]) {
        self.peran.lock().unwrap().insert((peran, akun));
    }

    pub fn cabut_peran(&self, peran: [u8; 32], akun: [u8; 20]) {
        self.peran.lock().unwrap().remove(&(peran, akun));
    }

    pub fn pasang_receipt(&self, tx: [u8; 32], r: Receipt) {
        self.receipt.lock().unwrap().insert(tx, r);
    }
}

#[async_trait]
impl Rantai for RantaiPalsu {
    async fn punya_peran(&self, peran: [u8; 32], akun: [u8; 20]) -> Result<bool, Galat> {
        self.panggilan_peran.fetch_add(1, Ordering::SeqCst);
        Ok(self.peran.lock().unwrap().contains(&(peran, akun)))
    }

    async fn receipt(&self, tx: [u8; 32]) -> Result<Option<Receipt>, Galat> {
        Ok(self.receipt.lock().unwrap().get(&tx).cloned())
    }
}

// ------------------------------------------------------------------ aplikasi uji

pub struct Uji {
    pub app: Router,
    pub db: PgPool,
    pub privy: Arc<PrivyPalsu>,
    pub ipfs: Arc<IpfsPalsu>,
    pub rantai: Arc<RantaiPalsu>,
}

/// Pool yang tidak pernah tersambung, untuk tes yang tidak menyentuh basis data.
pub fn pool_malas() -> PgPool {
    sqlx::postgres::PgPoolOptions::new()
        .connect_lazy("postgres://uji:uji@127.0.0.1:1/tidak_dipakai")
        .unwrap()
}

pub fn siapkan(db: PgPool) -> Uji {
    let privy = Arc::new(PrivyPalsu::default());
    {
        let mut p = privy.pengguna.lock().unwrap();
        p.insert(DID_OPERATOR.into(), vec![a(OPERATOR)]);
        p.insert(DID_REKTOR.into(), vec![a(REKTOR)]);
        p.insert(DID_ALUMNI.into(), vec![alamat_alumni(EMAIL_ALUMNI)]);
        p.insert(DID_TAMU.into(), vec![a(TAMU)]);
    }
    let rantai = Arc::new(RantaiPalsu::default());
    rantai.beri(peran_operator(), a(OPERATOR));
    rantai.beri(peran_penandatangan(), a(REKTOR));
    let ipfs = Arc::new(IpfsPalsu::default());
    let negara = Negara {
        db: db.clone(),
        privy: privy.clone(),
        ipfs: ipfs.clone(),
        rantai: rantai.clone(),
        token: Arc::new(PemeriksaToken::baru(KUNCI_JWT_PUBLIK, APP_ID).unwrap()),
        cache: Arc::new(CacheSesi::baru(Duration::from_secs(300))),
        kunci_master: KUNCI_MASTER,
        domain: domain(),
    };
    Uji {
        app: pusaka_api::router(negara),
        db,
        privy,
        ipfs,
        rantai,
    }
}

// ------------------------------------------------------------------ token & panggilan

#[derive(serde::Serialize)]
struct Klaim<'a> {
    sub: &'a str,
    aud: &'a str,
    iss: &'a str,
    sid: &'a str,
    iat: i64,
    exp: i64,
}

pub fn token_khusus(did: &str, aud: &str, iss: &str, umur_detik: i64, pem: &str) -> String {
    let kini = chrono::Utc::now().timestamp();
    let klaim = Klaim {
        sub: did,
        aud,
        iss,
        sid: "sesi-uji",
        iat: kini,
        exp: kini + umur_detik,
    };
    encode(
        &Header::new(Algorithm::ES256),
        &klaim,
        &EncodingKey::from_ec_pem(pem.as_bytes()).unwrap(),
    )
    .unwrap()
}

pub fn token(did: &str) -> String {
    token_khusus(did, APP_ID, "privy.io", 600, KUNCI_JWT)
}

async fn jawab(app: &Router, req: Request<Body>) -> (StatusCode, Value) {
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v = if b.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&b)
            .unwrap_or_else(|_| json!({ "mentah": String::from_utf8_lossy(&b) }))
    };
    (status, v)
}

pub async fn panggil(
    app: &Router,
    metode: &str,
    uri: &str,
    token: Option<&str>,
    badan: Option<Value>,
) -> (StatusCode, Value) {
    let mut r = Request::builder().method(metode).uri(uri);
    if let Some(t) = token {
        r = r.header("authorization", format!("Bearer {t}"));
    }
    let req = match badan {
        Some(b) => r
            .header("content-type", "application/json")
            .body(Body::from(b.to_string())),
        None => r.body(Body::empty()),
    };
    jawab(app, req.unwrap()).await
}

pub async fn panggil_mentah(
    app: &Router,
    uri: &str,
    token: Option<&str>,
    isi: Vec<u8>,
) -> (StatusCode, Value) {
    let mut r = Request::post(uri).header("content-type", "application/octet-stream");
    if let Some(t) = token {
        r = r.header("authorization", format!("Bearer {t}"));
    }
    jawab(app, r.body(Body::from(isi)).unwrap()).await
}

// ------------------------------------------------------------------ tanda tangan & draf

pub fn tanda_tangani(kunci_hex: &str, digest: &[u8; 32]) -> String {
    let k = SigningKey::from_slice(&hex::decode(kunci_hex).unwrap()).unwrap();
    let (sig, id) = k.sign_prehash_recoverable(digest).unwrap();
    let mut b = sig.to_bytes().to_vec();
    b.push(27 + id.to_byte());
    ke_hex(&b)
}

pub fn sekarang() -> u64 {
    chrono::Utc::now().timestamp() as u64
}

pub fn contoh_draf(i: u8, email: &str) -> Value {
    json!({
        "nama": format!("Lulusan {i}"),
        "nim": format!("2111{i:04}"),
        "prodi": "Teknik Informatika",
        "gelar": "S.Kom.",
        "nomor_ijazah": format!("UNPAM/2027/{i:04}"),
        "tanggal_lulus": "2027-08-30",
        "email": email,
        "doc_hash": ke_hex(&keccak256(&[i])),
        "uri": format!("ipfs://bafymeta{i}"),
        "cid_amplop": format!("bafyamplop{i}"),
        "kunci": ke_hex(&[i.max(1); 32]),
    })
}

/// Buat satu draf sebagai operator, lalu kembalikan detailnya (termasuk kunci).
pub async fn buat_draf(u: &Uji, isi: Value) -> Value {
    let (s, b) = panggil(
        &u.app,
        "POST",
        "/api/draf",
        Some(&token(DID_OPERATOR)),
        Some(json!({ "draf": [isi] })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{b}");
    let id = b["draf"][0]["id"].as_str().unwrap().to_owned();
    let (s, d) = panggil(
        &u.app,
        "GET",
        &format!("/api/draf/{id}"),
        Some(&token(DID_OPERATOR)),
        None,
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{d}");
    d
}

fn h32(v: &Value) -> [u8; 32] {
    dari_hex32(v.as_str().unwrap()).unwrap()
}

/// Tanda tangan `Penerbitan` atas draf (dari JSON API) dengan kunci tertentu.
pub fn ttd_penerbitan(kunci: &str, draf: &Value, batas: u64) -> String {
    let p = Penerbitan {
        penerima: a(draf["penerima"].as_str().unwrap()),
        doc_hash: h32(&draf["doc_hash"]),
        metadata_hash: h32(&draf["metadata_hash"]),
        batas_waktu: batas,
    };
    tanda_tangani(kunci, &eip712::digest_penerbitan(&domain(), &p))
}

pub fn ttd_pencabutan(kunci: &str, token_id: u64, alasan: &str, batas: u64) -> String {
    let c = Pencabutan {
        token_id,
        alasan_hash: keccak256(alasan.as_bytes()),
        batas_waktu: batas,
    };
    tanda_tangani(kunci, &eip712::digest_pencabutan(&domain(), &c))
}

/// Rektor menyetujui draf dengan batas waktu besok.
pub async fn setujui(u: &Uji, draf: &Value) -> (StatusCode, Value) {
    let batas = sekarang() + 86_400;
    let sig = ttd_penerbitan(KUNCI_REKTOR, draf, batas);
    let uri = format!("/api/draf/{}/setujui", draf["id"].as_str().unwrap());
    panggil(
        &u.app,
        "POST",
        &uri,
        Some(&token(DID_REKTOR)),
        Some(json!({ "sig": sig, "batas_waktu": batas })),
    )
    .await
}

pub fn kata_u64(x: u64) -> [u8; 32] {
    let mut w = [0u8; 32];
    w[24..].copy_from_slice(&x.to_be_bytes());
    w
}

pub fn kata_alamat(akun: [u8; 20]) -> [u8; 32] {
    let mut w = [0u8; 32];
    w[12..].copy_from_slice(&akun);
    w
}

pub fn log_diterbitkan(token_id: u64, penerima: [u8; 20], doc: [u8; 32]) -> Log {
    Log {
        alamat: a(KONTRAK),
        topik: vec![
            topik_diterbitkan(),
            kata_u64(token_id),
            kata_alamat(penerima),
            doc,
        ],
        data: kata_alamat(a(REKTOR)).to_vec(),
    }
}

pub fn log_dicabut(token_id: u64, alasan: &str) -> Log {
    Log {
        alamat: a(KONTRAK),
        topik: vec![topik_dicabut(), kata_u64(token_id)],
        data: alasan.as_bytes().to_vec(),
    }
}

/// Setujui draf lalu catat transaksi terbit palsu dengan `token_id`; kembalikan jawaban /api/terbit.
pub async fn terbitkan(u: &Uji, draf: &Value, token_id: u64) -> Value {
    let (s, b) = setujui(u, draf).await;
    assert_eq!(s, StatusCode::OK, "{b}");
    let tx = keccak256(format!("tx-terbit-{token_id}").as_bytes());
    u.rantai.pasang_receipt(
        tx,
        Receipt {
            sukses: true,
            log: vec![log_diterbitkan(
                token_id,
                a(draf["penerima"].as_str().unwrap()),
                h32(&draf["doc_hash"]),
            )],
        },
    );
    let (s, b) = panggil(
        &u.app,
        "POST",
        "/api/terbit",
        Some(&token(DID_OPERATOR)),
        Some(json!({ "tx_hash": ke_hex(&tx) })),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{b}");
    b
}

/// Jalankan `app` di port acak lokal; kembalikan URL dasarnya.
pub async fn layani(app: Router) -> String {
    let pendengar = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let alamat = pendengar.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(pendengar, app).await.unwrap() });
    format!("http://{alamat}")
}
