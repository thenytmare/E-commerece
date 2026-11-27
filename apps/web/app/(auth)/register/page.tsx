import { RegisterForm } from '@/components/auth/register-form';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Heading, Text } from '@repo/ui';

export const metadata = {
  title: 'Create account',
};

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export default function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-8 text-center">
        <Heading as="h1" size="lg" className="mb-2">
          Create your account
        </Heading>
        <Text variant="muted">Join Prime Accessories Kenya for a premium shopping experience</Text>
      </div>
      {googleEnabled ? (
        <div className="mb-6 space-y-4">
          <GoogleSignInButton callbackUrl="/" />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or sign up with email
            <div className="h-px flex-1 bg-border" />
          </div>
        </div>
      ) : null}
      <RegisterForm />
    </div>
  );
}
