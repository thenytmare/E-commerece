import { registerModule } from './admin-modules';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  UserCog,
  Settings,
  Tags,
  Image as ImageIcon,
  ShieldAlert,
  Star,
  Layout,
  Megaphone,
  BellRing,
  Zap
} from 'lucide-react';

// Register core Phase 1 modules here for now.
registerModule({
  id: 'core-dashboard',
  name: 'Dashboard',
  permissions: ['analytics.read'],
  routes: ['/admin'],
  navigation: [
    {
      group: 'Dashboard',
      items: [
        {
          title: 'Dashboard',
          href: '/admin',
          icon: LayoutDashboard,
          requiredPermissions: ['analytics.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'catalog-module',
  name: 'Catalog',
  permissions: ['products.read', 'categories.read', 'brands.read'],
  routes: ['/admin/catalog/products', '/admin/catalog/categories', '/admin/catalog/brands'],
  navigation: [
    {
      group: 'Catalog',
      items: [
        {
          title: 'Products',
          href: '/admin/catalog/products',
          icon: Package,
          requiredPermissions: ['products.read'],
        },
        {
          title: 'Categories',
          href: '/admin/catalog/categories',
          icon: Tags,
          requiredPermissions: ['categories.read'],
        },
        {
          title: 'Brands',
          href: '/admin/catalog/brands',
          icon: ImageIcon,
          requiredPermissions: ['brands.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'inventory-module',
  name: 'Inventory',
  permissions: ['inventory.read', 'inventory.write'],
  routes: ['/admin/inventory'],
  navigation: [
    {
      group: 'Catalog',
      items: [
        {
          title: 'Inventory Alerts',
          href: '/admin/inventory',
          icon: ShieldAlert,
          requiredPermissions: ['inventory.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'customers-module',
  name: 'Customers',
  permissions: ['customers.read'],
  routes: ['/admin/customers'],
  navigation: [
    {
      group: 'Sales',
      items: [
        {
          title: 'Customers',
          href: '/admin/customers',
          icon: Users,
          requiredPermissions: ['customers.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'reviews-module',
  name: 'Reviews',
  permissions: ['customers.read'],
  routes: ['/admin/reviews'],
  navigation: [
    {
      group: 'Marketing',
      items: [
        {
          title: 'Reviews',
          href: '/admin/reviews',
          icon: Star,
          requiredPermissions: ['reviews.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'homepage-module',
  name: 'Homepage Builder',
  permissions: ['settings.write'],
  routes: ['/admin/marketing/homepage'],
  navigation: [
    {
      group: 'Marketing',
      items: [
        {
          title: 'Homepage Builder',
          href: '/admin/marketing/homepage',
          icon: Layout,
          requiredPermissions: ['marketing.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'banners-module',
  name: 'Banners',
  permissions: ['settings.write'],
  routes: ['/admin/marketing/banners'],
  navigation: [
    {
      group: 'Marketing',
      items: [
        {
          title: 'Banners',
          href: '/admin/marketing/banners',
          icon: Megaphone,
          requiredPermissions: ['marketing.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'whatsapp-module',
  name: 'WhatsApp Center',
  permissions: ['settings.write'],
  routes: ['/admin/marketing/whatsapp'],
  navigation: [
    {
      group: 'Marketing',
      items: [
        {
          title: 'WhatsApp Center',
          href: '/admin/marketing/whatsapp',
          icon: Megaphone,
          requiredPermissions: ['marketing.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'coupons-module',
  name: 'Coupons',
  permissions: ['settings.write'],
  routes: ['/admin/marketing/coupons'],
  navigation: [
    {
      group: 'Marketing',
      items: [
        {
          title: 'Coupons',
          href: '/admin/marketing/coupons',
          icon: Megaphone,
          requiredPermissions: ['marketing.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'flash-sales-module',
  name: 'Flash Sales',
  permissions: ['products.write'],
  routes: ['/admin/marketing/flash-sales'],
  navigation: [
    {
      group: 'Marketing',
      items: [
        {
          title: 'Flash Sales',
          href: '/admin/marketing/flash-sales',
          icon: Zap,
          requiredPermissions: ['marketing.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'back-in-stock-module',
  name: 'Back in Stock',
  permissions: ['inventory.read'],
  routes: ['/admin/marketing/back-in-stock'],
  navigation: [
    {
      group: 'Marketing',
      items: [
        {
          title: 'Back in Stock',
          href: '/admin/marketing/back-in-stock',
          icon: BellRing,
          requiredPermissions: ['inventory.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'media-module',
  name: 'Media Library',
  permissions: ['settings.write'],
  routes: ['/admin/media'],
  navigation: [
    {
      group: 'Catalog',
      items: [
        {
          title: 'Media Library',
          href: '/admin/media',
          icon: ImageIcon,
          requiredPermissions: ['media.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'activity-module',
  name: 'Activity Log',
  permissions: ['analytics.read'],
  routes: ['/admin/activity'],
  navigation: [
    {
      group: 'Dashboard',
      items: [
        {
          title: 'Activity Log',
          href: '/admin/activity',
          icon: ShieldAlert,
          requiredPermissions: ['analytics.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'settings-module',
  name: 'Store Settings',
  permissions: ['settings.write'],
  routes: ['/admin/settings/store'],
  navigation: [
    {
      group: 'Settings',
      items: [
        {
          title: 'Store Settings',
          href: '/admin/settings/store',
          icon: Settings,
          requiredPermissions: ['settings.read'],
        }
      ]
    }
  ]
});

registerModule({
  id: 'sales-module',
  name: 'Sales',
  permissions: ['orders.read'],
  routes: ['/admin/orders'],
  navigation: [
    {
      group: 'Sales',
      items: [
        {
          title: 'Orders',
          href: '/admin/orders',
          icon: ShoppingCart,
          requiredPermissions: ['orders.read'],
        }
      ]
    }
  ]
});

export { getAdminNavigation } from './admin-modules';
export type { NavigationGroup, NavigationItem, AdminModule } from './admin-modules';
