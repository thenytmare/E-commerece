import { Button, Input } from '@repo/ui';
import type { Brand } from '@repo/database';

interface CatalogFiltersProps {
  search?: string;
  brands: Brand[];
  activeBrandSlug?: string;
  basePath?: string;
}

export function CatalogFilters({
  search,
  brands,
  activeBrandSlug,
  basePath = '/products',
}: CatalogFiltersProps) {
  return (
    <form method="get" action={basePath} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input
          name="q"
          label="Search"
          placeholder="Search products..."
          defaultValue={search}
        />
      </div>
      <div className="w-full sm:w-48">
        <label htmlFor="brand" className="mb-2 block text-sm font-medium text-foreground">
          Brand
        </label>
        <select
          id="brand"
          name="brand"
          defaultValue={activeBrandSlug ?? ''}
          className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit">Apply</Button>
    </form>
  );
}
