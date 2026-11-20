'use client';

import { Button } from '@repo/ui';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

type MenuCategory = { id: string; name: string; slug: string };

/**
 * "Categories" button in the site header. Opens a short list of every
 * category, so customers can jump to one from any page.
 * Closes on Escape, on a click outside, and when the page changes.
 */
export function CategoryMenu({ categories }: { categories: MenuCategory[] }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const menuId = useId();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (categories.length === 0) return null;

  return (
    <div ref={wrapper} className="relative">
      {/* Same button style as Products and Cart beside it. */}
      <Button
        ref={button}
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        Categories
        <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </Button>

      {open && (
        <div
          id={menuId}
          className="absolute left-1/2 top-full z-50 mt-2 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card p-2 shadow-lg"
        >
          <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/categories/${category.slug}`}
                  className="block rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-border pt-1">
            <Link
              href="/products"
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-primary hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              All products
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
