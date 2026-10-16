import init, * as core from '../wasm/pusaka_core.js';

let siap: Promise<typeof core> | null = null;

/** Muat `pusaka-core.wasm` sekali, saat pertama dibutuhkan. */
export function muatCore(): Promise<typeof core> {
  siap ??= init().then(() => core);
  return siap;
}
