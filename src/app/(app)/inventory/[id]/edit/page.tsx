import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui/page';
import { ProductForm } from '../../product-form';
import { productFormLabels } from '../../labels';

export const metadata: Metadata = { title: 'تعديل منتج' };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('inventory:update');
  const { t } = await getI18n();
  const { id } = await params;

  const [product, categories, suppliers] = await Promise.all([
    db.product.findUnique({ where: { id } }),
    db.productCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.actions.edit}
        description={product.name}
        backHref={`/inventory/${id}`}
        breadcrumbs={[
          { label: t.product.title, href: '/inventory' },
          { label: product.name, href: `/inventory/${id}` },
          { label: t.actions.edit },
        ]}
      />
      <ProductForm
        values={product}
        categories={categories}
        suppliers={suppliers}
        labels={productFormLabels(t)}
      />
    </div>
  );
}
