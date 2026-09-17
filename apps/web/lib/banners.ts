import { createRepositories } from '@repo/database';

export type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  isActive: boolean;
  position: string;
  startsAt: string | null;
  endsAt: string | null;
};

/** All banners as stored, regardless of active/expiry state — admin use. */
export async function getAllBanners(): Promise<Banner[]> {
  const repos = createRepositories();
  const setting = await repos.siteSetting.findByKey('banners');
  return (setting?.value as Banner[] | undefined) ?? [];
}

/**
 * Banners actually eligible to render on the storefront right now: active,
 * within their scheduling window (if any), for the given position.
 */
export async function getActiveBanners(position: string): Promise<Banner[]> {
  const all = await getAllBanners();
  const now = Date.now();
  return all.filter((b) => {
    if (!b.isActive || b.position !== position) return false;
    if (b.startsAt && new Date(b.startsAt).getTime() > now) return false;
    if (b.endsAt && new Date(b.endsAt).getTime() < now) return false;
    return true;
  });
}
