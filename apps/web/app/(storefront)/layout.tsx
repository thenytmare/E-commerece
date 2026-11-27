import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { StorefrontTracker } from '@/components/analytics/StorefrontTracker';
import { MetaPixel } from '@/components/analytics/MetaPixel';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { CookieConsent } from '@/components/CookieConsent';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hidden until a keyboard user tabs to it: jumps past the header. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <AnnouncementBar />
      <SiteHeader />
      <StorefrontTracker />
      <MetaPixel />
      <div id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </div>
      <SiteFooter />
      <CookieConsent />
    </div>
  );
}
