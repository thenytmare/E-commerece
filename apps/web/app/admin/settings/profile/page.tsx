import { createRepositories } from '@repo/database';
import { requireAdmin } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { staffRoleLabel } from '@/lib/auth/staff-roles';
import { ProfileForms } from './ProfileForms';

export const metadata = {
  title: 'Profile | Admin',
};
export const dynamic = 'force-dynamic';

/** The signed-in staff member's own name, sign-in email and password. */
export default async function AdminProfilePage() {
  const session = await requireAdmin();
  // Read from the database, not the session, so the form shows what is saved.
  const user = await createRepositories().user.findById(session.user.id);

  const roles = (user?.roles ?? [])
    .map((entry) => entry.role.name)
    .filter((role) => role !== 'CUSTOMER')
    .map(staffRoleLabel);

  return (
    <AdminPage title="Profile" description="Your own account: your name, sign-in email and password.">
      <ProfileForms
        name={user?.name ?? ''}
        email={user?.email ?? session.user.email ?? ''}
        roles={roles.length > 0 ? roles.join(', ') : 'None'}
      />
    </AdminPage>
  );
}
