import { registerModule } from './admin-modules';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings,
  Tags,
  Image as ImageIcon
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
  routes: ['/admin/products', '/admin/categories', '/admin/brands'],
  navigation: [
    {
      group: 'Catalog',
      items: [
        {
          title: 'Products',
          href: '/admin/products',
          icon: Package,
          requiredPermissions: ['products.read'],
        },
        {
          title: 'Categories',
          href: '/admin/categories',
          icon: Tags,
          requiredPermissions: ['categories.read'],
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
