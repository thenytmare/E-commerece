'use client';

import type { CategoryCard } from '@repo/database';
import {
  BatteryCharging,
  Car,
  Gamepad2,
  HardDrive,
  Headphones,
  House,
  LayoutGrid,
  PlugZap,
  Smartphone,
  Speaker,
  Watch,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

/**
 * Homepage category tiles: large rounded photos with a dark label in the
 * bottom-left corner. Rows alternate two wide tiles, then three, so the
 * section stays short however many categories the admin picks.
 *
 * The photo is the one chosen in the admin (Category Image). Until one is
 * chosen, a product photo stands in, shown whole on a soft background.
 */

const ICONS: [RegExp, LucideIcon][] = [
  [/ear|headphone|audio|neck/i, Headphones],
  [/speaker|sound/i, Speaker],
  [/watch/i, Watch],
  [/power ?bank/i, BatteryCharging],
  [/charg|cable|adapter/i, PlugZap],
  [/power|station|extension|ups/i, Zap],
  [/storage|ssd|drive|memory/i, HardDrive],
  [/gam/i, Gamepad2],
  [/car/i, Car],
  [/phone|mobile|holder/i, Smartphone],
  [/home|kitchen|care|appliance/i, House],
];

function iconFor(name: string): LucideIcon {
  return ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? LayoutGrid;
}

/** 2, 3, 2, 3... A lone last tile goes full width; four left become 2 + 2. */
export function tileRows<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  let index = 0;
  let wide = true;
  while (index < items.length) {
    const left = items.length - index;
    let size = wide ? 2 : 3;
    if (left <= 3) size = left;
    else if (left === 4) size = 2;
    rows.push(items.slice(index, index + size));
    index += size;
    wide = !wide;
  }
  return rows;
}

const ROW_LAYOUT: Record<number, { grid: string; tile: string; sizes: string }> = {
  1: { grid: 'grid-cols-1', tile: 'aspect-[21/8]', sizes: '100vw' },
  2: { grid: 'grid-cols-2', tile: 'aspect-[16/10]', sizes: '50vw' },
  3: { grid: 'grid-cols-3', tile: 'aspect-[4/5] lg:aspect-square', sizes: '33vw' },
};

function Tile({ category, layout, showButton }: { category: CategoryCard; layout: (typeof ROW_LAYOUT)[number]; showButton: boolean }) {
  const [failed, setFailed] = useState(false);
  const Icon = iconFor(category.name);
  const photo = category.coverUrl && !failed ? category.coverUrl : null;

  return (
    <Link
      href={`/categories/${category.slug}`}
      className={`group relative block overflow-hidden rounded-2xl bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/60 ${layout.tile}`}
    >
      {photo ? (
        <Image
          src={photo}
          alt=""
          fill
          sizes={layout.sizes}
          // A photo pasted from another website is shown as it is. Only photos
          // stored on this site go through the image resizer, which refuses
          // hosts it doesn't know and would otherwise break the page.
          unoptimized={!photo.startsWith('/')}
          onError={() => setFailed(true)}
          className={
            category.hasOwnImage
              ? 'object-cover transition-transform duration-500 group-hover:scale-[1.03]'
              : // A stand-in product photo: the whole item on white, not a crop.
                'bg-white object-contain p-8 pb-16 lg:p-12 lg:pb-20 transition-transform duration-500 group-hover:scale-[1.03]'
          }
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/40">
          <Icon className="h-16 w-16 text-muted-foreground/40" aria-hidden="true" />
        </div>
      )}

      {/* Keeps the label readable on the admin's own photos. */}
      {photo && category.hasOwnImage && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
      )}

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 lg:inset-x-5 lg:bottom-5">
        <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-black/70 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-sm lg:px-4 lg:py-2.5 lg:text-base">
          <Icon className="h-4 w-4 shrink-0 lg:h-5 lg:w-5" aria-hidden="true" />
          <span className="truncate">{category.name}</span>
        </span>
        {showButton && (
          <span className="hidden shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition-colors group-hover:bg-neutral-100 md:inline-block">
            Shop now
          </span>
        )}
      </div>
    </Link>
  );
}

const MOBILE_LAYOUT = { grid: '', tile: 'aspect-[4/3]', sizes: '85vw' };

export function CategoryCards({ categories }: { categories: CategoryCard[] }) {
  return (
    <>
      {/* Phones: one row to swipe through, the next tile peeking in, so the
          homepage stays short. */}
      <ul
        aria-label="Categories"
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((category) => (
          <li key={category.id} className={`shrink-0 snap-start ${categories.length === 1 ? 'w-full' : 'w-[82%]'}`}>
            <Tile category={category} layout={MOBILE_LAYOUT} showButton={false} />
          </li>
        ))}
      </ul>

      {/* Tablets and computers: rows of two wide tiles, then three. */}
      <div className="hidden flex-col gap-6 sm:flex">
        {tileRows(categories).map((row) => {
          const layout = ROW_LAYOUT[row.length] ?? ROW_LAYOUT[3]!;
          return (
            <ul key={row.map((c) => c.id).join('-')} className={`grid gap-6 ${layout.grid}`}>
              {row.map((category) => (
                <li key={category.id}>
                  <Tile category={category} layout={layout} showButton={row.length <= 2} />
                </li>
              ))}
            </ul>
          );
        })}
      </div>
    </>
  );
}

/** Small links to the categories that don't have a homepage tile, so phone users can still reach them. */
export function MoreCategories({ categories }: { categories: CategoryCard[] }) {
  if (categories.length === 0) return null;
  return (
    <nav aria-label="More categories" className="mt-6">
      <p className="mb-2 text-sm text-muted-foreground">More categories</p>
      {/* One swipeable row on phones; wraps onto more lines on bigger screens. */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {categories.map((category) => (
          <li key={category.id} className="shrink-0">
            <Link
              href={`/categories/${category.slug}`}
              className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
