import { describe, expect, it } from 'vitest';
import { getEnv } from './env';

describe('getEnv', () => {
  it('validates required DATABASE_URL and AUTH_SECRET', () => {
    const originalDb = process.env.DATABASE_URL;
    const originalAuth = process.env.AUTH_SECRET;
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.AUTH_SECRET = 'test-auth-secret-must-be-32-chars-min';

    expect(getEnv().DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
    expect(getEnv().AUTH_SECRET).toBe('test-auth-secret-must-be-32-chars-min');

    process.env.DATABASE_URL = originalDb;
    process.env.AUTH_SECRET = originalAuth;
  });

  it('throws on invalid DATABASE_URL', () => {
    const originalDb = process.env.DATABASE_URL;
    const originalAuth = process.env.AUTH_SECRET;
    process.env.DATABASE_URL = 'not-a-url';
    process.env.AUTH_SECRET = 'test-auth-secret-must-be-32-chars-min';

    expect(() => getEnv()).toThrow('Invalid environment variables');

    process.env.DATABASE_URL = originalDb;
    process.env.AUTH_SECRET = originalAuth;
  });
});
