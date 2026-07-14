'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { getAdminNavigation } from '@/config/admin-modules';
import { useAdmin } from '@/components/admin/providers/AdminProvider';
import { Search, Bell, Menu, ChevronRight } from 'lucide-react';
import { AdminUserMenu } from './AdminUserMenu';
import Link from 'next/link';

export function AdminTopBar() {
  const pathname = usePathname();
  const { toggleSidebar, setSearchOpen } = useAdmin();

  const navigation = getAdminNavigation();

  // Generate breadcrumbs automatically
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

  return (
    <header className="h-[60px] bg-card border-b border-border flex items-center justify-between px-4 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="md:hidden text-muted-foreground">
          <Menu className="h-5 w-5" />
        </button>

        <nav className="hidden md:flex items-center text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
              {crumb.href ? (
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

      <div className="flex items-center gap-4">
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background text-muted-foreground text-sm hover:bg-muted transition-colors w-48 lg:w-64"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search (Ctrl+K)...</span>
        </button>
        <button className="md:hidden text-muted-foreground hover:text-foreground" onClick={() => setSearchOpen(true)}>
          <Search className="h-5 w-5" />
        </button>

        <div className="relative">
          <button className="text-muted-foreground hover:text-foreground relative p-1">
            <Bell className="h-5 w-5" />
            {/* Placeholder Unread Badge */}
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-destructive border border-card" />
          </button>
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        <AdminUserMenu />
      </div>
    </header>
  );
}
