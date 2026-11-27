'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormField } from '@/components/admin/forms/FormField';
import { FormActions } from '@/components/admin/forms/FormActions';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { STAFF_ROLE_OPTIONS, staffRoleLabel } from '@/lib/auth/staff-roles';
import {
  addStaffAction,
  changeStaffRoleAction,
  removeStaffAction,
  resendInviteAction,
  type StaffActionResult,
} from '@/lib/actions/admin-staff';

export type StaffMember = {
  id: string;
  name: string | null;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'SUPPORT';
  isActive: boolean;
  invited: boolean;
  lastLoginAt: string | null;
  isYou: boolean;
};

const inputClass =
  'block w-full min-h-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

function Message({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p
      role={ok ? 'status' : 'alert'}
      className={
        ok
          ? 'rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm text-foreground'
          : 'rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground'
      }
    >
      {text}
    </p>
  );
}

function lastSeen(member: StaffMember): string {
  if (member.invited) return 'Invited, has not chosen a password yet';
  if (!member.lastLoginAt) return 'Has not signed in yet';
  return `Last signed in ${new Date(member.lastLoginAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function StaffManager({ staff, mailReady }: { staff: StaffMember[]; mailReady: boolean }) {
  const router = useRouter();
  const [added, addStaff, adding] = useActionState(addStaffAction, null);
  const [result, setResult] = useState<StaffActionResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<StaffMember | null>(null);
  const [, startTransition] = useTransition();

  const run = (id: string, work: () => Promise<StaffActionResult>) => {
    setBusyId(id);
    setResult(null);
    startTransition(async () => {
      const outcome = await work();
      setResult(outcome);
      setBusyId(null);
      setRemoving(null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="roles-heading" className="rounded-lg border border-border bg-card p-4">
        <h2 id="roles-heading" className="mb-3 text-lg font-semibold text-foreground">
          What each role can do
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {STAFF_ROLE_OPTIONS.map((option) => (
            <div key={option.value} className="rounded-md border border-border p-3">
              <dt className="text-sm font-semibold text-foreground">{option.label}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{option.description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="staff-heading" className="rounded-lg border border-border bg-card">
        <h2 id="staff-heading" className="border-b border-border px-4 py-3 text-lg font-semibold text-foreground">
          Staff ({staff.length})
        </h2>
        {result && (
          <div className="px-4 pt-4">
            <Message ok={result.success} text={result.message} />
          </div>
        )}
        <ul className="divide-y divide-border">
          {staff.map((member) => {
            const busy = busyId === member.id;
            return (
              <li key={member.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {member.name || member.email.split('@')[0]}
                    {member.isYou && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">You</span>}
                    {!member.isActive && (
                      <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">Switched off</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                  <p className="text-xs text-muted-foreground">{lastSeen(member)}</p>
                </div>

                {member.isYou ? (
                  <p className="text-sm text-muted-foreground md:text-right">
                    {staffRoleLabel(member.role)}
                    <br />
                    <span className="text-xs">You cannot change your own role.</span>
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`role-${member.id}`}>
                      Role for {member.email}
                    </label>
                    <select
                      id={`role-${member.id}`}
                      value={member.role}
                      disabled={busy}
                      onChange={(event) => {
                        const role = event.target.value;
                        run(member.id, () => changeStaffRoleAction(member.id, role));
                      }}
                      className="min-h-[44px] rounded-md border border-border bg-background px-3 text-sm"
                    >
                      {STAFF_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {member.invited && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(member.id, () => resendInviteAction(member.id))}
                        className="min-h-[44px] rounded-md border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                      >
                        Send invite again
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRemoving(member)}
                      className="min-h-[44px] rounded-md border border-destructive/40 px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      {member.invited ? 'Cancel invite' : 'Remove access'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <form action={addStaff} noValidate className="max-w-2xl">
        <FormSection
          title="Add a staff member"
          description="If they already have an account (for example as a customer), they get the role straight away and keep their password. If not, they get an email with a link to choose a password."
        >
          {!mailReady && (
            <Message ok={false} text="Email is not set up, so invites to new people will not arrive. Existing accounts can still be given a role." />
          )}
          <FormField id="staff-email" label="Email" error={added?.fieldErrors?.email} required>
            <input id="staff-email" name="email" type="email" autoComplete="off" required className={inputClass} />
          </FormField>
          <FormField id="staff-name" label="Name" description="Optional. Used only for new accounts." error={added?.fieldErrors?.name}>
            <input id="staff-name" name="name" autoComplete="off" className={inputClass} />
          </FormField>
          <FormField id="staff-role" label="Role" error={added?.fieldErrors?.role} required>
            <select id="staff-role" name="role" defaultValue="MANAGER" required className={inputClass}>
              {STAFF_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          {(added?.message || added?.error) && <Message ok={Boolean(added.success)} text={(added.message ?? added.error)!} />}
          <FormActions submitText="Add staff member" isSubmitting={adding} />
        </FormSection>
      </form>

      <ConfirmationDialog
        isOpen={removing !== null}
        title={removing?.invited ? 'Cancel this invite?' : 'Remove admin access?'}
        description={
          removing?.invited
            ? `The invite for ${removing?.email} stops working and the unused account is deleted.`
            : `${removing?.email ?? ''} will no longer be able to open the admin. Their account stays, as a customer, and you can add them again later.`
        }
        confirmText={removing?.invited ? 'Cancel invite' : 'Remove access'}
        variant="danger"
        isLoading={removing !== null && busyId === removing.id}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) run(removing.id, () => removeStaffAction(removing.id));
        }}
      />
    </div>
  );
}
