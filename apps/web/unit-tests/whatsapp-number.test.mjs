import { describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: async () => null }));
const { toWhatsAppNumber } = await import('@/components/catalog/product-grid');

describe('WhatsApp number on product cards', () => {
  it('turns the ways people write Kenyan numbers into the format WhatsApp needs', () => {
    expect(toWhatsAppNumber('0712 345 678')).toBe('254712345678');
    expect(toWhatsAppNumber('0110345678')).toBe('254110345678');
    expect(toWhatsAppNumber('712345678')).toBe('254712345678');
    expect(toWhatsAppNumber('+254 712 345 678')).toBe('254712345678');
    expect(toWhatsAppNumber('254712345678')).toBe('254712345678');
  });
});
