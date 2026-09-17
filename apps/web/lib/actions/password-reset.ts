'use server';

import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { createRepositories, prisma } from '@repo/database';
import { clientIdentifier, rateLimit, retryMessage } from '@/lib/rate-limit';
import { sendMail } from '@/lib/mail';

const repos = createRepositories();

export type PasswordResetState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

/** How long a reset link stays usable. */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/** Namespaced so these can't collide with any other verification token. */
const IDENTIFIER_PREFIX = 'password-reset:';

/**
 * Only the hash is stored.
 *
 * A stolen database snapshot then yields no usable reset links, the same
 * reasoning that applies to password hashes themselves.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.');

export async function requestPasswordResetAction(
  _prevState: PasswordResetState | null,
  formData: FormData
): Promise<PasswordResetState> {
  const limit = rateLimit(`password-reset:${await clientIdentifier()}`, 5, 15 * 60_000);
  if (!limit.allowed) {
    return { error: retryMessage(limit.retryAfterSeconds) };
  }

  const parsed = emailSchema.safeParse(formData.get('email') ?? '');
  if (!parsed.success) {
    return { fieldErrors: { email: parsed.error.issues[0]!.message } };
  }
  const email = parsed.data;

  try {
    const user = await repos.user.findByEmail(email);

    // Only actually issue a token for a real, usable account — but always
    // return the same response, so this can't be used to discover which
    // addresses have accounts.
    if (user && user.isActive && !user.deletedAt && user.passwordHash) {
      const identifier = `${IDENTIFIER_PREFIX}${email}`;

      // Any earlier link for this account stops working the moment a new one
      // is requested.
      await prisma.verificationToken.deleteMany({ where: { identifier } });

      const token = randomBytes(32).toString('base64url');
      await prisma.verificationToken.create({
        data: {
          identifier,
          token: hashToken(token),
          expires: new Date(Date.now() + TOKEN_TTL_MS),
        },
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

      await sendMail({
        to: email,
        subject: 'Reset your Prime Accessories Kenya password',
        text: [
          'We received a request to reset your password.',
          '',
          `Open this link to choose a new one: ${resetUrl}`,
          '',
          'The link expires in one hour. If you did not ask for this, you can ignore this email — your password will not change.',
        ].join('\n'),
      });
    }
  } catch (error) {
    console.error('Password reset request failed:', error);
    // Deliberately still reports success — see above.
  }

  return { success: true };
}

const resetSchema = z
  .object({
    email: emailSchema,
    token: z.string().min(10, 'This reset link is not valid.'),
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Both passwords must match.',
    path: ['confirmPassword'],
  });

export async function resetPasswordAction(
  _prevState: PasswordResetState | null,
  formData: FormData
): Promise<PasswordResetState> {
  const limit = rateLimit(`password-reset-submit:${await clientIdentifier()}`, 10, 15 * 60_000);
  if (!limit.allowed) {
    return { error: retryMessage(limit.retryAfterSeconds) };
  }

  const parsed = resetSchema.safeParse({
    email: formData.get('email') ?? '',
    token: formData.get('token') ?? '',
    password: formData.get('password') ?? '',
    confirmPassword: formData.get('confirmPassword') ?? '',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }

  const identifier = `${IDENTIFIER_PREFIX}${parsed.data.email}`;

  try {
    const record = await prisma.verificationToken.findUnique({
      where: { token: hashToken(parsed.data.token) },
    });

    if (!record || record.identifier !== identifier || record.expires < new Date()) {
      return { error: 'This reset link has expired or already been used. Request a new one.' };
    }

    const user = await repos.user.findByEmail(parsed.data.email);
    if (!user || !user.isActive || user.deletedAt) {
      return { error: 'This account is no longer active.' };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await repos.user.updatePassword(user.id, passwordHash);

    // Single use — consume every token for this account, so a second copy of
    // the link can't be replayed.
    await prisma.verificationToken.deleteMany({ where: { identifier } });

    return { success: true };
  } catch (error) {
    console.error('Password reset failed:', error);
    return { error: 'Could not reset your password just now. Please try again.' };
  }
}
