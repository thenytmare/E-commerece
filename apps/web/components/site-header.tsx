import { auth } from '@/auth';
import { resolveCart } from '@/lib/cart';
import { canAccessAdmin } from '@/lib/auth/rbac';
import { SearchInput } from '@/components/SearchInput';
import { AccountMenu } from '@/components/account-menu';
import { CategoryMenu } from '@/components/catalog/category-menu';
import { getCachedCategoryCards } from '@/lib/catalog-cache';
import { getThemeChoice } from '@/lib/theme-server';
import { ThemeMenu } from '@/components/theme/theme-menu';
import { Badge, Button, Container } from '@repo/ui';
import { Search, ShoppingCart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export async function SiteHeader() {
  const session = await auth();
  const { itemCount } = await resolveCart();
  const isStaff = session?.user ? canAccessAdmin(session.user.roles) : false;
  const theme = await getThemeChoice();
  // Cached and shared with the homepage cards; a failure must not break the header.
  const menuCategories = await getCachedCategoryCards()
    .then((cards) => cards.map(({ id, name, slug }) => ({ id, name, slug })))
    .catch(() => []);

  return (
    // Sticky: on a long product or listing page the cart, search and nav
    // otherwise required scrolling all the way back to the top.
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <Container className="flex h-16 items-center justify-between gap-2 sm:gap-4">
        <Link
          href="/"
          aria-label="Prime Accessories Kenya, home"
          className="flex min-h-11 items-center gap-2 text-lg font-semibold tracking-tight shrink-0"
        >
          {/* The link's label names the shop, so the picture is not read out a second time. */}
          <Image src="/images/logo.png" alt="" width={32} height={32} className="h-8 w-8 object-contain" />
          {/* The shop name shows wherever the header has room beside the menus. */}
          <span className="hidden sm:inline lg:hidden xl:inline">Prime Accessories Kenya</span>
        </Link>

        <div className="mx-4 hidden max-w-md flex-1 lg:block">
          <SearchInput />
        </div>

        <nav className="flex min-w-0 items-center gap-0.5 sm:gap-2 lg:gap-3">
          {/* Below md the inline search bar is hidden, so this link is the only
              browse entry point on mobile — it needs its own visible label
              (not just a magnifying-glass icon) to read as "browse", not just "search". */}
          {/* 44px tall on phones, so they are easy to tap. */}
          <Button variant="ghost" size="sm" asChild className="h-11 px-2 sm:px-3 md:hidden">
            <Link href="/products" aria-label="Browse products">
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="ml-1.5 hidden min-[360px]:inline">Shop</span>
            </Link>
          </Button>
          <div className="hidden md:block">
            <CategoryMenu categories={menuCategories} />
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
            <Link href="/products">Products</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="relative h-11 min-w-11 sm:h-9">
            <Link href="/cart" aria-label={itemCount > 0 ? `Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : 'Cart'}>
              {/* Icon on phones, word from tablet width up. */}
              <ShoppingCart className="h-5 w-5 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">Cart</span>
              {/* The count sits on the corner, so it never makes the header wider. */}
              {itemCount > 0 ? (
                <Badge className="pointer-events-none absolute -right-0.5 top-0.5 h-5 min-w-5 justify-center px-1 py-0 text-xs leading-none sm:-right-2 sm:-top-1.5">
                  {itemCount > 99 ? '99+' : itemCount}
                </Badge>
              ) : null}
            </Link>
          </Button>
          <ThemeMenu initialTheme={theme} />
          {session?.user ? (
            <>
              {/* Admin, Account and Sign out sit behind one icon at every size, so
                  the header always fits the screen. */}
              <AccountMenu name={session.user.name ?? session.user.email} isStaff={isStaff} />
            </>
          ) : (
            <>
              {/* Phones: Sign in and Register sit behind one person icon, so the header always fits. */}
              <div className="sm:hidden">
                <AccountMenu guest />
              </div>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </nav>
      </Container>
    </header>
  );
}
