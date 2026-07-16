import { registerModule } from './admin-modules';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings,
  Tags,
  Image as ImageIcon,
  ShieldAlert
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
          badge: '3', // Placeholder badge
        }
      ]
    }
  ]
});

export { getAdminNavigation } from './admin-modules';
