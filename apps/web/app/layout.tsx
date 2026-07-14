import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
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
    default: 'Prime Accessories Kenya — Premium Electronics',
    template: '%s | Prime Accessories Kenya',
  },
  description:
    'Discover premium earbuds, smart watches, chargers, and accessories. Fast delivery across Kenya.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-KE" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
