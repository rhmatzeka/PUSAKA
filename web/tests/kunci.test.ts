import { describe, expect, test } from 'vitest';
import { kunciDariFragmen, kunciKeFragmen } from '../src/lib/kunci';

describe('kunci di fragmen', () => {
  test('bolak-balik 32 byte', () => {
    const k = Uint8Array.from({ length: 32 }, (_, i) => i * 7 + 250);
    const f = kunciKeFragmen(k);
    expect(f).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(kunciDariFragmen(`#k=${f}`)).toEqual(k);
  });

  test('parameter lain di fragmen tidak mengganggu', () => {
    const f = kunciKeFragmen(new Uint8Array(32).fill(9));
    expect(kunciDariFragmen(`#x=1&k=${f}`)).toEqual(new Uint8Array(32).fill(9));
  });

  test.each(['', '#', '#k=', '#k=abc', `#k=${'A'.repeat(44)}`, `#k=${'A'.repeat(42)}+`, '#kunci=x'])(
    'fragmen %j tidak menghasilkan kunci',
    (h) => expect(kunciDariFragmen(h)).toBeNull(),
  );
});
