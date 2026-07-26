import type { Role } from './constants';

/**
 * نظام الصلاحيات.
 *
 * الصلاحية بصيغة "module:action". لكل دور مجموعة صلاحيات افتراضية،
 * ويمكن منح المستخدم صلاحيات إضافية مخزّنة في User.permissions (JSON).
 * الدور ADMIN يملك الصلاحية الشاملة "*".
 */

export const PERMISSION_MODULES = [
  'dashboard',
  'customers',
  'devices',
  'repairs',
  'services',
  'inventory',
  'suppliers',
  'purchases',
  'pos',
  'invoices',
  'payments',
  'quotations',
  'expenses',
  'reports',
  'employees',
  'attendance',
  'payroll',
  'warranty',
  'appointments',
  'notifications',
  'settings',
  'audit',
  'backup',
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = ['view', 'create', 'update', 'delete', 'export'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type Permission = `${PermissionModule}:${PermissionAction}` | '*';

const all = (m: PermissionModule): Permission[] =>
  PERMISSION_ACTIONS.map((a) => `${m}:${a}` as Permission);

const view = (...mods: PermissionModule[]): Permission[] =>
  mods.map((m) => `${m}:view` as Permission);

const crud = (...mods: PermissionModule[]): Permission[] => mods.flatMap(all);

/** الصلاحيات الافتراضية لكل دور */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ['*'],

  MANAGER: [
    ...crud(
      'customers',
      'devices',
      'repairs',
      'services',
      'inventory',
      'suppliers',
      'purchases',
      'pos',
      'invoices',
      'payments',
      'quotations',
      'expenses',
      'warranty',
      'appointments',
      'notifications',
    ),
    ...view('dashboard', 'reports', 'employees', 'attendance', 'payroll', 'audit'),
    'reports:export',
    'employees:update',
    'attendance:create',
    'attendance:update',
  ],

  TECHNICIAN: [
    ...view('dashboard', 'customers', 'devices', 'services', 'inventory', 'appointments'),
    'repairs:view',
    'repairs:create',
    'repairs:update',
    'devices:create',
    'devices:update',
    'customers:create',
    'attendance:view',
    'attendance:create',
    'warranty:view',
  ],

  CASHIER: [
    ...view('dashboard', 'customers', 'services', 'inventory', 'warranty', 'appointments'),
    ...crud('pos'),
    'invoices:view',
    'invoices:create',
    'invoices:update',
    'invoices:export',
    'payments:view',
    'payments:create',
    'customers:create',
    'customers:update',
    'quotations:view',
    'quotations:create',
    'repairs:view',
    'attendance:view',
    'attendance:create',
  ],

  RECEPTIONIST: [
    ...view('dashboard', 'inventory', 'services', 'invoices', 'warranty'),
    ...crud('customers', 'devices', 'appointments'),
    'repairs:view',
    'repairs:create',
    'repairs:update',
    'quotations:view',
    'quotations:create',
    'notifications:view',
    'notifications:create',
    'attendance:view',
    'attendance:create',
  ],

  ACCOUNTANT: [
    ...view(
      'dashboard',
      'customers',
      'invoices',
      'payments',
      'repairs',
      'inventory',
      'suppliers',
      'purchases',
      'payroll',
    ),
    ...crud('expenses'),
    'reports:view',
    'reports:export',
    'invoices:export',
    'payments:create',
    'payments:update',
    'payroll:create',
    'payroll:update',
    'attendance:view',
  ],

  VIEWER: [
    ...view(
      'dashboard',
      'customers',
      'repairs',
      'services',
      'inventory',
      'invoices',
      'quotations',
      'reports',
      'warranty',
      'appointments',
    ),
  ],
};

export interface PermissionSubject {
  role: string;
  permissions?: string[] | string | null;
}

/** يوسّع صلاحيات المستخدم (الدور + الإضافات) إلى مجموعة */
export function resolvePermissions(subject: PermissionSubject): Set<string> {
  const base = ROLE_PERMISSIONS[subject.role as Role] ?? [];
  const extras = parsePermissions(subject.permissions);
  return new Set<string>([...base, ...extras]);
}

function parsePermissions(value: string[] | string | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

/** هل يملك المستخدم الصلاحية المطلوبة؟ */
export function can(subject: PermissionSubject | null | undefined, permission: Permission): boolean {
  if (!subject) return false;
  if (subject.role === 'ADMIN') return true;
  const set = resolvePermissions(subject);
  if (set.has('*')) return true;
  if (set.has(permission)) return true;
  // صلاحية على مستوى الوحدة كاملة: "invoices:*"
  const [mod] = permission.split(':');
  return set.has(`${mod}:*`);
}

/** هل يملك أياً من الصلاحيات؟ */
export function canAny(
  subject: PermissionSubject | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => can(subject, p));
}

/** هل يملك كل الصلاحيات؟ */
export function canAll(
  subject: PermissionSubject | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => can(subject, p));
}

export const ROLE_LABELS: Record<Role, { ar: string; fr: string; en: string }> = {
  ADMIN: { ar: 'مدير النظام', fr: 'Administrateur', en: 'Administrator' },
  MANAGER: { ar: 'مدير المحل', fr: 'Gérant', en: 'Manager' },
  TECHNICIAN: { ar: 'فني صيانة', fr: 'Technicien', en: 'Technician' },
  CASHIER: { ar: 'أمين الصندوق', fr: 'Caissier', en: 'Cashier' },
  RECEPTIONIST: { ar: 'موظف استقبال', fr: 'Réceptionniste', en: 'Receptionist' },
  ACCOUNTANT: { ar: 'محاسب', fr: 'Comptable', en: 'Accountant' },
  VIEWER: { ar: 'مشاهدة فقط', fr: 'Lecture seule', en: 'Viewer' },
};
