import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { StorefrontTracker } from '@/components/analytics/StorefrontTracker';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { CookieConsent } from '@/components/CookieConsent';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar />
      <SiteHeader />
      <StorefrontTracker />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <CookieConsent />
    </div>
  );
}
