'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export type AdminNotificationType = 'order' | 'inventory' | 'customer' | 'system';
export type AdminNotificationPriority = 'high' | 'normal' | 'low';

export type AdminNotification = {
  id: string;
  title: string;
  message: string;
  type: AdminNotificationType;
  priority: AdminNotificationPriority;
  read: boolean;
  createdAt: string;
  link?: string;
};

type NotificationContextValue = {
  notifications: AdminNotification[];
  unreadCount: number;
  addNotification: (notification: AdminNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

/**
 * Where read state is kept.
 *
 * Notifications are derived on each request from recent orders and low-stock
 * levels rather than stored as rows, and the server hardcodes `read: false` —
 * so marking one read only ever lived in React state and reappeared on the
 * next refresh. Their ids are stable (order id / variant id), so remembering
 * the dismissed ones here makes "read" actually stick.
 *
 * This is per-browser, not per-account across devices. Making it follow the
 * user everywhere needs real notification rows, which is a larger change than
 * this bug warrants.
 *
 * Keyed by user id so a shared machine (or one admin signing out and another
 * signing in) doesn't inherit — or clobber — someone else's read state.
 */
const STORAGE_PREFIX = 'admin:notifications:read';

/**
 * How often to pull fresh notifications from the server.
 *
 * Every open admin session polls this on its own timer, each pull re-running
 * the recent-orders and low-stock queries server-side. Notifications aren't
 * urgent enough to justify a 60s cadence — 3 minutes still surfaces a new
 * order or low-stock alert promptly without multiplying load across every
 * idle admin tab.
 */
const REFRESH_INTERVAL_MS = 180_000;

function loadReadIds(storageKey: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function persistReadIds(storageKey: string, ids: Set<string>): void {
  try {
    // Cap the list so it can't grow without bound as old ids age out.
    window.localStorage.setItem(storageKey, JSON.stringify([...ids].slice(-500)));
  } catch {
    // Private mode or a full quota — read state just won't persist.
  }
}

export function NotificationProvider({
  children,
  initialNotifications = [],
}: {
  children: React.ReactNode;
  initialNotifications?: AdminNotification[];
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const storageKey = userId ? `${STORAGE_PREFIX}:${userId}` : null;
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [extra, setExtra] = useState<AdminNotification[]>([]);

  // Read from localStorage after mount (and once we know who's signed in) so
  // server and client markup match and we load the right user's read state.
  useEffect(() => {
    if (!storageKey) return;
    setReadIds(loadReadIds(storageKey));
  }, [storageKey]);

  // The admin layout is a Server Component that only re-runs on navigation, so
  // without this a signed-in admin would never see a new order appear in the
  // bell for the rest of their session.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  const markRead = useCallback((id: string) => {
    setReadIds((current) => {
      const next = new Set(current).add(id);
      if (storageKey) persistReadIds(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const notifications = useMemo(
    () =>
      [...extra, ...initialNotifications].map((notification) => ({
        ...notification,
        read: notification.read || readIds.has(notification.id),
      })),
    [extra, initialNotifications, readIds]
  );

  const markAllRead = useCallback(() => {
    setReadIds((current) => {
      const next = new Set(current);
      notifications.forEach((notification) => next.add(notification.id));
      if (storageKey) persistReadIds(storageKey, next);
      return next;
    });
  }, [notifications, storageKey]);

  const addNotification = useCallback((notification: AdminNotification) => {
    setExtra((current) => [notification, ...current]);
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read).length,
      addNotification,
      markRead,
      markAllRead,
    }),
    [notifications, addNotification, markRead, markAllRead]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
}
