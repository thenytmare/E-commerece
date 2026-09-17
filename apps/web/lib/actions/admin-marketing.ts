'use server';

import { createRepositories } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { requirePermission } from './auth';
import { getClientIp } from '@/lib/request-context';
import { bannersSchema, homepageSectionsSchema } from '@/lib/validations/marketing';

const repos = createRepositories();

export type MarketingActionState = { success?: boolean; error?: string };

/** First validation message, for surfacing in the admin UI. */
function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? 'That content is not valid.';
}

export async function updateHomepageAction(sections: unknown): Promise<MarketingActionState> {
  const session = await requirePermission('marketing.write');

  // Validated rather than cast: this JSON is read by the public homepage on
  // every request, so a malformed save used to break the storefront for
  // everyone, not just whoever saved it.
  const parsed = homepageSectionsSchema.safeParse(sections);
  if (!parsed.success) {
    return { success: false, error: firstIssue(parsed.error) };
  }

  await repos.siteSetting.upsert('homepage', parsed.data);
  await repos.auditLog.create({
    actorId: session.user.id,
    ipAddress: (await getClientIp()) ?? undefined,
    action: 'marketing.homepage_update',
    entity: 'SiteSetting',
    entityId: 'homepage',
  });

  revalidatePath('/admin/marketing/homepage');
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateBannersAction(banners: unknown): Promise<MarketingActionState> {
  const session = await requirePermission('marketing.write');

  const parsed = bannersSchema.safeParse(banners);
  if (!parsed.success) {
    return { success: false, error: firstIssue(parsed.error) };
  }

  await repos.siteSetting.upsert('banners', parsed.data);
  await repos.auditLog.create({
    actorId: session.user.id,
    ipAddress: (await getClientIp()) ?? undefined,
    action: 'marketing.banners_update',
    entity: 'SiteSetting',
    entityId: 'banners',
    metadata: { count: parsed.data.length },
  });

  revalidatePath('/admin/marketing/banners');
  revalidatePath('/', 'layout');
  return { success: true };
}
