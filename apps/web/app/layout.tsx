import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Sora } from 'next/font/google';
import { headers } from 'next/headers';
import { themeClass } from '@/lib/theme';
import { getThemeChoice } from '@/lib/theme-server';
import '@repo/ui/globals.css';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Headings only (wired via the `font-display` Tailwind token in Heading) —
// gives the store's own voice on titles and hero copy instead of every
// weight of text on the page coming from the same body face.
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const siteName = 'Prime Accessories Kenya';
const siteDescription =
  'Discover premium earbuds, smart watches, chargers, and accessories. Fast delivery across Kenya.';

/**
 * `metadataBase` makes every relative Open Graph / canonical URL elsewhere in
 * the app resolve to an absolute one. Without it Next.js silently drops them,
 * which is why shared product links previously showed no preview image.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: `${siteName} — Premium Electronics`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: 'website',
    siteName,
    locale: 'en_KE',
    title: `${siteName} — Premium Electronics`,
    description: siteDescription,
    // The square mark, not the tall logo.png — a social-media preview crops
    // to a wide box, and the extra top/bottom padding in logo.png pushed the
    // mark off-centre or cut it in half.
    images: ['/images/icon-512.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} — Premium Electronics`,
    description: siteDescription,
    images: ['/images/icon-512.png'],
  },
  icons: {
    // logo.png is 819x1024, a tall rectangle. Browsers and Google squash a
    // favicon into a square box, which stretched the mark. These are
    // pre-cropped to square so the tab icon and search-result icon look
    // right instead of distorted.
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/images/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/images/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/images/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading `headers()` here does two things: it lets Next.js's own request
  // pipeline pick up the CSP nonce middleware.ts set on the request (see
  // middleware.ts for how/why), and — just as importantly — calling a
  // dynamic API like `headers()` in the root layout opts every route into
  // dynamic rendering. That's required for the nonce-based CSP to be sound:
  // without it, a route could get statically prerendered once at build time
  // with a nonce baked into its HTML that will never match the fresh nonce
  // middleware.ts generates (and enforces via the CSP response header) on
  // each later request, which would make the browser block that page's
  // scripts. `nonce` itself isn't referenced below because Next.js reads it
  // from the request header automatically for its own injected scripts.
  await headers();
  // Light or dark: chosen by the shopper (a cookie), or else the device's own
  // setting, which the CSS follows by itself. Set here so there is no flash.
  const theme = await getThemeChoice();

  return (
    <html
      lang="en-KE"
      data-theme={theme}
      className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable} ${themeClass(theme)}`.trim()}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
