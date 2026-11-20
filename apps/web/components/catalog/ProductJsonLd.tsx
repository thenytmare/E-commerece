import { DEFAULT_CURRENCY } from '@repo/config';

/**
 * schema.org Product markup.
 *
 * This is what lets search results show a price, availability and rating for a
 * product rather than a plain blue link. There was no structured data anywhere
 * in the app before.
 */
export function ProductJsonLd({
  name,
  description,
  sku,
  brand,
  category,
  images,
  price,
  inStock,
  url,
  ratingValue,
  reviewCount,
}: {
  name: string;
  description?: string | null;
  sku?: string | null;
  brand?: string | null;
  category?: string | null;
  images: string[];
  price: number;
  inStock: boolean;
  url: string;
  ratingValue?: number | null;
  reviewCount?: number;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(description ? { description } : {}),
    ...(sku ? { sku } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    ...(category ? { category } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: DEFAULT_CURRENCY,
      price: price.toFixed(2),
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    // Only emitted when real reviews exist — inventing an aggregate rating is
    // both dishonest and a structured-data policy violation.
    ...(ratingValue && reviewCount
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: ratingValue.toFixed(1),
            reviewCount,
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      // Serialised server-side from our own data; `<` is escaped so the
      // payload can't break out of the script element.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
      }}
    />
  );
}
