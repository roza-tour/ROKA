import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';

import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui/page';
import { ProductForm } from '../product-form';
import { productFormLabels } from '../labels';

export const metadata: Metadata = { title: 'منتج جديد' };

export default async function NewProductPage() {
  await pagePermission('inventory:create');
  const { t } = await getI18n();

  const [categories, suppliers] = await Promise.all([
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

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.product.new}
        backHref="/inventory"
        breadcrumbs={[{ label: t.product.title, href: '/inventory' }, { label: t.product.new }]}
      />
      <ProductForm
        categories={categories}
        suppliers={suppliers}
        labels={productFormLabels(t)}
      />
    </div>
  );
}
