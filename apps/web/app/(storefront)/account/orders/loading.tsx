import { LoadingSkeleton } from '@/components/admin/ui/LoadingSkeleton';
import { Container, Section } from '@repo/ui';

export default function AccountOrdersLoading() {
  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <LoadingSkeleton className="mb-2 h-8 w-32" />
          <LoadingSkeleton className="h-4 w-28" />
        </Container>
      </Section>

      <Section>
        <Container>
          <ul className="space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="rounded-xl border border-border bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <LoadingSkeleton className="h-4 w-36" />
                    <LoadingSkeleton className="h-3 w-44" />
                  </div>
                  <div className="flex items-center gap-3">
                    <LoadingSkeleton className="h-6 w-20 rounded-full" />
                    <LoadingSkeleton className="h-4 w-16" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </main>
  );
}
