import { describe, expect, it } from 'vitest';
import { attributeName, variantLabel } from '../lib/variant-label.ts';

describe('variantLabel', () => {
  it('names the colour in words and leaves out the hex code', () => {
    expect(variantLabel({ color: 'Black', hex: '#000000' })).toBe('Colour: Black');
  });
  it('lists other options too', () => {
    expect(variantLabel({ color: 'Blue', hex: '#00f', size: 'M' }, ', ')).toBe('Colour: Blue, Size: M');
  });
  it('is empty when there is nothing to say', () => {
    expect(variantLabel(null)).toBe('');
    expect(variantLabel({ hex: '#fff', color: ' ' })).toBe('');
  });
  it('spells colour the UK way', () => {
    expect(attributeName('color')).toBe('Colour');
    expect(attributeName('storage_size')).toBe('Storage size');
  });
});
