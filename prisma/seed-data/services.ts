/**
 * كتالوج الخدمات الافتراضي.
 * الأسعار تقديرية ويمكن تعديلها بالكامل من واجهة النظام.
 */

export interface SeedServiceCategory {
  key: string;
  name: string;
  nameFr: string;
  nameEn: string;
  deviceType: 'PHONE' | 'TABLET' | 'LAPTOP' | 'DESKTOP' | 'CONSOLE' | 'ALL';
  icon: string;
  services: SeedService[];
}

export interface SeedService {
  code: string;
  name: string;
  nameFr: string;
  nameEn: string;
  price: number;
  cost?: number;
  minutes: number;
  warrantyDays: number;
  requiresParts?: boolean;
  description?: string;
}

export const SERVICE_CATALOG: SeedServiceCategory[] = [
  // ================================================================ الهواتف
  {
    key: 'phone-hardware',
    name: 'الهواتف — تبديل قطع',
    nameFr: 'Téléphones — Remplacement de pièces',
    nameEn: 'Phones — Parts replacement',
    deviceType: 'PHONE',
    icon: 'Smartphone',
    services: [
      { code: 'PH-SCR', name: 'تغيير شاشة', nameFr: "Remplacement d'écran", nameEn: 'Screen replacement', price: 8000, cost: 5500, minutes: 45, warrantyDays: 30, requiresParts: true },
      { code: 'PH-BAT', name: 'تغيير بطارية', nameFr: 'Remplacement de batterie', nameEn: 'Battery replacement', price: 3500, cost: 2200, minutes: 30, warrantyDays: 90, requiresParts: true },
      { code: 'PH-CAMF', name: 'تغيير كاميرا أمامية', nameFr: 'Remplacement caméra avant', nameEn: 'Front camera replacement', price: 3000, cost: 1800, minutes: 40, warrantyDays: 30, requiresParts: true },
      { code: 'PH-CAMB', name: 'تغيير كاميرا خلفية', nameFr: 'Remplacement caméra arrière', nameEn: 'Rear camera replacement', price: 4500, cost: 2800, minutes: 45, warrantyDays: 30, requiresParts: true },
      { code: 'PH-SPK', name: 'تغيير سماعة', nameFr: 'Remplacement haut-parleur', nameEn: 'Speaker replacement', price: 2000, cost: 1000, minutes: 35, warrantyDays: 30, requiresParts: true },
      { code: 'PH-MIC', name: 'تغيير مايك', nameFr: 'Remplacement microphone', nameEn: 'Microphone replacement', price: 2000, cost: 900, minutes: 35, warrantyDays: 30, requiresParts: true },
      { code: 'PH-CHG', name: 'تغيير منفذ شحن', nameFr: 'Remplacement port de charge', nameEn: 'Charging port replacement', price: 2500, cost: 1200, minutes: 40, warrantyDays: 30, requiresParts: true },
      { code: 'PH-BTN', name: 'تغيير أزرار', nameFr: 'Remplacement des boutons', nameEn: 'Buttons replacement', price: 1800, cost: 700, minutes: 35, warrantyDays: 30, requiresParts: true },
      { code: 'PH-FPR', name: 'تغيير بصمة', nameFr: "Remplacement lecteur d'empreinte", nameEn: 'Fingerprint sensor replacement', price: 3500, cost: 2000, minutes: 45, warrantyDays: 30, requiresParts: true },
      { code: 'PH-BCK', name: 'تغيير ظهر الجهاز', nameFr: 'Remplacement face arrière', nameEn: 'Back cover replacement', price: 3000, cost: 1800, minutes: 40, warrantyDays: 30, requiresParts: true },
      { code: 'PH-FLX', name: 'تغيير فلاتات', nameFr: 'Remplacement des nappes', nameEn: 'Flex cable replacement', price: 2200, cost: 1000, minutes: 40, warrantyDays: 30, requiresParts: true },
      { code: 'PH-VIB', name: 'تغيير الهزاز', nameFr: 'Remplacement du vibreur', nameEn: 'Vibration motor replacement', price: 1500, cost: 600, minutes: 30, warrantyDays: 30, requiresParts: true },
    ],
  },
  {
    key: 'phone-board',
    name: 'الهواتف — صيانة اللوحة',
    nameFr: 'Téléphones — Carte mère',
    nameEn: 'Phones — Board repair',
    deviceType: 'PHONE',
    icon: 'Cpu',
    services: [
      { code: 'PH-IC', name: 'تغيير IC', nameFr: 'Remplacement IC', nameEn: 'IC replacement', price: 5000, cost: 2500, minutes: 90, warrantyDays: 30, requiresParts: true },
      { code: 'PH-MB', name: 'صيانة اللوحة الأم', nameFr: 'Réparation carte mère', nameEn: 'Motherboard repair', price: 7000, cost: 2000, minutes: 150, warrantyDays: 30 },
      { code: 'PH-WTR', name: 'إزالة الماء وتنظيف اللوحة', nameFr: "Traitement dégât d'eau", nameEn: 'Water damage treatment', price: 3000, cost: 500, minutes: 90, warrantyDays: 7, description: 'تنظيف بالموجات فوق الصوتية ومعالجة التآكل — بدون ضمان على النتيجة' },
      { code: 'PH-CLN', name: 'تنظيف الجهاز', nameFr: "Nettoyage de l'appareil", nameEn: 'Device cleaning', price: 1000, cost: 150, minutes: 30, warrantyDays: 0 },
    ],
  },
  {
    key: 'phone-software',
    name: 'الهواتف — البرمجيات',
    nameFr: 'Téléphones — Logiciel',
    nameEn: 'Phones — Software',
    deviceType: 'PHONE',
    icon: 'Code',
    services: [
      { code: 'PH-UNL', name: 'فك كلمة المرور', nameFr: 'Déverrouillage code', nameEn: 'Passcode removal', price: 2500, cost: 0, minutes: 60, warrantyDays: 0, description: 'يتطلب إثبات ملكية الجهاز' },
      { code: 'PH-FRP', name: 'إزالة حساب Google (FRP)', nameFr: 'Suppression compte Google (FRP)', nameEn: 'Google account (FRP) removal', price: 3000, cost: 0, minutes: 60, warrantyDays: 0, description: 'يتطلب إثبات ملكية الجهاز ووثيقة شراء' },
      { code: 'PH-ICL', name: 'إزالة حساب iCloud (الطرق القانونية)', nameFr: 'Suppression iCloud (voies légales)', nameEn: 'iCloud removal (legal channels)', price: 5000, cost: 0, minutes: 90, warrantyDays: 0, description: 'عبر القنوات الرسمية فقط مع إثبات ملكية موثّق' },
      { code: 'PH-FMT', name: 'فورمات', nameFr: 'Formatage', nameEn: 'Factory reset', price: 800, cost: 0, minutes: 20, warrantyDays: 0 },
      { code: 'PH-FLS', name: 'فلاش النظام', nameFr: 'Flash firmware', nameEn: 'Firmware flash', price: 2000, cost: 0, minutes: 60, warrantyDays: 15 },
      { code: 'PH-UPD', name: 'تحديث النظام', nameFr: 'Mise à jour système', nameEn: 'System update', price: 800, cost: 0, minutes: 40, warrantyDays: 0 },
      { code: 'PH-REC', name: 'استرجاع البيانات', nameFr: 'Récupération de données', nameEn: 'Data recovery', price: 4000, cost: 0, minutes: 120, warrantyDays: 0, description: 'حسب حالة الجهاز — لا يُضمن استرجاع كامل البيانات' },
      { code: 'PH-BKP', name: 'نسخ البيانات', nameFr: 'Sauvegarde des données', nameEn: 'Data backup', price: 1000, cost: 0, minutes: 45, warrantyDays: 0 },
    ],
  },
  {
    key: 'phone-accessories',
    name: 'الهواتف — تركيب إكسسوارات',
    nameFr: 'Téléphones — Pose accessoires',
    nameEn: 'Phones — Accessory fitting',
    deviceType: 'PHONE',
    icon: 'Shield',
    services: [
      { code: 'PH-GLS', name: 'تركيب حماية شاشة', nameFr: "Pose protection d'écran", nameEn: 'Screen protector fitting', price: 800, cost: 300, minutes: 10, warrantyDays: 7, requiresParts: true },
      { code: 'PH-CSE', name: 'تركيب جراب', nameFr: 'Pose de coque', nameEn: 'Case fitting', price: 200, cost: 0, minutes: 5, warrantyDays: 0 },
      { code: 'PH-LNS', name: 'تركيب عدسات حماية الكاميرا', nameFr: 'Pose protection caméra', nameEn: 'Camera lens protector fitting', price: 500, cost: 200, minutes: 10, warrantyDays: 7, requiresParts: true },
    ],
  },

  // ============================================================== الحواسيب
  {
    key: 'computer-software',
    name: 'الحواسيب — أنظمة وبرمجيات',
    nameFr: 'Ordinateurs — Systèmes',
    nameEn: 'Computers — Systems & software',
    deviceType: 'LAPTOP',
    icon: 'Monitor',
    services: [
      { code: 'PC-WIN', name: 'تثبيت Windows', nameFr: 'Installation Windows', nameEn: 'Windows installation', price: 2000, cost: 0, minutes: 90, warrantyDays: 15 },
      { code: 'PC-LNX', name: 'تثبيت Linux', nameFr: 'Installation Linux', nameEn: 'Linux installation', price: 2000, cost: 0, minutes: 90, warrantyDays: 15 },
      { code: 'PC-MAC', name: 'تثبيت macOS', nameFr: 'Installation macOS', nameEn: 'macOS installation', price: 3000, cost: 0, minutes: 120, warrantyDays: 15 },
      { code: 'PC-DRV', name: 'تثبيت التعريفات', nameFr: 'Installation des pilotes', nameEn: 'Drivers installation', price: 800, cost: 0, minutes: 40, warrantyDays: 0 },
      { code: 'PC-FMT', name: 'فورمات', nameFr: 'Formatage', nameEn: 'Format', price: 1200, cost: 0, minutes: 60, warrantyDays: 0 },
      { code: 'PC-VIR', name: 'إزالة الفيروسات', nameFr: 'Suppression des virus', nameEn: 'Virus removal', price: 1500, cost: 0, minutes: 60, warrantyDays: 15 },
      { code: 'PC-SFT', name: 'إصلاح السوفتوير', nameFr: 'Réparation logicielle', nameEn: 'Software repair', price: 1800, cost: 0, minutes: 75, warrantyDays: 15 },
      { code: 'PC-REC', name: 'استرجاع البيانات', nameFr: 'Récupération de données', nameEn: 'Data recovery', price: 5000, cost: 0, minutes: 180, warrantyDays: 0 },
      { code: 'PC-BKP', name: 'نسخ احتياطي', nameFr: 'Sauvegarde', nameEn: 'Backup', price: 1200, cost: 0, minutes: 60, warrantyDays: 0 },
    ],
  },
  {
    key: 'computer-hardware',
    name: 'الحواسيب — العتاد',
    nameFr: 'Ordinateurs — Matériel',
    nameEn: 'Computers — Hardware',
    deviceType: 'LAPTOP',
    icon: 'HardDrive',
    services: [
      { code: 'PC-SSD', name: 'تغيير SSD', nameFr: 'Remplacement SSD', nameEn: 'SSD replacement', price: 1500, cost: 300, minutes: 45, warrantyDays: 30, requiresParts: true },
      { code: 'PC-HDD', name: 'تغيير HDD', nameFr: 'Remplacement HDD', nameEn: 'HDD replacement', price: 1500, cost: 300, minutes: 45, warrantyDays: 30, requiresParts: true },
      { code: 'PC-RAM', name: 'تغيير RAM', nameFr: 'Remplacement RAM', nameEn: 'RAM replacement', price: 1000, cost: 200, minutes: 30, warrantyDays: 30, requiresParts: true },
      { code: 'PC-SCR', name: 'تغيير شاشة', nameFr: "Remplacement d'écran", nameEn: 'Screen replacement', price: 4000, cost: 1500, minutes: 90, warrantyDays: 30, requiresParts: true },
      { code: 'PC-KBD', name: 'تغيير لوحة مفاتيح', nameFr: 'Remplacement clavier', nameEn: 'Keyboard replacement', price: 3000, cost: 1200, minutes: 75, warrantyDays: 30, requiresParts: true },
      { code: 'PC-BAT', name: 'تغيير بطارية', nameFr: 'Remplacement batterie', nameEn: 'Battery replacement', price: 2500, cost: 900, minutes: 40, warrantyDays: 90, requiresParts: true },
      { code: 'PC-FAN', name: 'تنظيف المروحة', nameFr: 'Nettoyage du ventilateur', nameEn: 'Fan cleaning', price: 1500, cost: 100, minutes: 60, warrantyDays: 15 },
      { code: 'PC-THP', name: 'تغيير المعجون الحراري', nameFr: 'Changement pâte thermique', nameEn: 'Thermal paste replacement', price: 2000, cost: 300, minutes: 75, warrantyDays: 90, requiresParts: true },
      { code: 'PC-CLN', name: 'تنظيف الجهاز', nameFr: "Nettoyage de l'appareil", nameEn: 'Device cleaning', price: 1500, cost: 150, minutes: 60, warrantyDays: 0 },
      { code: 'PC-UPG', name: 'ترقية الجهاز', nameFr: "Mise à niveau de l'appareil", nameEn: 'Hardware upgrade', price: 2000, cost: 0, minutes: 90, warrantyDays: 30, requiresParts: true },
      { code: 'PC-MB', name: 'صيانة اللوحة الأم', nameFr: 'Réparation carte mère', nameEn: 'Motherboard repair', price: 8000, cost: 2000, minutes: 180, warrantyDays: 30 },
      { code: 'PC-PWR', name: 'إصلاح منفذ الشحن', nameFr: 'Réparation port de charge', nameEn: 'Charging port repair', price: 3000, cost: 800, minutes: 90, warrantyDays: 30, requiresParts: true },
    ],
  },

  // ======================================================= الأجهزة اللوحية
  {
    key: 'tablet',
    name: 'الأجهزة اللوحية',
    nameFr: 'Tablettes',
    nameEn: 'Tablets',
    deviceType: 'TABLET',
    icon: 'Tablet',
    services: [
      { code: 'TB-SCR', name: 'تغيير شاشة', nameFr: "Remplacement d'écran", nameEn: 'Screen replacement', price: 9000, cost: 6000, minutes: 90, warrantyDays: 30, requiresParts: true },
      { code: 'TB-GLS', name: 'تغيير الزجاج الأمامي', nameFr: 'Remplacement de la vitre', nameEn: 'Front glass replacement', price: 5000, cost: 3000, minutes: 90, warrantyDays: 30, requiresParts: true },
      { code: 'TB-BAT', name: 'تغيير بطارية', nameFr: 'Remplacement batterie', nameEn: 'Battery replacement', price: 4500, cost: 2800, minutes: 60, warrantyDays: 90, requiresParts: true },
      { code: 'TB-CHG', name: 'تغيير منفذ شحن', nameFr: 'Remplacement port de charge', nameEn: 'Charging port replacement', price: 3000, cost: 1500, minutes: 60, warrantyDays: 30, requiresParts: true },
      { code: 'TB-CAM', name: 'تغيير كاميرا', nameFr: 'Remplacement caméra', nameEn: 'Camera replacement', price: 3500, cost: 2000, minutes: 60, warrantyDays: 30, requiresParts: true },
      { code: 'TB-SPK', name: 'تغيير سماعة', nameFr: 'Remplacement haut-parleur', nameEn: 'Speaker replacement', price: 2500, cost: 1200, minutes: 50, warrantyDays: 30, requiresParts: true },
      { code: 'TB-BCK', name: 'تغيير الغطاء الخلفي', nameFr: 'Remplacement face arrière', nameEn: 'Back cover replacement', price: 4000, cost: 2200, minutes: 60, warrantyDays: 30, requiresParts: true },
      { code: 'TB-SFT', name: 'إصلاح السوفتوير / فلاش', nameFr: 'Réparation logicielle / Flash', nameEn: 'Software repair / flash', price: 2000, cost: 0, minutes: 60, warrantyDays: 15 },
      { code: 'TB-CLN', name: 'تنظيف الجهاز', nameFr: "Nettoyage de l'appareil", nameEn: 'Device cleaning', price: 1200, cost: 150, minutes: 40, warrantyDays: 0 },
      { code: 'TB-GLSP', name: 'تركيب حماية شاشة', nameFr: "Pose protection d'écran", nameEn: 'Screen protector fitting', price: 1200, cost: 500, minutes: 15, warrantyDays: 7, requiresParts: true },
    ],
  },

  // ======================================================== أجهزة الألعاب
  {
    key: 'console',
    name: 'أجهزة الألعاب',
    nameFr: 'Consoles de jeu',
    nameEn: 'Game consoles',
    deviceType: 'CONSOLE',
    icon: 'Gamepad2',
    services: [
      { code: 'GC-INS', name: 'تثبيت الألعاب', nameFr: 'Installation de jeux', nameEn: 'Game installation', price: 1000, cost: 0, minutes: 45, warrantyDays: 0 },
      { code: 'GC-UPD', name: 'تحديث النظام', nameFr: 'Mise à jour système', nameEn: 'System update', price: 1000, cost: 0, minutes: 45, warrantyDays: 0 },
      { code: 'GC-CLN', name: 'تنظيف الجهاز', nameFr: "Nettoyage de l'appareil", nameEn: 'Console cleaning', price: 2500, cost: 200, minutes: 75, warrantyDays: 15 },
      { code: 'GC-HDD', name: 'تغيير الهارد', nameFr: 'Remplacement du disque', nameEn: 'Hard drive replacement', price: 2500, cost: 500, minutes: 60, warrantyDays: 30, requiresParts: true },
      { code: 'GC-HDMI', name: 'صيانة منفذ HDMI', nameFr: 'Réparation port HDMI', nameEn: 'HDMI port repair', price: 5000, cost: 1200, minutes: 120, warrantyDays: 30, requiresParts: true },
      { code: 'GC-FAN', name: 'تغيير المراوح', nameFr: 'Remplacement des ventilateurs', nameEn: 'Fan replacement', price: 4000, cost: 2000, minutes: 90, warrantyDays: 30, requiresParts: true },
      { code: 'GC-MB', name: 'صيانة اللوحة', nameFr: 'Réparation de la carte', nameEn: 'Board repair', price: 9000, cost: 2500, minutes: 180, warrantyDays: 30 },
      { code: 'GC-THP', name: 'تغيير المعجون الحراري', nameFr: 'Changement pâte thermique', nameEn: 'Thermal paste replacement', price: 3000, cost: 400, minutes: 90, warrantyDays: 90, requiresParts: true },
      { code: 'GC-CTL', name: 'صيانة ذراع التحكم', nameFr: 'Réparation de manette', nameEn: 'Controller repair', price: 2000, cost: 600, minutes: 60, warrantyDays: 30, requiresParts: true },
    ],
  },

  // ================================================================== عام
  {
    key: 'general',
    name: 'خدمات عامة',
    nameFr: 'Services généraux',
    nameEn: 'General services',
    deviceType: 'ALL',
    icon: 'Wrench',
    services: [
      { code: 'GN-DIAG', name: 'فحص وتشخيص', nameFr: 'Diagnostic', nameEn: 'Diagnostics', price: 500, cost: 0, minutes: 30, warrantyDays: 0, description: 'يُخصم من قيمة الإصلاح عند الموافقة' },
      { code: 'GN-EXP', name: 'خدمة مستعجلة (رسوم إضافية)', nameFr: 'Service express (supplément)', nameEn: 'Express service surcharge', price: 1500, cost: 0, minutes: 0, warrantyDays: 0 },
      { code: 'GN-INST', name: 'تركيب قطعة يوفرها العميل', nameFr: 'Pose de pièce fournie par le client', nameEn: 'Fitting of customer-supplied part', price: 1500, cost: 0, minutes: 45, warrantyDays: 0, description: 'الضمان لا يشمل القطعة' },
      { code: 'GN-CONS', name: 'استشارة تقنية', nameFr: 'Consultation technique', nameEn: 'Technical consultation', price: 500, cost: 0, minutes: 20, warrantyDays: 0 },
    ],
  },
];

/** تصنيفات المصروفات الافتراضية */
export const EXPENSE_CATEGORIES = [
  { name: 'الإيجار', nameFr: 'Loyer', nameEn: 'Rent', icon: 'Home', color: '#6366f1', recurring: true },
  { name: 'الكهرباء', nameFr: 'Électricité', nameEn: 'Electricity', icon: 'Zap', color: '#f59e0b', recurring: true },
  { name: 'الماء', nameFr: 'Eau', nameEn: 'Water', icon: 'Droplet', color: '#06b6d4', recurring: true },
  { name: 'الإنترنت', nameFr: 'Internet', nameEn: 'Internet', icon: 'Wifi', color: '#3b82f6', recurring: true },
  { name: 'الهاتف', nameFr: 'Téléphone', nameEn: 'Phone', icon: 'Phone', color: '#8b5cf6', recurring: true },
  { name: 'رواتب الموظفين', nameFr: 'Salaires', nameEn: 'Salaries', icon: 'Users', color: '#10b981', recurring: true },
  { name: 'الضرائب', nameFr: 'Impôts', nameEn: 'Taxes', icon: 'Landmark', color: '#ef4444', recurring: true },
  { name: 'النقل', nameFr: 'Transport', nameEn: 'Transport', icon: 'Truck', color: '#f97316', recurring: false },
  { name: 'أدوات الصيانة', nameFr: 'Outillage', nameEn: 'Repair tools', icon: 'Wrench', color: '#64748b', recurring: false },
  { name: 'مواد التنظيف', nameFr: 'Produits de nettoyage', nameEn: 'Cleaning supplies', icon: 'SprayCan', color: '#14b8a6', recurring: false },
  { name: 'الدعاية والإعلانات', nameFr: 'Publicité', nameEn: 'Advertising', icon: 'Megaphone', color: '#ec4899', recurring: false },
  { name: 'شراء المعدات', nameFr: "Achat d'équipement", nameEn: 'Equipment purchase', icon: 'PackagePlus', color: '#84cc16', recurring: false },
  { name: 'صيانة المحل', nameFr: 'Entretien du local', nameEn: 'Shop maintenance', icon: 'Hammer', color: '#a855f7', recurring: false },
  { name: 'مصروفات أخرى', nameFr: 'Autres dépenses', nameEn: 'Other expenses', icon: 'MoreHorizontal', color: '#94a3b8', recurring: false },
];

/** تصنيفات المنتجات الافتراضية */
export const PRODUCT_CATEGORIES = [
  { name: 'شاشات', nameFr: 'Écrans', nameEn: 'Screens', icon: 'Monitor' },
  { name: 'بطاريات', nameFr: 'Batteries', nameEn: 'Batteries', icon: 'BatteryCharging' },
  { name: 'كاميرات', nameFr: 'Caméras', nameEn: 'Cameras', icon: 'Camera' },
  { name: 'منافذ شحن', nameFr: 'Ports de charge', nameEn: 'Charging ports', icon: 'Plug' },
  { name: 'سماعات وميكروفونات', nameFr: 'HP & Micros', nameEn: 'Speakers & mics', icon: 'Volume2' },
  { name: 'فلاتات', nameFr: 'Nappes', nameEn: 'Flex cables', icon: 'Cable' },
  { name: 'قطع لوحات', nameFr: 'Composants CM', nameEn: 'Board components', icon: 'Cpu' },
  { name: 'أغطية خلفية', nameFr: 'Faces arrière', nameEn: 'Back covers', icon: 'Layers' },
  { name: 'ذاكرة وتخزين', nameFr: 'Mémoire & stockage', nameEn: 'Memory & storage', icon: 'HardDrive' },
  { name: 'شواحن وكابلات', nameFr: 'Chargeurs & câbles', nameEn: 'Chargers & cables', icon: 'Zap' },
  { name: 'جرابات', nameFr: 'Coques', nameEn: 'Cases', icon: 'Shield' },
  { name: 'واقيات شاشة', nameFr: "Protections d'écran", nameEn: 'Screen protectors', icon: 'ShieldCheck' },
  { name: 'سماعات رأس', nameFr: 'Écouteurs', nameEn: 'Headphones', icon: 'Headphones' },
  { name: 'هواتف', nameFr: 'Téléphones', nameEn: 'Phones', icon: 'Smartphone' },
  { name: 'حواسيب', nameFr: 'Ordinateurs', nameEn: 'Computers', icon: 'Laptop' },
  { name: 'أجهزة لوحية', nameFr: 'Tablettes', nameEn: 'Tablets', icon: 'Tablet' },
  { name: 'مستهلكات ورشة', nameFr: "Consommables d'atelier", nameEn: 'Workshop consumables', icon: 'Beaker' },
];

/** قوالب الإشعارات الافتراضية */
export const NOTIFICATION_TEMPLATES = [
  {
    key: 'repair.received',
    ar: 'مرحباً {{customerName}}، تم استلام جهازك {{deviceName}} برقم {{orderNumber}}. تابع حالته عبر: {{trackingUrl}} — {{shopName}}',
    fr: 'Bonjour {{customerName}}, votre appareil {{deviceName}} (N° {{orderNumber}}) a été reçu. Suivi : {{trackingUrl}} — {{shopName}}',
    en: 'Hello {{customerName}}, your device {{deviceName}} (#{{orderNumber}}) has been received. Track it: {{trackingUrl}} — {{shopName}}',
  },
  {
    key: 'repair.diagnosing',
    ar: 'عزيزي {{customerName}}، جهازك {{orderNumber}} قيد الفحص الآن. سنوافيك بالنتيجة قريباً — {{shopName}}',
    fr: 'Cher {{customerName}}, votre appareil {{orderNumber}} est en cours de diagnostic — {{shopName}}',
    en: 'Dear {{customerName}}, your device {{orderNumber}} is being diagnosed — {{shopName}}',
  },
  {
    key: 'repair.waiting_approval',
    ar: 'عزيزي {{customerName}}، تم فحص جهازك {{orderNumber}}. التكلفة التقديرية {{estimatedCost}}. نرجو التواصل للموافقة — {{shopName}}',
    fr: 'Cher {{customerName}}, diagnostic terminé pour {{orderNumber}}. Coût estimé : {{estimatedCost}}. Merci de nous contacter — {{shopName}}',
    en: 'Dear {{customerName}}, diagnosis complete for {{orderNumber}}. Estimated cost: {{estimatedCost}}. Please contact us to approve — {{shopName}}',
  },
  {
    key: 'repair.waiting_parts',
    ar: 'عزيزي {{customerName}}، جهازك {{orderNumber}} بانتظار وصول قطعة الغيار. سنعلمك فور توفرها — {{shopName}}',
    fr: 'Cher {{customerName}}, votre appareil {{orderNumber}} attend une pièce. Nous vous informerons — {{shopName}}',
    en: 'Dear {{customerName}}, your device {{orderNumber}} is awaiting a spare part. We will update you — {{shopName}}',
  },
  {
    key: 'repair.repairing',
    ar: 'عزيزي {{customerName}}، بدأ العمل على إصلاح جهازك {{orderNumber}} — {{shopName}}',
    fr: 'Cher {{customerName}}, la réparation de {{orderNumber}} a commencé — {{shopName}}',
    en: 'Dear {{customerName}}, repair work on {{orderNumber}} has started — {{shopName}}',
  },
  {
    key: 'repair.ready',
    ar: 'بشرى سارة {{customerName}}! جهازك {{deviceName}} ({{orderNumber}}) جاهز للاستلام. المبلغ المستحق: {{amountDue}} — {{shopName}} {{shopPhone}}',
    fr: 'Bonne nouvelle {{customerName}} ! Votre appareil {{deviceName}} ({{orderNumber}}) est prêt. Montant dû : {{amountDue}} — {{shopName}} {{shopPhone}}',
    en: 'Good news {{customerName}}! Your device {{deviceName}} ({{orderNumber}}) is ready for pickup. Amount due: {{amountDue}} — {{shopName}} {{shopPhone}}',
  },
  {
    key: 'repair.delivered',
    ar: 'شكراً {{customerName}} لثقتك بنا. تم تسليم جهازك {{orderNumber}}. الضمان ساري حتى {{warrantyEnd}} — {{shopName}}',
    fr: 'Merci {{customerName}}. Appareil {{orderNumber}} livré. Garantie jusqu\'au {{warrantyEnd}} — {{shopName}}',
    en: 'Thank you {{customerName}}. Device {{orderNumber}} delivered. Warranty valid until {{warrantyEnd}} — {{shopName}}',
  },
  {
    key: 'warranty.expiring',
    ar: 'تنبيه: ضمان {{itemName}} ينتهي في {{warrantyEnd}}. لأي استفسار تواصل معنا — {{shopName}}',
    fr: 'Rappel : la garantie de {{itemName}} expire le {{warrantyEnd}} — {{shopName}}',
    en: 'Reminder: warranty for {{itemName}} expires on {{warrantyEnd}} — {{shopName}}',
  },
  {
    key: 'invoice.created',
    ar: 'عزيزي {{customerName}}، تم إصدار الفاتورة {{invoiceNumber}} بقيمة {{total}}. شكراً لتعاملك معنا — {{shopName}}',
    fr: 'Cher {{customerName}}, facture {{invoiceNumber}} émise pour {{total}}. Merci — {{shopName}}',
    en: 'Dear {{customerName}}, invoice {{invoiceNumber}} issued for {{total}}. Thank you — {{shopName}}',
  },
  {
    key: 'invoice.due',
    ar: 'تذكير: المبلغ المتبقي على الفاتورة {{invoiceNumber}} هو {{amountDue}}. نرجو السداد — {{shopName}}',
    fr: 'Rappel : solde de {{amountDue}} sur la facture {{invoiceNumber}} — {{shopName}}',
    en: 'Reminder: {{amountDue}} outstanding on invoice {{invoiceNumber}} — {{shopName}}',
  },
  {
    key: 'appointment.reminder',
    ar: 'تذكير بموعدك لدى {{shopName}} في {{appointmentTime}}. نراك قريباً!',
    fr: 'Rappel de votre rendez-vous chez {{shopName}} le {{appointmentTime}}. À bientôt !',
    en: 'Reminder: your appointment at {{shopName}} on {{appointmentTime}}. See you soon!',
  },
];
