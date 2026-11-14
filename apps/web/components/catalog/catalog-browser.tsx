'use client';

import { cn } from '@repo/utils';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';

/**
 * Filters for the Products and category pages.
 *
 * Computer: a panel on the left (categories, brands) that updates the results
 * straight away, with search, sort and the chosen filters above the products.
 * Phone: search, a "Filters" button that opens a panel from the bottom with a
 * live "Show N results" button, sort, and a swipeable row of categories.
 *
 * Everything lives in the address (?q=&brand=a,b&sort=), so links, the back
 * button and sharing all keep the filters.
 */

export type FacetOption = { slug: string; name: string; count: number };

type State = { q?: string; brands: string[]; sort: string };

interface Props {
  /** "/products", or "/categories/<slug>" on a category page. */
  basePath: string;
  activeCategorySlug?: string;
  activeCategoryName?: string;
  categories: FacetOption[];
  brands: FacetOption[];
  state: State;
  sortOptions: { value: string; label: string }[];
  total: number;
  children: ReactNode;
}

const BRANDS_SHOWN = 8;

function href(path: string, state: State): string {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.brands.length > 0) params.set('brand', state.brands.join(','));
  if (state.sort && state.sort !== 'newest') params.set('sort', state.sort);
  // Plain commas between brands read better in a shared link than %2C.
  const query = params.toString().replace(/%2C/gi, ',');
  return query ? `${path}?${query}` : path;
}

function categoryPath(slug?: string): string {
  return slug ? `/categories/${slug}` : '/products';
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/* ── Pieces shared by the sidebar and the phone panel ───────────────────── */

function CategoryList({
  categories,
  active,
  state,
  onPick,
}: {
  categories: FacetOption[];
  active?: string;
  state: State;
  onPick?: () => void;
}) {
  const item = (slug: string | undefined, name: string, count?: number) => {
    const isActive = slug === active;
    return (
      <li key={slug ?? 'all'}>
        <Link
          href={href(categoryPath(slug), state)}
          onClick={onPick}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'flex min-h-[40px] items-center justify-between gap-3 rounded-md px-3 text-sm transition-colors',
            isActive ? 'bg-primary/10 font-semibold text-primary' : 'text-foreground hover:bg-muted'
          )}
        >
          <span className="truncate">{name}</span>
          {count !== undefined && <span className="shrink-0 text-xs text-muted-foreground">{count}</span>}
        </Link>
      </li>
    );
  };
  return (
    <ul className="space-y-0.5">
      {item(undefined, 'All products')}
      {categories.map((category) => item(category.slug, category.name, category.count))}
    </ul>
  );
}

function BrandList({
  brands,
  selected,
  onToggle,
  idPrefix,
}: {
  brands: FacetOption[];
  selected: string[];
  onToggle: (slug: string) => void;
  idPrefix: string;
}) {
  const [showAll, setShowAll] = useState(false);
  if (brands.length === 0) return <p className="px-3 text-sm text-muted-foreground">No brands for this selection.</p>;
  // Ticked brands always stay visible, even when the list is shortened.
  const visible = showAll
    ? brands
    : brands.filter((brand, index) => index < BRANDS_SHOWN || selected.includes(brand.slug));

  return (
    <div>
      <ul className="space-y-0.5">
        {visible.map((brand) => {
          const id = `${idPrefix}-brand-${brand.slug}`;
          return (
            <li key={brand.slug}>
              <label
                htmlFor={id}
                className="flex min-h-[40px] cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-foreground hover:bg-muted"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={selected.includes(brand.slug)}
                  onChange={() => onToggle(brand.slug)}
                  className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                />
                <span className="flex-1 truncate">{brand.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{brand.count}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {brands.length > BRANDS_SHOWN && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="mt-1 min-h-[40px] px-3 text-sm font-medium text-primary hover:underline"
        >
          {showAll ? 'Show fewer brands' : `Show all ${brands.length} brands`}
        </button>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export function CatalogBrowser({
  basePath,
  activeCategorySlug,
  activeCategoryName,
  categories,
  brands,
  state,
  sortOptions,
  total,
  children,
}: Props) {
  const router = useRouter();
  // The address we asked for. Until the page shows it, results are "updating".
  const [requested, setRequested] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState(state.q ?? '');
  const panelRef = useRef<HTMLDivElement>(null);
  const panelTitleId = useId();

  // Ticks and the sort choice change on screen at once; the results follow
  // when the server answers. Both reset to the address once it updates.
  const [brandsShown, setBrandsShown] = useState(state.brands);
  const [sortShown, setSortShown] = useState(state.sort);
  const brandsKey = state.brands.join(',');
  useEffect(() => setBrandsShown(brandsKey ? brandsKey.split(',') : []), [brandsKey]);
  useEffect(() => setSortShown(state.sort), [state.sort]);
  useEffect(() => setQuery(state.q ?? ''), [state.q]);
  useFocusTrap(panelRef, panelOpen, () => setPanelOpen(false));

  const current = href(basePath, state);
  useEffect(() => setRequested(null), [current]);
  const pending = requested !== null && requested !== current;

  const go = (next: State) => {
    const target = href(basePath, next);
    if (target === current) return;
    setRequested(target);
    router.replace(target, { scroll: false });
  };

  const toggleBrand = (slug: string) => {
    const brandsNext = brandsShown.includes(slug)
      ? brandsShown.filter((value) => value !== slug)
      : [...brandsShown, slug];
    setBrandsShown(brandsNext);
    go({ ...state, brands: brandsNext });
  };

  const brandName = (slug: string) => brands.find((brand) => brand.slug === slug)?.name ?? slug;
  const activeCount = (activeCategorySlug ? 1 : 0) + state.brands.length;
  const hasAnyFilter = activeCount > 0 || Boolean(state.q);

  const searchForm = (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        go({ ...state, q: query.trim() || undefined });
      }}
      className="relative flex-1"
    >
      <label htmlFor={`${panelTitleId}-search`} className="sr-only">
        Search products
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        id={`${panelTitleId}-search`}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={activeCategoryName ? `Search in ${activeCategoryName}` : 'Search products'}
        className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </form>
  );

  const sortSelect = (id: string) => (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="hidden whitespace-nowrap text-sm text-muted-foreground lg:inline">
        Sort by
      </label>
      <select
        id={id}
        aria-label="Sort by"
        value={sortShown}
        onChange={(event) => {
          setSortShown(event.target.value);
          go({ ...state, sort: event.target.value });
        }}
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const chips = hasAnyFilter && (
    <div className="flex flex-wrap items-center gap-2" aria-label="Chosen filters">
      {activeCategorySlug && activeCategoryName && (
        <Link
          href={href('/products', state)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm hover:border-primary"
          aria-label={`Remove category ${activeCategoryName}`}
        >
          {activeCategoryName} <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
      {state.brands.map((slug) => (
        <button
          key={slug}
          type="button"
          onClick={() => toggleBrand(slug)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm hover:border-primary"
          aria-label={`Remove brand ${brandName(slug)}`}
        >
          {brandName(slug)} <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ))}
      {state.q && (
        <button
          type="button"
          onClick={() => go({ ...state, q: undefined })}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm hover:border-primary"
          aria-label={`Remove search ${state.q}`}
        >
          “{state.q}” <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      <Link href="/products" className="min-h-[36px] px-2 text-sm font-medium text-primary hover:underline">
        Clear all
      </Link>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8">
      {/* Computer: filter panel on the left, stays in view while scrolling. */}
      <aside className="hidden lg:block" aria-label="Filters">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-6 overflow-y-auto pb-6 pr-1">
          <section>
            <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</h2>
            <CategoryList categories={categories} active={activeCategorySlug} state={state} />
          </section>
          <section>
            <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brand</h2>
            <BrandList brands={brands} selected={brandsShown} onToggle={toggleBrand} idPrefix="side" />
          </section>
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        {/* Search, filters button (phone) and sort. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {searchForm}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              aria-haspopup="dialog"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium sm:flex-none lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
            {sortSelect(`${panelTitleId}-sort`)}
          </div>
        </div>

        {/* Phone and tablet: categories as one swipeable row. */}
        <nav aria-label="Categories" className="lg:hidden">
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
            {[{ slug: undefined as string | undefined, name: 'All' }, ...categories].map((category) => {
              const isActive = category.slug === activeCategorySlug;
              return (
                <li key={category.slug ?? 'all'} className="shrink-0">
                  <Link
                    href={href(categoryPath(category.slug), state)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full border px-4 text-sm transition-colors',
                      isActive ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary'
                    )}
                  >
                    {category.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {pending ? 'Updating…' : plural(total, 'product')}
          </p>
        </div>
        {chips}

        <div className={cn('transition-opacity', pending && 'opacity-60')}>{children}</div>
      </div>

      {/* Phone: filter panel from the bottom. */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPanelOpen(false)} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={panelTitleId}
            className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-card shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 id={panelTitleId} className="text-base font-semibold">
                Filters
              </h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-2 py-4">
              <section>
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</h3>
                <CategoryList
                  categories={categories}
                  active={activeCategorySlug}
                  state={state}
                  onPick={() => setPanelOpen(false)}
                />
              </section>
              <section>
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brand</h3>
                <BrandList brands={brands} selected={brandsShown} onToggle={toggleBrand} idPrefix="panel" />
              </section>
            </div>
            <div className="flex gap-3 border-t border-border p-4">
              {hasAnyFilter && (
                <Link
                  href="/products"
                  onClick={() => setPanelOpen(false)}
                  className="inline-flex h-12 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium"
                >
                  Clear all
                </Link>
              )}
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
              >
                {pending ? 'Updating…' : `Show ${plural(total, 'result')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
