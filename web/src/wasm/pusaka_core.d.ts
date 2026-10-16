/* tslint:disable */
/* eslint-disable */

export class HasilBuka {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly data_json: string;
    readonly pdf: Uint8Array;
}

/**
 * Hasil: JSON `{ "baris": [...], "galat": [...] }`.
 */
export function baca_csv(teks: string): string;

export function buka_amplop(kunci: Uint8Array, amplop: Uint8Array): HasilBuka;

export function digest_pencabutan_hex(chain_id: bigint, kontrak: string, token_id: bigint, alasan_hash: string, batas_waktu: bigint): string;

export function digest_penerbitan_hex(chain_id: bigint, kontrak: string, penerima: string, doc_hash: string, metadata_hash: string, batas_waktu: bigint): string;

/**
 * Keccak-256 berkas, hasil `0x…` (64 hex).
 */
export function keccak256_hex(data: Uint8Array): string;

export function segel_amplop(kunci: Uint8Array, nonce: Uint8Array, data_json: string, pdf: Uint8Array): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_hasilbuka_free: (a: number, b: number) => void;
    readonly baca_csv: (a: number, b: number) => [number, number, number, number];
    readonly buka_amplop: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly digest_pencabutan_hex: (a: bigint, b: number, c: number, d: bigint, e: number, f: number, g: bigint) => [number, number, number, number];
    readonly digest_penerbitan_hex: (a: bigint, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: bigint) => [number, number, number, number];
    readonly hasilbuka_data_json: (a: number) => [number, number];
    readonly hasilbuka_pdf: (a: number) => [number, number];
    readonly keccak256_hex: (a: number, b: number) => [number, number];
    readonly segel_amplop: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
