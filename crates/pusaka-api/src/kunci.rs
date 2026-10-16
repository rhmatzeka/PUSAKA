//! Kunci AES ijazah disimpan terenkripsi dengan KUNCI_MASTER (AES-256-GCM).
//! Format: nonce 12 byte ‖ ciphertext 32 byte ‖ tag 16 byte. AAD = id draf, sehingga kunci
//! yang tersimpan tidak bisa dipindahkan ke draf lain.

use aes_gcm::aead::{Aead, Payload};
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use uuid::Uuid;

use crate::galat::Galat;

const PANJANG: usize = 12 + 32 + 16;

fn sandi(master: &[u8; 32]) -> Aes256Gcm {
    Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(master))
}

pub fn bungkus(master: &[u8; 32], draf: Uuid, kunci: &[u8; 32]) -> Result<Vec<u8>, Galat> {
    let mut nonce = [0u8; 12];
    getrandom::fill(&mut nonce).map_err(|e| Galat::Internal(format!("getrandom: {e}")))?;
    let ct = sandi(master)
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: kunci,
                aad: draf.as_bytes(),
            },
        )
        .map_err(|_| Galat::Internal("enkripsi kunci gagal".into()))?;
    Ok([nonce.as_slice(), &ct].concat())
}

pub fn buka(master: &[u8; 32], draf: Uuid, bungkus: &[u8]) -> Result<[u8; 32], Galat> {
    if bungkus.len() != PANJANG {
        return Err(Galat::Internal("panjang kunci tersimpan salah".into()));
    }
    let (nonce, ct) = bungkus.split_at(12);
    let polos = sandi(master)
        .decrypt(
            Nonce::from_slice(nonce),
            Payload {
                msg: ct,
                aad: draf.as_bytes(),
            },
        )
        .map_err(|_| Galat::Internal("kunci tersimpan tidak dapat dibuka".into()))?;
    polos
        .try_into()
        .map_err(|_| Galat::Internal("kunci tersimpan bukan 32 byte".into()))
}
