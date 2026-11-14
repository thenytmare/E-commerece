// Server action IDs change on every build. This reads the ones the k6
// scripts need from the build manifest and writes tests/load/.action-ids.json.
//   node tests/load/lib/action-ids.mjs   (after `pnpm --filter @repo/web build`)
import { readFileSync, writeFileSync } from 'node:fs';

const manifestPath = new URL('../../../apps/web/.next/server/server-reference-manifest.json', import.meta.url);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const wanted = ['addToCartAction', 'updateCartItemAction', 'placeOrderAction', 'loginAction', 'chooseCashOnDeliveryAction'];
const ids = {};
for (const [id, entry] of Object.entries(manifest.node)) {
  if (wanted.includes(entry.exportedName)) ids[entry.exportedName] = id;
}
const missing = wanted.filter((name) => !ids[name]);
if (missing.length) throw new Error(`Not in build manifest: ${missing.join(', ')}`);
writeFileSync(new URL('../.action-ids.json', import.meta.url), JSON.stringify(ids, null, 2));
console.log(ids);
