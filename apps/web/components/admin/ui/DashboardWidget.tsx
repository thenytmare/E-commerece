'use client';

import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Permission, hasPermission } from '@/lib/auth/permissions';
import { useSession } from 'next-auth/react';
import { RoleName } from '@repo/database';

export interface DashboardWidgetProps {
  title: string;
  icon?: React.ElementType;
  body: React.ReactNode;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
  isLoading?: boolean;
  error?: Error | string | null;
  empty?: boolean;
  emptyMessage?: string;
  requiredPermission?: Permission;
}

export function DashboardWidget({
  title,
  icon: Icon,
  body,
  footer,
  actions,
  isLoading,
  error,
  empty,
  emptyMessage = "No data available",
  requiredPermission
}: DashboardWidgetProps) {
  const { data: session } = useSession();
  const userRoles = (session?.user?.roles as RoleName[]) || [];

  if (requiredPermission && !hasPermission(userRoles, requiredPermission)) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 flex flex-col items-center justify-center h-full text-center min-h-[200px]">
        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <p className="font-medium text-foreground">Permission Denied</p>
        <p className="text-sm text-muted-foreground mt-1">You don't have access to this widget.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card flex flex-col h-full overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
          <h3 className="font-semibold text-foreground tracking-tight">{title}</h3>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      
      <div className="flex-1 p-6 relative flex flex-col">
        {isLoading ? (
          <div className="absolute inset-0 bg-card/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm font-medium text-foreground">Failed to load data</p>
            <p className="text-xs text-muted-foreground mt-1">{typeof error === 'string' ? error : error.message}</p>
          </div>
        ) : empty ? (
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          body
        )}
      </div>

      {footer && (
        <div className="px-6 py-4 border-t border-border bg-muted/20">
          {footer}
        </div>
      )}
    </div>
  );
}
