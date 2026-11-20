import type { Serialized } from '@/lib/serialize';
import type { CartWithItems } from '@repo/database';

type FullCartItem = Serialized<CartWithItems['items'][number]>;

/**
 * Only what the row shows. This is all that crosses to the browser, so
 * internal fields (cost price, reserved counts) never reach a customer.
 */
export type CartItem = {
  id: string;
  quantity: number;
  variant: {
    price: number;
    attributes: unknown;
    inventory: { quantity: number; reserved: number } | null;
  };
  product: { name: string; slug: string };
  image: { url: string; alt: string | null } | null;
  /** False when the shop has hidden or removed the product since it was added. */
  available: boolean;
};

/** True when the shop is currently selling this cart line's product. */
export function isCartItemAvailable(item: {
  variant: { product: { isActive: boolean; deletedAt: unknown } };
}): boolean {
  return item.variant.product.isActive && !item.variant.product.deletedAt;
}

/** Narrow a full cart line down to the public fields the row needs. */
export function toPublicCartItem(item: FullCartItem): CartItem {
  const image = item.variant.product.images[0];
  return {
    id: item.id,
    quantity: item.quantity,
    variant: {
      price: item.variant.price,
      attributes: item.variant.attributes,
      inventory: item.variant.inventory
        ? {
            quantity: item.variant.inventory.quantity,
            reserved: item.variant.inventory.reserved,
          }
        : null,
    },
    product: { name: item.variant.product.name, slug: item.variant.product.slug },
    image: image ? { url: image.url, alt: image.alt } : null,
    available: isCartItemAvailable(item),
  };
}
