'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QuantitySelector } from './QuantitySelector';
import { ShoppingCart, Zap, Check, AlertTriangle } from 'lucide-react';
// `Zap` doubles as the Order Now icon and the flash-sale marker.
import type { ClientProductDetail } from '@/lib/catalog-dtos';
import { addToCartAction } from '@/lib/actions/cart';
import { BackInStockForm } from './BackInStockForm';
import { buildWhatsAppLink } from '@repo/utils';
import { formatDateTime, formatPrice } from '@/lib/format';

interface Props {
  product: ClientProductDetail;
  whatsappNumber?: string;
  selectedVariantId?: string | null;
  onVariantChange?: (variantId: string | null) => void;
  /** Active flash-sale price, if one is running for this product. */
  flashSalePrice?: number | null;
  flashSaleEndsAt?: string | null;
}

function calcDiscount(price: number, compareAt: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function ProductActions({
  product,
  whatsappNumber,
  selectedVariantId,
  onVariantChange,
  flashSalePrice,
  flashSaleEndsAt,
}: Props) {
  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const selected =
    product.variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const router = useRouter();

  const listPrice = selected ? selected.price : product.basePrice;
  // A running flash sale wins over the variant price; the variant price then
  // becomes the "was" figure so the saving is visible.
  const onFlashSale = typeof flashSalePrice === 'number' && flashSalePrice < listPrice;
  const price = onFlashSale ? flashSalePrice : listPrice;
  const regularCompareAt = selected?.compareAtPrice ?? product.compareAtPrice ?? null;
  const compareAt = onFlashSale ? listPrice : regularCompareAt;
  const discount = calcDiscount(price, compareAt);

  const available = selected?.inventory
    ? Math.max(0, selected.inventory.quantity - selected.inventory.reserved)
    : 0;
  const inStock = available > 0;

  // Colour swatches when the variants carry a hex, so the shopper can see the
  // actual colour rather than read its name.
  const variantColors = product.variants
    .map((v) => ({
      id: v.id,
      name: v.attributes?.color ?? '',
      hex: v.attributes?.hex ?? null,
    }))
    .filter((v) => v.hex !== null);

  /**
   * Every other attribute variants differ by — size, capacity, length, and so
   * on — as its own row of choices.
   *
   * Only colour used to be selectable, which meant a product whose variants
   * differed by anything else had every non-default SKU unreachable: it could
   * not be chosen, and therefore could not be bought.
   */
  const attributeGroups = (() => {
    const skip = new Set(['hex', ...(variantColors.length > 1 ? ['color'] : [])]);
    const groups = new Map<string, { value: string; variantId: string }[]>();

    for (const variant of product.variants) {
      for (const [key, rawValue] of Object.entries(variant.attributes ?? {})) {
        if (skip.has(key) || rawValue == null) continue;
        const value = String(rawValue);
        const existing = groups.get(key) ?? [];
        // First variant offering a value wins as that option's target.
        if (!existing.some((option) => option.value === value)) {
          existing.push({ value, variantId: variant.id });
        }
        groups.set(key, existing);
      }
    }

    // A single-option attribute isn't a choice, so it isn't worth a control.
    return [...groups.entries()].filter(([, options]) => options.length > 1);
  })();

  const labelFor = (key: string) => key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]/g, ' ');

  const handleAddToCart = async (): Promise<boolean> => {
    if (!inStock || !selected) return false;
    setAdding(true);
    setCartError(null);
    setJustAdded(false);

    const formData = new FormData();
    formData.append('variantId', selected.id);
    formData.append('quantity', String(quantity));

    const result = await addToCartAction(null, formData);
    setAdding(false);

    if (result.error) {
      setCartError(result.error);
      return false;
    }

    setJustAdded(true);
    router.refresh();
    return true;
  };

  const handleOrderNow = async () => {
    if (!inStock) return;
    const added = await handleAddToCart();
    if (added) {
      router.push('/checkout');
    }
  };

  const handleWhatsApp = () => {
    const number = whatsappNumber ?? '254700000000';
    const message = `Hi! I'm interested in: ${product.name} (${product.brandName}) - ${formatPrice(price)}`;
    window.open(buildWhatsAppLink(number, message), '_blank');
  };

  return (
    <div className="space-y-5">
      {/* Color swatches */}
      {variantColors.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Color:</span>
          {variantColors.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onVariantChange?.(c.id)}
              className={`w-7 h-7 rounded-full border-2 transition-colors ${
                selected?.id === c.id
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-border hover:border-muted-foreground'
              }`}
              style={{ backgroundColor: c.hex ?? '#cccccc' }}
              title={c.name}
              aria-pressed={selected?.id === c.id}
              aria-label={c.name || 'color'}
            />
          ))}
        </div>
      )}

      {/* Remaining variant attributes (size, capacity, ...) */}
      {attributeGroups.map(([key, options]) => (
        <div key={key} className="space-y-1.5">
          <span className="text-xs text-muted-foreground">{labelFor(key)}:</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label={labelFor(key)}>
            {options.map((option) => {
              const isSelected = String(selected?.attributes?.[key] ?? '') === option.value;
              const optionVariant = product.variants.find((v) => v.id === option.variantId);
              const optionAvailable = optionVariant?.inventory
                ? optionVariant.inventory.quantity - optionVariant.inventory.reserved > 0
                : false;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onVariantChange?.(option.variantId)}
                  aria-pressed={isSelected}
                  // Out-of-stock options stay selectable so the shopper can see
                  // the price and sign up to be notified.
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-border hover:border-muted-foreground'
                  } ${optionAvailable ? '' : 'text-muted-foreground line-through decoration-1'}`}
                >
                  {option.value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Flash sale banner */}
      {onFlashSale && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <Zap className="h-4 w-4 text-destructive" />
          <span className="font-medium text-destructive">Flash Sale</span>
          {flashSaleEndsAt && (
            <span className="text-muted-foreground text-xs">
              ends {formatDateTime(flashSaleEndsAt)}
            </span>
          )}
        </div>
      )}

      {/* Price & Discount */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-2xl font-bold text-foreground">
          {formatPrice(price)}
        </span>
        {compareAt && (
          <>
            <span className="text-lg text-muted-foreground line-through">
              {formatPrice(compareAt)}
            </span>
            {discount && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-destructive/10 text-destructive rounded-full">
                -{discount}%
              </span>
            )}
          </>
        )}
      </div>

      {/* Stock Status */}
      <div className="flex items-center gap-1.5">
        {inStock ? (
          <>
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-600 font-medium">In Stock</span>
            {available <= 5 && (
              <span className="text-xs text-amber-600 ml-1">(Only {available} left)</span>
            )}
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive font-medium">Out of Stock</span>
          </>
        )}
      </div>

      {/* Back-in-stock capture (out-of-stock only) */}
      {!inStock && <BackInStockForm productId={product.id} />}

      {/* SKU */}
      {selected?.sku && (
        <div className="text-xs text-muted-foreground">SKU: {selected.sku}</div>
      )}

      {/* Quantity + Buttons */}
      {inStock && (
        <>
          <div>
            <span className="text-xs text-muted-foreground block mb-1">Quantity</span>
            <QuantitySelector quantity={quantity} max={available} onChange={setQuantity} />
          </div>

          <div className="flex flex-col gap-2">
            {/* Primary action: adds to cart, the intended default purchase path. */}
            <button
              type="button"
              onClick={() => handleAddToCart()}
              disabled={adding}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {justAdded ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
              {adding ? 'Adding...' : justAdded ? 'Added to Cart' : 'Add to Cart'}
            </button>
            {/* Secondary: skips the cart and goes straight to checkout — visually
                subordinate so it reads as a shortcut, not a second default. */}
            <button
              type="button"
              onClick={handleOrderNow}
              disabled={adding}
              className="w-full flex items-center justify-center gap-1.5 px-6 py-2 text-sm text-primary font-medium hover:underline disabled:opacity-50 transition-colors"
            >
              <Zap className="h-4 w-4" />
              Buy now, straight to checkout
            </button>
            {cartError && (
              <p className="text-sm text-destructive" role="alert">
                {cartError}
              </p>
            )}
          </div>
        </>
      )}

      {/* WhatsApp: support/questions channel, not a competing checkout path. */}
      <button
        type="button"
        onClick={handleWhatsApp}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-green-700 dark:text-green-500 font-medium border border-green-600/30 rounded-lg hover:bg-green-600/10 transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
        Questions? Ask on WhatsApp
      </button>

      {/*
        Mobile-only sticky purchase bar. Once a shopper scrolls into the
        description/reviews further down the page, the inline Add to Cart
        button above scrolls out of view with nothing to replace it — this
        keeps price + purchase one tap away the whole time, same as the
        `lg:hidden` bar disappears once the desktop layout has the actions
        panel visible without scrolling.
      */}
      {inStock && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-border bg-card px-4 py-3 shadow-elevated lg:hidden"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <span className="min-w-0 flex-1 truncate text-lg font-bold text-foreground">
            {formatPrice(price)}
          </span>
          <button
            type="button"
            onClick={() => handleAddToCart()}
            disabled={adding}
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {justAdded ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
            {adding ? 'Adding...' : justAdded ? 'Added' : 'Add to Cart'}
          </button>
        </div>
      )}
    </div>
  );
}