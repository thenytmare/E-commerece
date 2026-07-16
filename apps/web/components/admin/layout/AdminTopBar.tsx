'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getAdminNavigation } from '@/config/admin-navigation';
import { useAdmin } from '@/components/admin/providers/AdminProvider';
import { useTheme } from '@/components/admin/providers/ThemeProvider';
import { NotificationCenter } from '@/components/admin/ui/NotificationCenter';
import { AdminUserMenu } from './AdminUserMenu';
import { Search, Bell, Menu, ChevronRight, Sun, Moon, Monitor } from 'lucide-react';
import Link from 'next/link';

export function AdminTopBar() {
  const pathname = usePathname();
  const { toggleSidebar, setSearchOpen } = useAdmin();
  const { theme, setTheme } = useTheme();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const navigation = getAdminNavigation();

  const breadcrumbs: { title: string; href?: string }[] = [{ title: 'Dashboard', href: '/admin' }];
  if (pathname !== '/admin') {
    for (const group of navigation) {
      for (const item of group.items) {
        if (item.href === pathname) {
          breadcrumbs.push({ title: item.title, href: item.href });
        } else if (item.children) {
          for (const child of item.children) {
            if (child.href === pathname) {
              breadcrumbs.push({ title: item.title });
              breadcrumbs.push({ title: child.title, href: child.href });
            }
          }
        }
      }
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <header className="h-[60px] bg-card border-b border-border flex items-center justify-between px-4 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleSidebar}
          className="md:hidden text-muted-foreground"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav className="hidden md:flex items-center text-sm text-muted-foreground" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={`${crumb.title}-${index}`}>
              {index > 0 && <ChevronRight className="h-4 w-4 mx-1" aria-hidden />}
              {crumb.href && index < breadcrumbs.length - 1 ? (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.title}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{crumb.title}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background text-muted-foreground text-sm hover:bg-muted transition-colors w-48 lg:w-64"
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search (Ctrl+K)...</span>
        </button>
        <button
          type="button"
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setSearchOpen(true)}
          aria-label="Open search"
        >
          <Search className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={cycleTheme}
          className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label={`Theme: ${theme}. Click to change.`}
          title={`Theme: ${theme}`}
        >
          <ThemeIcon className="h-5 w-5" />
        </button>

        <div className="relative">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground relative p-1.5 rounded-md hover:bg-muted transition-colors"
            onClick={() => setNotificationsOpen((o) => !o)}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive border border-card" />
          </button>
          {notificationsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} aria-hidden />
              <div className="absolute right-0 mt-2 z-50">
                <NotificationCenter />
              </div>
            </>
          )}
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        <AdminUserMenu />
      </div>
    </header>
  );
}
