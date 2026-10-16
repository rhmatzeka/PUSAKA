//! Autentikasi: token akses Privy (ES256) → DID → wallet (Privy) → peran (kontrak).
//! Wallet dan peran di-cache 5 menit per DID; aksi sensitif tetap memeriksa ulang on-chain.

use std::collections::HashMap;
use std::sync::{Mutex, PoisonError};
use std::time::{Duration, Instant};

use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};

use crate::galat::Galat;
use crate::negara::Negara;
use crate::rantai::{PERAN_ADMIN, peran_operator, peran_penandatangan};

pub struct PemeriksaToken {
    kunci: DecodingKey,
    validasi: Validation,
}

#[derive(Deserialize)]
struct Klaim {
    sub: String,
}

impl PemeriksaToken {
    pub fn baru(pem: &str, app_id: &str) -> Result<Self, String> {
        let kunci = DecodingKey::from_ec_pem(pem.as_bytes()).map_err(|e| e.to_string())?;
        let mut validasi = Validation::new(Algorithm::ES256);
        validasi.set_audience(&[app_id]);
        validasi.set_issuer(&["privy.io"]);
        validasi.set_required_spec_claims(&["exp", "aud", "iss", "sub"]);
        Ok(Self { kunci, validasi })
    }

    /// DID pengguna bila token sah.
    pub fn periksa(&self, token: &str) -> Result<String, Galat> {
        decode::<Klaim>(token, &self.kunci, &self.validasi)
            .map(|d| d.claims.sub)
            .map_err(|_| {
                Galat::TidakTerautentikasi("token Privy tidak valid atau kedaluwarsa".into())
            })
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct Peran {
    pub admin: bool,
    pub operator: bool,
    pub penandatangan: bool,
}

#[derive(Debug, Clone)]
pub struct DataSesi {
    pub wallet: Vec<[u8; 20]>,
    pub peran: Peran,
}

pub struct CacheSesi {
    umur: Duration,
    isi: Mutex<HashMap<String, (Instant, DataSesi)>>,
}

impl CacheSesi {
    const MAKS_ENTRI: usize = 1000;

    pub fn baru(umur: Duration) -> Self {
        Self {
            umur,
            isi: Mutex::default(),
        }
    }

    fn ambil(&self, did: &str) -> Option<DataSesi> {
        let isi = self.isi.lock().unwrap_or_else(PoisonError::into_inner);
        isi.get(did)
            .filter(|(t, _)| t.elapsed() < self.umur)
            .map(|(_, d)| d.clone())
    }

    fn simpan(&self, did: &str, data: DataSesi) {
        let mut isi = self.isi.lock().unwrap_or_else(PoisonError::into_inner);
        if isi.len() >= Self::MAKS_ENTRI {
            isi.retain(|_, (t, _)| t.elapsed() < self.umur);
            if isi.len() >= Self::MAKS_ENTRI {
                isi.clear();
            }
        }
        isi.insert(did.to_owned(), (Instant::now(), data));
    }
}

/// Pengguna yang sudah login.
#[derive(Debug, Clone)]
pub struct Pengguna {
    pub did: String,
    pub wallet: Vec<[u8; 20]>,
    pub peran: Peran,
}

impl Pengguna {
    pub fn wajib_operator(&self) -> Result<(), Galat> {
        if self.peran.operator {
            Ok(())
        } else {
            Err(Galat::PeranTidakCukup("butuh peran operator BAAK".into()))
        }
    }

    pub fn wajib_penandatangan(&self) -> Result<(), Galat> {
        if self.peran.penandatangan {
            Ok(())
        } else {
            Err(Galat::PeranTidakCukup(
                "butuh peran pejabat penanda tangan".into(),
            ))
        }
    }

    pub fn wajib_operator_atau_penandatangan(&self) -> Result<(), Galat> {
        if self.peran.operator || self.peran.penandatangan {
            Ok(())
        } else {
            Err(Galat::PeranTidakCukup(
                "butuh peran operator atau pejabat".into(),
            ))
        }
    }

    pub fn punya_wallet(&self, alamat: &[u8; 20]) -> bool {
        self.wallet.contains(alamat)
    }

    /// Ada wallet pengguna yang memegang `peran` saat ini (dibaca langsung on-chain, tanpa cache).
    pub async fn punya_peran_langsung(&self, n: &Negara, peran: [u8; 32]) -> Result<bool, Galat> {
        for w in &self.wallet {
            if n.rantai.punya_peran(peran, *w).await? {
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// Untuk aksi yang membuka kunci ijazah: peran operator/pejabat dari cache sesi
    /// dipastikan masih berlaku on-chain.
    pub async fn wajib_peran_langsung(&self, n: &Negara) -> Result<(), Galat> {
        let operator =
            self.peran.operator && self.punya_peran_langsung(n, peran_operator()).await?;
        let pejabat = !operator
            && self.peran.penandatangan
            && self.punya_peran_langsung(n, peran_penandatangan()).await?;
        if operator || pejabat {
            Ok(())
        } else {
            Err(Galat::PeranTidakCukup(
                "peran Anda sudah dicabut di blockchain".into(),
            ))
        }
    }
}

async fn muat_sesi(n: &Negara, did: &str) -> Result<DataSesi, Galat> {
    let wallet = n.privy.wallet_pengguna(did).await?;
    let (op, ttd) = (peran_operator(), peran_penandatangan());
    let mut peran = Peran::default();
    for w in &wallet {
        let (admin, operator, penandatangan) = tokio::try_join!(
            n.rantai.punya_peran(PERAN_ADMIN, *w),
            n.rantai.punya_peran(op, *w),
            n.rantai.punya_peran(ttd, *w),
        )?;
        peran.admin |= admin;
        peran.operator |= operator;
        peran.penandatangan |= penandatangan;
    }
    Ok(DataSesi { wallet, peran })
}

impl FromRequestParts<Negara> for Pengguna {
    type Rejection = Galat;

    async fn from_request_parts(parts: &mut Parts, n: &Negara) -> Result<Self, Galat> {
        let token = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or_else(|| {
                Galat::TidakTerautentikasi("header Authorization: Bearer wajib".into())
            })?;
        let did = n.token.periksa(token.trim())?;
        let data = match n.cache.ambil(&did) {
            Some(d) => d,
            None => {
                let d = muat_sesi(n, &did).await?;
                n.cache.simpan(&did, d.clone());
                d
            }
        };
        Ok(Self {
            did,
            wallet: data.wallet,
            peran: data.peran,
        })
    }
}
