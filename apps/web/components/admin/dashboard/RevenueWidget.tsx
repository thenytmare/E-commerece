import React from 'react';

// Placeholder Revenue widget for admin dashboard
export default function RevenueWidget() {
  // In a real implementation, fetch revenue data from an API.
  const revenue = '$12,345';
  return (
    <div className="rounded-lg border border-border bg-card p-6 h-full">
      <h3 className="mb-1 text-sm text-muted-foreground">Revenue</h3>
      <p className="text-2xl font-bold">{revenue}</p>
      <p className="text-sm text-muted-foreground">Total revenue this month</p>
    </div>
  );
}
