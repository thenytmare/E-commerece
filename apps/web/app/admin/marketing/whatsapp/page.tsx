import { createRepositories } from '@repo/database';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { WhatsAppCenterClient } from './WhatsAppCenterClient';
import { requirePermission } from '@/lib/actions/auth';

export const metadata = { title: 'WhatsApp Notification Center | Admin' };

export default async function WhatsAppCenterPage() {
  await requirePermission('marketing.read');
  const repos = createRepositories();
  
  const [templatesSetting, campaignsSetting] = await Promise.all([
    repos.siteSetting.findByKey('whatsapp_templates'),
    repos.siteSetting.findByKey('whatsapp_campaigns'),
  ]);

  const templates = (templatesSetting?.value as Array<Record<string, unknown>>) ?? [];
  const campaigns = (campaignsSetting?.value as Array<Record<string, unknown>>) ?? [];

  return (
    <AdminPage 
      title="WhatsApp Notification Center" 
      description="Send bulk WhatsApp messages, manage templates, and track campaign history."
    >
      <WhatsAppCenterClient
        templates={templates.map(t => ({
          id: String(t.id ?? ''),
          name: String(t.name ?? ''),
          message: String(t.message ?? ''),
          createdAt: String(t.createdAt ?? ''),
        }))}
        campaigns={campaigns.map(c => ({
          id: String(c.id ?? ''),
          message: String(c.message ?? ''),
          target: String(c.target ?? 'all'),
          recipientCount: Number(c.recipientCount ?? 0),
          sentAt: String(c.sentAt ?? ''),
        }))}
      />
    </AdminPage>
  );
}