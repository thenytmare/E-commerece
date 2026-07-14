import { createRepositories } from '@repo/database';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/actions/auth';

// GET: list all categories (with hierarchy) and POST: create a new category
export async function GET() {
  await requireAdmin();
  const repos = createRepositories();
  const categories = await repos.category.findRootCategories(); // includes children recursively
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  await requireAdmin();
  const repos = createRepositories();
  const { name, slug, parentId } = await req.json();
  const category = await repos.category.create({
    name,
    slug,
    parentId: parentId || null,
  });
  return NextResponse.json(category, { status: 201 });
}
