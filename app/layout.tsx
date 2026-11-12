import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Circuit · Bitcoin Suisse', description: 'External events: who goes where, approved in one click.', robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: '#0b0a0a', colorScheme: 'dark', viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
