import { RegisterForm } from '@/components/auth/register-form';
import { Heading, Text } from '@repo/ui';

export const metadata = {
  title: 'Create account',
};

export default function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-8 text-center">
        <Heading as="h1" size="lg" className="mb-2">
          Create your account
        </Heading>
        <Text variant="muted">Join Prime Accessories Kenya for a premium shopping experience</Text>
      </div>
      <RegisterForm />
    </div>
  );
}
