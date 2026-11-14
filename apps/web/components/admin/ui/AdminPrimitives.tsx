'use client';

import React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { hasPermission, type Permission } from '@/lib/auth/permissions';
import type { RoleName } from '@repo/database';

export function QuickActionCard({
  href,
  title,
  description,
  icon,
  requiredPermission,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  requiredPermission?: Permission;
}) {
  const { data: session } = useSession();
  const roles = (session?.user?.roles as RoleName[] | undefined) ?? [];
  if (requiredPermission && !hasPermission(roles, requiredPermission)) return null;
  return (
    <Link href={href} className="group rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring">
      <div className="mb-3 h-5 w-5 text-primary" aria-hidden="true">{icon}</div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

export function InfoCard({ title, value, description }: { title: string; value: React.ReactNode; description?: string }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </section>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search...' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring" />
    </label>
  );
}
