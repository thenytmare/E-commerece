'use client';

import React, { useEffect } from 'react';
import { useAdmin } from '@/components/admin/providers/AdminProvider';
import { Search, X, Package, ShoppingCart, LayoutDashboard, FileText } from 'lucide-react';
import Link from 'next/link';

export function CommandPalette() {
  const { searchOpen, setSearchOpen } = useAdmin();

  // Handle Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [searchOpen, setSearchOpen]);

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={() => setSearchOpen(false)}
      />
      
      {/* Command Palette */}
      <div className="relative w-full max-w-lg transform overflow-hidden rounded-xl bg-card border border-border shadow-2xl transition-all flex flex-col mx-4 max-h-[80vh]">
        <div className="relative flex items-center border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            autoFocus
            className="flex-1 bg-transparent border-0 focus:ring-0 text-foreground placeholder:text-muted-foreground ml-3 focus:outline-none"
            placeholder="Search Products, Orders, Reports... (UI Placeholder)"
          />
          <button 
            className="text-muted-foreground hover:text-foreground p-1 rounded-md"
            onClick={() => setSearchOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
            Quick Actions
          </div>
          <Link 
            href="/admin/products" 
            className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-md text-foreground cursor-pointer"
            onClick={() => setSearchOpen(false)}
          >
            <Package className="h-5 w-5 text-muted-foreground" />
            <span>Search Products</span>
          </Link>
          <Link 
            href="/admin/orders" 
            className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-md text-foreground cursor-pointer"
            onClick={() => setSearchOpen(false)}
          >
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            <span>Search Orders</span>
          </Link>
          <Link 
            href="/admin" 
            className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-md text-foreground cursor-pointer"
            onClick={() => setSearchOpen(false)}
          >
            <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
            <span>Go to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-md text-foreground cursor-pointer" onClick={() => setSearchOpen(false)}>
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span>Go to Reports</span>
          </div>
        </div>
      </div>
    </div>
  );
}
