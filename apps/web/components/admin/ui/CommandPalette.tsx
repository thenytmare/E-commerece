'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearch } from '@/components/admin/providers/SearchProvider';
import { Search, X, Package, ShoppingCart, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getAdminNavigation } from '@/config/admin-navigation';
import { hasPermission } from '@/lib/auth/permissions';
import type { RoleName } from '@repo/database';
import { adminSearchAction, type AdminSearchResult } from '@/lib/actions/admin-search';

const kindIcon = {
  product: Package,
  order: ShoppingCart,
  customer: Users,
} as const;

const kindLabel = {
  product: 'Products',
  order: 'Orders',
  customer: 'Customers',
} as const;

export function CommandPalette() {
  const { isOpen, query, open, close, setQuery } = useSearch();
  const { data: session } = useSession();
  const router = useRouter();
  const sessionRoles = session?.user?.roles as RoleName[] | undefined;

  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // Roving index across the flattened result list — a palette that can't be
  // driven with the arrow keys isn't really a palette.
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) close(); else open();
      }
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [close, isOpen, open]);

  // Navigation targets come from the same registry the sidebar uses, filtered
  // by the signed-in user's permissions — no separate hardcoded list to drift.
  const navTargets = useMemo(() => {
    const roles = sessionRoles ?? [];
    return getAdminNavigation()
      .flatMap((group) => group.items.map((item) => ({ ...item, group: group.group })))
      .filter(
        (item) => item.href && item.requiredPermissions.every((p) => hasPermission(roles, p))
      );
  }, [sessionRoles]);

  const filteredNav = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return navTargets;
    return navTargets.filter(
      (item) =>
        item.title.toLowerCase().includes(term) || item.group.toLowerCase().includes(term)
    );
  }, [navTargets, query]);

  // Debounced entity lookup so typing doesn't fire a query per keystroke.
  useEffect(() => {
    if (!isOpen) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await adminSearchAction(term);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isOpen]);

  // Drop stale results when the palette is reopened.
  useEffect(() => {
    if (!isOpen) setResults([]);
  }, [isOpen]);

  const grouped = results.reduce<Record<string, AdminSearchResult[]>>((acc, result) => {
    (acc[result.kind] ??= []).push(result);
    return acc;
  }, {});

  // Must match render order exactly: navigation first, then each entity group.
  const options = useMemo(
    () => [
      ...filteredNav.map((item) => ({ id: `nav-${item.href}`, href: item.href! })),
      ...(Object.keys(grouped) as (keyof typeof kindLabel)[]).flatMap((kind) =>
        grouped[kind]!.map((result) => ({
          id: `${result.kind}-${result.id}`,
          href: result.href,
        }))
      ),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredNav, results]
  );

  // Typing changes the list, so the highlight goes back to the top.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  const activeId = options[activeIndex]?.id;

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (options.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % options.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + options.length) % options.length);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActiveIndex(options.length - 1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const target = options[activeIndex];
        if (target) {
          close();
          router.push(target.href);
        }
      }
    },
    [activeIndex, close, options, router]
  );

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    if (!activeId) return;
    listRef.current
      ?.querySelector(`[data-option-id="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  if (!isOpen) return null;

  const nothingAtAll = filteredNav.length === 0 && results.length === 0 && !searching;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={close}
      />

      <div className="relative w-full max-w-lg transform overflow-hidden rounded-xl bg-card border border-border shadow-2xl transition-all flex flex-col mx-4 max-h-[80vh]">
        <div className="relative flex items-center border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-0 focus:ring-0 text-foreground placeholder:text-muted-foreground ml-3 focus:outline-none"
            placeholder="Search pages, products, orders, customers..."
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-listbox"
            aria-activedescendant={activeId ? `option-${activeId}` : undefined}
            aria-autocomplete="list"
          />
          {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-1 rounded-md"
            onClick={close}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          ref={listRef}
          id="command-palette-listbox"
          role="listbox"
          aria-label="Results"
          className="flex-1 overflow-y-auto p-2"
        >
          {nothingAtAll ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No matches</p>
          ) : null}

          {filteredNav.length > 0 && (
            <>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
                Navigation
              </div>
              {filteredNav.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href!}
                  id={`option-nav-${item.href}`}
                  data-option-id={`nav-${item.href}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-foreground ${
                    activeIndex === index ? 'bg-muted' : 'hover:bg-muted'
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={close}
                >
                  {item.icon ? (
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <span className="h-5 w-5" />
                  )}
                  <span>{item.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{item.group}</span>
                </Link>
              ))}
            </>
          )}

          {(Object.keys(grouped) as (keyof typeof kindLabel)[]).map((kind) => {
            const Icon = kindIcon[kind];
            return (
              <div key={kind}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 mt-1">
                  {kindLabel[kind]}
                </div>
                {grouped[kind]!.map((result) => {
                  const optionId = `${result.kind}-${result.id}`;
                  const index = options.findIndex((option) => option.id === optionId);
                  return (
                  <Link
                    key={optionId}
                    href={result.href}
                    id={`option-${optionId}`}
                    data-option-id={optionId}
                    role="option"
                    aria-selected={activeIndex === index}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-foreground ${
                      activeIndex === index ? 'bg-muted' : 'hover:bg-muted'
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={close}
                  >
                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate">{result.title}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {result.subtitle}
                      </span>
                    </span>
                  </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
