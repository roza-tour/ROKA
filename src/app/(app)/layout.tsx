import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { ROLE_LABELS } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getShopInfo } from '@/lib/settings';
import { db } from '@/lib/db';
import { buildNavigation } from '@/components/layout/nav-config';
import { AppShell } from '@/components/layout/app-shell';
import { ACTIVE_REPAIR_STATUSES } from '@/lib/constants';
import type { Role } from '@/lib/constants';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { locale, t } = await getI18n();
  const shop = await getShopInfo();

  // ترشيح القائمة حسب صلاحيات المستخدم
  const sections = buildNavigation(t)
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.permission || can(user, item.permission),
      ),
    }))
    .filter((section) => section.items.length > 0);

  // شارات العدّ في القائمة الجانبية
  const [repairsActive, unpaidInvoices, lowStockProducts] = await Promise.all([
    can(user, 'repairs:view')
      ? db.repairOrder.count({ where: { status: { in: ACTIVE_REPAIR_STATUSES } } })
      : Promise.resolve(0),
    can(user, 'invoices:view')
      ? db.invoice.count({ where: { status: { in: ['UNPAID', 'PARTIAL'] } } })
      : Promise.resolve(0),
    can(user, 'inventory:view')
      ? db.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count FROM Product
          WHERE isActive = 1 AND minQuantity > 0 AND quantity <= minQuantity
        `
      : Promise.resolve([{ count: BigInt(0) }]),
  ]);

  const lowStock = Number(lowStockProducts[0]?.count ?? 0);

  return (
    <AppShell
      sections={sections}
      badges={{ repairsActive, unpaidInvoices, lowStock }}
      user={{
        fullName: user.fullName,
        role: user.role,
        roleLabel: t.roles[user.role as Role] ?? ROLE_LABELS[user.role as Role]?.ar ?? user.role,
        avatarUrl: user.avatarUrl,
      }}
      shopName={shop.name}
      locale={locale}
      labels={{
        profile: t.nav.profile,
        changePassword: t.auth.changePassword,
        logout: t.nav.logout,
        search: t.app.searchPlaceholder,
      }}
    >
      {children}
    </AppShell>
  );
}
