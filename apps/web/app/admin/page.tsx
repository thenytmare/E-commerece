import { requireAdmin } from '@/lib/actions/auth';
import { getDashboardWidgets } from '@/config/dashboard-registry';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { AdminErrorNotice } from '@/components/admin/ui/AdminErrorNotice';
import { hasPermission } from '@/lib/auth/permissions';
import type { RoleName } from '@repo/database';
import '@/config/admin-bootstrap';

export const metadata = {
  title: 'Dashboard | Admin',
};

const MD_SPAN: Record<number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
};

const LG_SPAN: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireAdmin();
  // requirePermission() redirects here with ?error=forbidden when an action is
  // rejected, so this is where that has to be explained.
  const { error } = await searchParams;
  const roles = (session.user.roles as RoleName[]) || [];
  const widgets = getDashboardWidgets().filter((widget) =>
    hasPermission(roles, widget.permission)
  );

  return (
    <AdminPage
      title="Dashboard"
      description={`Welcome back, ${session.user.name || session.user.email}`}
    >
      <AdminErrorNotice error={error} />

      <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6">
        {widgets.map((widget) => {
          const WidgetComponent = widget.component;
          const colSpanMd = MD_SPAN[widget.span?.tablet ?? 6] ?? 'md:col-span-6';
          const colSpanLg = LG_SPAN[widget.span?.desktop ?? 12] ?? 'lg:col-span-12';

          return (
            <div key={widget.id} className={`col-span-1 ${colSpanMd} ${colSpanLg}`}>
              <WidgetComponent />
            </div>
          );
        })}
        {widgets.length === 0 && (
          <div className="col-span-1 md:col-span-6 lg:col-span-12 p-8 text-center text-muted-foreground bg-card border border-border rounded-lg border-dashed">
            No widgets available for your permissions.
          </div>
        )}
      </div>
    </AdminPage>
  );
}
