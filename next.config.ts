import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1'],
  serverExternalPackages: ['@electric-sql/pglite', '@react-pdf/renderer', 'pdfkit', 'exceljs'],   // pglite: local development database only; the others build the reports
  // the PDF needs the logo and pdfkit's built-in fonts, which are loaded by path and missed by the bundle tracer
  outputFileTracingIncludes: { '/api/report': ['./public/logo-dark.png', './node_modules/pdfkit/js/standard-fonts/**/*', './node_modules/pdfkit/js/data/**/*'] },
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Referrer-Policy', value: 'same-origin' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }, { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }] }];
  },
};
export default nextConfig;
