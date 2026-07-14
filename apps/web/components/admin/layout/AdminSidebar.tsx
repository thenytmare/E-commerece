'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAdminNavigation, NavigationGroup, NavigationItem } from '@/config/admin-modules';
import { useAdmin } from '@/components/admin/providers/AdminProvider';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/auth/permissions';
import { RoleName } from '@repo/database';
import { ChevronDown, ChevronRight, Search, Menu, X } from 'lucide-react';

export function AdminSidebar() {
  const { data: session } = useSession();
  const userRoles = (session?.user?.roles as RoleName[]) || [];
  const pathname = usePathname();
  const { sidebarCollapsed, sidebarExpandedGroup, setSidebarExpandedGroup, toggleSidebar, setSearchOpen } = useAdmin();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const navigation = getAdminNavigation();

  // Filter based on roles and search term
  const filteredNav = navigation.map(group => {
    const items = group.items.filter(item => {
      const permitted = item.requiredPermissions.every(p => hasPermission(userRoles, p));
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
      return permitted && matchesSearch;
    });
    return { ...group, items };
  }).filter(group => group.items.length > 0);

  const toggleGroup = (groupName: string) => {
    if (sidebarExpandedGroup === groupName) {
      setSidebarExpandedGroup(null);
    } else {
      setSidebarExpandedGroup(groupName);
      if (sidebarCollapsed) {
        toggleSidebar(); // Auto-expand sidebar if a group is clicked while collapsed
      }
    }
  };

  const renderItem = (item: NavigationItem, isNested = false) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;

    return (
      <Link
        key={item.title}
        href={item.href || '#'}
        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm ${
          isActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        } ${isNested ? 'ml-6' : ''}`}
        title={sidebarCollapsed ? item.title : undefined}
      >
        {Icon && <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />}
        {!sidebarCollapsed && <span className="flex-1">{item.title}</span>}
        {!sidebarCollapsed && item.badge && (
          <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const SidebarContent = (
    <div className="flex h-full flex-col bg-card border-r border-border">
      <div className="p-4 flex items-center justify-between border-b border-border h-[60px]">
        <Link href="/admin" className="flex items-center gap-2 font-bold text-lg text-foreground">
          {!sidebarCollapsed ? 'Admin Panel' : 'AP'}
        </Link>
        {!sidebarCollapsed && (
          <button onClick={toggleSidebar} className="hidden md:block text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
        )}
        {sidebarCollapsed && (
          <button onClick={toggleSidebar} className="hidden md:block text-muted-foreground hover:text-foreground mx-auto">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <button onClick={() => setMobileOpen(false)} className="md:hidden text-muted-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      {!sidebarCollapsed && (
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter menu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {filteredNav.map((group) => (
          <div key={group.group}>
            {!sidebarCollapsed && (
              <h4 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.group}
              </h4>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <div key={item.title}>
                  {item.children ? (
                    <div>
                      <button
                        onClick={() => toggleGroup(item.title)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm text-muted-foreground hover:bg-muted hover:text-foreground`}
                        title={sidebarCollapsed ? item.title : undefined}
                      >
                        {item.icon && <item.icon className="h-5 w-5 flex-shrink-0" />}
                        {!sidebarCollapsed && <span className="flex-1 text-left">{item.title}</span>}
                        {!sidebarCollapsed && (
                          sidebarExpandedGroup === item.title ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )
                        )}
                      </button>
                      {!sidebarCollapsed && sidebarExpandedGroup === item.title && (
                        <div className="mt-1 space-y-1">
                          {item.children.map(child => renderItem(child, true))}
                        </div>
                      )}
                    </div>
                  ) : (
                    renderItem(item)
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        } h-screen sticky top-0 left-0`}
      >
        {SidebarContent}
      </aside>

      {/* Mobile Drawer Trigger (if needed globally, but usually TopBar has it) */}
      <div className="md:hidden fixed bottom-4 right-4 z-50">
        {!mobileOpen && (
          <button
            onClick={() => setMobileOpen(true)}
            className="bg-primary text-primary-foreground p-3 rounded-full shadow-elevated"
          >
            <Menu className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full flex-shrink-0 bg-card shadow-elevated transition-transform duration-300 translate-x-0">
            {SidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
