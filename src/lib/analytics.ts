import 'server-only';

import { db } from './db';
import {
  ACTIVE_REPAIR_STATUSES,
  type RepairStatus,
} from './constants';
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addDays,
  round,
} from './utils';

/**
 * طبقة التحليلات — كل استعلامات الأرقام والتقارير في مكان واحد.
 *
 * قاعدة حساب الربح المعتمدة:
 *   الربح الإجمالي = إيراد الفواتير غير الملغاة − تكلفة البنود
 *   صافي الربح     = الربح الإجمالي − المصروفات
 * الإيراد يُحتسب على أساس تاريخ إصدار الفاتورة (accrual)، لا على أساس التحصيل.
 */

export interface Period {
  from: Date;
  to: Date;
}

export const PERIODS = {
  today: (): Period => ({ from: startOfDay(), to: endOfDay() }),
  month: (): Period => ({ from: startOfMonth(), to: endOfMonth() }),
  year: (): Period => ({ from: startOfYear(), to: endOfYear() }),
  days: (n: number): Period => ({ from: startOfDay(addDays(new Date(), -n + 1)), to: endOfDay() }),
};

/** الفترة السابقة المكافئة (للمقارنة) */
export function previousPeriod(period: Period): Period {
  const span = period.to.getTime() - period.from.getTime();
  return {
    from: new Date(period.from.getTime() - span - 1),
    to: new Date(period.from.getTime() - 1),
  };
}

// ------------------------------------------------------------- الإيراد والربح

export interface RevenueSummary {
  revenue: number;
  cost: number;
  profit: number;
  invoiceCount: number;
  collected: number;
  outstanding: number;
}

/** ملخص الإيرادات والأرباح لفترة */
export async function getRevenueSummary(period: Period): Promise<RevenueSummary> {
  const [aggregate, payments] = await Promise.all([
    db.invoice.aggregate({
      where: {
        issuedAt: { gte: period.from, lte: period.to },
        status: { notIn: ['CANCELLED', 'DRAFT'] },
      },
      _sum: { total: true, costTotal: true, profit: true, paidAmount: true, dueAmount: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: { createdAt: { gte: period.from, lte: period.to }, direction: 'IN' },
      _sum: { amount: true },
    }),
  ]);

  const revenue = round(aggregate._sum.total ?? 0);
  const cost = round(aggregate._sum.costTotal ?? 0);

  return {
    revenue,
    cost,
    profit: round(aggregate._sum.profit ?? revenue - cost),
    invoiceCount: aggregate._count,
    collected: round(payments._sum.amount ?? 0),
    outstanding: round(aggregate._sum.dueAmount ?? 0),
  };
}

/** إجمالي المصروفات لفترة */
export async function getExpensesTotal(period: Period): Promise<number> {
  const result = await db.expense.aggregate({
    where: { date: { gte: period.from, lte: period.to } },
    _sum: { amount: true },
  });
  return round(result._sum.amount ?? 0);
}

export interface ProfitAndLoss extends RevenueSummary {
  expenses: number;
  netProfit: number;
  margin: number;
}

/** بيان الأرباح والخسائر لفترة */
export async function getProfitAndLoss(period: Period): Promise<ProfitAndLoss> {
  const [summary, expenses] = await Promise.all([
    getRevenueSummary(period),
    getExpensesTotal(period),
  ]);

  const netProfit = round(summary.profit - expenses);
  return {
    ...summary,
    expenses,
    netProfit,
    margin: summary.revenue ? round((netProfit / summary.revenue) * 100, 1) : 0,
  };
}

// ------------------------------------------------------------------ الصيانة

export interface RepairCounts {
  active: number;
  ready: number;
  deliveredInPeriod: number;
  overdue: number;
  byStatus: Record<string, number>;
}

export async function getRepairCounts(period: Period): Promise<RepairCounts> {
  const now = new Date();

  const [grouped, deliveredInPeriod, overdue] = await Promise.all([
    db.repairOrder.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    db.repairOrder.count({
      where: { deliveredAt: { gte: period.from, lte: period.to } },
    }),
    db.repairOrder.count({
      where: {
        status: { in: ACTIVE_REPAIR_STATUSES },
        promisedAt: { lt: now },
      },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of grouped) byStatus[row.status] = row._count._all;

  const active = ACTIVE_REPAIR_STATUSES.reduce(
    (sum, status) => sum + (byStatus[status] ?? 0),
    0,
  );

  return {
    active,
    ready: byStatus.READY ?? 0,
    deliveredInPeriod,
    overdue,
    byStatus,
  };
}

// ------------------------------------------------------------------ المخزون

export interface StockSummary {
  totalValue: number;
  retailValue: number;
  itemCount: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export async function getStockSummary(): Promise<StockSummary> {
  const rows = await db.$queryRaw<
    { totalValue: number | null; retailValue: number | null; itemCount: bigint }[]
  >`
    SELECT
      SUM(quantity * costPrice) as totalValue,
      SUM(quantity * sellPrice) as retailValue,
      COUNT(*) as itemCount
    FROM Product WHERE isActive = 1
  `;

  const [lowStock, outOfStock] = await Promise.all([
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM Product
      WHERE isActive = 1 AND minQuantity > 0 AND quantity <= minQuantity AND quantity > 0
    `,
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM Product WHERE isActive = 1 AND quantity <= 0
    `,
  ]);

  return {
    totalValue: round(rows[0]?.totalValue ?? 0),
    retailValue: round(rows[0]?.retailValue ?? 0),
    itemCount: Number(rows[0]?.itemCount ?? 0),
    lowStockCount: Number(lowStock[0]?.count ?? 0),
    outOfStockCount: Number(outOfStock[0]?.count ?? 0),
  };
}

// ------------------------------------------------------ السلاسل الزمنية للرسوم

export interface TimeSeriesPoint {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  expenses: number;
  invoices: number;
}

/** سلسلة يومية للإيرادات والمصروفات خلال آخر N يوم */
export async function getDailySeries(days = 30): Promise<TimeSeriesPoint[]> {
  const from = startOfDay(addDays(new Date(), -days + 1));
  const to = endOfDay();

  const [invoices, expenses] = await Promise.all([
    db.invoice.findMany({
      where: {
        issuedAt: { gte: from, lte: to },
        status: { notIn: ['CANCELLED', 'DRAFT'] },
      },
      select: { issuedAt: true, total: true, costTotal: true, profit: true },
    }),
    db.expense.findMany({
      where: { date: { gte: from, lte: to } },
      select: { date: true, amount: true },
    }),
  ]);

  const buckets = new Map<string, TimeSeriesPoint>();
  for (let i = 0; i < days; i++) {
    const key = dateKey(addDays(from, i));
    buckets.set(key, {
      date: key,
      revenue: 0,
      cost: 0,
      profit: 0,
      expenses: 0,
      invoices: 0,
    });
  }

  for (const inv of invoices) {
    const bucket = buckets.get(dateKey(inv.issuedAt));
    if (!bucket) continue;
    bucket.revenue += inv.total;
    bucket.cost += inv.costTotal;
    bucket.profit += inv.profit;
    bucket.invoices += 1;
  }

  for (const exp of expenses) {
    const bucket = buckets.get(dateKey(exp.date));
    if (!bucket) continue;
    bucket.expenses += exp.amount;
  }

  return [...buckets.values()].map((b) => ({
    ...b,
    revenue: round(b.revenue),
    cost: round(b.cost),
    profit: round(b.profit),
    expenses: round(b.expenses),
  }));
}

/** سلسلة شهرية لسنة محددة */
export async function getMonthlySeries(year: number): Promise<TimeSeriesPoint[]> {
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59, 999);

  const [invoices, expenses] = await Promise.all([
    db.invoice.findMany({
      where: {
        issuedAt: { gte: from, lte: to },
        status: { notIn: ['CANCELLED', 'DRAFT'] },
      },
      select: { issuedAt: true, total: true, costTotal: true, profit: true },
    }),
    db.expense.findMany({
      where: { date: { gte: from, lte: to } },
      select: { date: true, amount: true },
    }),
  ]);

  const buckets: TimeSeriesPoint[] = Array.from({ length: 12 }, (_, m) => ({
    date: `${year}-${String(m + 1).padStart(2, '0')}`,
    revenue: 0,
    cost: 0,
    profit: 0,
    expenses: 0,
    invoices: 0,
  }));

  for (const inv of invoices) {
    const b = buckets[inv.issuedAt.getMonth()];
    b.revenue += inv.total;
    b.cost += inv.costTotal;
    b.profit += inv.profit;
    b.invoices += 1;
  }
  for (const exp of expenses) {
    buckets[exp.date.getMonth()].expenses += exp.amount;
  }

  return buckets.map((b) => ({
    ...b,
    revenue: round(b.revenue),
    cost: round(b.cost),
    profit: round(b.profit),
    expenses: round(b.expenses),
  }));
}

/** عدد أوامر الصيانة المستلمة والمسلّمة يومياً */
export async function getRepairSeries(days = 30): Promise<
  { date: string; received: number; delivered: number }[]
> {
  const from = startOfDay(addDays(new Date(), -days + 1));
  const to = endOfDay();

  const [received, delivered] = await Promise.all([
    db.repairOrder.findMany({
      where: { receivedAt: { gte: from, lte: to } },
      select: { receivedAt: true },
    }),
    db.repairOrder.findMany({
      where: { deliveredAt: { gte: from, lte: to } },
      select: { deliveredAt: true },
    }),
  ]);

  const buckets = new Map<string, { date: string; received: number; delivered: number }>();
  for (let i = 0; i < days; i++) {
    const key = dateKey(addDays(from, i));
    buckets.set(key, { date: key, received: 0, delivered: 0 });
  }

  for (const r of received) {
    const b = buckets.get(dateKey(r.receivedAt));
    if (b) b.received += 1;
  }
  for (const d of delivered) {
    if (!d.deliveredAt) continue;
    const b = buckets.get(dateKey(d.deliveredAt));
    if (b) b.delivered += 1;
  }

  return [...buckets.values()];
}

// -------------------------------------------------------------- أفضل العناصر

export interface RankedItem {
  id: string;
  name: string;
  count: number;
  revenue: number;
  extra?: string;
}

/** أكثر الخدمات طلباً */
export async function getTopServices(period: Period, limit = 8): Promise<RankedItem[]> {
  const rows = await db.$queryRaw<
    { id: string; name: string; count: bigint; revenue: number | null }[]
  >`
    SELECT s.id as id, s.name as name,
           COUNT(*) as count,
           SUM(x.total) as revenue
    FROM (
      SELECT ii.serviceId as serviceId, ii.total as total
      FROM InvoiceItem ii
      JOIN Invoice i ON i.id = ii.invoiceId
      WHERE ii.serviceId IS NOT NULL
        AND i.status NOT IN ('CANCELLED','DRAFT')
        AND i.issuedAt >= ${period.from} AND i.issuedAt <= ${period.to}
      UNION ALL
      SELECT ri.serviceId as serviceId, ri.total as total
      FROM RepairItem ri
      JOIN RepairOrder ro ON ro.id = ri.repairOrderId
      WHERE ri.serviceId IS NOT NULL
        AND ro.status NOT IN ('CANCELLED')
        AND ro.receivedAt >= ${period.from} AND ro.receivedAt <= ${period.to}
    ) x
    JOIN Service s ON s.id = x.serviceId
    GROUP BY s.id, s.name
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    count: Number(r.count),
    revenue: round(r.revenue ?? 0),
  }));
}

/** أكثر قطع الغيار/المنتجات استهلاكاً */
export async function getTopProducts(period: Period, limit = 8): Promise<RankedItem[]> {
  const rows = await db.$queryRaw<
    { id: string; name: string; sku: string; count: number | null; revenue: number | null }[]
  >`
    SELECT p.id as id, p.name as name, p.sku as sku,
           SUM(x.quantity) as count,
           SUM(x.total) as revenue
    FROM (
      SELECT ii.productId as productId, ii.quantity as quantity, ii.total as total
      FROM InvoiceItem ii
      JOIN Invoice i ON i.id = ii.invoiceId
      WHERE ii.productId IS NOT NULL
        AND i.status NOT IN ('CANCELLED','DRAFT')
        AND i.issuedAt >= ${period.from} AND i.issuedAt <= ${period.to}
      UNION ALL
      SELECT ri.productId as productId, ri.quantity as quantity, ri.total as total
      FROM RepairItem ri
      JOIN RepairOrder ro ON ro.id = ri.repairOrderId
      WHERE ri.productId IS NOT NULL
        AND ro.status NOT IN ('CANCELLED')
        AND ro.receivedAt >= ${period.from} AND ro.receivedAt <= ${period.to}
    ) x
    JOIN Product p ON p.id = x.productId
    GROUP BY p.id, p.name, p.sku
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    count: Number(r.count ?? 0),
    revenue: round(r.revenue ?? 0),
    extra: r.sku,
  }));
}

/** أفضل العملاء حسب حجم التعامل */
export async function getTopCustomers(period: Period, limit = 8): Promise<RankedItem[]> {
  const rows = await db.$queryRaw<
    { id: string; firstName: string; lastName: string | null; count: bigint; revenue: number | null }[]
  >`
    SELECT c.id as id, c.firstName as firstName, c.lastName as lastName,
           COUNT(i.id) as count, SUM(i.total) as revenue
    FROM Invoice i
    JOIN Customer c ON c.id = i.customerId
    WHERE i.status NOT IN ('CANCELLED','DRAFT')
      AND i.issuedAt >= ${period.from} AND i.issuedAt <= ${period.to}
    GROUP BY c.id, c.firstName, c.lastName
    ORDER BY revenue DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    name: [r.firstName, r.lastName].filter(Boolean).join(' '),
    count: Number(r.count),
    revenue: round(r.revenue ?? 0),
  }));
}

/** أداء الموظفين */
export async function getTopEmployees(period: Period, limit = 8): Promise<RankedItem[]> {
  const [salesRows, repairRows] = await Promise.all([
    db.$queryRaw<{ id: string; fullName: string; count: bigint; revenue: number | null }[]>`
      SELECT u.id as id, u.fullName as fullName, COUNT(i.id) as count, SUM(i.total) as revenue
      FROM Invoice i JOIN User u ON u.id = i.userId
      WHERE i.status NOT IN ('CANCELLED','DRAFT')
        AND i.issuedAt >= ${period.from} AND i.issuedAt <= ${period.to}
      GROUP BY u.id, u.fullName
    `,
    db.$queryRaw<{ id: string; fullName: string; count: bigint }[]>`
      SELECT u.id as id, u.fullName as fullName, COUNT(ro.id) as count
      FROM RepairOrder ro JOIN User u ON u.id = ro.technicianId
      WHERE ro.completedAt >= ${period.from} AND ro.completedAt <= ${period.to}
      GROUP BY u.id, u.fullName
    `,
  ]);

  const map = new Map<string, RankedItem>();
  for (const r of salesRows) {
    map.set(r.id, {
      id: r.id,
      name: r.fullName,
      count: Number(r.count),
      revenue: round(r.revenue ?? 0),
    });
  }
  for (const r of repairRows) {
    const existing = map.get(r.id);
    if (existing) {
      existing.extra = `${Number(r.count)} صيانة`;
    } else {
      map.set(r.id, {
        id: r.id,
        name: r.fullName,
        count: Number(r.count),
        revenue: 0,
        extra: `${Number(r.count)} صيانة`,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

/** الأعطال الأكثر تكراراً */
export async function getFrequentFaults(period: Period, limit = 10): Promise<RankedItem[]> {
  const rows = await db.repairOrder.groupBy({
    by: ['faultCategory'],
    where: {
      receivedAt: { gte: period.from, lte: period.to },
      faultCategory: { not: null },
    },
    _count: { _all: true },
    orderBy: { _count: { faultCategory: 'desc' } },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.faultCategory ?? 'unknown',
    name: r.faultCategory ?? '—',
    count: r._count._all,
    revenue: 0,
  }));
}

/** المصروفات مجمّعة حسب التصنيف */
export async function getExpensesByCategory(
  period: Period,
): Promise<{ id: string; name: string; amount: number; count: number }[]> {
  const rows = await db.expense.groupBy({
    by: ['categoryId'],
    where: { date: { gte: period.from, lte: period.to } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const categories = await db.expenseCategory.findMany({
    where: { id: { in: rows.map((r) => r.categoryId).filter(Boolean) as string[] } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(categories.map((c) => [c.id, c.name]));

  return rows
    .map((r) => ({
      id: r.categoryId ?? 'uncategorized',
      name: r.categoryId ? (nameMap.get(r.categoryId) ?? '—') : 'غير مصنّف',
      amount: round(r._sum.amount ?? 0),
      count: r._count._all,
    }))
    .sort((a, b) => b.amount - a.amount);
}

// ------------------------------------------------------------------ التنبيهات

export interface DashboardAlerts {
  lowStock: { id: string; name: string; quantity: number; minQuantity: number }[];
  overdueRepairs: { id: string; number: string; customerName: string; promisedAt: Date | null }[];
  unpaidInvoices: { id: string; number: string; dueAmount: number; dueDate: Date | null }[];
  expiringWarranties: { id: string; number: string; itemName: string; endsAt: Date }[];
  dueRecurringExpenses: { id: string; description: string; amount: number; nextDueDate: Date | null }[];
}

export async function getDashboardAlerts(limit = 5): Promise<DashboardAlerts> {
  const now = new Date();
  const in14Days = addDays(now, 14);

  const [lowStock, overdueRepairs, unpaidInvoices, expiringWarranties, recurringExpenses] =
    await Promise.all([
      db.$queryRaw<
        { id: string; name: string; quantity: number; minQuantity: number }[]
      >`
        SELECT id, name, quantity, minQuantity FROM Product
        WHERE isActive = 1 AND minQuantity > 0 AND quantity <= minQuantity
        ORDER BY (quantity - minQuantity) ASC
        LIMIT ${limit}
      `,
      db.repairOrder.findMany({
        where: { status: { in: ACTIVE_REPAIR_STATUSES }, promisedAt: { lt: now } },
        select: {
          id: true,
          number: true,
          promisedAt: true,
          customer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { promisedAt: 'asc' },
        take: limit,
      }),
      db.invoice.findMany({
        where: { status: { in: ['UNPAID', 'PARTIAL'] }, dueAmount: { gt: 0 } },
        select: { id: true, number: true, dueAmount: true, dueDate: true },
        orderBy: [{ dueDate: 'asc' }, { issuedAt: 'asc' }],
        take: limit,
      }),
      db.warranty.findMany({
        where: { status: 'ACTIVE', endsAt: { gte: now, lte: in14Days } },
        select: { id: true, number: true, itemName: true, endsAt: true },
        orderBy: { endsAt: 'asc' },
        take: limit,
      }),
      db.expense.findMany({
        where: { isRecurring: true, nextDueDate: { lte: addDays(now, 7) } },
        select: { id: true, description: true, amount: true, nextDueDate: true },
        orderBy: { nextDueDate: 'asc' },
        take: limit,
      }),
    ]);

  return {
    lowStock,
    overdueRepairs: overdueRepairs.map((r) => ({
      id: r.id,
      number: r.number,
      customerName: [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' '),
      promisedAt: r.promisedAt,
    })),
    unpaidInvoices,
    expiringWarranties,
    dueRecurringExpenses: recurringExpenses,
  };
}

// -------------------------------------------------------------------- مساعدات

function dateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type { RepairStatus };
