import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { getI18n, type Dictionary } from '@/i18n';
import { PageHeader } from '@/components/ui/page';
import { SupplierForm } from '../supplier-form';

export const metadata: Metadata = { title: 'مورد جديد' };

export function supplierLabels(t: Dictionary) {
  return {
    section: t.supplier.single,
    name: t.supplier.name,
    company: t.supplier.company,
    phone: t.supplier.phone,
    phone2: t.customer.phone2,
    email: t.supplier.email,
    address: t.supplier.address,
    taxNumber: t.customer.taxNumber,
    notes: t.customer.notes,
    active: t.service.active,
    save: t.actions.save,
    cancel: t.actions.cancel,
  };
}

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
