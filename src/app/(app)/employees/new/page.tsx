import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';

import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui/page';
import { EmployeeForm } from '../employee-form';
import {
  employeeFormLabels,
  permissionModuleLabels,
  permissionActionLabels,
} from '../labels';

export const metadata: Metadata = { title: 'موظف جديد' };

export default async function NewEmployeePage() {
  await pagePermission('employees:create');
  const { t } = await getI18n();

  const branches = await db.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.employee.new}
        backHref="/employees"
        breadcrumbs={[{ label: t.employee.title, href: '/employees' }, { label: t.employee.new }]}
      />
      <EmployeeForm
        branches={branches}
        moduleLabels={permissionModuleLabels(t)}
        actionLabels={permissionActionLabels(t)}
        labels={employeeFormLabels(t)}
      />
    </div>
  );
}
