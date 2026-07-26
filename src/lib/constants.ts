/**
 * الثوابت المشتركة عبر النظام.
 * القيم هنا هي «مصدر الحقيقة» للحقول النصية المحدودة في قاعدة البيانات
 * (استُعيض عن enum في Prisma بنصوص لضمان التوافق بين SQLite و PostgreSQL).
 */

// ---------------------------------------------------------------- الأدوار

export const ROLES = [
  'ADMIN',
  'MANAGER',
  'TECHNICIAN',
  'CASHIER',
  'RECEPTIONIST',
  'ACCOUNTANT',
  'VIEWER',
] as const;
export type Role = (typeof ROLES)[number];

// ---------------------------------------------------------- أنواع الأجهزة

export const DEVICE_TYPES = [
  'PHONE',
  'TABLET',
  'LAPTOP',
  'DESKTOP',
  'CONSOLE',
  'WATCH',
  'ACCESSORY',
  'OTHER',
] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

// -------------------------------------------------------- حالات الصيانة

export const REPAIR_STATUSES = [
  'RECEIVED',
  'DIAGNOSING',
  'WAITING_APPROVAL',
  'WAITING_PARTS',
  'REPAIRING',
  'READY',
  'DELIVERED',
  'CANCELLED',
  'UNREPAIRABLE',
] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

/** الحالات التي تُعتبر «الجهاز داخل الورشة» */
export const ACTIVE_REPAIR_STATUSES: RepairStatus[] = [
  'RECEIVED',
  'DIAGNOSING',
  'WAITING_APPROVAL',
  'WAITING_PARTS',
  'REPAIRING',
];

export const REPAIR_STATUS_COLORS: Record<RepairStatus, string> = {
  RECEIVED: 'slate',
  DIAGNOSING: 'blue',
  WAITING_APPROVAL: 'amber',
  WAITING_PARTS: 'orange',
  REPAIRING: 'violet',
  READY: 'emerald',
  DELIVERED: 'teal',
  CANCELLED: 'rose',
  UNREPAIRABLE: 'red',
};

/** الانتقالات المسموحة بين حالات الصيانة */
export const REPAIR_STATUS_FLOW: Record<RepairStatus, RepairStatus[]> = {
  RECEIVED: ['DIAGNOSING', 'REPAIRING', 'CANCELLED'],
  DIAGNOSING: ['WAITING_APPROVAL', 'WAITING_PARTS', 'REPAIRING', 'UNREPAIRABLE', 'CANCELLED'],
  WAITING_APPROVAL: ['REPAIRING', 'WAITING_PARTS', 'CANCELLED', 'UNREPAIRABLE'],
  WAITING_PARTS: ['REPAIRING', 'WAITING_APPROVAL', 'CANCELLED', 'UNREPAIRABLE'],
  REPAIRING: ['READY', 'WAITING_PARTS', 'UNREPAIRABLE', 'CANCELLED'],
  READY: ['DELIVERED', 'REPAIRING'],
  DELIVERED: [],
  CANCELLED: ['RECEIVED'],
  UNREPAIRABLE: ['DELIVERED', 'REPAIRING'],
};

export const REPAIR_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type RepairPriority = (typeof REPAIR_PRIORITIES)[number];

// ------------------------------------------------------ تقرير حالة الجهاز

/** حالة كل مكوّن في تقرير الفحص المبدئي */
export const CONDITION_VALUES = ['OK', 'FAULTY', 'MISSING', 'UNTESTED'] as const;
export type ConditionValue = (typeof CONDITION_VALUES)[number];

/** مكوّنات الفحص حسب نوع الجهاز */
export const CONDITION_CHECKS: {
  key: string;
  label: string;
  labelFr: string;
  labelEn: string;
  devices: DeviceType[] | 'ALL';
}[] = [
  { key: 'screen', label: 'الشاشة', labelFr: 'Écran', labelEn: 'Screen', devices: 'ALL' },
  { key: 'backCover', label: 'الواجهة الخلفية', labelFr: 'Face arrière', labelEn: 'Back cover', devices: ['PHONE', 'TABLET', 'WATCH'] },
  { key: 'frontCamera', label: 'الكاميرا الأمامية', labelFr: 'Caméra avant', labelEn: 'Front camera', devices: ['PHONE', 'TABLET', 'LAPTOP'] },
  { key: 'backCamera', label: 'الكاميرا الخلفية', labelFr: 'Caméra arrière', labelEn: 'Rear camera', devices: ['PHONE', 'TABLET'] },
  { key: 'speaker', label: 'السماعات', labelFr: 'Haut-parleurs', labelEn: 'Speakers', devices: 'ALL' },
  { key: 'earpiece', label: 'سماعة المكالمات', labelFr: 'Écouteur', labelEn: 'Earpiece', devices: ['PHONE'] },
  { key: 'microphone', label: 'الميكروفون', labelFr: 'Microphone', labelEn: 'Microphone', devices: 'ALL' },
  { key: 'chargingPort', label: 'منفذ الشحن', labelFr: 'Port de charge', labelEn: 'Charging port', devices: 'ALL' },
  { key: 'buttons', label: 'الأزرار', labelFr: 'Boutons', labelEn: 'Buttons', devices: 'ALL' },
  { key: 'fingerprint', label: 'البصمة', labelFr: 'Empreinte', labelEn: 'Fingerprint', devices: ['PHONE', 'TABLET', 'LAPTOP'] },
  { key: 'faceId', label: 'Face ID', labelFr: 'Face ID', labelEn: 'Face ID', devices: ['PHONE', 'TABLET'] },
  { key: 'network', label: 'الشبكة', labelFr: 'Réseau', labelEn: 'Network', devices: ['PHONE', 'TABLET'] },
  { key: 'wifi', label: 'الواي فاي', labelFr: 'Wi-Fi', labelEn: 'Wi-Fi', devices: 'ALL' },
  { key: 'bluetooth', label: 'البلوتوث', labelFr: 'Bluetooth', labelEn: 'Bluetooth', devices: 'ALL' },
  { key: 'battery', label: 'البطارية', labelFr: 'Batterie', labelEn: 'Battery', devices: 'ALL' },
  { key: 'keyboard', label: 'لوحة المفاتيح', labelFr: 'Clavier', labelEn: 'Keyboard', devices: ['LAPTOP', 'DESKTOP'] },
  { key: 'touchpad', label: 'لوحة اللمس', labelFr: 'Pavé tactile', labelEn: 'Touchpad', devices: ['LAPTOP'] },
  { key: 'ports', label: 'المنافذ', labelFr: 'Ports', labelEn: 'Ports', devices: ['LAPTOP', 'DESKTOP', 'CONSOLE'] },
  { key: 'fans', label: 'المراوح', labelFr: 'Ventilateurs', labelEn: 'Fans', devices: ['LAPTOP', 'DESKTOP', 'CONSOLE'] },
  { key: 'storage', label: 'وحدة التخزين', labelFr: 'Stockage', labelEn: 'Storage', devices: ['LAPTOP', 'DESKTOP', 'CONSOLE'] },
  { key: 'chassis', label: 'الهيكل', labelFr: 'Châssis', labelEn: 'Chassis', devices: 'ALL' },
  { key: 'vibration', label: 'الهزاز', labelFr: 'Vibreur', labelEn: 'Vibration', devices: ['PHONE'] },
  { key: 'sensors', label: 'الحساسات', labelFr: 'Capteurs', labelEn: 'Sensors', devices: ['PHONE', 'TABLET'] },
];

/** علامات فيزيائية عامة (نعم/لا) */
export const PHYSICAL_FLAGS = [
  { key: 'scratches', label: 'خدوش', labelFr: 'Rayures', labelEn: 'Scratches' },
  { key: 'cracks', label: 'كسور', labelFr: 'Fissures', labelEn: 'Cracks' },
  { key: 'bent', label: 'انحناء', labelFr: 'Tordu', labelEn: 'Bent' },
  { key: 'dropMarks', label: 'آثار سقوط', labelFr: 'Traces de chute', labelEn: 'Drop marks' },
  { key: 'waterDamage', label: 'آثار ماء', labelFr: "Dégât d'eau", labelEn: 'Water damage' },
  { key: 'previousRepair', label: 'صيانة سابقة', labelFr: 'Réparation antérieure', labelEn: 'Previous repair' },
  { key: 'missingScrews', label: 'براغي ناقصة', labelFr: 'Vis manquantes', labelEn: 'Missing screws' },
];

/** الملحقات المستلمة مع الجهاز */
export const ACCESSORY_ITEMS = [
  { key: 'battery', label: 'البطارية', labelFr: 'Batterie', labelEn: 'Battery' },
  { key: 'charger', label: 'الشاحن', labelFr: 'Chargeur', labelEn: 'Charger' },
  { key: 'cable', label: 'الكابل', labelFr: 'Câble', labelEn: 'Cable' },
  { key: 'case', label: 'الجراب', labelFr: 'Coque', labelEn: 'Case' },
  { key: 'memoryCard', label: 'كارت الذاكرة', labelFr: 'Carte mémoire', labelEn: 'Memory card' },
  { key: 'simCard', label: 'الشريحة', labelFr: 'Carte SIM', labelEn: 'SIM card' },
  { key: 'screenProtector', label: 'واقي الشاشة', labelFr: "Protection d'écran", labelEn: 'Screen protector' },
  { key: 'headphones', label: 'السماعات', labelFr: 'Écouteurs', labelEn: 'Headphones' },
  { key: 'stylus', label: 'القلم', labelFr: 'Stylet', labelEn: 'Stylus' },
  { key: 'box', label: 'العلبة', labelFr: 'Boîte', labelEn: 'Box' },
  { key: 'controller', label: 'ذراع التحكم', labelFr: 'Manette', labelEn: 'Controller' },
  { key: 'powerAdapter', label: 'محول الطاقة', labelFr: 'Adaptateur', labelEn: 'Power adapter' },
];

// ---------------------------------------------------------- أنواع المنتجات

export const PRODUCT_TYPES = ['DEVICE', 'PART', 'ACCESSORY', 'CONSUMABLE'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const STOCK_MOVEMENT_TYPES = [
  'IN',
  'OUT',
  'ADJUST',
  'RETURN_IN',
  'RETURN_OUT',
  'TRANSFER',
  'DAMAGE',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

/** الحركات التي تزيد المخزون */
export const STOCK_IN_TYPES: StockMovementType[] = ['IN', 'RETURN_IN'];

// -------------------------------------------------------------- الفواتير

export const INVOICE_TYPES = ['SALE', 'REPAIR', 'SERVICE', 'RETURN'] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_STATUSES = [
  'DRAFT',
  'UNPAID',
  'PARTIAL',
  'PAID',
  'REFUNDED',
  'CANCELLED',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = [
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'WALLET',
  'CREDIT',
  'CHECK',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const QUOTATION_STATUSES = [
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

// ------------------------------------------------------------- المصروفات

export const RECURRENCES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
export type Recurrence = (typeof RECURRENCES)[number];

// ------------------------------------------------------------ الإشعارات

export const NOTIFICATION_CHANNELS = ['SMS', 'WHATSAPP', 'EMAIL', 'INTERNAL'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_KEYS = [
  'repair.received',
  'repair.diagnosing',
  'repair.waiting_approval',
  'repair.waiting_parts',
  'repair.repairing',
  'repair.ready',
  'repair.delivered',
  'warranty.expiring',
  'invoice.created',
  'invoice.due',
  'appointment.reminder',
] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

/** ربط حالة الصيانة بمفتاح قالب الإشعار */
export const REPAIR_STATUS_NOTIFICATION: Partial<Record<RepairStatus, NotificationKey>> = {
  RECEIVED: 'repair.received',
  DIAGNOSING: 'repair.diagnosing',
  WAITING_APPROVAL: 'repair.waiting_approval',
  WAITING_PARTS: 'repair.waiting_parts',
  REPAIRING: 'repair.repairing',
  READY: 'repair.ready',
  DELIVERED: 'repair.delivered',
};

// ------------------------------------------------------------- المواعيد

export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'ARRIVED',
  'DONE',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HOLIDAY'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

// ---------------------------------------------------------------- عام

export const CURRENCIES = [
  { code: 'DZD', symbol: 'د.ج', name: 'دينار جزائري' },
  { code: 'MAD', symbol: 'د.م', name: 'درهم مغربي' },
  { code: 'TND', symbol: 'د.ت', name: 'دينار تونسي' },
  { code: 'EGP', symbol: 'ج.م', name: 'جنيه مصري' },
  { code: 'SAR', symbol: 'ر.س', name: 'ريال سعودي' },
  { code: 'AED', symbol: 'د.إ', name: 'درهم إماراتي' },
  { code: 'USD', symbol: '$', name: 'دولار أمريكي' },
  { code: 'EUR', symbol: '€', name: 'يورو' },
];

export const DEFAULT_SETTINGS: Record<string, string> = {
  'shop.name': 'ROKA',
  'shop.legalName': 'ROKA — بيع وصيانة الأجهزة الإلكترونية',
  'shop.phone': '',
  'shop.phone2': '',
  'shop.email': '',
  'shop.address': '',
  'shop.taxNumber': '',
  'shop.logoUrl': '',
  'shop.website': '',
  'finance.currency': 'DZD',
  'finance.taxRate': '0',
  'finance.taxEnabled': 'false',
  'finance.decimals': '2',
  'repair.defaultWarrantyDays': '30',
  'repair.defaultTurnaroundDays': '3',
  'repair.overdueGraceHours': '24',
  'repair.terms':
    'المحل غير مسؤول عن أي بيانات مفقودة. يجب استلام الجهاز خلال 30 يوماً من تاريخ الإصلاح. الضمان لا يشمل الكسر أو الماء أو سوء الاستخدام.',
  'invoice.terms': 'البضاعة المباعة لا تُرد ولا تُستبدل بعد 48 ساعة. الضمان حسب الشروط المذكورة.',
  'invoice.footer': 'شكراً لتعاملكم معنا',
  'loyalty.enabled': 'true',
  'loyalty.pointsPerUnit': '1', // نقطة لكل 100 وحدة عملة
  'loyalty.unitValue': '100',
  'notifications.autoOnStatusChange': 'true',
  'notifications.defaultChannel': 'SMS',
  'inventory.lowStockAlert': 'true',
  'ui.defaultLocale': 'ar',
  'ui.theme': 'system',
};
