import { requireAdmin } from '@/lib/actions/auth';
import { createRepositories } from '@repo/database';
import { Badge, Container, Heading, Section, Text } from '@repo/ui';

export const metadata = {
  title: 'Admin Inventory',
};

export default async function AdminInventoryPage() {
  await requireAdmin();
  const repos = createRepositories();
  const lowStock = await repos.inventory.findLowStockDetailed();

  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <Heading as="h1" size="lg" className="mb-2">
            Inventory Alerts
          </Heading>
          <Text variant="muted">Variants at or below their low-stock threshold.</Text>
        </Container>
      </Section>

      <Section>
        <Container>
          {lowStock.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
              <Text variant="muted">No low-stock variants right now.</Text>
            </div>
          ) : (
            <div className="space-y-4">
              {lowStock.map((record) => {
                const available = record.quantity - record.reserved;

                return (
                  <div key={record.id} className="rounded-xl border border-border bg-card p-6">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">Low Stock</Badge>
                      <Badge variant="outline">{record.variant.sku}</Badge>
                    </div>
                    <Heading as="h2" size="xs" className="mb-1">
                      {record.variant.product.name}
                    </Heading>
                    <Text variant="muted" className="mb-4 text-sm">
                      Threshold {record.lowStockThreshold} · Available {available}
                    </Text>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-muted/30 p-4">
                        <Text variant="muted" className="text-xs">
                          Quantity
                        </Text>
                        <Text className="font-semibold">{record.quantity}</Text>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-4">
                        <Text variant="muted" className="text-xs">
                          Reserved
                        </Text>
                        <Text className="font-semibold">{record.reserved}</Text>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-4">
                        <Text variant="muted" className="text-xs">
                          Available
                        </Text>
                        <Text className="font-semibold">{available}</Text>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Container>
      </Section>
    </main>
  );
}
