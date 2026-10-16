//! Ekspor untuk peramban (`wasm-bindgen`). Struktur kompleks dikirim sebagai string JSON.

use wasm_bindgen::prelude::*;

use crate::hash::keccak256;
use crate::heks::ke_hex;

/// Keccak-256 berkas, hasil `0x…` (64 hex).
#[wasm_bindgen]
pub fn keccak256_hex(data: &[u8]) -> String {
    ke_hex(&keccak256(data))
}
