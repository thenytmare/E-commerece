import { cache } from 'react';
import { createRepositories } from '@repo/database';

export type HomepageSections = {
  hero: { enabled: boolean; title: string; subtitle: string; ctaText: string; ctaLink: string; imageUrl: string };
  featuredCategories: { enabled: boolean };
  featuredProducts: { enabled: boolean };
  newArrivals: { enabled: boolean };
  bestSellers: { enabled: boolean };
  announcements: { enabled: boolean; message: string };
};

export const defaultHomepageSections: HomepageSections = {
  hero: {
    enabled: true,
    title: 'Prime Accessories Kenya',
    subtitle: 'Premium Electronics',
    ctaText: 'Shop Now',
    ctaLink: '/products',
    imageUrl: '',
  },
  featuredCategories: { enabled: true },
  featuredProducts: { enabled: true },
  newArrivals: { enabled: true },
  bestSellers: { enabled: true },
  announcements: { enabled: false, message: '' },
};

// The announcement bar and the homepage both read this independently within
// the same request. `cache()` dedupes them into one DB round trip.
export const getHomepageSections = cache(async (): Promise<HomepageSections> => {
  const repos = createRepositories();
  const setting = await repos.siteSetting.findByKey('homepage');
  return (setting?.value as HomepageSections | undefined) ?? defaultHomepageSections;
});
