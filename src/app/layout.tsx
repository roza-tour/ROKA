import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { getLocale, LOCALE_META } from '@/i18n';
import { ThemeScript } from '@/components/theme-script';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ROKA — نظام إدارة بيع وصيانة الأجهزة الإلكترونية',
    template: '%s · ROKA',
  },
  description:
    'نظام احترافي متكامل لإدارة محلات بيع وصيانة الهواتف والحواسيب والأجهزة اللوحية: صيانة، مخزون، فواتير، تقارير وإشعارات.',
  applicationName: 'ROKA',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'ROKA', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0D9488' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const dir = LOCALE_META[locale].dir;
  const theme = (await cookies()).get('roka_theme')?.value ?? 'system';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <ThemeScript defaultTheme={theme} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
