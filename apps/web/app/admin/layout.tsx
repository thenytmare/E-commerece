import React from 'react';
import '@/config/admin-bootstrap';
import { AdminProvider } from '@/components/admin/providers/AdminProvider';
import { AuthSessionProvider } from '@/components/admin/providers/AuthSessionProvider';
import { ThemeProvider } from '@/components/admin/providers/ThemeProvider';
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';
import { AdminTopBar } from '@/components/admin/layout/AdminTopBar';
import { CommandPalette } from '@/components/admin/ui/CommandPalette';
import { auth } from '@/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <ThemeProvider>
      <AuthSessionProvider session={session}>
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
          <CommandPalette />
        </AdminProvider>
      </AuthSessionProvider>
    </ThemeProvider>
  );
}
