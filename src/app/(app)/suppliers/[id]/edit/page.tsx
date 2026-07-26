import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui/page';
import { SupplierForm } from '../../supplier-form';
import { supplierLabels } from '../../labels';

export const metadata: Metadata = { title: 'تعديل مورد' };

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('suppliers:update');
  const { t } = await getI18n();
  const { id } = await params;

  const supplier = await db.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.actions.edit}
        description={supplier.name}
        backHref={`/suppliers/${id}`}
        breadcrumbs={[
          { label: t.supplier.title, href: '/suppliers' },
          { label: supplier.name, href: `/suppliers/${id}` },
          { label: t.actions.edit },
        ]}
      />
      <SupplierForm values={supplier} labels={supplierLabels(t)} />
    </div>
  );
}
