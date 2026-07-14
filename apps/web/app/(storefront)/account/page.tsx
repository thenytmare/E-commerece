import { requireAuth } from '@/lib/actions/auth';
import { Badge, Button, Container, Heading, Section, Text } from '@repo/ui';
import Link from 'next/link';

export const metadata = {
  title: 'My Account',
};

export default async function AccountPage() {
  const session = await requireAuth();

  return (
    <Section>
      <Container>
        <Badge variant="secondary" className="mb-4">
          Account
        </Badge>
        <Heading as="h1" size="xl" className="mb-4">
          My Account
        </Heading>
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div>
            <Text variant="muted" className="mb-1">
              Name
            </Text>
            <Text>{session.user.name ?? '—'}</Text>
          </div>
          <div>
            <Text variant="muted" className="mb-1">
              Email
            </Text>
            <Text>{session.user.email}</Text>
          </div>
          <div>
            <Text variant="muted" className="mb-1">
              Roles
            </Text>
            <Text>{session.user.roles.join(', ')}</Text>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/account/orders">My orders</Link>
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}