import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Beyond90 AI | FIFA World Cup 2026 Intelligence Platform',
  description:
    'GenAI-powered smart stadium intelligence platform for FIFA World Cup 2026. Real-time crowd analytics, AI navigation, multilingual fan assistance, and operational command — powered by Claude AI.',
  keywords: [
    'FIFA World Cup 2026',
    'smart stadium',
    'AI navigation',
    'crowd intelligence',
    'stadium operations',
    'GenAI',
    'fan experience',
  ],
  authors: [{ name: 'Beyond90 AI' }],
  openGraph: {
    title: 'Beyond90 AI | FIFA World Cup 2026 Intelligence Platform',
    description:
      'GenAI-powered smart stadium intelligence platform for FIFA World Cup 2026.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A1628',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className={inter.className}>
        <a href="#main" className="skip-link">Skip to main content</a>
        <main id="main" aria-label="Main content">{children}</main>
      </body>
    </html>
  );
}
