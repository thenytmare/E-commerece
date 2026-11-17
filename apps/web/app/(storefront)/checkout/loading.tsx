import { LoadingSkeleton } from '@/components/admin/ui/LoadingSkeleton';
import { Container, Grid, Section } from '@repo/ui';

export default function CheckoutLoading() {
  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <LoadingSkeleton className="h-8 w-40" />
        </Container>
      </Section>

      <Section>
        <Container>
          <Grid cols={1} gap="lg" className="lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4 rounded-xl border border-border bg-card p-6">
              <LoadingSkeleton className="h-5 w-40" />
              {Array.from({ length: 4 }, (_, i) => (
                <LoadingSkeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-card p-6">
              <LoadingSkeleton className="h-5 w-32" />
              <LoadingSkeleton className="h-4 w-full" />
              <LoadingSkeleton className="h-4 w-full" />
              <LoadingSkeleton className="h-6 w-2/3" />
            </div>
          </Grid>
        </Container>
      </Section>
    </main>
  );
}
