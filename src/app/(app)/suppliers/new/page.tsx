import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';

import { getI18n } from '@/i18n';
import { PageHeader } from '@/components/ui/page';
import { SupplierForm } from '../supplier-form';
import { supplierLabels } from '../labels';

export const metadata: Metadata = { title: 'مورد جديد' };

export default async function NewSupplierPage() {
  await pagePermission('suppliers:create');
  const { t } = await getI18n();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.supplier.new}
        backHref="/suppliers"
        breadcrumbs={[{ label: t.supplier.title, href: '/suppliers' }, { label: t.supplier.new }]}
      />
      <SupplierForm labels={supplierLabels(t)} />
    </div>
  );
}
