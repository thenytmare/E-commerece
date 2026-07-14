import React from 'react';


// Placeholder Low Stock Alert widget for admin dashboard
export default function LowStockAlertWidget() {
  // In a real implementation, fetch low‑stock data from an API.
  const lowStockCount = 3;
  return (
    <div className="rounded-lg border border-border bg-card p-6 h-full">
      <h3 className="mb-1 text-sm text-muted-foreground">Low Stock Alerts</h3>
      <p className="text-2xl font-bold">{lowStockCount} items</p>
      <p className="text-sm text-muted-foreground">Products needing restock</p>
    </div>
  );
}
