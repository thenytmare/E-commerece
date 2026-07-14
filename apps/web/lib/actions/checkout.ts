'use server';

import { requireAuth } from '@/lib/actions/auth';
import { resolveCart } from '@/lib/cart';
import { addressSchema } from '@/lib/validations/checkout';
import { createRepositories } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type CheckoutActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function placeOrderAction(
  _prevState: CheckoutActionState | null,
  formData: FormData
): Promise<CheckoutActionState> {
  const session = await requireAuth('/login?callbackUrl=/checkout');
  const repos = createRepositories();
  const { cart } = await resolveCart();

  if (!cart || cart.items.length === 0) {
    return { error: 'Your cart is empty' };
  }

  const addressId = String(formData.get('addressId') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
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

    const address = await repos.address.createForUser(session.user.id, parsed.data);
    resolvedAddressId = address.id;
  } else {
    const existing = await repos.address.findByIdForUser(resolvedAddressId, session.user.id);
    if (!existing) {
      return { error: 'Invalid shipping address selected' };
    }
  }

  try {
    const order = await repos.order.createFromCart({
      cart,
      userId: session.user.id,
      addressId: resolvedAddressId,
      notes: notes || undefined,
    });

    revalidatePath('/cart');
    revalidatePath('/', 'layout');
    revalidatePath('/account/orders');
    redirect(`/orders/${order.orderNumber}/pay`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to place order';
    return { error: message };
  }
}
