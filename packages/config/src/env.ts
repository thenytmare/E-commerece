import { z } from 'zod';

/**
 * Server-side environment variables validated at startup.
 * Client-safe vars use NEXT_PUBLIC_ prefix.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  AUTH_SECRET: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and returns typed environment variables.
 * Throws with a clear message if required vars are missing or invalid.
 */
export function getEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }

  return result.data;
}

/**
 * Lazy singleton — only validates when first accessed.
 */
let cachedEnv: Env | undefined;

export function env(): Env {
  if (!cachedEnv) {
    cachedEnv = getEnv();
  }
  return cachedEnv;
}
