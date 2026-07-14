import type { CategoryWithChildren } from '@repo/database';
import { cn } from '@repo/utils';
import Link from 'next/link';

interface CategoryNavProps {
  categories: CategoryWithChildren[];
  activeSlug?: string;
  className?: string;
}

export function CategoryNav({ categories, activeSlug, className }: CategoryNavProps) {
  return (
    <nav className={cn('flex flex-wrap gap-2', className)} aria-label="Categories">
      <Link
        href="/products"
        className={cn(
          'rounded-full border px-4 py-1.5 text-sm transition-colors',
          !activeSlug
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background hover:bg-muted'
        )}
      >
        All
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/categories/${category.slug}`}
          className={cn(
            'rounded-full border px-4 py-1.5 text-sm transition-colors',
            activeSlug === category.slug
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background hover:bg-muted'
          )}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
