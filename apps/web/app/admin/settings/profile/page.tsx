import { requireAdmin } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';

export const metadata = {
  title: 'Profile | Admin',
};

/**
 * Read-only — this exists to stop "Profile" in the avatar menu 404ing.
 * Editing name/email/password isn't wired up anywhere yet; this just shows
 * who you're signed in as and what you can do here.
 */
export default async function AdminProfilePage() {
  const session = await requireAdmin();

  return (
    <AdminPage title="Profile" description="Your account details for this admin panel.">
      <div className="max-w-lg space-y-4 rounded-lg border border-border bg-card p-6">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Name</p>
          <p className="text-sm text-foreground">{session.user.name ?? '—'}</p>
        </div>
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Email</p>
          <p className="text-sm text-foreground">{session.user.email}</p>
        </div>
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Roles</p>
          <p className="text-sm text-foreground">{session.user.roles.join(', ')}</p>
        </div>
      </div>
    </AdminPage>
  );
}
