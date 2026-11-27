import { LoadingSkeleton } from '@/components/admin/ui/LoadingSkeleton';
import { Container, Section } from '@repo/ui';

export default function OrderDetailLoading() {
  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container className="space-y-2">
          <LoadingSkeleton className="h-6 w-48" />
          <LoadingSkeleton className="h-4 w-64" />
        </Container>
      </Section>

      <Section>
        <Container className="max-w-2xl space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <LoadingSkeleton className="h-4 w-24" />
            <LoadingSkeleton className="h-4 w-40" />
            <LoadingSkeleton className="h-4 w-56" />
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <LoadingSkeleton className="h-5 w-32" />
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <LoadingSkeleton className="h-4 w-1/2" />
                <LoadingSkeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </main>
  );
}
