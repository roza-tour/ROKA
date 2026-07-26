import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';

import { getI18n } from '@/i18n';
import { PageHeader } from '@/components/ui/page';
import { CustomerForm } from '../customer-form';

export const metadata: Metadata = { title: 'عميل جديد' };

export default async function NewCustomerPage() {
  await pagePermission('customers:create');
  const { t } = await getI18n();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.customer.new}
        backHref="/customers"
        breadcrumbs={[
          { label: t.customer.title, href: '/customers' },
          { label: t.customer.new },
        ]}
      />
      <CustomerForm
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
