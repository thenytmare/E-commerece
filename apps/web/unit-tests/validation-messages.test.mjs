import { afterEach, describe, expect, it, vi } from 'vitest';

// Guards the zod 4 upgrade: customers and admins must keep seeing our own
// wording, not the library's default messages.
const { couponSchema, parseFormData } = await import('@/lib/validations/admin');
const { loginSchema, registerSchema } = await import('@/lib/validations/auth');
const { addressSchema } = await import('@/lib/validations/checkout');

const messages = (result) => result.error.issues.map((i) => i.message);

describe('validation messages', () => {
  it('coupon type keeps its own message', () => {
    const fd = new FormData();
    fd.set('code', 'SAVE10');
    fd.set('value', '10');
    const { fieldErrors } = parseFormData(couponSchema, fd);
    expect(fieldErrors.type).toBe('Select a discount type');
  });

  it('a percentage over 100 is refused on the value field', () => {
    const fd = new FormData();
    fd.set('code', 'HALF');
    fd.set('type', 'PERCENTAGE');
    fd.set('value', '150');
    const { fieldErrors } = parseFormData(couponSchema, fd);
    expect(fieldErrors.value).toBe('A percentage discount cannot be more than 100%');
  });

  it('login and register use our wording', () => {
    expect(messages(loginSchema.safeParse({ email: 'not-an-email', password: '' }))).toEqual([
      'Enter a valid email address',
      'Password is required',
    ]);
    const reg = registerSchema.safeParse({
      name: 'Amina',
      email: 'amina@example.co.ke',
      password: 'longenough1',
      confirmPassword: 'different1',
    });
    expect(messages(reg)).toEqual(['Passwords do not match']);
  });

  it('accepts ordinary Kenyan email addresses', () => {
    for (const email of ['amina@example.co.ke', 'j.otieno+orders@mail.example.com']) {
      expect(loginSchema.safeParse({ email, password: 'x' }).success).toBe(true);
    }
  });

  it('checkout address uses our wording', () => {
    const res = addressSchema.safeParse({ name: 'A', phone: '07', county: '', city: '', street: '' });
    expect(messages(res)).toEqual([
      'Name is required',
      'Enter a valid phone number',
      'County is required',
      'City is required',
      'Street address is required',
    ]);
  });
});

describe('startup check', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.resetModules();
  });

  it('names the missing database setting', async () => {
    delete process.env.DATABASE_URL;
    process.env.AUTH_SECRET = 'x'.repeat(40);
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { validateEnv } = await import('@/lib/env');
    expect(() => validateEnv()).toThrow(/DATABASE_URL is not set/);
  });
});
