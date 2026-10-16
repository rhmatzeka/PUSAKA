//! Logika kripto PUSAKA tanpa I/O. Dipakai backend (native) dan peramban (WASM).
//! Keacakan (kunci, nonce) selalu disuplai pemanggil supaya semua fungsi deterministik.

pub mod amplop;
pub mod hash;
pub mod heks;

#[cfg(feature = "wasm")]
pub mod wasm;
