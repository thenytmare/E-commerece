import { DashboardWidget } from '@/components/admin/ui/DashboardWidget';
import { QuickActionCard } from '@/components/admin/ui/AdminPrimitives';
import { PackagePlus, Tags, ClipboardList, TriangleAlert } from 'lucide-react';

export default function QuickActionsWidget() {
  return (
    <DashboardWidget
      title="Quick actions"
      requiredPermission="analytics.read"
      body={
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickActionCard href="/admin/catalog/products/new" title="Add product" description="Create a catalog product" icon={<PackagePlus className="h-5 w-5" />} requiredPermission="products.write" />
          <QuickActionCard href="/admin/catalog/categories/new" title="Add category" description="Organize the catalog" icon={<Tags className="h-5 w-5" />} requiredPermission="categories.write" />
          <QuickActionCard href="/admin/orders" title="Review orders" description="Manage fulfillment" icon={<ClipboardList className="h-5 w-5" />} requiredPermission="orders.read" />
          <QuickActionCard href="/admin/inventory" title="Check stock" description="Review low-stock alerts" icon={<TriangleAlert className="h-5 w-5" />} requiredPermission="inventory.read" />
        </div>
      }
    />
  );
}
