import { Button } from '@repo/ui';
import Link from 'next/link';

interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}

function buildPageUrl(basePath: string, page: number, searchParams: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== 'page') {
      params.set(key, value);
    }
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({ page, totalPages, basePath, searchParams }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-3">
      {page > 1 ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={buildPageUrl(basePath, page - 1, searchParams)}>Previous</Link>
        </Button>
      ) : null}
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={buildPageUrl(basePath, page + 1, searchParams)}>Next</Link>
        </Button>
      ) : null}
    </div>
  );
}
