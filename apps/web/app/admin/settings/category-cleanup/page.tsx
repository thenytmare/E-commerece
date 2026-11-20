import { requirePermission } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { planCategoryCleanup } from '@/lib/admin/category-cleanup';
import { SaveCleanupButton } from './SaveCleanupButton';

export const metadata = { title: 'Category clean-up | Admin' };
export const dynamic = 'force-dynamic';

const cell = 'border-b border-border px-3 py-2 text-left align-top';
const head = `${cell} text-xs font-semibold uppercase tracking-wide text-muted-foreground`;

export default async function CategoryCleanupPage() {
  await requirePermission('settings.write');
  const plan = await planCategoryCleanup();

  if (plan.done) {
    return (
      <AdminPage title="Category clean-up" description="Tidies the shop's categories from 33 down to 11.">
        <p role="status" className="max-w-2xl rounded-lg border border-green-600/30 bg-green-600/10 p-4 text-sm text-foreground">
          Already done. The shop uses the 11 new categories. Nothing else to do here.
        </p>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Category clean-up"
      description="Preview first. Nothing changes until you press Save. Take a database backup in Coolify before saving."
    >
      <div className="flex max-w-4xl flex-col gap-6">
        {plan.unplaced.length > 0 && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <p className="font-semibold">These products have no new category yet, so saving is blocked:</p>
            <ul className="mt-2 list-disc pl-5">
              {plan.unplaced.map((u) => (
                <li key={`${u.from}-${u.product}`}>
                  {u.product} <span className="text-muted-foreground">(in {u.from})</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">Move them to another category in Catalogue, then Products, and reload this page.</p>
          </div>
        )}

        <section className="rounded-lg border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-lg font-semibold">The 11 categories after saving</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={head}>Category</th>
                  <th className={`${head} text-right`}>Products</th>
                </tr>
              </thead>
              <tbody>
                {plan.totals.map((t) => (
                  <tr key={t.slug}>
                    <td className={cell}>
                      {t.name}
                      {!t.exists && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">new</span>}
                    </td>
                    <td className={`${cell} text-right tabular-nums`}>{t.products}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {plan.mergedCount} products move together with their whole category (for example Earpods into Earbuds &amp; Earphones).
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-lg font-semibold">
            Products from brand and catch-all categories ({plan.namedMoves.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={head}>Product</th>
                  <th className={head}>Was in</th>
                  <th className={head}>Brand</th>
                  <th className={head}>Goes to</th>
                </tr>
              </thead>
              <tbody>
                {plan.namedMoves.map((m) => (
                  <tr key={m.productId}>
                    <td className={cell}>{m.product}</td>
                    <td className={cell}>{m.from}</td>
                    <td className={cell}>{m.brand}</td>
                    <td className={cell}>{plan.totals.find((t) => t.slug === m.to)?.name ?? m.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.brandCheck.length > 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Check the brand column: a product from the Jbl category should have the brand JBL. Fix any that look wrong in
              Catalogue, then Products. The clean-up never changes brands.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Old categories that will be removed ({plan.removing.length})</h2>
          <p className="mt-2 text-sm text-muted-foreground">{plan.removing.join(', ')}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            They are kept in the database as deleted, not erased, so nothing is lost. Their pages stop working.
          </p>
        </section>

        <SaveCleanupButton disabled={plan.unplaced.length > 0} />
      </div>
    </AdminPage>
  );
}
