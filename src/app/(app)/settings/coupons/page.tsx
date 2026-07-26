import type { Metadata } from 'next';
import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { PageHeader, Card } from '@/components/ui/page';
import { CouponManager } from './coupon-manager';

export const metadata: Metadata = { title: 'كوبونات الخصم' };
export const dynamic = 'force-dynamic';

export default async function CouponsPage() {
  await requirePermission('settings:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();

  const coupons = await db.coupon.findMany({
    include: { _count: { select: { invoices: true } } },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.invoice.coupon}
        backHref="/settings"
        breadcrumbs={[
          { label: t.settings.title, href: '/settings' },
          { label: t.invoice.coupon },
        ]}
      />

      <Card title={t.invoice.coupon} bodyClassName="p-0">
        <CouponManager
          coupons={coupons.map((coupon) => ({
            id: coupon.id,
            code: coupon.code,
            description: coupon.description,
            type: coupon.type,
            value: coupon.value,
            minAmount: coupon.minAmount,
            maxDiscount: coupon.maxDiscount,
            usageLimit: coupon.usageLimit,
            usedCount: coupon.usedCount,
            startsAt: coupon.startsAt.toISOString(),
            endsAt: coupon.endsAt?.toISOString() ?? null,
            isActive: coupon.isActive,
            invoiceCount: coupon._count.invoices,
          }))}
          canEdit={can(user, 'invoices:create')}
          canDelete={can(user, 'invoices:delete')}
          currency={finance.currency}
          decimals={finance.decimals}
          locale={locale}
          labels={{
            add: t.actions.add,
            edit: t.actions.edit,
            delete: t.actions.delete,
            code: t.service.code,
            description: t.service.description,
            type: t.invoice.discountType,
            percent: t.invoice.percent,
            fixed: t.invoice.fixed,
            value: t.payment.amount,
            minAmount: 'الحد الأدنى للفاتورة',
            maxDiscount: 'أقصى خصم',
            unlimited: 'بلا حد',
            usageLimit: 'حد الاستخدام',
            usedCount: 'مرات الاستخدام',
            startsAt: t.warranty.startsAt,
            endsAt: t.warranty.endsAt,
            active: t.service.active,
            save: t.actions.save,
            cancel: t.actions.cancel,
            confirmDelete: t.app.confirmDelete,
            empty: t.app.noData,
          }}
        />
      </Card>
    </div>
  );
}
