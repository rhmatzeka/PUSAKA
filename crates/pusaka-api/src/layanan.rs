//! Layanan luar di balik trait supaya handler bisa diuji dengan tiruan.

use async_trait::async_trait;

use crate::galat::Galat;

/// Privy: identitas pengguna dan wallet tertanam alumni.
#[async_trait]
pub trait Privy: Send + Sync {
    /// Semua wallet Ethereum yang tertaut ke pengguna (DID). DID tak dikenal → kosong.
    async fn wallet_pengguna(&self, did: &str) -> Result<Vec<[u8; 20]>, Galat>;
    /// Wallet tertanam milik alumni dengan email ini; dibuat bila belum ada.
    async fn wallet_alumni(&self, email: &str) -> Result<[u8; 20], Galat>;
}

/// Penyimpanan IPFS (Pinata).
#[async_trait]
pub trait Ipfs: Send + Sync {
    /// Unggah ke jaringan publik; kembalikan CID.
    async fn unggah(&self, nama: &str, isi: Vec<u8>) -> Result<String, Galat>;
}

/// Pembacaan blockchain (RPC Polygon/Anvil).
#[async_trait]
pub trait Rantai: Send + Sync {
    async fn punya_peran(&self, peran: [u8; 32], akun: [u8; 20]) -> Result<bool, Galat>;
    /// `None` bila transaksi belum ditambang.
    async fn receipt(&self, tx: [u8; 32]) -> Result<Option<Receipt>, Galat>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Receipt {
    pub sukses: bool,
    pub log: Vec<Log>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Log {
    pub alamat: [u8; 20],
    pub topik: Vec<[u8; 32]>,
    pub data: Vec<u8>,
}
