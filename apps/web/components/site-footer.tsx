import { getStoreSettings } from '@/lib/store';
import { createRepositories } from '@repo/database';
import { Container } from '@repo/ui';
import { buildWhatsAppLink } from '@repo/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';

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
    createRepositories().category.findRootCategories(),
  ]);

  const year = new Date().getFullYear();
  const whatsappHref = buildWhatsAppLink(store.whatsappNumber);

  return (
    <footer className="mt-16 border-t border-border bg-card">
      <Container className="py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
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
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/products" className="text-muted-foreground hover:text-foreground">
                  All products
                </Link>
              </li>
              {categories.slice(0, 4).map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/categories/${category.slug}`}
                    className="text-muted-foreground hover:text-foreground"
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
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/account/orders" className="text-muted-foreground hover:text-foreground">
                  Track my order
                </Link>
              </li>
              <li>
                <Link
                  href="/account/wishlist"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Saved items
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="text-muted-foreground hover:text-foreground">
                  Shipping &amp; delivery
                </Link>
              </li>
              <li>
                <Link href="/returns" className="text-muted-foreground hover:text-foreground">
                  Returns &amp; refunds
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-foreground">
                  Terms of sale
                </Link>
              </li>
            </ul>
          </nav>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Get in touch</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <a href={`tel:${store.phone.replace(/\s+/g, '')}`} className="hover:text-foreground">
                  {store.phone}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <a href={`mailto:${store.email}`} className="break-all hover:text-foreground">
                  {store.email}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{store.address}</span>
              </li>
            </ul>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            &copy; {year} {store.name}. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            We accept <span className="font-medium text-foreground">M-Pesa</span> and major cards
          </p>
        </div>
      </Container>
    </footer>
  );
}
