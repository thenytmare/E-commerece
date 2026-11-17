'use client';

import { buildWhatsAppLink } from '@repo/utils';
import { Check, Loader2, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addToCartAction } from '@/lib/actions/cart';
import { WishlistButton } from './WishlistButton';

/**
 * The row of buttons under each product card: Add to cart, Save (heart) and
 * WhatsApp. WhatsApp opens a chat with the shop, with a message about this
 * product already typed in.
 */

type Props = {
  productId: string;
  productSlug: string;
  productName: string;
  priceText: string;
  /** The default option, added straight to the cart. Missing if there is none. */
  variantId: string | null;
  /** More than one option (colour, size): send the shopper to choose. */
  hasOptions: boolean;
  soldOut: boolean;
  saved: boolean;
  whatsappNumber: string;
  storeName: string;
  productUrl: string;
};

/** WhatsApp mark, drawn here so it needs no outside image. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.2-1.36A9.93 9.93 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.17-1.15l-.3-.18-3.08.81.82-3-.2-.31a8.18 8.18 0 1 1 6.93 3.83Zm4.49-6.13c-.25-.12-1.46-.72-1.69-.8-.22-.08-.39-.12-.55.12-.16.25-.63.8-.78.97-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-1.97-1.22 7.4 7.4 0 0 1-1.37-1.7c-.14-.25 0-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.55-1.34-.76-1.83-.2-.48-.4-.42-.55-.42h-.47a.9.9 0 0 0-.65.31 2.75 2.75 0 0 0-.86 2.04 4.78 4.78 0 0 0 1 2.53 10.9 10.9 0 0 0 4.18 3.7c.58.25 1.04.4 1.4.51.58.19 1.12.16 1.54.1.47-.07 1.46-.6 1.66-1.18.2-.57.2-1.07.15-1.17-.06-.1-.22-.17-.47-.29Z" />
    </svg>
  );
}

// Slightly narrower on phones, so "Add" still fits on a two-column card.
const square =
  'inline-flex h-11 w-8 shrink-0 sm:h-10 min-[380px]:w-9 sm:w-10 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

export function ProductCardActions(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const message = [
    `Hello ${props.storeName}, I would like to buy this product:`,
    '',
    props.productName,
    `Price: ${props.priceText}`,
    props.productUrl,
    '',
    'Is it available?',
  ].join('\n');

  const add = () => {
    if (!props.variantId) return;
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set('variantId', props.variantId!);
      form.set('quantity', '1');
      const result = await addToCartAction(null, form);
      if (result.success) {
        setAdded(true);
        router.refresh(); // updates the cart count in the header
        setTimeout(() => setAdded(false), 2000);
      } else {
        setError(result.error ?? 'Could not add to cart.');
      }
    });
  };

  const main =
    'inline-flex h-11 min-w-0 flex-1 sm:h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-1 text-[13px] font-semibold min-[380px]:px-1.5 sm:px-2 sm:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="px-2 pb-2.5 min-[380px]:px-3 min-[380px]:pb-3 sm:px-4 sm:pb-4">
      <div className="flex items-center gap-1 min-[380px]:gap-1.5 sm:gap-2">
        {props.soldOut ? (
          <Link href={`/products/${props.productSlug}`} className={`${main} border border-border bg-muted text-muted-foreground`}>
            Sold out
          </Link>
        ) : props.hasOptions || !props.variantId ? (
          <Link
            href={`/products/${props.productSlug}`}
            className={`${main} bg-foreground text-background hover:bg-foreground/90`}
            aria-label={`Choose options for ${props.productName}`}
          >
            Choose
          </Link>
        ) : (
          <button
            type="button"
            onClick={add}
            disabled={pending}
            aria-label={`Add ${props.productName} to cart`}
            className={`${main} bg-foreground text-background hover:bg-foreground/90 disabled:opacity-70`}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : added ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              // The cart icon shows from tablet width up; phones show the word only.
              <ShoppingCart className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
            )}
            <span className="truncate">{added ? 'Added' : 'Add'}</span>
          </button>
        )}

        <WishlistButton
          productId={props.productId}
          productSlug={props.productSlug}
          variantId={props.variantId}
          initialSaved={props.saved}
          className="shrink-0"
          buttonClassName={`${square} border-border bg-background text-foreground hover:bg-muted`}
        />

        <a
          href={buildWhatsAppLink(props.whatsappNumber, message)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ask about ${props.productName} on WhatsApp`}
          className={`${square} border-border bg-background text-[#128C7E] hover:bg-muted dark:text-[#25D366]`}
        >
          <WhatsAppIcon className="h-5 w-5" />
        </a>
      </div>
      <p className="sr-only" aria-live="polite">
        {added ? `${props.productName} added to cart` : ''}
      </p>
      {error && (
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
