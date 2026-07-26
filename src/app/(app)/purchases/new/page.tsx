import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui/page';
import { PurchaseForm } from './purchase-form';

export const metadata: Metadata = { title: 'أمر شراء جديد' };
export const dynamic = 'force-dynamic';

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('purchases:create');
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const [suppliers, products] = await Promise.all([
    db.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true, costPrice: true, quantity: true },
      orderBy: { name: 'asc' },
      take: 1000,
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.purchase.new}
        backHref="/purchases"
        breadcrumbs={[
          { label: t.purchase.title, href: '/purchases' },
          { label: t.purchase.new },
        ]}
      />

      <PurchaseForm
        suppliers={suppliers}
        products={products}
        preselectedSupplierId={
          typeof params.supplierId === 'string' ? params.supplierId : undefined
        }
        currency={finance.currency}
        decimals={finance.decimals}
        locale={locale}
        labels={{
          supplier: t.purchase.supplier,
          selectSupplier: t.app.searchPlaceholder,
          items: t.invoice.items,
          addProduct: t.invoice.addProduct,
          product: t.product.single,
          quantity: t.invoice.quantity,
          unitCost: t.product.costPrice,
          total: t.app.total,
          subtotal: t.app.subtotal,
          discount: t.invoice.discount,
          tax: t.invoice.tax,
          shipping: t.purchase.shipping,
          notes: t.invoice.notes,
          totals: t.app.summary,
          noItems: t.invoice.emptyItems,
          remove: t.actions.delete,
          search: t.app.searchPlaceholder,
          noResults: t.app.noResults,
          stock: t.product.quantity,
          save: t.actions.save,
          cancel: t.actions.cancel,
        }}
      />
    </div>
  );
}
