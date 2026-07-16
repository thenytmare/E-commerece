'use client';

import React, { useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/providers/AdminProvider';
import { Search, X, Package, ShoppingCart, LayoutDashboard, Tags, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

const QUICK_LINKS = [
  { href: '/admin', label: 'Go to Dashboard', icon: LayoutDashboard },
  { href: '/admin/catalog/products', label: 'Products', icon: Package },
  { href: '/admin/catalog/categories', label: 'Categories', icon: Tags },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/inventory', label: 'Inventory Alerts', icon: ShieldAlert },
] as const;

export function CommandPalette() {
  const { searchOpen, setSearchOpen } = useAdmin();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [searchOpen, setSearchOpen]);

  useEffect(() => {
    if (!searchOpen) setQuery('');
  }, [searchOpen]);

  if (!searchOpen) return null;

  const filtered = QUICK_LINKS.filter((link) =>
    link.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={() => setSearchOpen(false)}
      />

      <div className="relative w-full max-w-lg transform overflow-hidden rounded-xl bg-card border border-border shadow-2xl transition-all flex flex-col mx-4 max-h-[80vh]">
        <div className="relative flex items-center border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-0 focus:ring-0 text-foreground placeholder:text-muted-foreground ml-3 focus:outline-none"
            placeholder="Search navigation..."
            aria-label="Search"
          />
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-1 rounded-md"
            onClick={() => setSearchOpen(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
            Quick Actions
          </div>
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No matches</p>
          ) : (
            filtered.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-md text-foreground"
                onClick={() => setSearchOpen(false)}
              >
                <link.icon className="h-5 w-5 text-muted-foreground" />
                <span>{link.label}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
