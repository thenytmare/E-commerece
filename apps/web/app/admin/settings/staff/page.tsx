import { createRepositories, isStaffRole } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { isMailConfigured } from '@/lib/mail';
import { StaffManager, type StaffMember } from './StaffManager';

export const metadata = { title: 'Staff & roles | Admin' };
export const dynamic = 'force-dynamic';

/** Strongest role first, in case an account somehow has more than one. */
const ORDER = ['ADMIN', 'MANAGER', 'SUPPORT'] as const;

export default async function StaffPage() {
  const session = await requirePermission('staff.manage');
  const rows = await createRepositories().user.findStaff();

  const staff: StaffMember[] = rows.map((row) => {
    const roles = row.roles.map((entry) => entry.role.name).filter(isStaffRole);
    const role = ORDER.find((r) => roles.includes(r)) ?? 'SUPPORT';
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role,
      isActive: row.isActive,
      // Only a yes/no leaves the server. The hash itself never does.
      invited: !row.passwordHash,
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      isYou: row.id === session.user.id,
    };
  });

  return (
    <AdminPage
      title="Staff & roles"
      description="Who can open this admin, and what each person can do. Customers are on the Customers page."
    >
      <StaffManager staff={staff} mailReady={isMailConfigured()} />
    </AdminPage>
  );
}
