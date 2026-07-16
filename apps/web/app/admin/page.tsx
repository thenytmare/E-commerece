import { requireAdmin } from '@/lib/actions/auth';
import { getDashboardWidgets } from '@/config/dashboard-registry';
import { AdminPage } from '@/components/admin/ui/AdminPage';


export const metadata = {
  title: 'Dashboard | Admin',
};

export default async function AdminDashboardPage() {
  const session = await requireAdmin();
  const widgets = getDashboardWidgets();

  return (
    <AdminPage 
      title="Dashboard" 
      description={`Welcome back, ${session.user.name || session.user.email}`}
    >
      {/* 12-column responsive grid */}
      <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6">
        {widgets.map(widget => {
          const WidgetComponent = widget.component;
          // Apply responsive spans: default to full width on mobile, specified spans on larger screens
          const colSpanMd = widget.span?.tablet ? `md:col-span-${widget.span.tablet}` : 'md:col-span-6';
          const colSpanLg = widget.span?.desktop ? `lg:col-span-${widget.span.desktop}` : 'lg:col-span-12';
          
          return (
            <div key={widget.id} className={`col-span-1 ${colSpanMd} ${colSpanLg}`}>
              <WidgetComponent />
            </div>
          );
        })}
        {widgets.length === 0 && (
          <div className="col-span-1 md:col-span-6 lg:col-span-12 p-8 text-center text-muted-foreground bg-card border border-border rounded-lg border-dashed">
            No widgets registered. Register them in DashboardRegistry.
          </div>
        )}
      </div>
    </AdminPage>
  );
}
