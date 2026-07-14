import { Permission } from '@/lib/auth/permissions';

export interface DashboardWidgetConfig {
  id: string;
  component: React.ComponentType;
  permission: Permission;
  order: number;
  span?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}

export const registeredWidgets: DashboardWidgetConfig[] = [];

export function registerDashboardWidget(widget: DashboardWidgetConfig) {
  registeredWidgets.push(widget);
  // Keep them sorted by order
  registeredWidgets.sort((a, b) => a.order - b.order);
}

export function getDashboardWidgets(): DashboardWidgetConfig[] {
  return registeredWidgets;
}
