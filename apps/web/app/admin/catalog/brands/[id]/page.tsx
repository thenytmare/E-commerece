import { createRepositories } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { notFound } from 'next/navigation';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { BrandFormClient } from './BrandFormClient';

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === 'new';
  await requirePermission(isNew ? 'brands.write' : 'brands.read');
  const brand = isNew ? null : await createRepositories().brand.findById(id);
  if (!isNew && !brand) notFound();
  return <AdminPage title={isNew ? 'Create Brand' : `Edit ${brand?.name}`} description="Brand identity and catalog metadata."><BrandFormClient initialData={brand ? { id: brand.id, name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl, description: brand.description, website: brand.website, country: brand.country, isFeatured: brand.isFeatured, isActive: brand.isActive, seoTitle: brand.seoTitle, seoDescription: brand.seoDescription } : null} /></AdminPage>;
}
