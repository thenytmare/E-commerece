import { NotFoundContent } from '@/components/not-found-content';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

/** A missing product or category: shown inside the shop's own header and footer. */
export default function StorefrontNotFound() {
  return (
    <main>
      <NotFoundContent />
    </main>
  );
}
