import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // حزمة مستقلة (.next/standalone) تحتوي كل شيء بما فيه node_modules المطلوبة فقط —
  // مثالية لاستضافة cPanel حيث لا يمكن تنفيذ npm install كامل على الخادم.
  // تُفعَّل عبر: npm run build:cpanel
  ...(process.env.BUILD_STANDALONE === '1' ? { output: 'standalone' as const } : {}),
  serverExternalPackages: ['bwip-js', 'exceljs', 'bcryptjs'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
    // يتيح forbidden()/unauthorized() لإرجاع 403/401 بدل 500 عند رفض الصلاحية
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
