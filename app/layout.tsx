import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';

export const metadata: Metadata = { title: 'Circuit · Bitcoin Suisse', description: 'External events: who goes where, approved in one click.', robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: '#0b0a0a', colorScheme: 'dark', viewportFit: 'cover' };

// reading the request makes every page render per request, so each one carries the nonce of its security policy
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers();
  return <html lang="en"><body>{children}</body></html>;
}
