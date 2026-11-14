import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Sora } from 'next/font/google';
import { headers } from 'next/headers';
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
    images: ['/images/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} — Premium Electronics`,
    description: siteDescription,
    images: ['/images/logo.png'],
  },
  icons: {
    icon: '/images/logo.png',
    apple: '/images/logo.png',
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

  return (
    <html lang="en-KE" className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
