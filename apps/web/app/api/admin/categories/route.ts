import { createRepositories } from '@repo/database';
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/auth/api-guard';

// GET: list all categories (with hierarchy) and POST: create a new category
export async function GET() {
  const guard = await guardApi('categories.read');
  if (!guard.ok) return guard.response;

  const repos = createRepositories();
  const categories = await repos.category.findRootCategories(); // includes children recursively
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const guard = await guardApi('categories.write');
  if (!guard.ok) return guard.response;

  try {
    const { name, slug, parentId } = await req.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const repos = createRepositories();
    const category = await repos.category.create({
      name: name.trim(),
      slug: slug.trim(),
      parentId: parentId || null,
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Failed to create category:', error);
    const isDuplicateSlug =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002';
    return NextResponse.json(
      { error: isDuplicateSlug ? 'A category with this slug already exists' : 'Failed to create category' },
      { status: 400 },
    );
  }
}
