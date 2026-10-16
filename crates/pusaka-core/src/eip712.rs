//! Hash EIP-712 untuk tanda tangan pejabat. Harus identik dengan `_hashTypedDataV4` di kontrak.

use crate::hash::keccak256;

pub const NAMA: &str = "PUSAKA";
pub const VERSI: &str = "2";

const TIPE_DOMAIN: &str =
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
const TIPE_PENERBITAN: &str =
    "Penerbitan(address penerima,bytes32 docHash,bytes32 metadataHash,uint64 batasWaktu)";
const TIPE_PENCABUTAN: &str = "Pencabutan(uint256 tokenId,bytes32 alasanHash,uint64 batasWaktu)";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Domain {
    pub chain_id: u64,
    pub kontrak: [u8; 20],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Penerbitan {
    pub penerima: [u8; 20],
    pub doc_hash: [u8; 32],
    pub metadata_hash: [u8; 32],
    pub batas_waktu: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Pencabutan {
    pub token_id: u64,
    pub alasan_hash: [u8; 32],
    pub batas_waktu: u64,
}

/// Satu "word" ABI (32 byte) dari bilangan tak bertanda.
fn kata_u64(x: u64) -> [u8; 32] {
    let mut w = [0u8; 32];
    w[24..].copy_from_slice(&x.to_be_bytes());
    w
}

fn kata_alamat(a: &[u8; 20]) -> [u8; 32] {
    let mut w = [0u8; 32];
    w[12..].copy_from_slice(a);
    w
}

fn hash_kata(kata: &[[u8; 32]]) -> [u8; 32] {
    keccak256(&kata.concat())
}

pub fn domain_separator(d: &Domain) -> [u8; 32] {
    hash_kata(&[
        keccak256(TIPE_DOMAIN.as_bytes()),
        keccak256(NAMA.as_bytes()),
        keccak256(VERSI.as_bytes()),
        kata_u64(d.chain_id),
        kata_alamat(&d.kontrak),
    ])
}

pub fn struct_hash_penerbitan(p: &Penerbitan) -> [u8; 32] {
    hash_kata(&[
        keccak256(TIPE_PENERBITAN.as_bytes()),
        kata_alamat(&p.penerima),
        p.doc_hash,
        p.metadata_hash,
        kata_u64(p.batas_waktu),
    ])
}

fn struct_hash_pencabutan(c: &Pencabutan) -> [u8; 32] {
    hash_kata(&[
        keccak256(TIPE_PENCABUTAN.as_bytes()),
        kata_u64(c.token_id),
        c.alasan_hash,
        kata_u64(c.batas_waktu),
    ])
}

fn digest(d: &Domain, struktur: [u8; 32]) -> [u8; 32] {
    let mut m = Vec::with_capacity(66);
    m.extend_from_slice(&[0x19, 0x01]);
    m.extend_from_slice(&domain_separator(d));
    m.extend_from_slice(&struktur);
    keccak256(&m)
}

pub fn digest_penerbitan(d: &Domain, p: &Penerbitan) -> [u8; 32] {
    digest(d, struct_hash_penerbitan(p))
}

pub fn digest_pencabutan(d: &Domain, c: &Pencabutan) -> [u8; 32] {
    digest(d, struct_hash_pencabutan(c))
}
