import { getStoreSettings } from '@/lib/store';
import { IntasendBadge } from '@/components/payment/intasend-badge';
import { Container } from '@repo/ui';
import { buildWhatsAppLink } from '@repo/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { getCachedActiveBrands, getCachedBrandBySlug, getCachedCategoryBySlug, getCachedRootCategories } from '@/lib/catalog-cache';

/**
 * Storefront footer.
 *
 * Carries the contact, policy, and payment-method information shoppers look
 * for before paying — the storefront previously ended at the last product
 * card, with no contact route, no policies, and no copyright anywhere.
 */
export async function SiteFooter() {
  const [store, categories] = await Promise.all([
    getStoreSettings(),
    getCachedRootCategories(),
  ]);

  const year = new Date().getFullYear();
  const whatsappHref = buildWhatsAppLink(store.whatsappNumber);

  return (
    <footer className="mt-16 border-t border-border bg-card">
      <Container className="py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.8fr_0.9fr_1.5fr]">
          <div className="space-y-3">
            <Link href="/" className="flex min-h-11 items-center gap-2 font-semibold tracking-tight">
              <Image
                src="/images/logo.png"
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
              <span>{store.name}</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Genuine phone and audio accessories, delivered across Kenya.
            </p>
          </div>

          <nav aria-labelledby="footer-shop" className="space-y-3">
            <h2 id="footer-shop" className="text-sm font-semibold">
              Shop
            </h2>
            <ul className="space-y-0 text-sm md:space-y-2">
              <li>
                <Link href="/products" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground md:min-h-0">
                  All products
                </Link>
              </li>
              {categories.slice(0, 4).map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/categories/${category.slug}`}
                    className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground md:min-h-0"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-help" className="space-y-3">
            <h2 id="footer-help" className="text-sm font-semibold">
              Help
            </h2>
            <ul className="space-y-0 text-sm md:space-y-2">
              <li>
                <Link href="/account/orders" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground md:min-h-0">
                  Track my order
                </Link>
              </li>
              <li>
                <Link
                  href="/saved"
                  className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground md:min-h-0"
                >
                  Saved items
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground md:min-h-0">
                  Shipping &amp; delivery
                </Link>
              </li>
              <li>
                <Link href="/returns" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground md:min-h-0">
                  Returns &amp; refunds
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground md:min-h-0">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground md:min-h-0">
                  Terms of sale
                </Link>
              </li>
            </ul>
          </nav>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Get in touch</h2>
            <ul className="space-y-0 text-sm text-muted-foreground md:space-y-2">
              <li className="flex min-h-11 items-center gap-2 md:min-h-0 md:items-start">
                <Phone className="h-4 w-4 shrink-0 md:mt-0.5" aria-hidden="true" />
                <a href={`tel:${store.phone.replace(/\s+/g, '')}`} className="inline-flex min-h-11 items-center hover:text-foreground md:min-h-0">
                  {store.phone}
                </a>
              </li>
              <li className="flex min-h-11 items-center gap-2 md:min-h-0 md:items-start">
                <Mail className="h-4 w-4 shrink-0 md:mt-0.5" aria-hidden="true" />
                <a href={`mailto:${store.email}`} className="inline-flex min-h-11 min-w-0 items-center break-words hover:text-foreground md:min-h-0">
                  {/* Break after the @ if it must wrap, never in the middle of a word. */}
                  <span>
                    {store.email.split('@')[0]}
                    {store.email.includes('@') ? (
                      <>
                        @<wbr />
                        {store.email.split('@').slice(1).join('@')}
                      </>
                    ) : null}
                  </span>
                </a>
              </li>
              <li className="flex min-h-11 items-center gap-2 md:min-h-0 md:items-start">
                <MapPin className="h-4 w-4 shrink-0 md:mt-0.5" aria-hidden="true" />
                <span>{store.address}</span>
              </li>
            </ul>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted md:min-h-9"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            &copy; {year} {store.name}. All rights reserved.
          </p>
          <div className="flex flex-col gap-3 sm:items-end">
            <p className="text-sm text-muted-foreground">
              We accept <span className="font-medium text-foreground">M-Pesa</span> and cash on delivery in Nairobi
            </p>
            <IntasendBadge />
          </div>
        </div>
      </Container>
    </footer>
  );
}
