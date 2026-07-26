import type { Dictionary } from '@/i18n';
import {
  INVOICE_TYPES,
  INVOICE_STATUSES,
  REPAIR_STATUSES,
  PRODUCT_TYPES,
  PAYMENT_METHODS,
} from './constants';

/** كل النصوص التي تحتاجها بواني التقارير، كخريطة مسطّحة */
export function reportLabels(t: Dictionary): Record<string, string> {
  const labels: Record<string, string> = {
    profitLoss: t.report.profitLoss,
    sales: t.report.sales,
    inventory: t.report.inventory,
    topCustomers: t.report.topCustomers,
    topEmployees: t.report.topEmployees,
    topServices: t.report.topServices,
    topParts: t.report.topParts,
    frequentFaults: t.report.frequentFaults,
    overdueRepairs: t.report.overdueRepairs,
    warranties: t.report.warranties,
    expenses: t.report.expenses,

    item: t.invoice.item,
    amount: t.payment.amount,
    grossRevenue: t.report.grossRevenue,
    costOfGoods: t.report.costOfGoods,
    grossProfit: t.report.grossProfit,
    totalExpenses: t.report.totalExpenses,
    netProfit: t.report.netProfit,
    margin: t.report.margin,
    revenue: t.report.revenue,
    count: t.report.count,
    total: t.app.total,
    details: t.app.details,
    share: 'النسبة',

    invoiceNumber: t.invoice.number,
    orderNumber: t.repair.number,
    warrantyNumber: t.warranty.number,
    number: t.expense.number,
    date: t.audit.date,
    customer: t.invoice.customer,
    walkIn: t.invoice.walkIn,
    employee: t.employee.single,
    phone: t.customer.phone,
    device: t.repair.device,
    service: t.service.single,
    product: t.product.single,
    fault: t.repair.faultCategory,
    type: t.invoice.type,
    status: t.invoice.status,
    paid: t.invoice.paid,
    due: t.invoice.due,
    profit: t.invoice.profit,
    user: t.audit.user,
    method: t.payment.method,
    description: t.expense.description,
    category: t.expense.category,
    vendor: t.expense.vendor,

    sku: t.product.sku,
    quantity: t.product.quantity,
    minQuantity: t.product.minQuantity,
    costPrice: t.product.costPrice,
    sellPrice: t.product.sellPrice,
    stockValue: t.product.stockValue,
    supplier: t.product.supplier,
    location: t.product.location,
    lowStock: t.product.lowStock,
    outOfStock: t.product.outOfStock,

    promisedAt: t.repair.promisedAt,
    daysLate: 'أيام التأخير',
    technician: t.repair.technician,
    estimatedCost: t.repair.estimatedCost,

    startsAt: t.warranty.startsAt,
    endsAt: t.warranty.endsAt,
    remaining: t.warranty.remaining,
    active: t.warranty.statuses.ACTIVE,
  };

  for (const type of INVOICE_TYPES) labels[`type_${type}`] = t.invoice.types[type];
  for (const status of INVOICE_STATUSES) labels[`status_${status}`] = t.invoice.statuses[status];
  for (const status of REPAIR_STATUSES) labels[`rstatus_${status}`] = t.repair.statuses[status];
  for (const type of PRODUCT_TYPES) labels[`ptype_${type}`] = t.product.types[type];
  for (const method of PAYMENT_METHODS) labels[`method_${method}`] = t.payment.methods[method];
  for (const [key, value] of Object.entries(t.warranty.statuses)) {
    labels[`wstatus_${key}`] = value;
  }

  return labels;
}

/** عناوين التقارير في القائمة الجانبية لصفحة التقارير */
export function reportMenu(t: Dictionary) {
  return [
    { key: 'profit-loss', label: t.report.profitLoss, icon: 'TrendingUp' },
    { key: 'sales', label: t.report.sales, icon: 'Receipt' },
    { key: 'expenses', label: t.report.expenses, icon: 'TrendingDown' },
    { key: 'inventory', label: t.report.inventory, icon: 'Package' },
    { key: 'top-customers', label: t.report.topCustomers, icon: 'Users' },
    { key: 'top-employees', label: t.report.topEmployees, icon: 'UserCog' },
    { key: 'top-services', label: t.report.topServices, icon: 'ListChecks' },
    { key: 'top-parts', label: t.report.topParts, icon: 'Boxes' },
    { key: 'frequent-faults', label: t.report.frequentFaults, icon: 'AlertTriangle' },
    { key: 'overdue-repairs', label: t.report.overdueRepairs, icon: 'AlarmClock' },
    { key: 'warranties', label: t.report.warranties, icon: 'ShieldCheck' },
  ] as const;
}
