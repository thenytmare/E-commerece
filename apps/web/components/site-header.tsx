import { auth } from '@/auth';
import { logoutAction } from '@/lib/actions/auth';
import { canAccessAdmin } from '@/lib/auth/rbac';
import { resolveCart } from '@/lib/cart';
import { Badge, Button, Container } from '@repo/ui';
import Image from 'next/image';
import Link from 'next/link';

export async function SiteHeader() {
  const session = await auth();
  const isAdmin = session?.user ? canAccessAdmin(session.user.roles) : false;
  const { itemCount } = await resolveCart();

  return (
    <header className="border-b border-border bg-card">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Image src="/images/logo.png" alt="Prime Accessories Kenya" width={32} height={32} className="h-8 w-8 object-contain" />
          <span>Prime Accessories Kenya</span>
        </Link>

        <nav className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
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
              <Button variant="ghost" size="sm" asChild>
                <Link href="/account">Account</Link>
              </Button>
              {isAdmin ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin">Admin</Link>
                </Button>
              ) : null}
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
