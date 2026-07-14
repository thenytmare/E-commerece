import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { SiteHeader } from '@/components/site-header';
import '@repo/ui/globals.css';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'TechVault — Premium Electronics',
    template: '%s | TechVault',
  },
  description:
    'Discover premium earbuds, smart watches, chargers, and accessories. Fast delivery across Kenya.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-KE" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
