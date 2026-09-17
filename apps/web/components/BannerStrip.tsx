import { getActiveBanners } from '@/lib/banners';
import { Container } from '@repo/ui';
import Link from 'next/link';

/** Renders active, in-window banners for a given position (see Admin → Banners). */
export async function BannerStrip({ position }: { position: string }) {
  const banners = await getActiveBanners(position);
  if (banners.length === 0) return null;

  return (
    <div className="border-b border-border">
      <Container className="py-4">
        <div className="flex gap-4 overflow-x-auto pb-1">
          {banners.map((banner) => (
            <Link
              key={banner.id}
              href={banner.link || '#'}
              className="group relative flex-shrink-0 w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card"
            >
              {banner.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="h-32 w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : null}
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-sm font-medium text-white">
                {banner.title}
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </div>
  );
}
