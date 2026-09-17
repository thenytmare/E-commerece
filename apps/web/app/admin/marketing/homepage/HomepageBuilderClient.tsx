'use client';

import React, { useState } from 'react';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormActions } from '@/components/admin/forms/FormActions';
import { updateHomepageAction } from '@/lib/actions/admin-marketing';
import type { HomepageSections } from '@/lib/homepage';
import { ImageUrlField } from '@/components/admin/media/ImageUrlField';
import { usePermissions } from '@/lib/hooks/use-permissions';

export function HomepageBuilderClient({ initialSections }: { initialSections: HomepageSections }) {
  const { can } = usePermissions();
  const canWrite = can('marketing.write');
  const [sections, setSections] = useState<HomepageSections>(initialSections);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const toggle = (key: keyof HomepageSections) => {
    setSections(s => {
      const section = s[key] as { enabled: boolean; [k: string]: unknown };
      return { ...s, [key]: { ...section, enabled: !section.enabled } };
    });
  };

  const updateHero = (field: string, value: string) => {
    setSections(s => ({ ...s, hero: { ...s.hero, [field]: value } }));
  };

  const updateAnnouncements = (message: string) => {
    setSections(s => ({ ...s, announcements: { ...s.announcements, message } }));
  };

  const handleSave = async () => {
    setSaving(true);
    await updateHomepageAction(sections);
    setSaving(false);
    setMessage('Saved!');
    setTimeout(() => setMessage(''), 2000);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6 max-w-2xl">
      {message && <div className="bg-success/10 text-success border border-success/20 rounded-md px-4 py-2 text-sm">{message}</div>}
      {!canWrite && (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          You have read-only access to marketing — this form is view-only.
        </div>
      )}

      <fieldset disabled={!canWrite} className="space-y-6 border-0 p-0 m-0 min-w-0">
      <FormSection title="Hero Banner" description="Main homepage hero section.">
        <div className="grid gap-4">
          <label className="flex items-center gap-3"><input type="checkbox" checked={sections.hero.enabled} onChange={() => toggle('hero')} className="h-4 w-4 rounded border-border" /><span className="text-sm font-medium">Enabled</span></label>
          {sections.hero.enabled && <>
            <div className="grid gap-4">
              <input type="text" placeholder="Title" value={sections.hero.title} onChange={e => updateHero('title', e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
              <input type="text" placeholder="Subtitle" value={sections.hero.subtitle} onChange={e => updateHero('subtitle', e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
              <input type="text" placeholder="CTA Button Text" value={sections.hero.ctaText} onChange={e => updateHero('ctaText', e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
              <input type="text" placeholder="CTA Link" value={sections.hero.ctaLink} onChange={e => updateHero('ctaLink', e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
              <ImageUrlField
                value={sections.hero.imageUrl}
                onChange={(url) => updateHero('imageUrl', url)}
                placeholder="Hero background image"
              />
            </div>
          </>}
        </div>
      </FormSection>

      <FormSection title="Homepage Sections" description="Toggle visibility of each section.">
        <div className="grid gap-4">
          {(['featuredCategories', 'featuredProducts', 'newArrivals', 'bestSellers'] as const).map(key => (
            <label key={key} className="flex items-center gap-3">
              <input type="checkbox" checked={sections[key].enabled} onChange={() => toggle(key)} className="h-4 w-4 rounded border-border" />
              <span className="text-sm font-medium">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
            </label>
          ))}
        </div>
      </FormSection>

      <FormSection title="Announcement Bar" description="Top-of-page announcement banner.">
        <div className="grid gap-4">
          <label className="flex items-center gap-3"><input type="checkbox" checked={sections.announcements.enabled} onChange={() => toggle('announcements')} className="h-4 w-4 rounded border-border" /><span className="text-sm font-medium">Enabled</span></label>
          {sections.announcements.enabled && <input type="text" placeholder="Announcement message" value={sections.announcements.message} onChange={e => updateAnnouncements(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />}
        </div>
      </FormSection>

      </fieldset>

      <FormActions isSubmitting={saving} submitDisabled={!canWrite} onCancel={() => window.location.reload()} submitText="Save Homepage" />
    </form>
  );
}