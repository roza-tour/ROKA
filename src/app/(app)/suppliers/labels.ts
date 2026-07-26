import type { Dictionary } from '@/i18n';

/** نصوص نموذج المورد — مشتركة بين صفحتَي الإنشاء والتعديل */
export function supplierLabels(t: Dictionary) {
  return {
    section: t.supplier.single,
    name: t.supplier.name,
    company: t.supplier.company,
    phone: t.supplier.phone,
    phone2: t.customer.phone2,
    email: t.supplier.email,
    address: t.supplier.address,
    taxNumber: t.customer.taxNumber,
    notes: t.customer.notes,
    active: t.service.active,
    save: t.actions.save,
    cancel: t.actions.cancel,
  };
}
