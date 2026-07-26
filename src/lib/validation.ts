import { z } from 'zod';
import {
  DEVICE_TYPES,
  REPAIR_STATUSES,
  REPAIR_PRIORITIES,
  PRODUCT_TYPES,
  PAYMENT_METHODS,
  INVOICE_TYPES,
  RECURRENCES,
  NOTIFICATION_CHANNELS,
  APPOINTMENT_STATUSES,
  ATTENDANCE_STATUSES,
  ROLES,
  STOCK_MOVEMENT_TYPES,
} from './constants';

/**
 * مخططات التحقق المشتركة بين الخادم والعميل.
 * كل إجراء خادمي (server action) يمرّ عبر مخطط هنا قبل لمس قاعدة البيانات.
 */

// ------------------------------------------------------------ أدوات مساعدة

/** حقل نصي اختياري: يحوّل السلسلة الفارغة إلى null */
export const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable();

/** رقم من حقل نموذج (قد يأتي كسلسلة فارغة) */
export const numberField = (min = 0) =>
  z.coerce
    .number({ invalid_type_error: 'أدخل رقماً صالحاً' })
    .min(min, `القيمة الدنيا ${min}`)
    .finite();

export const optionalNumber = (fallback = 0) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? fallback : v),
    z.coerce.number().finite(),
  );

/** تاريخ من حقل نموذج */
export const dateField = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : new Date(String(v))),
  z.date().nullable(),
);

export const requiredDate = z.preprocess(
  (v) => (v ? new Date(String(v)) : undefined),
  z.date({ required_error: 'التاريخ مطلوب', invalid_type_error: 'تاريخ غير صالح' }),
);

/** مربع اختيار من نموذج HTML: 'on' | 'true' | undefined */
export const checkboxField = z.preprocess(
  (v) => v === 'on' || v === 'true' || v === true,
  z.boolean(),
);

const phoneRegex = /^\+?[0-9\s\-().]{7,20}$/;

export const phoneField = z
  .string()
  .trim()
  .regex(phoneRegex, 'رقم هاتف غير صالح');

export const optionalPhone = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .refine((v) => v === null || phoneRegex.test(v), 'رقم هاتف غير صالح');

export const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .refine(
    (v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v),
    'بريد إلكتروني غير صالح',
  );

// ------------------------------------------------------------------ العملاء

export const customerSchema = z.object({
  firstName: z.string().trim().min(2, 'الاسم مطلوب (حرفان على الأقل)').max(80),
  lastName: optionalString,
  phone: phoneField,
  phone2: optionalPhone,
  email: optionalEmail,
  address: optionalString,
  city: optionalString,
  taxNumber: optionalString,
  notes: optionalString,
  type: z.enum(['INDIVIDUAL', 'COMPANY']).default('INDIVIDUAL'),
  isBlocked: checkboxField.optional().default(false),
});
export type CustomerInput = z.infer<typeof customerSchema>;

// ------------------------------------------------------------------ الأجهزة

export const deviceSchema = z.object({
  customerId: z.string().min(1, 'اختر العميل'),
  type: z.enum(DEVICE_TYPES),
  brand: z.string().trim().min(1, 'الشركة المصنعة مطلوبة').max(60),
  model: z.string().trim().min(1, 'الموديل مطلوب').max(80),
  color: optionalString,
  serialNumber: optionalString,
  imei: optionalString,
  imei2: optionalString,
  passcode: optionalString,
  purchaseDate: dateField.optional(),
  notes: optionalString,
});
export type DeviceInput = z.infer<typeof deviceSchema>;

// ------------------------------------------------------------------ الصيانة

export const repairItemSchema = z.object({
  kind: z.enum(['SERVICE', 'PART', 'CUSTOM']),
  serviceId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  name: z.string().trim().min(1, 'اسم البند مطلوب'),
  quantity: z.coerce.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unitPrice: z.coerce.number().min(0),
  unitCost: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().nullable().optional(),
});
export type RepairItemInput = z.infer<typeof repairItemSchema>;

export const repairOrderSchema = z.object({
  customerId: z.string().min(1, 'اختر العميل'),
  deviceId: z.string().optional(),
  // بيانات جهاز جديد (عند عدم اختيار جهاز موجود)
  device: deviceSchema.omit({ customerId: true }).optional(),

  technicianId: optionalString.optional(),
  priority: z.enum(REPAIR_PRIORITIES).default('NORMAL'),
  problemDescription: z.string().trim().min(3, 'وصف العطل مطلوب').max(2000),
  faultCategory: optionalString.optional(),
  internalNotes: optionalString.optional(),

  accessories: z.record(z.union([z.boolean(), z.string()])).default({}),
  conditionReport: z.record(z.string()).default({}),
  damageMarks: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        type: z.string(),
        note: z.string().optional(),
      }),
    )
    .default([]),
  photos: z.array(z.string()).default([]),

  customerSignature: z.string().nullable().optional(),
  employeeSignature: z.string().nullable().optional(),

  estimatedCost: optionalNumber(0),
  depositAmount: optionalNumber(0),
  promisedAt: dateField.optional(),
  warrantyDays: optionalNumber(0),

  items: z.array(repairItemSchema).default([]),
});
export type RepairOrderInput = z.infer<typeof repairOrderSchema>;

export const repairStatusSchema = z.object({
  repairOrderId: z.string().min(1),
  status: z.enum(REPAIR_STATUSES),
  note: optionalString.optional(),
  notifyCustomer: z.boolean().default(false),
  notifyChannel: z.enum(NOTIFICATION_CHANNELS).optional(),
});

// ------------------------------------------------------------------ الخدمات

export const serviceSchema = z.object({
  code: z.string().trim().min(2, 'الرمز مطلوب').max(24).toUpperCase(),
  name: z.string().trim().min(2, 'اسم الخدمة مطلوب').max(120),
  nameFr: optionalString,
  nameEn: optionalString,
  categoryId: optionalString,
  deviceType: z.enum([...DEVICE_TYPES, 'ALL']).default('ALL'),
  description: optionalString,
  price: numberField(0),
  cost: optionalNumber(0),
  estimatedMinutes: optionalNumber(30),
  warrantyDays: optionalNumber(0),
  requiresParts: checkboxField.optional().default(false),
  isActive: checkboxField.optional().default(true),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

export const serviceCategorySchema = z.object({
  name: z.string().trim().min(2, 'اسم التصنيف مطلوب').max(80),
  nameFr: optionalString,
  nameEn: optionalString,
  deviceType: z.enum([...DEVICE_TYPES, 'ALL']).default('ALL'),
  icon: optionalString,
  isActive: checkboxField.optional().default(true),
});

// ----------------------------------------------------------------- المخزون

export const productSchema = z.object({
  sku: optionalString,
  barcode: optionalString,
  name: z.string().trim().min(2, 'اسم المنتج مطلوب').max(160),
  nameFr: optionalString,
  nameEn: optionalString,
  type: z.enum(PRODUCT_TYPES),
  categoryId: optionalString,
  brand: optionalString,
  model: optionalString,
  compatibleWith: optionalString,
  description: optionalString,
  unit: z.string().trim().default('PCS'),
  costPrice: optionalNumber(0),
  sellPrice: numberField(0),
  wholesalePrice: optionalNumber(0),
  taxRate: optionalNumber(0),
  quantity: optionalNumber(0),
  minQuantity: optionalNumber(0),
  maxQuantity: optionalNumber(0),
  location: optionalString,
  supplierId: optionalString,
  trackSerial: checkboxField.optional().default(false),
  warrantyDays: optionalNumber(0),
  isActive: checkboxField.optional().default(true),
});
export type ProductInput = z.infer<typeof productSchema>;

export const stockAdjustSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(STOCK_MOVEMENT_TYPES),
  quantity: z.coerce.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unitCost: optionalNumber(0),
  reason: optionalString,
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2, 'اسم المورد مطلوب').max(120),
  company: optionalString,
  phone: optionalPhone,
  phone2: optionalPhone,
  email: optionalEmail,
  address: optionalString,
  taxNumber: optionalString,
  notes: optionalString,
  isActive: checkboxField.optional().default(true),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'اختر المورد'),
  notes: optionalString,
  discount: optionalNumber(0),
  tax: optionalNumber(0),
  shipping: optionalNumber(0),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().positive(),
        unitCost: z.coerce.number().min(0),
      }),
    )
    .min(1, 'أضف بنداً واحداً على الأقل'),
});

// ---------------------------------------------------------------- الفواتير

export const invoiceItemSchema = z.object({
  kind: z.enum(['PRODUCT', 'SERVICE', 'REPAIR', 'CUSTOM']),
  productId: z.string().nullable().optional(),
  serviceId: z.string().nullable().optional(),
  name: z.string().trim().min(1, 'اسم البند مطلوب'),
  description: z.string().nullable().optional(),
  quantity: z.coerce.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unitPrice: z.coerce.number().min(0),
  unitCost: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).default(0),
});
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

export const invoiceSchema = z.object({
  type: z.enum(INVOICE_TYPES).default('SALE'),
  customerId: optionalString.optional(),
  repairOrderId: optionalString.optional(),
  items: z.array(invoiceItemSchema).min(1, 'أضف بنداً واحداً على الأقل'),
  discountType: z.enum(['FIXED', 'PERCENT']).default('FIXED'),
  discountValue: optionalNumber(0),
  taxRate: optionalNumber(0),
  couponCode: optionalString.optional(),
  notes: optionalString.optional(),
  terms: optionalString.optional(),
  warrantyDays: optionalNumber(0),
  dueDate: dateField.optional(),
  // دفعة فورية اختيارية
  payment: z
    .object({
      amount: z.coerce.number().min(0),
      method: z.enum(PAYMENT_METHODS),
      reference: z.string().nullable().optional(),
    })
    .optional(),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  method: z.enum(PAYMENT_METHODS),
  reference: optionalString,
  notes: optionalString,
});

export const couponSchema = z.object({
  code: z.string().trim().min(2).max(32).toUpperCase(),
  description: optionalString,
  type: z.enum(['PERCENT', 'FIXED']).default('PERCENT'),
  value: numberField(0),
  minAmount: optionalNumber(0),
  maxDiscount: optionalNumber(0),
  usageLimit: optionalNumber(0),
  startsAt: dateField.optional(),
  endsAt: dateField.optional(),
  isActive: checkboxField.optional().default(true),
});

// ----------------------------------------------------------- عروض الأسعار

export const quotationSchema = z.object({
  customerId: z.string().min(1, 'اختر العميل'),
  deviceId: optionalString.optional(),
  items: z.array(invoiceItemSchema).min(1, 'أضف بنداً واحداً على الأقل'),
  discountType: z.enum(['FIXED', 'PERCENT']).default('FIXED'),
  discountValue: optionalNumber(0),
  taxRate: optionalNumber(0),
  notes: optionalString.optional(),
  terms: optionalString.optional(),
  validUntil: dateField.optional(),
});

// --------------------------------------------------------------- المصروفات

export const expenseSchema = z.object({
  categoryId: optionalString,
  description: z.string().trim().min(2, 'وصف المصروف مطلوب').max(300),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  date: requiredDate,
  paymentMethod: z.enum(PAYMENT_METHODS).default('CASH'),
  vendor: optionalString,
  reference: optionalString,
  receiptUrl: optionalString,
  notes: optionalString,
  isRecurring: checkboxField.optional().default(false),
  recurrence: z.enum(RECURRENCES).nullable().optional(),
  reminderDays: optionalNumber(3),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  nameFr: optionalString,
  nameEn: optionalString,
  icon: optionalString,
  color: optionalString,
  isRecurringDefault: checkboxField.optional().default(false),
});

// -------------------------------------------------------------- الموظفون

export const employeeSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'اسم المستخدم قصير جداً')
    .max(40)
    .regex(/^[a-z0-9._-]+$/, 'يُسمح بالأحرف اللاتينية والأرقام والنقطة والشرطة فقط'),
  email: optionalEmail,
  fullName: z.string().trim().min(3, 'الاسم الكامل مطلوب').max(120),
  phone: optionalPhone,
  role: z.enum(ROLES),
  jobTitle: optionalString,
  baseSalary: optionalNumber(0),
  hireDate: dateField.optional(),
  nationalId: optionalString,
  notes: optionalString,
  branchId: optionalString,
  isActive: checkboxField.optional().default(true),
  permissions: z.array(z.string()).default([]),
  password: z.string().optional(),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const attendanceSchema = z.object({
  userId: z.string().min(1),
  date: requiredDate,
  checkIn: optionalString,
  checkOut: optionalString,
  status: z.enum(ATTENDANCE_STATUSES).default('PRESENT'),
  notes: optionalString,
});

export const payrollSchema = z.object({
  userId: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'صيغة الفترة يجب أن تكون YYYY-MM'),
  baseSalary: optionalNumber(0),
  bonuses: optionalNumber(0),
  commissions: optionalNumber(0),
  deductions: optionalNumber(0),
  advances: optionalNumber(0),
  notes: optionalString,
});

// --------------------------------------------------------------- المواعيد

export const appointmentSchema = z.object({
  customerId: optionalString,
  customerName: z.string().trim().min(2, 'اسم العميل مطلوب').max(120),
  customerPhone: phoneField,
  deviceType: z.enum(DEVICE_TYPES).default('PHONE'),
  description: optionalString,
  scheduledAt: requiredDate,
  durationMinutes: optionalNumber(30),
  assignedToId: optionalString,
  status: z.enum(APPOINTMENT_STATUSES).default('SCHEDULED'),
  notes: optionalString,
});

// --------------------------------------------------------------- الإعدادات

export const settingsSchema = z.record(z.string());

export const notificationTemplateSchema = z.object({
  key: z.string().min(1),
  channel: z.enum(NOTIFICATION_CHANNELS),
  locale: z.enum(['ar', 'fr', 'en']),
  subject: optionalString,
  body: z.string().trim().min(1, 'نص القالب مطلوب'),
  isActive: checkboxField.optional().default(true),
});

export const branchSchema = z.object({
  code: z.string().trim().min(2).max(20).toUpperCase(),
  name: z.string().trim().min(2).max(100),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalString,
  taxNumber: optionalString,
  isActive: checkboxField.optional().default(true),
});

// ------------------------------------------------------------------ أدوات

/** يستخرج أول رسالة خطأ من نتيجة zod */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'بيانات غير صالحة';
}

/** يحوّل أخطاء zod إلى خريطة حقل → رسالة */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
