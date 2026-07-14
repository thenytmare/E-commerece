import { Container } from '@repo/ui';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-muted/30 py-12">
      <Container size="sm">{children}</Container>
    </div>
  );
}
