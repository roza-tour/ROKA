import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { fullName } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page';
import { CustomerForm } from '../../customer-form';

export const metadata: Metadata = { title: 'تعديل عميل' };

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pagePermission('customers:update');
  const { t } = await getI18n();
  const { id } = await params;

  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const name = fullName(customer.firstName, customer.lastName);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.customer.edit}
        description={name}
        backHref={`/customers/${id}`}
        breadcrumbs={[
          { label: t.customer.title, href: '/customers' },
          { label: name, href: `/customers/${id}` },
          { label: t.actions.edit },
        ]}
      />
      <CustomerForm
        values={{
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
          phone2: customer.phone2,
          email: customer.email,
          address: customer.address,
          city: customer.city,
          taxNumber: customer.taxNumber,
          notes: customer.notes,
          type: customer.type,
          isBlocked: customer.isBlocked,
        }}
        labels={{
          personal: t.customer.single,
          contact: t.customer.phone,
          other: t.app.details,
          firstName: t.customer.firstName,
          lastName: t.customer.lastName,
          phone: t.customer.phone,
          phone2: t.customer.phone2,
          email: t.customer.email,
          address: t.customer.address,
          city: t.customer.city,
          taxNumber: t.customer.taxNumber,
          notes: t.customer.notes,
          type: t.customer.type,
          individual: t.customer.individual,
          company: t.customer.company,
          blocked: t.customer.blocked,
          save: t.actions.save,
          cancel: t.actions.cancel,
        }}
      />
    </div>
  );
}
