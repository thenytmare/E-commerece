'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormField } from '@/components/admin/forms/FormField';
import { FormActions } from '@/components/admin/forms/FormActions';
import { changePasswordAction, updateProfileAction, type ProfileFormState } from '@/lib/actions/admin-profile';

const inputClass =
  'block w-full min-h-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

function Notice({ state }: { state: ProfileFormState | null }) {
  if (!state || (!state.message && !state.error)) return null;
  const ok = Boolean(state.success);
  return (
    <p
      role={ok ? 'status' : 'alert'}
      className={
        ok
          ? 'rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm text-foreground'
          : 'rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground'
      }
    >
      {state.message ?? state.error}
    </p>
  );
}

export function ProfileForms({ name, email, roles }: { name: string; email: string; roles: string }) {
  const [details, saveDetails, savingDetails] = useActionState(updateProfileAction, null);
  const [password, savePassword, savingPassword] = useActionState(changePasswordAction, null);
  const [emailValue, setEmailValue] = useState(email);
  const passwordForm = useRef<HTMLFormElement>(null);

  const emailChanging = emailValue.trim().toLowerCase() !== email.toLowerCase();

  // Clear the password boxes once the change has gone through.
  useEffect(() => {
    if (password?.success) passwordForm.current?.reset();
  }, [password]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <form action={saveDetails} noValidate>
        <FormSection title="Your details" description={`Your access: ${roles}.`}>
          <FormField id="profile-name" label="Name" error={details?.fieldErrors?.name}>
            <input id="profile-name" name="name" defaultValue={name} autoComplete="name" className={inputClass} />
          </FormField>
          <FormField
            id="profile-email"
            label="Sign-in email"
            description="Use an inbox you read. Test emails and password reset links go here."
            error={details?.fieldErrors?.email}
            required
          >
            <input
              id="profile-email"
              name="email"
              type="email"
              value={emailValue}
              onChange={(event) => setEmailValue(event.target.value)}
              autoComplete="email"
              required
              className={inputClass}
            />
          </FormField>
          {emailChanging && (
            <FormField
              id="profile-email-password"
              label="Current password"
              description="Needed to change your sign-in email."
              error={details?.fieldErrors?.currentPassword}
              required
            >
              <input
                id="profile-email-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </FormField>
          )}
          <Notice state={details} />
          <FormActions submitText="Save details" isSubmitting={savingDetails} />
        </FormSection>
      </form>

      <form action={savePassword} ref={passwordForm} noValidate>
        <FormSection title="Change password" description="At least 10 characters. A short sentence works well.">
          <FormField id="current-password" label="Current password" error={password?.fieldErrors?.currentPassword} required>
            <input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </FormField>
          <FormField id="new-password" label="New password" error={password?.fieldErrors?.newPassword} required>
            <input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              className={inputClass}
            />
          </FormField>
          <FormField
            id="confirm-password"
            label="New password again"
            error={password?.fieldErrors?.confirmPassword}
            required
          >
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className={inputClass}
            />
          </FormField>
          <Notice state={password} />
          <FormActions submitText="Change password" isSubmitting={savingPassword} />
        </FormSection>
      </form>
    </div>
  );
}
