import type { Dictionary } from '@/i18n';
import { PAYMENT_METHODS, INVOICE_TYPES } from './constants';

/**
 * نصوص محرّر المستندات (الفواتير وعروض الأسعار) — تُبنى على الخادم
 * وتُمرَّر كخريطة مسطّحة إلى مكوّنات العميل.
 */
export function documentLabels(t: Dictionary): Record<string, string> {
  const labels: Record<string, string> = {
    header: t.app.details,
    type: t.invoice.type,
    customer: t.invoice.customer,
    selectCustomer: t.pos.selectCustomer,
    searchCustomer: t.customer.searchHint,
    fromRepair: t.repair.single,

    items: t.invoice.items,
    item: t.invoice.item,
    itemName: t.invoice.item,
    addProduct: t.invoice.addProduct,
    addService: t.invoice.addService,
    addCustom: t.invoice.addCustom,
    noItems: t.invoice.emptyItems,
    quantity: t.invoice.quantity,
    unitPrice: t.invoice.unitPrice,
    discount: t.invoice.discount,
    total: t.app.total,
    subtotal: t.app.subtotal,
    remove: t.actions.delete,
    service: t.service.single,
    product: t.product.single,
    stock: t.product.quantity,
    insufficientStock: t.product.insufficientStock,

    totals: t.app.summary,
    fixed: t.invoice.fixed,
    percent: t.invoice.percent,
    tax: t.invoice.tax,
    taxRate: t.invoice.taxRate,
    notes: t.invoice.notes,
    profit: t.invoice.profit,

    payment: t.payment.title,
    coupon: t.invoice.coupon,
    couponApplied: t.invoice.couponApplied,
    couponInvalid: t.invoice.couponInvalid,
    warrantyDays: t.repair.warrantyDays,
    dueDate: t.invoice.dueDate,
    paidAmount: t.invoice.paid,
    method: t.payment.method,
    reference: t.payment.reference,
    validUntil: t.quotation.validUntil,
    creditNeedsCustomer: 'البيع الآجل يتطلب اختيار عميل لتسجيل الدين عليه',

    search: t.app.searchPlaceholder,
    noResults: t.app.noResults,
    clear: t.app.clear,
    save: t.actions.save,
    cancel: t.actions.cancel,
  };

  for (const method of PAYMENT_METHODS) {
    labels[`method_${method}`] = t.payment.methods[method];
  }
  for (const type of INVOICE_TYPES) {
    labels[`type_${type}`] = t.invoice.types[type];
  }

  return labels;
}
