'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  link?: string;
}

export interface ActivityTimelineProps {
  items: ActivityItem[];
  isLoading?: boolean;
}

export function ActivityTimeline({ items, isLoading }: ActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-4">No recent activity.</div>;
  }

  return (
    <div className="relative border-l border-border ml-4 py-2 space-y-6">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div key={item.id} className="relative flex items-start gap-4 group">
            <div 
              className={`absolute -left-[17px] h-8 w-8 rounded-full border border-card flex items-center justify-center shrink-0 ${item.iconBgColor || 'bg-muted'}`}
            >
              <Icon className={`h-4 w-4 ${item.iconColor || 'text-muted-foreground'}`} />
            </div>
            <div className="pl-6 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {item.timestamp.toLocaleDateString()} {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{item.description}</p>
              {item.link && (
                <a href={item.link} className="text-xs font-medium text-primary hover:underline mt-2 inline-block">
                  View details
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
