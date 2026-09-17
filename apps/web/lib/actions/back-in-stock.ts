'use server';

import { createRepositories } from '@repo/database';
import { auth } from '@/auth';
import { clientIdentifier, rateLimit, retryMessage } from '@/lib/rate-limit';
import { z } from 'zod';

const repos = createRepositories();

/**
 * Kenyan mobile number in any of the formats customers actually type:
 * 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX, 2541XXXXXXXX.
 */
const phonePattern = /^(?:\+?254|0)[17]\d{8}$/;

const subscribeSchema = z
  .object({
    productId: z.string().min(1, 'Product is required.'),
    email: z
      .string()
      .trim()
      .email('Enter a valid email address.')
      .max(200)
      .optional(),
    phone: z
      .string()
      .trim()
      .transform((value) => value.replace(/[\s-]/g, ''))
      .refine((value) => phonePattern.test(value), 'Enter a valid Kenyan phone number.')
      .optional(),
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: 'Enter an email address or a phone number.',
    path: ['email'],
  });

export async function subscribeBackInStock(
  _prevState: { success?: boolean; error?: string } | null,
  formData: FormData
) {
  // Public and unauthenticated by design, so it needs its own throttle —
  // otherwise anyone can sign an address up for unlimited restock alerts.
  const limit = rateLimit(`back-in-stock:${await clientIdentifier()}`, 10, 10 * 60_000);
  if (!limit.allowed) {
    return { success: false, error: retryMessage(limit.retryAfterSeconds) };
  }

  const parsed = subscribeSchema.safeParse({
    productId: String(formData.get('productId') ?? ''),
    email: String(formData.get('email') ?? '').trim() || undefined,
    phone: String(formData.get('phone') ?? '').trim() || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Check the details you entered.' };
  }

  try {
    // Link to the account when there is one, so the subscription follows the
    // customer rather than whichever address they happened to type.
    const session = await auth();

    await repos.backInStock.subscribe({
      productId: parsed.data.productId,
      email: parsed.data.email,
      phone: parsed.data.phone,
      userId: session?.user?.id,
    });
    return { success: true };
  } catch (error) {
    console.error('Back-in-stock subscribe failed:', error);
    return { success: false, error: 'Could not sign you up just now. Please try again.' };
  }
}
