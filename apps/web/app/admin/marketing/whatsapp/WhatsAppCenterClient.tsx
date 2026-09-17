'use client';

import React, { useState } from 'react';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormField } from '@/components/admin/forms/FormField';
import {
  sendWhatsAppCampaign,
  saveWhatsAppTemplate,
  deleteWhatsAppTemplate,
  type WhatsAppCampaignResult,
} from '@/lib/actions/admin-whatsapp';
import { MessageSquare, Send, Trash, Users, Clock, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/format';
import { buildWhatsAppLink } from '@repo/utils';
import { usePermissions } from '@/lib/hooks/use-permissions';

type Template = {
  id: string;
  name: string;
  message: string;
  createdAt: string;
};

type Campaign = {
  id: string;
  message: string;
  target: string;
  recipientCount: number;
  sentAt: string;
};

export function WhatsAppCenterClient({
  templates,
  campaigns,
}: {
  templates: Template[];
  campaigns: Campaign[];
}) {
  const router = useRouter();
  const { can } = usePermissions();
  const canWrite = can('marketing.write');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');
  const [phone, setPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<WhatsAppCampaignResult | null>(null);

  // Template form
  const [templateName, setTemplateName] = useState('');
  const [templateMessage, setTemplateMessage] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setResult(null);

    const formData = new FormData();
    formData.append('message', message);
    formData.append('target', target);
    if (target === 'single') formData.append('phone', phone);

    const res = await sendWhatsAppCampaign(null, formData);
    setResult(res);

    if (res.success && res.recipients?.length) {
      // Open one wa.me chat per real recipient phone number (WhatsApp has
      // no bulk-send API without their paid Business API — this opens a
      // pre-filled chat per customer for the admin to hit send on).
      res.recipients.forEach((recipient, i) => {
        setTimeout(() => {
          window.open(buildWhatsAppLink(recipient.phone, message), '_blank');
        }, i * 800);
      });
    }

    setIsSending(false);
    router.refresh();
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', templateName);
    formData.append('message', templateMessage);
    await saveWhatsAppTemplate(null, formData);
    setTemplateName('');
    setTemplateMessage('');
    router.refresh();
  };

  const handleDeleteTemplate = async (id: string) => {
    await deleteWhatsAppTemplate(id);
    router.refresh();
  };

  const selectTemplate = (tpl: Template) => {
    setMessage(tpl.message);
  };

  return (
    <div className="space-y-8">
      {/* Campaign Composer */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Send WhatsApp Campaign</h2>
        </div>

        {result && (
          <div className={`mb-4 p-3 rounded-md text-sm ${result.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-destructive/10 border border-destructive/20 text-destructive'}`}>
            {result.error || `Campaign queued for ${result.count} recipients.`}
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Target Audience</label>
            <div className="flex gap-3">
              <label className={`flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer transition-colors ${target === 'all' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input type="radio" name="target" value="all" checked={target === 'all'} onChange={() => setTarget('all')} className="sr-only" />
                <Users className="h-4 w-4" /> All Customers
              </label>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer transition-colors ${target === 'recent' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input type="radio" name="target" value="recent" checked={target === 'recent'} onChange={() => setTarget('recent')} className="sr-only" />
                <Clock className="h-4 w-4" /> Recent (30 days)
              </label>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer transition-colors ${target === 'single' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input type="radio" name="target" value="single" checked={target === 'single'} onChange={() => setTarget('single')} className="sr-only" />
                <User className="h-4 w-4" /> Single
              </label>
            </div>
          </div>

          {target === 'single' && (
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Customer phone number (+254...)"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          )}

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your WhatsApp message here... Use {name} for customer name."
            rows={4}
            required
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-y"
          />

          <button
            type="submit"
            disabled={isSending || !message.trim() || !canWrite}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
            {isSending ? 'Sending...' : 'Send Campaign'}
          </button>
          {!canWrite && (
            <p className="text-xs text-muted-foreground">You have read-only access to marketing.</p>
          )}
        </form>
      </div>

      {/* Templates */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Message Templates</h2>
        </div>

        {templates.length > 0 ? (
          <div className="space-y-3 mb-6">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-start justify-between gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{tpl.message}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => selectTemplate(tpl)} className="text-xs text-primary hover:underline whitespace-nowrap">Use</button>
                  {canWrite ? (
                    <button onClick={() => handleDeleteTemplate(tpl.id)} className="p-1 text-muted-foreground hover:text-destructive rounded-md">
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-4">No templates yet. Create your first one below.</p>
        )}

        <form onSubmit={handleSaveTemplate} className="space-y-3 border-t border-border pt-4">
          <h4 className="text-sm font-medium">New Template</h4>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name (e.g., New Arrival Alert)"
            required
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
          />
          <textarea
            value={templateMessage}
            onChange={(e) => setTemplateMessage(e.target.value)}
            placeholder="Template message..."
            rows={2}
            required
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-y"
          />
          <button
            type="submit"
            disabled={!canWrite}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Save Template
          </button>
        </form>
      </div>

      {/* Campaign History */}
      {campaigns.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Campaign History</h2>
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                <div>
                  <p className="text-sm truncate max-w-md">{c.message.slice(0, 100)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.recipientCount} recipients • {formatDate(c.sentAt)}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  c.target === 'all' ? 'bg-blue-100 text-blue-800' :
                  c.target === 'recent' ? 'bg-amber-100 text-amber-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {c.target === 'all' ? 'All' : c.target === 'recent' ? 'Recent' : 'Single'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}