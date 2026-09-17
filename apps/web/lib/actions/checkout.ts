'use server';

import { auth } from '@/auth';
import { resolveCart } from '@/lib/cart';
import { addressSchema } from '@/lib/validations/checkout';
import { rememberGuestOrder } from '@/lib/guest-orders';
import { clientIdentifier, rateLimit, retryMessage } from '@/lib/rate-limit';
import { createRepositories } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

export type CheckoutActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const guestEmailSchema = z.string().trim().email('Enter a valid email address.').max(200);

export async function placeOrderAction(
  _prevState: CheckoutActionState | null,
  formData: FormData
): Promise<CheckoutActionState> {
  // Checkout no longer requires an account. Requiring one is a well-known
  // cart-abandonment driver, and nothing about placing an order actually
  // needed a user record — Order.userId was already nullable.
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Defense in depth — order creation is already bounded by real cart and
  // inventory state, but nothing stopped a script from hammering this action.
  const limit = rateLimit(`place-order:${await clientIdentifier()}`, 10, 5 * 60_000);
  if (!limit.allowed) {
    return { error: retryMessage(limit.retryAfterSeconds) };
  }

  const repos = createRepositories();
  const { cart } = await resolveCart();

  if (!cart || cart.items.length === 0) {
    return { error: 'Your cart is empty' };
  }

  const addressId = String(formData.get('addressId') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();

  // Guests get their order updates by email, so it's required for them and
  // ignored for signed-in customers (whose account address is used instead).
  let guestEmail: string | undefined;
  if (!userId) {
    const parsedEmail = guestEmailSchema.safeParse(formData.get('guestEmail') ?? '');
    if (!parsedEmail.success) {
      return { fieldErrors: { guestEmail: parsedEmail.error.issues[0]!.message } };
    }
    guestEmail = parsedEmail.data;
  }

  let resolvedAddressId = addressId || undefined;

  if (!resolvedAddressId) {
    const parsed = addressSchema.safeParse({
      name: formData.get('name'),
      phone: formData.get('phone'),
      county: formData.get('county'),
      city: formData.get('city'),
      street: formData.get('street'),
      postalCode: formData.get('postalCode') || undefined,
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

    const address = userId
      ? await repos.address.createForUser(userId, parsed.data)
      : await repos.address.createForGuest(parsed.data);
    resolvedAddressId = address.id;
  } else if (userId) {
    const existing = await repos.address.findByIdForUser(resolvedAddressId, userId);
    if (!existing) {
      return { error: 'Invalid shipping address selected' };
    }
  } else {
    // A guest can't select a saved address — there are none to select.
    return { error: 'Please enter a delivery address.' };
  }

  const couponCode = String(formData.get('couponCode') ?? '').trim() || undefined;

  let orderNumber: string;
  try {
    const order = await repos.order.createFromCart({
      cart,
      userId,
      addressId: resolvedAddressId,
      notes: notes || undefined,
      couponCode,
      guestEmail,
    });
    orderNumber = order.orderNumber;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to place order';
    return { error: message };
  }

  // Signed cookie so this browser can reach the order it just placed. Without
  // it a guest would be redirected to a payment page they have no way to open.
  if (!userId) {
    await rememberGuestOrder(orderNumber);
  }

  revalidatePath('/cart');
  revalidatePath('/', 'layout');
  revalidatePath('/account/orders');

  // Must stay outside the try/catch above. redirect() signals navigation by
  // throwing, so catching it here would swallow the redirect and leave the
  // customer on the checkout form with their order already created, their
  // stock already reserved, and their cart already emptied.
  redirect(`/orders/${orderNumber}/pay`);
}
