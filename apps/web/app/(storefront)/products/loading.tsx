import { ProductGridSkeleton } from '@/components/catalog/ProductGridSkeleton';
import { LoadingSkeleton } from '@/components/admin/ui/LoadingSkeleton';
import { Container, Section } from '@repo/ui';

export default function ProductsLoading() {
  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <LoadingSkeleton className="mb-2 h-8 w-48" />
          <LoadingSkeleton className="h-4 w-32" />
        </Container>
      </Section>

      <Section>
        <Container className="space-y-8">
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }, (_, i) => (
              <LoadingSkeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
            ))}
          </div>
          <ProductGridSkeleton />
        </Container>
      </Section>
    </main>
  );
}
