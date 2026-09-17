import { cache } from 'react';
import { createRepositories } from '@repo/database';

const repos = createRepositories();

export type StoreSettings = {
  name: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  whatsappNumber: string;
};

// Storefront layout, header, footer, and several pages each read store
// settings independently within the same request. `cache()` dedupes those
// into one DB round trip per request instead of one per caller.
export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const setting = await repos.siteSetting.findByKey('store');
  const value = setting?.value as Record<string, unknown> | null;

  return {
    name: String(value?.name ?? 'Prime Accessories Kenya'),
    phone: String(value?.phone ?? '+254 700 000 000'),
    email: String(value?.email ?? 'hello@primeaccessorieskenya.co.ke'),
    address: String(value?.address ?? 'Nairobi, Kenya'),
    currency: String(value?.currency ?? 'KES'),
    whatsappNumber: String(value?.whatsappNumber ?? value?.phone ?? '254700000000').replace(/[^0-9+]/g, ''),
  };
});