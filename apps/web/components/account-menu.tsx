'use client';

import { ChevronDown, LayoutDashboard, LogIn, LogOut, User, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { logoutAction } from '@/lib/actions/auth';

/**
 * Account menu. The header has no room for Admin, Account and Sign out side
 * by side on a small screen, so they sit behind one person icon. For guests
 * on phones it holds Sign in and Register instead.
 * Closes on Escape, on a click outside, and when the page changes.
 */
export function AccountMenu({
  name,
  isStaff = false,
  guest = false,
}: {
  name?: string | null;
  isStaff?: boolean;
  /** Not signed in: show Sign in and Register. */
  guest?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const menuId = useId();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent | TouchEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('touchstart', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('touchstart', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item =
    'flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 text-left text-sm text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none';

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={guest ? 'Sign in or register' : 'Your account'}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 min-w-11 items-center justify-center gap-0.5 rounded-md px-2 text-foreground sm:h-9 sm:min-w-0 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <User className="h-5 w-5" aria-hidden="true" />
        {/* The small arrow shows from tablet width up; phones need the room. */}
        <ChevronDown className={`hidden h-3.5 w-3.5 transition-transform sm:block ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          {guest ? (
            <>
              <Link href="/login" className={item}>
                <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in
              </Link>
              <Link href="/register" className={item}>
                <UserPlus className="h-4 w-4" aria-hidden="true" /> Register
              </Link>
            </>
          ) : (
            <>
              {name && <p className="truncate px-3 pb-1.5 pt-1 text-xs text-muted-foreground">Signed in as {name}</p>}
              <Link href="/account" className={item}>
                <User className="h-4 w-4" aria-hidden="true" /> My account
              </Link>
              {isStaff && (
                <Link href="/admin" className={item}>
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Admin
                </Link>
              )}
              <form action={logoutAction} className="mt-1 border-t border-border pt-1">
                <button type="submit" className={item}>
                  <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
