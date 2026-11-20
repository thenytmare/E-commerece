import { z } from 'zod';

/**
 * Schemas for the JSON blobs stored in SiteSetting.
 *
 * These are written by admin actions that previously accepted `unknown` and
 * cast straight into the database. A malformed save therefore landed in
 * SiteSetting untouched, and the **public homepage** — which reads banners on
 * every request — would throw while iterating fields that weren't there,
 * taking the storefront down for every visitor rather than just the admin.
 */
export const homepageSectionsSchema = z.object({
  hero: z.object({
    enabled: z.boolean(),
    title: z.string().max(200),
    subtitle: z.string().max(300),
    ctaText: z.string().max(60),
    ctaLink: z.string().max(500),
    imageUrl: z.string().max(1000),
  }),
  featuredCategories: z.object({ enabled: z.boolean() }),
  featuredProducts: z.object({ enabled: z.boolean() }),
  newArrivals: z.object({ enabled: z.boolean() }),
  bestSellers: z.object({ enabled: z.boolean() }),
  announcements: z.object({ enabled: z.boolean(), message: z.string().max(300) }),
});

export type HomepageSectionsInput = z.infer<typeof homepageSectionsSchema>;

/** ISO date string, or null/empty for "no boundary". */
const optionalDate = z
  .string()
  .max(40)
  .nullable()
  .optional()
  .transform((value) => (value && value.trim() ? value : null))
  .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
    message: 'Enter a valid date',
  });

export const bannerSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1, 'Give the banner a title').max(200),
  imageUrl: z.string().max(1000),
  link: z.string().max(500),
  isActive: z.boolean(),
  position: z.string().min(1).max(60),
  startsAt: optionalDate,
  endsAt: optionalDate,
});

export const bannersSchema = z
  .array(bannerSchema)
  .max(50, 'That is more banners than the storefront can meaningfully show')
  .refine(
    (banners) =>
      banners.every(
        (banner) =>
          !banner.startsAt ||
          !banner.endsAt ||
          Date.parse(banner.startsAt) <= Date.parse(banner.endsAt)
      ),
    { message: 'A banner cannot end before it starts' }
  );

export type BannerInput = z.infer<typeof bannerSchema>;
