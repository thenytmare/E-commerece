import React from 'react';
import { AdminProvider } from '@/components/admin/providers/AdminProvider';
import { ThemeProvider } from '@/components/admin/providers/ThemeProvider';
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';
import { AdminTopBar } from '@/components/admin/layout/AdminTopBar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AdminProvider>
        <div className="flex min-h-screen bg-background">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AdminTopBar />
            <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </AdminProvider>
    </ThemeProvider>
  );
}
