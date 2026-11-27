import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { Heading, Text } from '@repo/ui';

export const metadata = {
  title: 'Reset your password',
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-8 text-center">
        <Heading as="h1" size="lg" className="mb-2">
          Reset your password
        </Heading>
        <Text variant="muted">
          Enter the email on your account and we&apos;ll send you a link to set a new password.
        </Text>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
