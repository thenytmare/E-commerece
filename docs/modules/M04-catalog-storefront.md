# Module 4 — Catalog Storefront

## Purpose

Wire the Next.js storefront to the database layer and deliver browsable product catalog pages — listing, category filtering, search, and product detail views.

## Deliverables

- [x] Product listing page (`/products`) with search, brand filter, pagination
- [x] Category pages (`/categories/[slug]`) with filtered listings
- [x] Product detail page (`/products/[slug]`) with variants, specs, features
- [x] Homepage with featured products and category navigation
- [x] `ProductRepository.findMany` extended with list relations (brand, image, price)
- [x] Catalog components (`ProductCard`, `ProductGrid`, `CategoryNav`, etc.)
- [x] KES price formatting utilities

## Folder Structure

```
apps/web/
├── app/
│   ├── page.tsx                     # Storefront homepage
│   ├── products/
│   │   ├── page.tsx                 # Product listing
│   │   └── [slug]/page.tsx          # Product detail (PDP)
│   └── categories/
│       └── [slug]/page.tsx          # Category listing
├── components/catalog/
│   ├── product-card.tsx
│   ├── product-grid.tsx
│   ├── product-image.tsx
│   ├── category-nav.tsx
│   ├── catalog-filters.tsx
│   ├── pagination.tsx
│   └── product-variant-picker.tsx
└── lib/
    ├── catalog.ts                   # Repository helpers & filter resolution
    └── format.ts                    # Price formatting (KES)
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Homepage — hero, categories, featured products |
| `/products` | Full catalog with `?q=`, `?brand=`, `?page=`, `?featured=true` |
| `/categories/[slug]` | Products filtered by category |
| `/products/[slug]` | Product detail with variants, specs, stock |

## Repository Usage

```typescript
import { createRepositories } from '@repo/database';

const repos = createRepositories();

// Listing with relations
await repos.product.findMany({ categoryId, search: 'earbuds', page: 1 });

// Full product detail
await repos.product.findBySlug('anker-soundcore-liberty-4-nc');

// Categories & brands for navigation
await repos.category.findRootCategories();
await repos.brand.findAllActive();
```

## Manual Testing Checklist

- [ ] Homepage shows categories and featured products from seed data
- [ ] `/products` lists all 3 seeded products
- [ ] Search filters products by name
- [ ] Brand filter narrows results
- [ ] Category pages show correct products
- [ ] PDP displays variants, price, stock, specs, and features
- [ ] Pagination works when products exceed page size

## Next Module

**M5 — Cart:** `CartRepository`, guest cart, cart UI, add-to-cart from PDP.
