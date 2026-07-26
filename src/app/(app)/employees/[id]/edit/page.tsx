import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { safeJsonParse } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page';
import { EmployeeForm } from '../../employee-form';
import {
  employeeFormLabels,
  permissionModuleLabels,
  permissionActionLabels,
} from '../../labels';

export const metadata: Metadata = { title: 'تعديل موظف' };

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pagePermission('employees:update');
  const { t } = await getI18n();
  const { id } = await params;

  const [employee, branches] = await Promise.all([
    db.user.findUnique({ where: { id } }),
    db.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!employee) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.actions.edit}
        description={employee.fullName}
        backHref={`/employees/${id}`}
        breadcrumbs={[
          { label: t.employee.title, href: '/employees' },
          { label: employee.fullName, href: `/employees/${id}` },
          { label: t.actions.edit },
        ]}
      />
      <EmployeeForm
        values={{
          ...employee,
          permissions: safeJsonParse<string[]>(employee.permissions, []),
        }}
        branches={branches}
        moduleLabels={permissionModuleLabels(t)}
        actionLabels={permissionActionLabels(t)}
        labels={employeeFormLabels(t)}
      />
    </div>
  );
}
