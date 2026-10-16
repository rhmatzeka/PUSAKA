//! Logika kripto PUSAKA tanpa I/O. Dipakai backend (native) dan peramban (WASM).
//! Keacakan (kunci, nonce) selalu disuplai pemanggil supaya semua fungsi deterministik.

pub mod amplop;
pub mod csv_lulusan;
pub mod eip712;
pub mod hash;
pub mod heks;
pub mod ttd;

#[cfg(feature = "wasm")]
pub mod wasm;
