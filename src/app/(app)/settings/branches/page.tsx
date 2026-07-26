import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { PageHeader, Card } from '@/components/ui/page';
import { BranchManager } from './branch-manager';

export const metadata: Metadata = { title: 'الفروع' };
export const dynamic = 'force-dynamic';

export default async function BranchesPage() {
  await pagePermission('settings:view');
  const user = await getCurrentUser();
  const { t } = await getI18n();

  const branches = await db.branch.findMany({
    include: { _count: { select: { users: true, repairOrders: true, invoices: true } } },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.settings.branches}
        backHref="/settings"
        breadcrumbs={[
          { label: t.settings.title, href: '/settings' },
          { label: t.settings.branches },
        ]}
      />

      <Card title={t.settings.branches} bodyClassName="p-0">
        <BranchManager
          branches={branches.map((branch) => ({
            id: branch.id,
            code: branch.code,
            name: branch.name,
            phone: branch.phone,
            email: branch.email,
            address: branch.address,
            taxNumber: branch.taxNumber,
            isDefault: branch.isDefault,
            isActive: branch.isActive,
            usersCount: branch._count.users,
            repairsCount: branch._count.repairOrders,
            invoicesCount: branch._count.invoices,
          }))}
          canEdit={can(user, 'settings:update')}
          labels={{
            add: t.actions.add,
            edit: t.actions.edit,
            code: t.supplier.code,
            name: t.supplier.name,
            phone: t.supplier.phone,
            email: t.supplier.email,
            address: t.supplier.address,
            taxNumber: t.customer.taxNumber,
            active: t.employee.active,
            isDefault: 'الفرع الافتراضي',
            users: t.employee.title,
            repairs: t.repair.title,
            invoices: t.invoice.title,
            save: t.actions.save,
            cancel: t.actions.cancel,
            empty: t.app.noData,
          }}
        />
      </Card>
    </div>
  );
}
