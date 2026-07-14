import React from 'react';

// Placeholder Sales Analytics widget for admin dashboard
export default function SalesAnalyticsWidget() {
  // In a real implementation, fetch sales analytics data from an API.
  const sales = '1,234';
  const growth = '+12%';
  return (
    <div className="rounded-lg border border-border bg-card p-6 h-full">
      <h3 className="mb-1 text-sm text-muted-foreground">Sales Analytics</h3>
      <p className="text-2xl font-bold">{sales} sales</p>
      <p className="text-sm text-muted-foreground">Growth: {growth}</p>
    </div>
  );
}
