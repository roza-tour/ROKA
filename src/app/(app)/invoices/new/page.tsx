import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { getFinanceSettings, getSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { fullName } from '@/lib/utils';
import { documentLabels } from '@/lib/document-labels';
import { PageHeader } from '@/components/ui/page';
import { InvoiceBuilderForm } from './invoice-builder-form';
import type { BuilderLine } from '@/components/document-builder';

export const metadata: Metadata = { title: 'فاتورة جديدة' };
export const dynamic = 'force-dynamic';

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('invoices:create');
  const { locale, t } = await getI18n();
  const [finance, settings] = await Promise.all([getFinanceSettings(), getSettings()]);
  const params = await searchParams;

  const repairId = typeof params.repairId === 'string' ? params.repairId : undefined;
  const quotationId = typeof params.quotationId === 'string' ? params.quotationId : undefined;

  const [customers, products, services] = await Promise.all([
    db.customer.findMany({
      where: { isActive: true, isBlocked: false },
      select: { id: true, firstName: true, lastName: true, phone: true, balance: true },
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

  // تحميل بنود أمر الصيانة أو عرض السعر عند التحويل
  let initialLines: BuilderLine[] = [];
  let initialCustomerId: string | undefined;
  let repairNumber: string | undefined;
  let uidSeed = 0;

  if (repairId) {
    const repair = await db.repairOrder.findUnique({
      where: { id: repairId },
      include: { items: true },
    });
    if (repair) {
      initialCustomerId = repair.customerId;
      repairNumber = repair.number;
      initialLines = repair.items.map((item) => ({
        uid: `seed-${++uidSeed}`,
        kind: item.kind === 'PART' ? 'PRODUCT' : item.kind === 'SERVICE' ? 'SERVICE' : 'CUSTOM',
        productId: item.productId,
        serviceId: item.serviceId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        discount: item.discount,
      }));

      // القطع خُصمت من المخزون عند استخدامها في الصيانة — لا تُخصم مرة أخرى
      initialLines = initialLines.map((line) =>
        line.productId ? { ...line, kind: 'CUSTOM' as const, productId: null } : line,
      );
    }
  } else if (quotationId) {
    const quotation = await db.quotation.findUnique({
      where: { id: quotationId },
      include: { items: true },
    });
    if (quotation) {
      initialCustomerId = quotation.customerId;
      initialLines = quotation.items.map((item) => ({
        uid: `seed-${++uidSeed}`,
        kind: item.kind as BuilderLine['kind'],
        productId: item.productId,
        serviceId: item.serviceId,
        name: item.name,
        description: item.description ?? undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        discount: item.discount,
      }));
    }
  }

  if (typeof params.customerId === 'string') initialCustomerId = params.customerId;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.invoice.new}
        backHref="/invoices"
        breadcrumbs={[{ label: t.invoice.title, href: '/invoices' }, { label: t.invoice.new }]}
      />

      <InvoiceBuilderForm
        customers={customers.map((c) => ({
          id: c.id,
          name: fullName(c.firstName, c.lastName),
          phone: c.phone,
          balance: c.balance,
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
        initialLines={initialLines}
        initialCustomerId={initialCustomerId}
        repairOrderId={repairId}
        repairNumber={repairNumber}
        defaultTaxRate={finance.taxRate}
        taxEnabled={finance.taxEnabled}
        defaultTerms={settings['invoice.terms'] ?? ''}
        currency={finance.currency}
        decimals={finance.decimals}
        locale={locale}
        labels={documentLabels(t)}
      />
    </div>
  );
}
