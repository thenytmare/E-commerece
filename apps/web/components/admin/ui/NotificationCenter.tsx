'use client';

import React from 'react';
import { ShoppingCart, Package, Users, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useNotifications, type AdminNotificationType } from '@/components/admin/providers/NotificationProvider';

export function NotificationCenter() {
  const { notifications, markAllRead, markRead } = useNotifications();
  const getIcon = (type: AdminNotificationType) => {
    switch(type) {
      case 'order': return <ShoppingCart className="h-4 w-4 text-primary" />;
      case 'inventory': return <Package className="h-4 w-4 text-warning" />;
      case 'customer': return <Users className="h-4 w-4 text-info" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTimeAgo = (date: string) => {
    const mins = Math.floor((new Date().getTime() - new Date(date).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="w-80 bg-card border border-border rounded-md shadow-elevated overflow-hidden flex flex-col max-h-[400px]">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <h3 className="font-semibold text-sm">Notifications</h3>
        <button type="button" onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>
      </div>
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No new notifications
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map(notif => {
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
                <Link key={notif.id} href={notif.link} onClick={() => markRead(notif.id)} className="block">
                  {content}
                </Link>
              ) : (
                <button key={notif.id} type="button" onClick={() => markRead(notif.id)} className="block w-full text-left">{content}</button>
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
