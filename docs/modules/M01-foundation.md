# Module 1 — Foundation & Design System

## Purpose

Establish the monorepo infrastructure, shared tooling, and reusable UI foundation that all future modules depend on.

## Deliverables

- [x] Turborepo monorepo with pnpm workspaces
- [x] TypeScript strict configuration
- [x] ESLint + Prettier setup
- [x] Shared Tailwind design tokens
- [x] `@repo/ui` package with primitives and layouts
- [x] `@repo/utils` with `cn()` utility
- [x] Minimal Next.js storefront showcase
- [x] Vitest unit tests for core components

## Folder Structure

```
packages/ui/src/
├── tokens/           Design token definitions
├── styles/           Global CSS variables
├── primitives/       Button, Input, Badge, Skeleton, Spinner
├── layouts/          Container, Section, Grid
└── patterns/         Heading, Text typography
```

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Radix Slot for Button | Enables `asChild` pattern for Link composition |
| CVA for variants | Type-safe, composable component variants |
| HSL CSS variables | Easy theming; Tailwind integration |
| Separate `@repo/ui` package | Reusable across web + admin apps |
| `output: 'standalone'` | Required for Host Africa VPS deployment |

## Manual Testing Checklist

### Visual

- [ ] Homepage loads at `localhost:3000`
- [ ] Typography is crisp and well-spaced
- [ ] Buttons have hover/active micro-interactions
- [ ] Skeleton cards match product card proportions
- [ ] Color palette feels premium (not generic)

### Responsive

- [ ] Layout works on mobile (375px)
- [ ] Layout works on tablet (768px)
- [ ] Layout works on desktop (1280px+)
- [ ] Touch targets are ≥ 44px (buttons)

### Accessibility

- [ ] Tab through all buttons — focus ring visible
- [ ] Input labels associated correctly
- [ ] Error input announces via `role="alert"`
- [ ] Spinner has screen reader text
- [ ] `prefers-reduced-motion` disables animations

### Performance

- [ ] No layout shift on page load
- [ ] Fonts load without FOUT flash
- [ ] Lighthouse Performance ≥ 90 (local)

## Automated Tests

```bash
pnpm test
```

Covers: `cn()` utility, Button, Input components.

## Suggested Improvements (Future)

- Storybook for isolated component development
- Dark mode theme toggle
- Additional primitives: Dialog, Select, Toast
- Visual regression testing with Playwright

## Next Module

**M2 — Database & Core Domain Models:** Prisma schema, PostgreSQL, repository pattern.
