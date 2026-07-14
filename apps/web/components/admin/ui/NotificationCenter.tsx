'use client';

import React from 'react';
import { ShoppingCart, Package, Users, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export type NotificationPriority = 'high' | 'normal' | 'low';
export type NotificationType = 'order' | 'inventory' | 'customer' | 'system';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  read: boolean;
  createdAt: Date;
  link?: string;
}

// Placeholder Data
const PLACEHOLDER_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'New Order #1245',
    message: 'John Doe placed a new order for 2 items.',
    type: 'order',
    priority: 'high',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
    link: '/admin/orders'
  },
  {
    id: '2',
    title: 'Low Stock Alert',
    message: 'AirPods Pro are running low on stock (2 remaining).',
    type: 'inventory',
    priority: 'normal',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    link: '/admin/products'
  }
];

export function NotificationCenter() {
  const getIcon = (type: NotificationType) => {
    switch(type) {
      case 'order': return <ShoppingCart className="h-4 w-4 text-primary" />;
      case 'inventory': return <Package className="h-4 w-4 text-warning" />;
      case 'customer': return <Users className="h-4 w-4 text-info" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTimeAgo = (date: Date) => {
    const mins = Math.floor((new Date().getTime() - date.getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="w-80 bg-card border border-border rounded-md shadow-elevated overflow-hidden flex flex-col max-h-[400px]">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <h3 className="font-semibold text-sm">Notifications</h3>
        <button className="text-xs text-primary hover:underline">Mark all read</button>
      </div>
      <div className="overflow-y-auto flex-1">
        {PLACEHOLDER_NOTIFICATIONS.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No new notifications
          </div>
        ) : (
          <div className="divide-y divide-border">
            {PLACEHOLDER_NOTIFICATIONS.map(notif => {
              const content = (
                <div className={`p-4 flex gap-3 hover:bg-muted/50 transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}>
                  <div className="flex-shrink-0 mt-1">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className={`text-sm font-medium truncate ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{getTimeAgo(notif.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                  </div>
                </div>
              );

              return notif.link ? (
                <Link key={notif.id} href={notif.link} className="block">
                  {content}
                </Link>
              ) : (
                <div key={notif.id}>{content}</div>
              );
            })}
          </div>
        )}
      </div>
      <div className="p-2 border-t border-border bg-muted/30 text-center">
        <Link href="/admin" className="text-xs font-medium text-primary hover:underline">
          View all notifications
        </Link>
      </div>
    </div>
  );
}
