import React from 'react';


// Placeholder Activity Feed widget for admin dashboard
export default function ActivityFeedWidget() {
  const mockActivities = [
    { id: 1, message: 'User "john_doe" placed an order #1023', time: '2h ago' },
    { id: 2, message: 'Product "Blue T‑Shirt" stock updated', time: '5h ago' },
    { id: 3, message: 'New category "Accessories" added', time: '1d ago' },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-6 h-full">
      <h3 className="mb-1 text-sm text-muted-foreground">Recent Activity</h3>
      <div className="space-y-2">
        {mockActivities.map((act) => (
          <div
            key={act.id}
            className="flex justify-between text-sm text-muted-foreground"
          >
            <span>{act.message}</span>
            <span className="opacity-75">{act.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
