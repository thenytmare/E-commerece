import { LoadingSkeleton } from '@/components/admin/ui/LoadingSkeleton';
import { Container, Grid, Section } from '@repo/ui';

function CartRowSkeleton() {
  return (
    <div className="flex gap-4 border-b border-border py-4 last:border-0">
      <LoadingSkeleton className="h-20 w-20 shrink-0 rounded-md" />
      <div className="flex flex-1 flex-col justify-between gap-2">
        <LoadingSkeleton className="h-4 w-2/3" />
        <LoadingSkeleton className="h-3 w-1/3" />
        <LoadingSkeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export default function CartLoading() {
  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <LoadingSkeleton className="h-8 w-40" />
        </Container>
      </Section>

      <Section>
        <Container>
          <Grid cols={1} gap="lg" className="lg:grid-cols-[1fr_360px]">
            <div className="rounded-xl border border-border bg-card px-6">
              {Array.from({ length: 3 }, (_, i) => (
                <CartRowSkeleton key={i} />
              ))}
            </div>
            <div className="rounded-xl border border-border bg-card p-6 space-y-3">
              <LoadingSkeleton className="h-5 w-32" />
              <LoadingSkeleton className="h-4 w-full" />
              <LoadingSkeleton className="h-4 w-full" />
              <LoadingSkeleton className="h-6 w-2/3" />
              <LoadingSkeleton className="mt-4 h-11 w-full rounded-lg" />
            </div>
          </Grid>
        </Container>
      </Section>
    </main>
  );
}
