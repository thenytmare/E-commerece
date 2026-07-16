'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type AdminState = {
  sidebarCollapsed: boolean;
  sidebarExpandedGroup: string | null;
  searchOpen: boolean;
};

type AdminActions = {
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarExpandedGroup: (group: string | null) => void;
  setSearchOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

const AdminContext = createContext<(AdminState & AdminActions) | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  const [state, setState] = useState<AdminState>({
    sidebarCollapsed: false,
    sidebarExpandedGroup: null,
    searchOpen: false,
  });

  useEffect(() => {
    setIsClient(true);
    const storedCollapsed = localStorage.getItem('admin.sidebarCollapsed');
    const storedExpandedGroup = localStorage.getItem('admin.sidebarExpandedGroup');
    
    if (storedCollapsed !== null) {
      setState(s => ({ ...s, sidebarCollapsed: storedCollapsed === 'true' }));
    }
    if (storedExpandedGroup !== null) {
      setState(s => ({ ...s, sidebarExpandedGroup: storedExpandedGroup }));
    }
  }, []);

  const setSidebarCollapsed = (collapsed: boolean) => {
    setState(s => ({ ...s, sidebarCollapsed: collapsed }));
    localStorage.setItem('admin.sidebarCollapsed', String(collapsed));
  };

  const setSidebarExpandedGroup = (group: string | null) => {
    setState(s => ({ ...s, sidebarExpandedGroup: group }));
    if (group) {
      localStorage.setItem('admin.sidebarExpandedGroup', group);
    } else {
      localStorage.removeItem('admin.sidebarExpandedGroup');
    }
  };

  const setSearchOpen = (open: boolean) => {
    setState(s => ({ ...s, searchOpen: open }));
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!state.sidebarCollapsed);
  };

  const value = {
    ...state,
    setSidebarCollapsed,
    setSidebarExpandedGroup,
    setSearchOpen,
    toggleSidebar,
  };

  // Keep default state on SSR/first paint; hydrate from localStorage after mount.
  // Always wrap with Provider so useAdmin works during SSR and first client render.
  return (
    <AdminContext.Provider value={value}>
      <div style={{ visibility: isClient ? 'visible' : 'hidden' }}>{children}</div>
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
