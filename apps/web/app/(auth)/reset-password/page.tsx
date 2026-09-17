import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Heading, Text } from '@repo/ui';

export const metadata = {
  title: 'Choose a new password',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token, email } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-8 text-center">
        <Heading as="h1" size="lg" className="mb-2">
          Choose a new password
        </Heading>
        <Text variant="muted">Pick something you haven&apos;t used before.</Text>
      </div>
      <ResetPasswordForm token={token ?? ''} email={email ?? ''} />
    </div>
  );
}
