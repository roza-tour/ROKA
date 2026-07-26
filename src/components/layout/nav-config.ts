import type { Permission } from '@/lib/permissions';
import type { Dictionary } from '@/i18n';

export interface NavItem {
  href: string;
  label: string;
  /** اسم أيقونة lucide (يُحلّ في مكوّن العميل) */
  icon: string;
  permission?: Permission;
  /** مطابقة دقيقة فقط (لتفادي تفعيل العنصر الأب) */
  exact?: boolean;
  badge?: 'repairsActive' | 'lowStock' | 'unpaidInvoices';
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** بناء قائمة التنقل حسب لغة الواجهة */
export function buildNavigation(t: Dictionary): NavSection[] {
  return [
    {
      title: t.nav.operations,
      items: [
        {
          href: '/dashboard',
          label: t.nav.dashboard,
          icon: 'LayoutDashboard',
          permission: 'dashboard:view',
          exact: true,
        },
        {
          href: '/pos',
          label: t.nav.pos,
          icon: 'ScanLine',
          permission: 'pos:view',
        },
        {
          href: '/repairs',
          label: t.nav.repairs,
          icon: 'Wrench',
          permission: 'repairs:view',
          badge: 'repairsActive',
        },
        {
          href: '/customers',
          label: t.nav.customers,
          icon: 'Users',
          permission: 'customers:view',
        },
        {
          href: '/appointments',
          label: t.nav.appointments,
          icon: 'CalendarClock',
          permission: 'appointments:view',
        },
      ],
    },
    {
      title: t.nav.management,
      items: [
        {
          href: '/services',
          label: t.nav.services,
          icon: 'ListChecks',
          permission: 'services:view',
        },
        {
          href: '/inventory',
          label: t.nav.inventory,
          icon: 'Package',
          permission: 'inventory:view',
          badge: 'lowStock',
        },
        {
          href: '/suppliers',
          label: t.nav.suppliers,
          icon: 'Truck',
          permission: 'suppliers:view',
        },
        {
          href: '/purchases',
          label: t.nav.purchases,
          icon: 'ShoppingCart',
          permission: 'purchases:view',
        },
        {
          href: '/warranty',
          label: t.nav.warranty,
          icon: 'ShieldCheck',
          permission: 'warranty:view',
        },
      ],
    },
    {
      title: t.nav.finance,
      items: [
        {
          href: '/invoices',
          label: t.nav.invoices,
          icon: 'Receipt',
          permission: 'invoices:view',
          badge: 'unpaidInvoices',
        },
        {
          href: '/quotations',
          label: t.nav.quotations,
          icon: 'FileText',
          permission: 'quotations:view',
        },
        {
          href: '/payments',
          label: t.nav.payments,
          icon: 'Wallet',
          permission: 'payments:view',
        },
        {
          href: '/installments',
          label: t.nav.installments,
          icon: 'CalendarRange',
          permission: 'invoices:view',
        },
        {
          href: '/expenses',
          label: t.nav.expenses,
          icon: 'TrendingDown',
          permission: 'expenses:view',
        },
        {
          href: '/reports',
          label: t.nav.reports,
          icon: 'BarChart3',
          permission: 'reports:view',
        },
      ],
    },
    {
      title: t.nav.system,
      items: [
        {
          href: '/employees',
          label: t.nav.employees,
          icon: 'UserCog',
          permission: 'employees:view',
        },
        {
          href: '/attendance',
          label: t.nav.attendance,
          icon: 'Clock',
          permission: 'attendance:view',
        },
        {
          href: '/payroll',
          label: t.nav.payroll,
          icon: 'Banknote',
          permission: 'payroll:view',
        },
        {
          href: '/notifications',
          label: t.nav.notifications,
          icon: 'Bell',
          permission: 'notifications:view',
        },
        {
          href: '/audit',
          label: t.nav.auditLog,
          icon: 'History',
          permission: 'audit:view',
        },
        {
          href: '/settings',
          label: t.nav.settings,
          icon: 'Settings',
          permission: 'settings:view',
        },
      ],
    },
  ];
}
