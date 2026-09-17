'use client';

import React, { useCallback, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAdminNavigation, type NavigationItem } from '@/config/admin-navigation';
import { useAdmin } from '@/components/admin/providers/AdminProvider';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/auth/permissions';
import { RoleName } from '@repo/database';
import { ChevronDown, ChevronRight, Search, Menu, X } from 'lucide-react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';

export function AdminSidebar() {
  const { data: session } = useSession();
  const userRoles = (session?.user?.roles as RoleName[]) || [];
  const pathname = usePathname();
  const { sidebarCollapsed, sidebarExpandedGroup, setSidebarExpandedGroup, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useAdmin();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const sidebarIsCollapsed = sidebarCollapsed && !hoverExpanded && !mobileSidebarOpen;

  const mobileSidebarRef = useRef<HTMLDivElement>(null);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), [setMobileSidebarOpen]);
  useFocusTrap(mobileSidebarRef, mobileSidebarOpen, closeMobileSidebar);

  const idPrefix = useId();

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
      if (sidebarIsCollapsed) {
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
        title={sidebarIsCollapsed ? item.title : undefined}
      >
        {Icon && <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />}
        {!sidebarIsCollapsed && <span className="flex-1">{item.title}</span>}
        {!sidebarIsCollapsed && item.badge && (
          <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const renderSidebarContent = (variant: 'desktop' | 'mobile') => (
    <div className="flex h-full flex-col bg-card border-r border-border">
      <div className="p-4 flex items-center justify-between border-b border-border h-[60px]">
        <Link href="/admin" className="flex items-center gap-2 font-bold text-lg text-foreground">
          {!sidebarIsCollapsed ? 'Admin Panel' : 'AP'}
        </Link>
        {!sidebarIsCollapsed && (
          <button
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            className="hidden md:block text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {sidebarIsCollapsed && (
          <button
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            className="hidden md:block text-muted-foreground hover:text-foreground mx-auto"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close navigation menu"
          className="md:hidden text-muted-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {!sidebarIsCollapsed && (
        <div className="p-3 border-b border-border">
          <div className="relative">
            <label htmlFor={`${idPrefix}-${variant}-filter`} className="sr-only">
              Filter menu
            </label>
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              id={`${idPrefix}-${variant}-filter`}
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
            {!sidebarIsCollapsed && (
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
                        title={sidebarIsCollapsed ? item.title : undefined}
                      >
                        {item.icon && <item.icon className="h-5 w-5 flex-shrink-0" />}
                        {!sidebarIsCollapsed && <span className="flex-1 text-left">{item.title}</span>}
                        {!sidebarIsCollapsed && (
                          sidebarExpandedGroup === item.title ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )
                        )}
                      </button>
                      {!sidebarIsCollapsed && sidebarExpandedGroup === item.title && (
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
          sidebarIsCollapsed ? 'w-[72px]' : 'w-64'
        } h-screen sticky top-0 left-0`}
        onMouseEnter={() => sidebarCollapsed && setHoverExpanded(true)}
        onMouseLeave={() => setHoverExpanded(false)}
      >
        {renderSidebarContent('desktop')}
      </aside>

      {/* Mobile Overlay - triggered by TopBar hamburger only */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" aria-hidden="true" onClick={() => setMobileSidebarOpen(false)} />
          <aside
            ref={mobileSidebarRef}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="relative w-64 h-full flex-shrink-0 bg-card shadow-elevated transition-transform duration-300 translate-x-0"
          >
            {renderSidebarContent('mobile')}
          </aside>
        </div>
      )}
    </>
  );
}
