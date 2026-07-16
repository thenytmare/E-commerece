import { registerDashboardWidget } from './dashboard-registry';
import RevenueWidget from '@/components/admin/dashboard/RevenueWidget';
import SalesAnalyticsWidget from '@/components/admin/dashboard/SalesAnalyticsWidget';
import LowStockAlertWidget from '@/components/admin/dashboard/LowStockAlertWidget';
import ActivityFeedWidget from '@/components/admin/dashboard/ActivityFeedWidget';

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
  id: 'activity-feed',
  component: ActivityFeedWidget,
  permission: 'analytics.read',
  order: 40,
  span: { tablet: 6, desktop: 6 },
});
