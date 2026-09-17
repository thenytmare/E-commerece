import { registerDashboardWidget } from './dashboard-registry';
import RevenueWidget from '@/components/admin/dashboard/RevenueWidget';
import SalesAnalyticsWidget from '@/components/admin/dashboard/SalesAnalyticsWidget';
import LowStockAlertWidget from '@/components/admin/dashboard/LowStockAlertWidget';
import ActivityFeedWidget from '@/components/admin/dashboard/ActivityFeedWidget';
import QuickActionsWidget from '@/components/admin/dashboard/QuickActionsWidget';
import StoreOverviewWidget from '@/components/admin/dashboard/StoreOverviewWidget';
import RecentOrdersWidget from '@/components/admin/dashboard/RecentOrdersWidget';
import RecentCustomersWidget from '@/components/admin/dashboard/RecentCustomersWidget';

registerDashboardWidget({
  id: 'store-overview',
  component: StoreOverviewWidget,
  permission: 'analytics.read',
  order: 5,
  span: { tablet: 6, desktop: 6 },
});

registerDashboardWidget({
  id: 'revenue',
  component: RevenueWidget,
  permission: 'analytics.read',
  order: 10,
  span: { tablet: 3, desktop: 3 },
});

registerDashboardWidget({
  id: 'low-stock',
  component: LowStockAlertWidget,
  permission: 'inventory.read',
  order: 20,
  span: { tablet: 3, desktop: 3 },
});

registerDashboardWidget({
  id: 'sales-analytics',
  component: SalesAnalyticsWidget,
  permission: 'analytics.read',
  order: 30,
  span: { tablet: 6, desktop: 6 },
});

registerDashboardWidget({
  id: 'recent-orders', component: RecentOrdersWidget, permission: 'orders.read', order: 35, span: { tablet: 6, desktop: 3 },
});

registerDashboardWidget({
  id: 'recent-customers', component: RecentCustomersWidget, permission: 'customers.read', order: 36, span: { tablet: 6, desktop: 3 },
});

registerDashboardWidget({
  id: 'activity-feed',
  component: ActivityFeedWidget,
  permission: 'analytics.read',
  order: 40,
  span: { tablet: 6, desktop: 6 },
});

registerDashboardWidget({
  id: 'quick-actions',
  component: QuickActionsWidget,
  permission: 'analytics.read',
  order: 50,
  span: { tablet: 6, desktop: 6 },
});
