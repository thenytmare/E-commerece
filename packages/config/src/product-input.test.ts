import { describe, expect, it } from 'vitest';
import {
  parseFeaturesJson,
  parseImageUrlsJson,
  parseImageVariantsJson,
  parseVariantsJson,
} from './product-input';

describe('parseVariantsJson', () => {
  it('accepts a valid list and treats a missing field as "not sent"', () => {
    expect(parseVariantsJson(undefined)).toEqual({ ok: true, value: undefined });
    const r = parseVariantsJson(JSON.stringify([{ name: 'Red', hex: '#FF0000', price: 1500, stock: 4 }]));
    expect(r.ok).toBe(true);
  });

  it('rejects malformed JSON', () => {
    expect(parseVariantsJson('{oops').ok).toBe(false);
  });

  it('rejects a negative price', () => {
    const r = parseVariantsJson(JSON.stringify([{ name: 'Red', hex: '#FF0000', price: -5 }]));
    expect(r).toEqual({ ok: false, error: 'Variant price cannot be negative' });
  });

  it('rejects negative or fractional opening stock', () => {
    expect(parseVariantsJson(JSON.stringify([{ name: 'A', hex: '#000', stock: -1 }])).ok).toBe(false);
    expect(parseVariantsJson(JSON.stringify([{ name: 'A', hex: '#000', stock: 1.5 }])).ok).toBe(false);
  });

  it('rejects a bad colour and a duplicate variant id', () => {
    expect(parseVariantsJson(JSON.stringify([{ name: 'A', hex: 'red' }])).ok).toBe(false);
    const dup = JSON.stringify([
      { id: 'v1', name: 'A', hex: '#000' },
      { id: 'v1', name: 'B', hex: '#111' },
    ]);
    expect(parseVariantsJson(dup).ok).toBe(false);
  });
});

describe('other nested payloads', () => {
  it('validates images, image variants and features', () => {
    expect(parseImageUrlsJson('["/a.png"]').ok).toBe(true);
    expect(parseImageUrlsJson('[1]').ok).toBe(false);
    expect(parseImageUrlsJson('nope').ok).toBe(false);
    expect(parseImageVariantsJson('[0,null]')).toEqual({ ok: true, value: [0, null] });
    expect(parseImageVariantsJson('[-1]').ok).toBe(false);
    expect(parseFeaturesJson('["Fast"]').ok).toBe(true);
    expect(parseFeaturesJson('[""]').ok).toBe(false);
  });
});
