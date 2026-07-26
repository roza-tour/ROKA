import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Store, Wallet, Wrench, Receipt, Gift, Palette, Building2, Ticket, DatabaseBackup } from 'lucide-react';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getSettings } from '@/lib/settings';
import { CURRENCIES } from '@/lib/constants';

import { PageHeader, Card } from '@/components/ui/page';
import { SettingsForm } from './settings-form';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata: Metadata = { title: 'الإعدادات' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await pagePermission('settings:view');
  const user = await getCurrentUser();
  const { t } = await getI18n();
  const settings = await getSettings();

  const links = [
    {
      href: '/settings/branches',
      icon: Building2,
      title: t.settings.branches,
      description: 'إدارة الفروع وبياناتها',
    },
    {
      href: '/settings/coupons',
      icon: Ticket,
      title: t.invoice.coupon,
      description: 'كوبونات الخصم والعروض',
    },
    {
      href: '/settings/backup',
      icon: DatabaseBackup,
      title: t.backup.title,
      description: t.backup.create,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t.settings.title} />

      {/* روابط الأقسام الفرعية */}
      <div className="grid gap-3 sm:grid-cols-3">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="card flex items-start gap-3 p-4 transition-shadow hover:shadow-card"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{link.title}</span>
                <span className="block text-xs text-muted-foreground">{link.description}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <SettingsForm
        settings={settings}
        currencies={CURRENCIES}
        canEdit={can(user, 'settings:update')}
        labels={{
          shop: t.settings.shop,
          shopName: t.settings.shopName,
          legalName: t.settings.legalName,
          phone: t.customer.phone,
          phone2: t.customer.phone2,
          email: t.customer.email,
          address: t.customer.address,
          taxNumber: t.customer.taxNumber,
          website: t.settings.website,
          logo: t.settings.logo,

          finance: t.settings.finance,
          currency: t.settings.currency,
          taxEnabled: t.settings.taxEnabled,
          taxRate: t.settings.taxRate,
          decimals: t.settings.decimals,

          repair: t.settings.repairSettings,
          defaultWarranty: t.settings.defaultWarranty,
          defaultTurnaround: t.settings.defaultTurnaround,
          repairTerms: t.settings.repairTerms,

          invoice: t.settings.invoiceSettings,
          invoiceTerms: t.settings.invoiceTerms,
          invoiceFooter: t.settings.invoiceFooter,

          loyalty: t.settings.loyalty,
          loyaltyEnabled: t.settings.loyaltyEnabled,
          pointsPerUnit: t.settings.pointsPerUnit,
          unitValue: 'وحدة عملة',
          loyaltyHint: 'مثال: نقطة واحدة لكل 100 وحدة من قيمة الفاتورة',

          notifications: t.notification.title,
          autoNotify: 'إشعار العميل تلقائياً عند تغيير حالة الجهاز',
          defaultChannel: 'القناة الافتراضية',
          channels: t.notification.channels as Record<string, string>,

          inventory: t.product.title,
          lowStockAlert: 'تنبيه عند انخفاض المخزون',

          save: t.actions.save,
          saved: t.settings.saved,
        }}
      />

      <Card title={t.settings.appearance}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t.settings.theme}</p>
            <p className="text-xs text-muted-foreground">
              يُحفظ التفضيل على هذا الجهاز
            </p>
          </div>
          <ThemeToggle compact={false} />
        </div>
      </Card>
    </div>
  );
}
