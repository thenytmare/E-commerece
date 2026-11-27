'use server';

import { createRepositories } from '@repo/database';
import { getStoreSettings } from '@/lib/store';
import { requirePermission } from '@/lib/actions/auth';
import { revalidatePath } from 'next/cache';

const repos = createRepositories();

export type WhatsAppCampaignResult = {
  success?: boolean;
  error?: string;
  count?: number;
  recipients?: { name: string; phone: string }[];
};

export async function sendWhatsAppCampaign(
  _prevState: WhatsAppCampaignResult | null,
  formData: FormData
): Promise<WhatsAppCampaignResult> {
  await requirePermission('marketing.write');
  
  const message = String(formData.get('message') ?? '').trim();
  const target = String(formData.get('target') ?? 'all');
  
  if (!message) {
    return { success: false, error: 'Message is required.' };
  }

  const store = await getStoreSettings();
  const encodedMessage = encodeURIComponent(message);

  // Get target customers
  const customers: { name: string; phone: string }[] = [];
  
  if (target === 'all') {
    // Get all users with orders
    const orders = await repos.order.listAll(500);
    const seen = new Set<string>();
    for (const order of orders) {
      if (order.address?.phone && !seen.has(order.address.phone)) {
        seen.add(order.address.phone);
        customers.push({
          name: order.address.name ?? 'Customer',
          phone: order.address.phone.replace(/[^0-9+]/g, ''),
        });
      }
    }
  } else if (target === 'recent') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const orders = await repos.order.listAll(500);
    const seen = new Set<string>();
    for (const order of orders) {
      if (order.createdAt >= thirtyDaysAgo && order.address?.phone && !seen.has(order.address.phone)) {
        seen.add(order.address.phone);
        customers.push({
          name: order.address.name ?? 'Customer',
          phone: order.address.phone.replace(/[^0-9+]/g, ''),
        });
      }
    }
  } else {
    // Specific customer — get from form
    const phone = String(formData.get('phone') ?? '').trim().replace(/[^0-9+]/g, '');
    if (phone) {
      customers.push({ name: 'Customer', phone });
    }
  }

  // Save the campaign to settings
  const existing = await repos.siteSetting.findByKey('whatsapp_campaigns');
  const campaigns = (existing?.value as Array<Record<string, unknown>>) ?? [];
  campaigns.unshift({
    id: Date.now().toString(),
    message,
    target,
    recipientCount: customers.length,
    sentAt: new Date().toISOString(),
    recipients: customers.slice(0, 50), // Store first 50 for display
  });
  await repos.siteSetting.upsert('whatsapp_campaigns', campaigns as never);

  // Dispatch: the client opens one wa.me link per recipient (practical
  // limit: browsers block many simultaneous popups, so cap what we hand
  // back — WhatsApp has no bulk-send API without their paid Business API).
  const DISPATCH_LIMIT = 10;
  const recipients = customers.slice(0, DISPATCH_LIMIT).filter((c) => c.phone);

  revalidatePath('/admin/marketing/whatsapp');

  return {
    success: true,
    count: customers.length,
    recipients,
    error:
      customers.length > DISPATCH_LIMIT
        ? `Campaign saved. ${customers.length} recipients found. Opening WhatsApp for the first ${DISPATCH_LIMIT} — send the rest in batches.`
        : `Campaign sent to ${customers.length} recipient(s). WhatsApp tabs will open.`,
  };
}

export async function saveWhatsAppTemplate(
  _prevState: { success?: boolean; error?: string } | null,
  formData: FormData
) {
  await requirePermission('marketing.write');
  
  const name = String(formData.get('name') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  
  if (!name || !message) {
    return { success: false, error: 'Name and message are required.' };
  }

  const existing = await repos.siteSetting.findByKey('whatsapp_templates');
  const templates = (existing?.value as Array<Record<string, unknown>>) ?? [];
  templates.push({ id: Date.now().toString(), name, message, createdAt: new Date().toISOString() });
  await repos.siteSetting.upsert('whatsapp_templates', templates as never);

  revalidatePath('/admin/marketing/whatsapp');
  return { success: true };
}

export async function deleteWhatsAppTemplate(id: string) {
  await requirePermission('marketing.write');
  
  const existing = await repos.siteSetting.findByKey('whatsapp_templates');
  const templates = (existing?.value as Array<Record<string, unknown>>) ?? [];
  const filtered = templates.filter((t) => t.id !== id);
  await repos.siteSetting.upsert('whatsapp_templates', filtered as never);

  revalidatePath('/admin/marketing/whatsapp');
  return { success: true };
}