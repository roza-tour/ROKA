import 'server-only';

import { db } from './db';
import {
  type Period,
  getProfitAndLoss,
  getTopCustomers,
  getTopEmployees,
  getTopServices,
  getTopProducts,
  getFrequentFaults,
  getExpensesByCategory,
  getStockSummary,
} from './analytics';
import { ACTIVE_REPAIR_STATUSES } from './constants';
import { round } from './utils';

/**
 * تعريف التقارير المتاحة.
 * كل تقرير يوفّر: بياناته، وأعمدته للتصدير — حتى تعمل صفحة العرض
 * ومسار التصدير من نفس المصدر.
 */

export const REPORT_KEYS = [
  'profit-loss',
  'sales',
  'inventory',
  'top-customers',
  'top-employees',
  'top-services',
  'top-parts',
  'frequent-faults',
  'overdue-repairs',
  'warranties',
  'expenses',
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export interface ReportColumnDef {
  key: string;
  header: string;
  type?: 'text' | 'number' | 'currency' | 'date';
  align?: 'start' | 'center' | 'end';
}

export interface ReportResult {
  key: ReportKey;
  title: string;
  columns: ReportColumnDef[];
  rows: Record<string, string | number | Date | null>[];
  /** صف المجاميع في تذييل الجدول */
  totals?: Record<string, string | number | null>;
  /** بطاقات ملخّصة تُعرض فوق الجدول */
  summary?: { label: string; value: number; type: 'currency' | 'number' | 'percent' }[];
}

export async function buildReport(
  key: ReportKey,
  period: Period,
  labels: Record<string, string>,
): Promise<ReportResult> {
  switch (key) {
    case 'profit-loss':
      return profitLossReport(period, labels);
    case 'sales':
      return salesReport(period, labels);
    case 'inventory':
      return inventoryReport(labels);
    case 'top-customers':
      return topCustomersReport(period, labels);
    case 'top-employees':
      return topEmployeesReport(period, labels);
    case 'top-services':
      return topServicesReport(period, labels);
    case 'top-parts':
      return topPartsReport(period, labels);
    case 'frequent-faults':
      return frequentFaultsReport(period, labels);
    case 'overdue-repairs':
      return overdueRepairsReport(labels);
    case 'warranties':
      return warrantiesReport(period, labels);
    case 'expenses':
      return expensesReport(period, labels);
    default:
      throw new Error(`تقرير غير معروف: ${key}`);
  }
}

// -------------------------------------------------------- الأرباح والخسائر

async function profitLossReport(
  period: Period,
  l: Record<string, string>,
): Promise<ReportResult> {
  const pl = await getProfitAndLoss(period);
  const byCategory = await getExpensesByCategory(period);

  const rows: Record<string, string | number>[] = [
    { item: l.grossRevenue, amount: pl.revenue },
    { item: l.costOfGoods, amount: -pl.cost },
    { item: l.grossProfit, amount: pl.profit },
    ...byCategory.map((category) => ({
      item: `${l.expenses} — ${category.name}`,
      amount: -category.amount,
    })),
    { item: l.totalExpenses, amount: -pl.expenses },
    { item: l.netProfit, amount: pl.netProfit },
  ];

  return {
    key: 'profit-loss',
    title: l.profitLoss,
    columns: [
      { key: 'item', header: l.item },
      { key: 'amount', header: l.amount, type: 'currency', align: 'end' },
    ],
    rows,
    summary: [
      { label: l.grossRevenue, value: pl.revenue, type: 'currency' },
      { label: l.grossProfit, value: pl.profit, type: 'currency' },
      { label: l.totalExpenses, value: pl.expenses, type: 'currency' },
      { label: l.netProfit, value: pl.netProfit, type: 'currency' },
      { label: l.margin, value: pl.margin, type: 'percent' },
    ],
  };
}

// ------------------------------------------------------------------ المبيعات

async function salesReport(period: Period, l: Record<string, string>): Promise<ReportResult> {
  const invoices = await db.invoice.findMany({
    where: {
      issuedAt: { gte: period.from, lte: period.to },
      status: { notIn: ['CANCELLED', 'DRAFT'] },
    },
    select: {
      number: true,
      type: true,
      status: true,
      issuedAt: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      total: true,
      paidAmount: true,
      dueAmount: true,
      profit: true,
      customer: { select: { firstName: true, lastName: true } },
      user: { select: { fullName: true } },
    },
    orderBy: { issuedAt: 'desc' },
  });

  const rows = invoices.map((invoice) => ({
    number: invoice.number,
    date: invoice.issuedAt,
    customer: invoice.customer
      ? [invoice.customer.firstName, invoice.customer.lastName].filter(Boolean).join(' ')
      : l.walkIn,
    type: l[`type_${invoice.type}`] ?? invoice.type,
    status: l[`status_${invoice.status}`] ?? invoice.status,
    subtotal: invoice.subtotal,
    discount: invoice.discountAmount,
    tax: invoice.taxAmount,
    total: invoice.total,
    paid: invoice.paidAmount,
    due: invoice.dueAmount,
    profit: invoice.profit,
    user: invoice.user?.fullName ?? '—',
  }));

  const sum = (fn: (i: (typeof invoices)[number]) => number) =>
    round(invoices.reduce((total, invoice) => total + fn(invoice), 0));

  return {
    key: 'sales',
    title: l.sales,
    columns: [
      { key: 'number', header: l.invoiceNumber },
      { key: 'date', header: l.date, type: 'date', align: 'center' },
      { key: 'customer', header: l.customer },
      { key: 'type', header: l.type, align: 'center' },
      { key: 'status', header: l.status, align: 'center' },
      { key: 'total', header: l.total, type: 'currency', align: 'end' },
      { key: 'paid', header: l.paid, type: 'currency', align: 'end' },
      { key: 'due', header: l.due, type: 'currency', align: 'end' },
      { key: 'profit', header: l.profit, type: 'currency', align: 'end' },
      { key: 'user', header: l.user },
    ],
    rows,
    totals: {
      number: l.total,
      total: sum((i) => i.total),
      paid: sum((i) => i.paidAmount),
      due: sum((i) => i.dueAmount),
      profit: sum((i) => i.profit),
    },
    summary: [
      { label: l.count, value: invoices.length, type: 'number' },
      { label: l.grossRevenue, value: sum((i) => i.total), type: 'currency' },
      { label: l.profit, value: sum((i) => i.profit), type: 'currency' },
      { label: l.due, value: sum((i) => i.dueAmount), type: 'currency' },
    ],
  };
}

// ------------------------------------------------------------------ المخزون

async function inventoryReport(l: Record<string, string>): Promise<ReportResult> {
  const [products, summary] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      select: {
        sku: true,
        name: true,
        type: true,
        quantity: true,
        minQuantity: true,
        costPrice: true,
        sellPrice: true,
        location: true,
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
    getStockSummary(),
  ]);

  const rows = products.map((product) => ({
    sku: product.sku,
    name: product.name,
    category: product.category?.name ?? '—',
    type: l[`ptype_${product.type}`] ?? product.type,
    quantity: product.quantity,
    minQuantity: product.minQuantity,
    costPrice: product.costPrice,
    sellPrice: product.sellPrice,
    stockValue: round(product.quantity * product.costPrice),
    supplier: product.supplier?.name ?? '—',
    location: product.location ?? '—',
  }));

  return {
    key: 'inventory',
    title: l.inventory,
    columns: [
      { key: 'sku', header: l.sku },
      { key: 'name', header: l.product },
      { key: 'category', header: l.category },
      { key: 'type', header: l.type, align: 'center' },
      { key: 'quantity', header: l.quantity, type: 'number', align: 'center' },
      { key: 'minQuantity', header: l.minQuantity, type: 'number', align: 'center' },
      { key: 'costPrice', header: l.costPrice, type: 'currency', align: 'end' },
      { key: 'sellPrice', header: l.sellPrice, type: 'currency', align: 'end' },
      { key: 'stockValue', header: l.stockValue, type: 'currency', align: 'end' },
      { key: 'supplier', header: l.supplier },
      { key: 'location', header: l.location },
    ],
    rows,
    totals: {
      sku: l.total,
      stockValue: summary.totalValue,
    },
    summary: [
      { label: l.count, value: summary.itemCount, type: 'number' },
      { label: l.stockValue, value: summary.totalValue, type: 'currency' },
      { label: l.lowStock, value: summary.lowStockCount, type: 'number' },
      { label: l.outOfStock, value: summary.outOfStockCount, type: 'number' },
    ],
  };
}

// -------------------------------------------------------- التقارير المرتّبة

async function topCustomersReport(
  period: Period,
  l: Record<string, string>,
): Promise<ReportResult> {
  const items = await getTopCustomers(period, 50);
  return {
    key: 'top-customers',
    title: l.topCustomers,
    columns: [
      { key: 'name', header: l.customer },
      { key: 'count', header: l.count, type: 'number', align: 'center' },
      { key: 'revenue', header: l.revenue, type: 'currency', align: 'end' },
    ],
    rows: items.map((i) => ({ name: i.name, count: i.count, revenue: i.revenue })),
    totals: {
      name: l.total,
      count: items.reduce((s, i) => s + i.count, 0),
      revenue: round(items.reduce((s, i) => s + i.revenue, 0)),
    },
  };
}

async function topEmployeesReport(
  period: Period,
  l: Record<string, string>,
): Promise<ReportResult> {
  const items = await getTopEmployees(period, 50);
  return {
    key: 'top-employees',
    title: l.topEmployees,
    columns: [
      { key: 'name', header: l.employee },
      { key: 'count', header: l.count, type: 'number', align: 'center' },
      { key: 'revenue', header: l.revenue, type: 'currency', align: 'end' },
      { key: 'extra', header: l.details },
    ],
    rows: items.map((i) => ({
      name: i.name,
      count: i.count,
      revenue: i.revenue,
      extra: i.extra ?? '—',
    })),
    totals: {
      name: l.total,
      revenue: round(items.reduce((s, i) => s + i.revenue, 0)),
    },
  };
}

async function topServicesReport(
  period: Period,
  l: Record<string, string>,
): Promise<ReportResult> {
  const items = await getTopServices(period, 50);
  return {
    key: 'top-services',
    title: l.topServices,
    columns: [
      { key: 'name', header: l.service },
      { key: 'count', header: l.count, type: 'number', align: 'center' },
      { key: 'revenue', header: l.revenue, type: 'currency', align: 'end' },
    ],
    rows: items.map((i) => ({ name: i.name, count: i.count, revenue: i.revenue })),
    totals: {
      name: l.total,
      count: items.reduce((s, i) => s + i.count, 0),
      revenue: round(items.reduce((s, i) => s + i.revenue, 0)),
    },
  };
}

async function topPartsReport(period: Period, l: Record<string, string>): Promise<ReportResult> {
  const items = await getTopProducts(period, 50);
  return {
    key: 'top-parts',
    title: l.topParts,
    columns: [
      { key: 'sku', header: l.sku },
      { key: 'name', header: l.product },
      { key: 'count', header: l.quantity, type: 'number', align: 'center' },
      { key: 'revenue', header: l.revenue, type: 'currency', align: 'end' },
    ],
    rows: items.map((i) => ({
      sku: i.extra ?? '—',
      name: i.name,
      count: i.count,
      revenue: i.revenue,
    })),
    totals: {
      sku: l.total,
      count: items.reduce((s, i) => s + i.count, 0),
      revenue: round(items.reduce((s, i) => s + i.revenue, 0)),
    },
  };
}

async function frequentFaultsReport(
  period: Period,
  l: Record<string, string>,
): Promise<ReportResult> {
  const items = await getFrequentFaults(period, 50);
  const total = items.reduce((s, i) => s + i.count, 0);
  return {
    key: 'frequent-faults',
    title: l.frequentFaults,
    columns: [
      { key: 'name', header: l.fault },
      { key: 'count', header: l.count, type: 'number', align: 'center' },
      { key: 'share', header: l.share, align: 'center' },
    ],
    rows: items.map((i) => ({
      name: i.name,
      count: i.count,
      share: total ? `${((i.count / total) * 100).toFixed(1)}%` : '0%',
    })),
    totals: { name: l.total, count: total },
  };
}

// ------------------------------------------------------- الأجهزة المتأخرة

async function overdueRepairsReport(l: Record<string, string>): Promise<ReportResult> {
  const now = new Date();
  const orders = await db.repairOrder.findMany({
    where: { status: { in: ACTIVE_REPAIR_STATUSES }, promisedAt: { lt: now } },
    select: {
      number: true,
      status: true,
      receivedAt: true,
      promisedAt: true,
      estimatedCost: true,
      customer: { select: { firstName: true, lastName: true, phone: true } },
      device: { select: { brand: true, model: true } },
      technician: { select: { fullName: true } },
    },
    orderBy: { promisedAt: 'asc' },
  });

  const rows = orders.map((order) => ({
    number: order.number,
    customer: [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' '),
    phone: order.customer.phone,
    device: `${order.device.brand} ${order.device.model}`,
    status: l[`rstatus_${order.status}`] ?? order.status,
    receivedAt: order.receivedAt,
    promisedAt: order.promisedAt,
    daysLate: order.promisedAt
      ? Math.floor((now.getTime() - order.promisedAt.getTime()) / 86_400_000)
      : 0,
    technician: order.technician?.fullName ?? '—',
    estimatedCost: order.estimatedCost,
  }));

  return {
    key: 'overdue-repairs',
    title: l.overdueRepairs,
    columns: [
      { key: 'number', header: l.orderNumber },
      { key: 'customer', header: l.customer },
      { key: 'phone', header: l.phone },
      { key: 'device', header: l.device },
      { key: 'status', header: l.status, align: 'center' },
      { key: 'promisedAt', header: l.promisedAt, type: 'date', align: 'center' },
      { key: 'daysLate', header: l.daysLate, type: 'number', align: 'center' },
      { key: 'technician', header: l.technician },
      { key: 'estimatedCost', header: l.estimatedCost, type: 'currency', align: 'end' },
    ],
    rows,
    summary: [{ label: l.count, value: orders.length, type: 'number' }],
  };
}

// ------------------------------------------------------------------ الضمانات

async function warrantiesReport(
  period: Period,
  l: Record<string, string>,
): Promise<ReportResult> {
  const warranties = await db.warranty.findMany({
    where: { startsAt: { gte: period.from, lte: period.to } },
    select: {
      number: true,
      itemName: true,
      serial: true,
      days: true,
      startsAt: true,
      endsAt: true,
      status: true,
      customer: { select: { firstName: true, lastName: true, phone: true } },
    },
    orderBy: { endsAt: 'asc' },
  });

  const now = new Date();
  const rows = warranties.map((warranty) => ({
    number: warranty.number,
    customer: [warranty.customer.firstName, warranty.customer.lastName]
      .filter(Boolean)
      .join(' '),
    phone: warranty.customer.phone,
    item: warranty.itemName,
    serial: warranty.serial ?? '—',
    startsAt: warranty.startsAt,
    endsAt: warranty.endsAt,
    remaining: Math.max(
      0,
      Math.ceil((warranty.endsAt.getTime() - now.getTime()) / 86_400_000),
    ),
    status: l[`wstatus_${warranty.status}`] ?? warranty.status,
  }));

  return {
    key: 'warranties',
    title: l.warranties,
    columns: [
      { key: 'number', header: l.warrantyNumber },
      { key: 'customer', header: l.customer },
      { key: 'phone', header: l.phone },
      { key: 'item', header: l.item },
      { key: 'startsAt', header: l.startsAt, type: 'date', align: 'center' },
      { key: 'endsAt', header: l.endsAt, type: 'date', align: 'center' },
      { key: 'remaining', header: l.remaining, type: 'number', align: 'center' },
      { key: 'status', header: l.status, align: 'center' },
    ],
    rows,
    summary: [
      { label: l.count, value: warranties.length, type: 'number' },
      {
        label: l.active,
        value: warranties.filter((w) => w.status === 'ACTIVE' && w.endsAt > now).length,
        type: 'number',
      },
    ],
  };
}

// ----------------------------------------------------------------- المصروفات

async function expensesReport(
  period: Period,
  l: Record<string, string>,
): Promise<ReportResult> {
  const expenses = await db.expense.findMany({
    where: { date: { gte: period.from, lte: period.to } },
    select: {
      number: true,
      description: true,
      amount: true,
      date: true,
      paymentMethod: true,
      vendor: true,
      category: { select: { name: true } },
      user: { select: { fullName: true } },
    },
    orderBy: { date: 'desc' },
  });

  const total = round(expenses.reduce((sum, expense) => sum + expense.amount, 0));

  return {
    key: 'expenses',
    title: l.expenses,
    columns: [
      { key: 'number', header: l.number },
      { key: 'date', header: l.date, type: 'date', align: 'center' },
      { key: 'description', header: l.description },
      { key: 'category', header: l.category },
      { key: 'vendor', header: l.vendor },
      { key: 'method', header: l.method, align: 'center' },
      { key: 'amount', header: l.amount, type: 'currency', align: 'end' },
      { key: 'user', header: l.user },
    ],
    rows: expenses.map((expense) => ({
      number: expense.number,
      date: expense.date,
      description: expense.description,
      category: expense.category?.name ?? '—',
      vendor: expense.vendor ?? '—',
      method: l[`method_${expense.paymentMethod}`] ?? expense.paymentMethod,
      amount: expense.amount,
      user: expense.user?.fullName ?? '—',
    })),
    totals: { number: l.total, amount: total },
    summary: [
      { label: l.count, value: expenses.length, type: 'number' },
      { label: l.total, value: total, type: 'currency' },
    ],
  };
}
