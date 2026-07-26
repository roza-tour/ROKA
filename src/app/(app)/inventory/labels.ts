import type { Dictionary } from '@/i18n';
import type { ProductFormLabels } from './product-form';

/** نصوص نموذج المنتج — مشتركة بين صفحتَي الإنشاء والتعديل */
export function productFormLabels(t: Dictionary): ProductFormLabels {
  return {
    basic: t.product.single,
    pricing: t.invoice.unitPrice,
    stock: t.product.quantity,

    name: t.product.name,
    type: t.product.type,
    types: t.product.types as Record<string, string>,
    category: t.product.category,
    sku: t.product.sku,
    skuHint: 'يُولَّد تلقائياً إن تُرك فارغاً',
    barcode: t.product.barcode,
    barcodeHint: 'يُولَّد باركود EAN-13 صالح تلقائياً',
    brand: t.product.brand,
    model: t.product.model,
    compatibleWith: t.product.compatibleWith,
    compatibleWithHint: 'الموديلات التي تناسبها هذه القطعة — تساعد في البحث',
    description: t.product.description,

    costPrice: t.product.costPrice,
    sellPrice: t.product.sellPrice,
    wholesalePrice: t.product.wholesalePrice,
    taxRate: t.invoice.taxRate,
    profit: t.invoice.profit,
    margin: t.product.margin,

    quantity: t.product.quantity,
    quantityHint: 'الرصيد الافتتاحي — يُسجَّل كحركة إدخال',
    quantityEditHint: 'التعديل يتم عبر «تعديل الكمية» ليبقى سجل الحركات دقيقاً',
    minQuantity: t.product.minQuantity,
    minQuantityHint: 'التنبيه عند الوصول لهذا الحد',
    maxQuantity: t.product.maxQuantity,
    unit: t.product.unit,
    location: t.product.location,
    supplier: t.product.supplier,
    warrantyDays: t.product.warranty,
    trackSerial: t.product.trackSerial,
    active: t.service.active,
    none: t.app.none,

    save: t.actions.save,
    cancel: t.actions.cancel,
  };
}
