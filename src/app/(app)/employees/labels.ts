import type { Dictionary } from '@/i18n';
import { PERMISSION_MODULES, PERMISSION_ACTIONS } from '@/lib/permissions';

/** نصوص نموذج الموظف */
export function employeeFormLabels(t: Dictionary) {
  return {
    account: t.auth.login,
    job: t.employee.jobTitle,
    permissions: t.employee.permissions,
    permissionsHint: 'الصلاحيات الأساسية تأتي من الدور، ويمكن منح صلاحيات إضافية',
    username: t.employee.username,
    usernameHint: 'أحرف لاتينية وأرقام فقط',
    email: t.employee.email,
    fullName: t.employee.fullName,
    phone: t.employee.phone,
    password: t.auth.password,
    passwordHint: 'اتركه فارغاً لتوليد كلمة مرور مؤقتة تلقائياً',
    role: t.employee.role,
    roles: t.roles as Record<string, string>,
    jobTitle: t.employee.jobTitle,
    baseSalary: t.employee.baseSalary,
    hireDate: t.employee.hireDate,
    nationalId: t.employee.nationalId,
    notes: t.customer.notes,
    branch: t.employee.branch,
    active: t.employee.active,
    fromRole: 'صلاحيات ممنوحة من الدور',
    extra: t.employee.customPermissions,
    none: t.app.none,
    save: t.actions.save,
    cancel: t.actions.cancel,
  };
}

/** أسماء وحدات الصلاحيات بالعربية */
export function permissionModuleLabels(t: Dictionary): Record<string, string> {
  const map: Partial<Record<(typeof PERMISSION_MODULES)[number], string>> = {
    dashboard: t.nav.dashboard,
    customers: t.nav.customers,
    devices: t.device.title,
    repairs: t.nav.repairs,
    services: t.nav.services,
    inventory: t.nav.inventory,
    suppliers: t.nav.suppliers,
    purchases: t.nav.purchases,
    pos: t.nav.pos,
    invoices: t.nav.invoices,
    payments: t.nav.payments,
    quotations: t.nav.quotations,
    expenses: t.nav.expenses,
    reports: t.nav.reports,
    employees: t.nav.employees,
    attendance: t.nav.attendance,
    payroll: t.nav.payroll,
    warranty: t.nav.warranty,
    appointments: t.nav.appointments,
    notifications: t.nav.notifications,
    settings: t.nav.settings,
    audit: t.nav.auditLog,
    backup: t.nav.backup,
  };

  const out: Record<string, string> = {};
  for (const module of PERMISSION_MODULES) out[module] = map[module] ?? module;
  return out;
}

/** أسماء إجراءات الصلاحيات */
export function permissionActionLabels(t: Dictionary): Record<string, string> {
  const map: Record<(typeof PERMISSION_ACTIONS)[number], string> = {
    view: t.actions.view,
    create: t.actions.create,
    update: t.actions.update,
    delete: t.actions.delete,
    export: t.app.export,
  };
  return map;
}
