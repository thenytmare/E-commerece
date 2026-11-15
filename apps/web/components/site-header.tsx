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
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight shrink-0">
          <Image src="/images/logo.png" alt="Prime Accessories Kenya" width={32} height={32} className="h-8 w-8 object-contain" />
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
          <Button variant="ghost" size="sm" asChild className="md:hidden">
            <Link href="/products" aria-label="Browse products">
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="ml-1.5">Shop</span>
            </Link>
          </Button>
          <div className="hidden md:block">
            <CategoryMenu categories={menuCategories} />
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
            <Link href="/products">Products</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="relative">
            <Link href="/cart" aria-label={itemCount > 0 ? `Cart, ${itemCount} items` : 'Cart'}>
              {/* Icon on phones, word from tablet width up. */}
              <ShoppingCart className="h-5 w-5 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">Cart</span>
              {itemCount > 0 ? (
                <Badge className="ml-1.5 min-w-5 justify-center px-1.5 py-0 text-[10px]">
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
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              {/* On the smallest phones, Register lives on the sign-in page. */}
              <Button size="sm" asChild className="hidden min-[375px]:inline-flex">
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </nav>
      </Container>
    </header>
  );
}
