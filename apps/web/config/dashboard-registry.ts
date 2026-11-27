import type { Permission } from '@/lib/auth/permissions';
import type { ComponentType, ReactNode } from 'react';

export interface DashboardWidgetConfig {
  id: string;
  /** Supports client components and async Server Components */
  component: ComponentType | (() => Promise<ReactNode> | ReactNode);
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
  if (registeredWidgets.some((w) => w.id === widget.id)) {
    return;
  }
  registeredWidgets.push(widget);
  registeredWidgets.sort((a, b) => a.order - b.order);
}

export function getDashboardWidgets(): DashboardWidgetConfig[] {
  return registeredWidgets;
}
