// Writes real product / category slugs and variant ids from the test
// database to tests/load/.slugs.json for the k6 scripts.
//   DATABASE_URL=postgresql://... node tests/load/lib/slugs.mjs
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pg = require(require.resolve('pg', { paths: [process.cwd() + '/packages/database', process.cwd() + '/node_modules/.pnpm/node_modules'] }));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL.replace(/\?.*$/, '') });
await client.connect();
const products = (await client.query(`select p.slug, v.id as variant from products p join product_variants v on v.product_id = p.id and v.is_default where p.is_active and p.deleted_at is null`)).rows;
const categories = (await client.query(`select slug from categories where is_active`)).rows.map((r) => r.slug);
const brands = (await client.query(`select slug from brands where is_active`)).rows.map((r) => r.slug);
await client.end();
writeFileSync(new URL('../.slugs.json', import.meta.url), JSON.stringify({ products, categories, brands }));
console.log(`${products.length} products, ${categories.length} categories, ${brands.length} brands`);
