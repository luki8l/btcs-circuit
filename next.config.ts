import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1'],
  serverExternalPackages: ['@electric-sql/pglite', '@react-pdf/renderer', 'exceljs'],   // pglite: local development database only; the others build the reports
  outputFileTracingIncludes: { '/api/report': ['./public/logo-dark.png'] },          // the logo in the PDF
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Referrer-Policy', value: 'same-origin' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' }] }];
  },
};
export default nextConfig;
