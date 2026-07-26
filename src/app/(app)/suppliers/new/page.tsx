import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { PageHeader } from '@/components/ui/page';
import { SupplierForm } from '../supplier-form';
import { supplierLabels } from '../labels';

export const metadata: Metadata = { title: 'مورد جديد' };

export default async function NewSupplierPage() {
  await requirePermission('suppliers:create');
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
