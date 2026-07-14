'use client';

import React from 'react';
import { DashboardWidget } from './DashboardWidget';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function StatisticCard({
  title,
  value,
  trend,
  trendLabel,
  icon,
  isLoading
}: {
  title: string;
  value: string | number;
  trend?: number; // percentage
  trendLabel?: string;
  icon?: React.ElementType;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm flex flex-col justify-between h-full relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-card/50 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full" />
        </div>
      )}
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon && React.createElement(icon, { className: "h-4 w-4 text-muted-foreground" })}
      </div>
      
      <div>
        <div className="text-2xl font-bold text-foreground mb-1">{value}</div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 text-xs">
            {trend > 0 ? (
              <TrendingUp className="h-3 w-3 text-success" />
            ) : trend < 0 ? (
              <TrendingDown className="h-3 w-3 text-destructive" />
            ) : null}
            <span className={trend > 0 ? "text-success font-medium" : trend < 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
            {trendLabel && <span className="text-muted-foreground ml-1">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ChartCard is a wrapper around DashboardWidget that is expected to receive Recharts components as children.
export function ChartCard(props: Parameters<typeof DashboardWidget>[0]) {
  return <DashboardWidget {...props} />;
}

// TableCard is a wrapper around DashboardWidget that is expected to receive DataTable as children.
export function TableCard(props: Parameters<typeof DashboardWidget>[0]) {
  return <DashboardWidget {...props} />;
}
