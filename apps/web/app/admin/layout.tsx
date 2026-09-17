import React from 'react';
import '@/config/admin-bootstrap';
import { AdminProvider } from '@/components/admin/providers/AdminProvider';
import { AuthSessionProvider } from '@/components/admin/providers/AuthSessionProvider';
import { ThemeProvider } from '@/components/admin/providers/ThemeProvider';
import { NotificationProvider } from '@/components/admin/providers/NotificationProvider';
import { SearchProvider } from '@/components/admin/providers/SearchProvider';
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';
import { AdminTopBar } from '@/components/admin/layout/AdminTopBar';
import { CommandPalette } from '@/components/admin/ui/CommandPalette';
import { ToastProvider } from '@/components/ui/toast';
import { auth } from '@/auth';
import { getDashboardNotifications } from '@/lib/actions/admin-dashboard';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const notifications = session?.user ? await getDashboardNotifications() : [];
  return (
    <ThemeProvider>
      <AuthSessionProvider session={session}>
        <NotificationProvider initialNotifications={notifications}>
          <SearchProvider>
            <ToastProvider>
              <AdminProvider>
                <div className="bg-background flex min-h-screen">
                  <AdminSidebar />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <AdminTopBar />
                    <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</main>
                  </div>
                </div>
                <CommandPalette />
              </AdminProvider>
            </ToastProvider>
          </SearchProvider>
        </NotificationProvider>
      </AuthSessionProvider>
    </ThemeProvider>
  );
}
