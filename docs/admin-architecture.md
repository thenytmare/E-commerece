# Admin Panel Architecture

This document describes the foundational architecture for the Admin Panel of the e-commerce platform.

## Folder Structure

```
apps/web/
├── app/admin/                   # Next.js App Router for all admin pages
│   ├── layout.tsx               # Shell (Sidebar, TopBar, Providers)
│   └── error.tsx / loading.tsx  # Graceful UI states
├── components/admin/
│   ├── layout/                  # Sidebar, TopBar, UserMenu
│   ├── ui/                      # Reusable components (AdminPage, DataTable, widgets)
│   ├── forms/                   # Reusable form elements for CRUD
│   └── providers/               # AdminContext, ThemeContext
├── config/
│   ├── admin-modules.ts         # Plugin registry for new modules
│   ├── admin-navigation.ts      # Core modules setup
│   ├── dashboard-registry.ts    # Widget registry for the dashboard
│   └── features.ts              # Feature flags
└── lib/auth/
    └── permissions.ts           # Permission definitions and RBAC mapping
```

## Module System (Plug & Play)

We use a plugin architecture to prevent merge conflicts as the system scales to 25+ modules.

### How to add a new module

1. Register it in `config/admin-navigation.ts` using `registerModule`:
```ts
registerModule({
  id: 'blog-module',
  name: 'Blog',
  permissions: ['blog.read'],
  routes: ['/admin/blog'],
  navigation: [
    {
      group: 'Marketing',
      items: [
        {
          title: 'Posts',
          href: '/admin/blog/posts',
          icon: FileText,
          requiredPermissions: ['blog.read']
        }
      ]
    }
  ]
});
```
2. The navigation and breadcrumbs will automatically update. No changes to the `AdminSidebar` component are needed!

## Dashboard Widgets

Do not hardcode widgets into the `Dashboard` page. 
Use the `DashboardRegistry` so widgets can be injected automatically.

```ts
registerDashboardWidget({
  id: "revenue",
  component: RevenueWidget,
  permission: "analytics.read",
  order: 1,
  span: { desktop: 12, tablet: 6, mobile: 1 } // Using a responsive CSS grid layout
});
```

## Permissions & RBAC

Never hardcode roles in navigation. Use granular permissions:
`requiredPermissions: ['products.read']` instead of `roles: ['ADMIN']`.
Roles are mapped to these granular permissions in `lib/auth/permissions.ts`.

## UI Standardization

Every page must wrap its content with `<AdminPage>` for a consistent layout header.
Lists must use `<DataTable>`.
Forms must use the elements in `components/admin/forms/`.
Never hardcode colors; use semantic tokens (`bg-background`, `text-muted`, `border-border`).

## Server State Fetching Pattern

All modules must follow the unified server-state architecture:
`Page ↓ Server Action ↓ Repository ↓ Prisma ↓ Database`

Never import Prisma directly into a UI Component or Middleware!
Middleware must remain Edge-compatible.
