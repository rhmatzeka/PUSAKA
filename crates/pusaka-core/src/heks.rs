//! Konversi hex untuk hash dan alamat. Prefiks `0x` opsional, huruf besar/kecil diterima.

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum GalatHeks {
    #[error("bukan string hex")]
    BukanHex,
    #[error("panjang salah: harus {harus} byte, dapat {dapat}")]
    PanjangSalah { harus: usize, dapat: usize },
}

pub fn ke_hex(b: &[u8]) -> String {
    format!("0x{}", hex::encode(b))
}

fn tetap<const N: usize>(s: &str) -> Result<[u8; N], GalatHeks> {
    let s = s
        .strip_prefix("0x")
        .or_else(|| s.strip_prefix("0X"))
        .unwrap_or(s);
    let byte = hex::decode(s).map_err(|_| GalatHeks::BukanHex)?;
    let dapat = byte.len();
    byte.try_into()
        .map_err(|_| GalatHeks::PanjangSalah { harus: N, dapat })
}

pub fn dari_hex32(s: &str) -> Result<[u8; 32], GalatHeks> {
    tetap::<32>(s)
}

pub fn alamat(s: &str) -> Result<[u8; 20], GalatHeks> {
    tetap::<20>(s)
}
