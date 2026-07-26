import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { fullName } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page';
import { PosTerminal, type PosLabels } from './pos-terminal';
import { PAYMENT_METHODS } from '@/lib/constants';

export const metadata: Metadata = { title: 'نقطة البيع' };
export const dynamic = 'force-dynamic';

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('pos:view');
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const [products, services, customers] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        sellPrice: true,
        costPrice: true,
        quantity: true,
        categoryId: true,
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
      take: 1500,
    }),
    db.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        cost: true,
        categoryId: true,
        warrantyDays: true,
        category: { select: { name: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    db.customer.findMany({
      where: { isActive: true, isBlocked: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        balance: true,
        loyaltyPoints: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }),
  ]);

  const labels: PosLabels = {
    scanOrSearch: t.pos.scanOrSearch,
    products: t.pos.products,
    services: t.pos.services,
    all: t.app.all,
    noResults: t.app.noResults,
    emptyCart: t.pos.emptyCart,
    selectCustomer: t.pos.selectCustomer,
    searchCustomer: t.customer.searchHint,
    clearCart: t.pos.clearCart,
    checkout: t.pos.checkout,
    subtotal: t.app.subtotal,
    discount: t.invoice.discount,
    percent: t.invoice.percent,
    fixed: t.invoice.fixed,
    tax: t.invoice.tax,
    total: t.app.total,
    coupon: t.invoice.coupon,
    applyCoupon: t.invoice.applyCoupon,
    couponApplied: t.invoice.couponApplied,
    couponInvalid: t.invoice.couponInvalid,
    method: t.payment.method,
    amountReceived: t.payment.amountReceived,
    change: t.payment.change,
    due: t.invoice.due,
    reference: t.payment.reference,
    exact: 'المبلغ بالضبط',
    confirm: t.actions.submit,
    cancel: t.actions.cancel,
    printAndNew: t.pos.printAndNew,
    printLast: 'طباعة آخر فاتورة',
    completed: t.pos.completed,
    error: t.app.error,
    remove: t.actions.delete,
    clear: t.app.clear,
    stock: t.product.quantity,
    insufficientStock: t.product.insufficientStock,
    outOfStock: t.product.outOfStock,
    debit: t.customer.debit,
    creditNeedsCustomer: 'البيع الآجل يتطلب اختيار عميل لتسجيل الدين عليه',
  };

  for (const method of PAYMENT_METHODS) {
    labels[`method_${method}`] = t.payment.methods[method];
  }

  return (
    <div>
      <PageHeader title={t.pos.title} className="mb-4" />

      <PosTerminal
        products={products.map((p) => ({
          id: p.id,
          sku: p.sku,
          barcode: p.barcode,
          name: p.name,
          sellPrice: p.sellPrice,
          costPrice: p.costPrice,
          quantity: p.quantity,
          categoryId: p.categoryId,
          categoryName: p.category?.name ?? null,
        }))}
        services={services.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          price: s.price,
          cost: s.cost,
          categoryId: s.categoryId,
          categoryName: s.category?.name ?? null,
          warrantyDays: s.warrantyDays,
        }))}
        customers={customers.map((c) => ({
          id: c.id,
          name: fullName(c.firstName, c.lastName),
          phone: c.phone,
          balance: c.balance,
          loyaltyPoints: c.loyaltyPoints,
        }))}
        defaultTaxRate={finance.taxRate}
        taxEnabled={finance.taxEnabled}
        currency={finance.currency}
        decimals={finance.decimals}
        locale={locale}
        labels={labels}
        preselectedCustomerId={
          typeof params.customerId === 'string' ? params.customerId : undefined
        }
      />
    </div>
  );
}
