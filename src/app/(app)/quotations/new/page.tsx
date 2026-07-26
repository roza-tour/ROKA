import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';

import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { fullName } from '@/lib/utils';
import { documentLabels } from '@/lib/document-labels';
import { PageHeader } from '@/components/ui/page';
import { QuotationForm } from './quotation-form';

export const metadata: Metadata = { title: 'عرض سعر جديد' };
export const dynamic = 'force-dynamic';

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('quotations:create');
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const [customers, products, services] = await Promise.all([
    db.customer.findMany({
      where: { isActive: true, isBlocked: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        devices: { select: { id: true, brand: true, model: true, imei: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }),
    db.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true, sellPrice: true, costPrice: true, quantity: true },
      orderBy: { name: 'asc' },
      take: 1000,
    }),
    db.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        cost: true,
        category: { select: { name: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ]);

  const labels = {
    ...documentLabels(t),
    device: t.repair.device,
    deviceHint: 'اختيار الجهاز يتيح تحويل العرض إلى أمر صيانة مباشرة',
    none: t.app.none,
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.quotation.new}
        backHref="/quotations"
        breadcrumbs={[
          { label: t.quotation.title, href: '/quotations' },
          { label: t.quotation.new },
        ]}
      />

      <QuotationForm
        customers={customers.map((c) => ({
          id: c.id,
          name: fullName(c.firstName, c.lastName),
          phone: c.phone,
          devices: c.devices.map((d) => ({
            id: d.id,
            label: `${d.brand} ${d.model}${d.imei ? ` · ${d.imei}` : ''}`,
          })),
        }))}
        products={products}
        services={services.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          price: s.price,
          cost: s.cost,
          categoryName: s.category?.name ?? null,
        }))}
        initialCustomerId={
          typeof params.customerId === 'string' ? params.customerId : undefined
        }
        defaultTaxRate={finance.taxRate}
        taxEnabled={finance.taxEnabled}
        currency={finance.currency}
        decimals={finance.decimals}
        locale={locale}
        labels={labels}
      />
    </div>
  );
}
