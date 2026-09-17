import { auth } from '@/auth';
import { logoutAction } from '@/lib/actions/auth';
import { resolveCart } from '@/lib/cart';
import { canAccessAdmin } from '@/lib/auth/rbac';
import { SearchInput } from '@/components/SearchInput';
import { Badge, Button, Container } from '@repo/ui';
import { Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export async function SiteHeader() {
  const session = await auth();
  const { itemCount } = await resolveCart();
  const isStaff = session?.user ? canAccessAdmin(session.user.roles) : false;

  return (
    // Sticky: on a long product or listing page the cart, search and nav
    // otherwise required scrolling all the way back to the top.
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight shrink-0">
          <Image src="/images/logo.png" alt="Prime Accessories Kenya" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="hidden sm:inline">Prime Accessories Kenya</span>
        </Link>

        <div className="mx-4 hidden max-w-md flex-1 md:block">
          <SearchInput />
        </div>

        <nav className="flex items-center gap-1 sm:gap-3">
          {/* Below md the inline search bar is hidden, so this link is the only
              browse entry point on mobile — it needs its own visible label
              (not just a magnifying-glass icon) to read as "browse", not just "search". */}
          <Button variant="ghost" size="sm" asChild className="md:hidden">
            <Link href="/products" aria-label="Browse products">
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="ml-1.5">Shop</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
            <Link href="/products">Products</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="relative">
            <Link href="/cart">
              Cart
              {itemCount > 0 ? (
                <Badge className="ml-1.5 min-w-5 justify-center px-1.5 py-0 text-[10px]">
                  {itemCount > 99 ? '99+' : itemCount}
                </Badge>
              ) : null}
            </Link>
          </Button>
          {session?.user ? (
            <>
              {isStaff ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin">Admin</Link>
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/account">Account</Link>
              </Button>
              <form action={logoutAction}>
                <Button variant="outline" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </nav>
      </Container>
    </header>
  );
}
