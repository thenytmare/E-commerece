import { LoadingSkeleton } from '@/components/admin/ui/LoadingSkeleton';
import { Container, Section } from '@repo/ui';

export default function ProductDetailLoading() {
  return (
    <main>
      <Section>
        <Container>
          <LoadingSkeleton className="mb-6 h-4 w-64" />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
            {/* Gallery */}
            <div>
              <LoadingSkeleton className="aspect-square w-full" />
              <div className="mt-3 flex gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <LoadingSkeleton key={i} className="h-16 w-16 shrink-0 rounded-md" />
                ))}
              </div>
            </div>
            {/* Details */}
            <div className="space-y-4">
              <LoadingSkeleton className="h-3 w-20" />
              <LoadingSkeleton className="h-8 w-3/4" />
              <LoadingSkeleton className="h-4 w-1/3" />
              <LoadingSkeleton className="h-7 w-32" />
              <div className="space-y-2 pt-4">
                <LoadingSkeleton className="h-4 w-full" />
                <LoadingSkeleton className="h-4 w-full" />
                <LoadingSkeleton className="h-4 w-2/3" />
              </div>
              <LoadingSkeleton className="mt-6 h-12 w-full rounded-lg" />
            </div>
          </div>
        </Container>
      </Section>
    </main>
  );
}
