import { Permission } from '@/lib/auth/permissions';
import { LucideIcon } from 'lucide-react';

export type NavigationItem = {
  title: string;
  href?: string;
  icon?: LucideIcon;
  requiredPermissions: Permission[];
  badge?: string | number;
  children?: NavigationItem[];
};

export type NavigationGroup = {
  group: string;
  items: NavigationItem[];
};

export interface AdminModule {
  id: string;
  name: string;
  navigation: NavigationGroup[];
  permissions: Permission[];
  routes: string[];
}

export const registeredModules: AdminModule[] = [];

export function registerModule(module: AdminModule) {
  registeredModules.push(module);
}

export function getAdminNavigation(): NavigationGroup[] {
  // Merge all navigation groups from all registered modules
  const merged: Record<string, NavigationGroup> = {};
  
  for (const mod of registeredModules) {
    for (const group of mod.navigation) {
      if (!merged[group.group]) {
        merged[group.group] = { group: group.group, items: [] };
      }
      merged[group.group]!.items.push(...group.items);
    }
  }
  
  return Object.values(merged);
}
