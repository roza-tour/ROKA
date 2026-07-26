# نشر FIXEL ERP على استضافة cPanel

هذا الدليل يشرح تشغيل النظام على استضافة cPanel باستخدام **MySQL / MariaDB**
(قاعدة البيانات المتوفرة في كل حسابات cPanel تقريباً) و **Setup Node.js App**
(Passenger).

---

## 0) تأكّد أولاً أن الاستضافة تدعم Node.js

في لوحة cPanel ابحث عن أيقونة **Setup Node.js App** (تحت قسم *Software*).

| الحالة | ماذا تفعل |
|---|---|
| الأيقونة موجودة | تابع هذا الدليل ✅ |
| الأيقونة غير موجودة | استضافتك تدعم PHP فقط. النظام مبني على Node.js ولن يعمل. اطلب من مزوّد الاستضافة تفعيل **CloudLinux Node.js Selector**، أو انتقل إلى VPS / استضافة تدعم Node |

تحقق أيضاً من إصدار Node المتاح — النظام يتطلب **Node 20 أو أحدث**.

---

## 1) إنشاء قاعدة بيانات MySQL

من cPanel → **MySQL® Databases**:

1. **Create New Database**: اكتب `fixel` — سينشئه cPanel باسم `اسمحسابك_fixel`.
2. **Add New User**: اكتب `fixel` وكلمة مرور قوية — سيصبح `اسمحسابك_fixel`.
3. **Add User To Database** → اختر المستخدم والقاعدة → **ALL PRIVILEGES**.

> ⚠️ سجّل الاسمين **كاملين مع البادئة**. مثال: `rozatour_fixel`.

### ضبط الترميز (مهم للعربية)

من **phpMyAdmin** → اختر القاعدة → تبويب **SQL** ونفّذ:

```sql
ALTER DATABASE `اسمحسابك_fixel`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

بدون `utf8mb4` ستُخزَّن الرموز التعبيرية وبعض المحارف العربية بشكل خاطئ.

---

## 2) تحويل المخطط إلى MySQL

على **جهازك** قبل البناء:

```bash
npm run db:mysql
```

هذا السكربت (`scripts/switch-db.mjs`) يقوم بأمرين:

1. يغيّر `provider` في `prisma/schema.prisma` إلى `mysql`.
2. يضيف `@db.Text` / `@db.LongText` إلى **56 حقلاً** طويلاً.

### لماذا الخطوة الثانية ضرورية؟

Prisma يحوّل أي حقل `String` في MySQL إلى `VARCHAR(191)` افتراضياً. بدون
التعديل ستفشل أو تُقتطع البيانات التالية:

| الحقل | المحتوى | النوع بعد التحويل |
|---|---|---|
| `RepairOrder.customerSignature` | توقيع العميل (صورة base64، عشرات الكيلوبايت) | `LONGTEXT` |
| `RepairOrder.employeeSignature` | توقيع الموظف | `LONGTEXT` |
| `AuditLog.before` / `after` | لقطة JSON قبل/بعد كل تعديل | `LONGTEXT` |
| `RepairOrder.conditionReport` | تقرير حالة الجهاز (JSON) | `TEXT` |
| `RepairOrder.damageMarks` | مواقع الخدوش المرسومة | `TEXT` |
| `RepairOrder.photos` | مسارات صور الجهاز | `TEXT` |
| `RepairOrder.accessories` | الملحقات المستلمة | `TEXT` |
| `Invoice.terms` / `Warranty.terms` | الشروط والأحكام | `TEXT` |
| `NotificationTemplate.body` | نص قالب الرسالة | `TEXT` |
| … و46 حقلاً آخر (الملاحظات، الأوصاف، العناوين) | | `TEXT` |

> السكربت يعمل في الاتجاهين — `npm run db:sqlite` يزيل هذه الأنواع للعودة
> للتطوير المحلي، و`npm run db:postgres` يضبطها لـ PostgreSQL.
> لا يوجد فهرس (index) على أي عمود `TEXT`، لذا لا تصطدم بحد 3072 بايت في InnoDB.

---

## 3) ضبط متغيّرات البيئة

عدّل `.env` محلياً (وستكرّر نفس القيم في cPanel لاحقاً):

```env
DATABASE_URL="mysql://اسمحسابك_fixel:كلمةالمرور@localhost:3306/اسمحسابك_fixel?connection_limit=5&pool_timeout=20"

AUTH_SECRET="ناتج openssl rand -base64 48"
ENCRYPTION_KEY="ناتج openssl rand -hex 32"

NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NODE_ENV="production"
```

### ملاحظات مهمة

- **`connection_limit=5`** — الاستضافة المشتركة تحدّ عادةً عدد اتصالات MySQL
  (غالباً 10–25). Prisma يفتح افتراضياً `(عدد الأنوية × 2) + 1` وقد يستهلك
  الحصة كلها ويعطّل الموقع. ابدأ بـ 5.
- إذا احتوت كلمة المرور على `@` أو `#` أو `/` فرمّزها (`@` تصبح `%40`)، أو
  الأسهل: استخدم كلمة مرور بحروف وأرقام فقط.
- **`ENCRYPTION_KEY` لا يتغيّر بعد أول تشغيل** — هو مفتاح فك تشفير أكواد قفل
  الأجهزة المخزّنة. تغييره يجعلها غير قابلة للقراءة نهائياً. احفظ نسخة منه
  في مكان آمن خارج الخادم.

---

## 4) البناء

لديك مساران — اختر حسب توفّر SSH.

### المسار (أ) — بناء محلي ثم رفع (الأنسب للاستضافة المشتركة)

```bash
npm run build:cpanel
```

ينتج مجلد **`.next/standalone`** (حوالي 96 ميجابايت) يحتوي كل شيء:
الخادم، `node_modules` المطلوبة فقط، الملفات الثابتة، ومجلد `prisma`.

> ⚠️ **مهم**: عميل Prisma يُبنى لنظام جهازك. إذا كان جهازك macOS أو Windows،
> افتح `prisma/schema.prisma` وأضف هدف خادم cPanel:
> ```prisma
> binaryTargets = ["native", "rhel-openssl-3.0.x"]
> ```
> معظم خوادم cPanel تعمل على CloudLinux/AlmaLinux ← `rhel-openssl-3.0.x`.
> إن كانت Debian/Ubuntu ← `debian-openssl-3.0.x`.
> ثم أعد `npm run build:cpanel`.

اضغط **محتويات** `.next/standalone` (وليس المجلد نفسه) في `fixel.zip`.

### المسار (ب) — بناء على الخادم عبر SSH (أدق وأبسط)

ارفع كود المشروع كاملاً ثم:

```bash
cd ~/fixel
npm ci
npm run build
```

في هذه الحالة `binaryTargets = ["native"]` صحيح ولا تحتاج تعديلاً، ونقطة
الدخول ستكون `node_modules/.bin/next start` بدل `server.js`
(أو أنشئ `server.js` بسيطاً يستدعي `next start`).

---

## 5) إنشاء التطبيق في cPanel

من cPanel → **Setup Node.js App** → **CREATE APPLICATION**:

| الحقل | القيمة |
|---|---|
| Node.js version | 20 أو أحدث |
| Application mode | **Production** |
| Application root | `fixel` |
| Application URL | الدومين أو `yourdomain.com/fixel` |
| Application startup file | `server.js` |

اضغط **CREATE**، ثم:

1. ارفع `fixel.zip` عبر **File Manager** إلى مجلد `fixel` وفكّ الضغط.
2. ارجع إلى Setup Node.js App وأضف كل متغيّرات البيئة في قسم
   **Environment variables** (نفس قيم الخطوة 3).
3. اضغط **Run NPM Install** — عند استخدام حزمة standalone لن يثبّت شيئاً
   يُذكر لأن `node_modules` مرفوعة، وهذا مقصود.

---

## 6) إنشاء الجداول والبيانات الأولية

من صفحة التطبيق اضغط زر **"Enter to the virtual environment"** وانسخ الأمر
الظاهر، ثم من **Terminal** في cPanel:

```bash
source /home/اسمحسابك/nodevenv/fixel/20/bin/activate
cd ~/fixel

# إنشاء كل الجداول
npx prisma migrate deploy      # أو: npx prisma db push   إن لم تكن هناك هجرات

# البيانات الأساسية: المستخدم المدير، 71 خدمة، 99 قالب إشعار، التصنيفات
npm run db:seed
```

سجّل الدخول بـ `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` من `.env`
ثم **غيّر كلمة المرور فوراً** من الإعدادات.

> لتجربة النظام ببيانات وهمية (عملاء، أجهزة، فواتير): `npm run db:seed:demo`
> — لا تنفّذه على قاعدة إنتاج.

أعد تشغيل التطبيق من زر **RESTART**.

---

## 7) بعد النشر — قائمة تحقق

- [ ] تسجيل الدخول يعمل وواجهة النظام تظهر بتنسيق سليم (إن ظهرت بلا تنسيق
      فهذا يعني أن `.next/static` لم تُنسخ — أعد `npm run build:cpanel`).
- [ ] فتح `https://yourdomain.com` يعيد التوجيه إلى `/login`.
- [ ] إنشاء عميل وأمر إصلاح تجريبي، وطباعة إيصال الاستلام (تحقق من QR والباركود).
- [ ] تفعيل **SSL** من cPanel → *SSL/TLS Status* → *Run AutoSSL*.
      بدون HTTPS لن يُرسل كوكي الجلسة في وضع الإنتاج.
- [ ] ضبط `NEXT_PUBLIC_APP_URL` على العنوان بـ `https://` — يُستخدم في روابط
      تتبّع الجهاز **وفي روابط PDF الموقّعة المرسلة عبر واتساب**. إن بقي على
      `localhost` وصلت العملاءَ روابطُ لا تفتح.
- [ ] تنزيل فاتورة بصيغة PDF (`/api/pdf/invoice/<id>?dl=1`) والتأكد أن النص
      العربي يظهر سليماً — إن ظهر خطأ «ملف الخط غير موجود» فمجلد
      `assets/fonts` لم يُرفع؛ انسخه يدوياً إلى جذر التطبيق.
- [ ] من cPanel → *Backup Wizard* فعّل نسخاً احتياطياً دورياً لقاعدة البيانات،
      **إضافةً** إلى نسخ النظام الداخلية من `/settings/backup`.

---

## 8) التحديثات اللاحقة

```bash
# محلياً
npm run build:cpanel
```

ارفع الحزمة الجديدة **مع الحفاظ على**:

| المجلد/الملف | السبب |
|---|---|
| `public/uploads/` | صور الأجهزة المرفوعة — تُفقد نهائياً إن حُذفت |
| متغيّرات البيئة | خصوصاً `ENCRYPTION_KEY` |

ثم على الخادم:

```bash
npx prisma migrate deploy   # يطبّق أي تغييرات جديدة في المخطط
```

وأعد تشغيل التطبيق.

> **نصيحة**: انقل `public/uploads` إلى خارج مجلد التطبيق (مثلاً
> `~/fixel-data/uploads`) واربطه برابط رمزي:
> ```bash
> ln -s ~/fixel-data/uploads ~/fixel/public/uploads
> ```
> بهذا لن يمسّه أي نشر مستقبلي.

---

## 9) حلّ المشكلات الشائعة

| العَرَض | السبب | الحل |
|---|---|---|
| `PrismaClientInitializationError: Query engine binary not found` | بُني العميل لنظام مختلف | أضف `binaryTargets` الصحيح وأعد البناء (الخطوة 4-أ) |
| `Data too long for column 'customerSignature'` | لم تُنفّذ `npm run db:mysql` قبل البناء | نفّذها، ثم `npx prisma db push` على الخادم |
| نصوص عربية تظهر `????` | القاعدة ليست `utf8mb4` | نفّذ `ALTER DATABASE` من الخطوة 1 |
| `Too many connections` | حصة MySQL استُنفدت | اخفض `connection_limit` في `DATABASE_URL` إلى 3 |
| الواجهة بلا CSS | `.next/static` غير مرفوع | أعد `npm run build:cpanel` وارفع الحزمة كاملة |
| `502 Bad Gateway` | التطبيق توقّف | راجع `stderr.log` في مجلد التطبيق، ثم RESTART |
| تسجيل الدخول ينجح ثم يعود لصفحة الدخول | لا يوجد HTTPS في وضع الإنتاج | فعّل AutoSSL |
| بطء بعد أشهر من الاستخدام | تضخّم `AuditLog` | احذف السجلات الأقدم من سنة دورياً |

---

## 10) MySQL أم PostgreSQL؟

النظام يدعم الاثنين بالتساوي — المخطط لا يستخدم `enum` ولا `Json` تحديداً
ليبقى محايداً.

| | MySQL / MariaDB | PostgreSQL |
|---|---|---|
| التوفّر في cPanel | متوفّر دائماً ✅ | نادر (يحتاج طلب من الدعم) |
| الأداء لهذا الحجم | ممتاز | ممتاز |
| دقة الأرقام المالية | `DOUBLE` | يمكن الترقية إلى `DECIMAL` |
| التوصية | **ابدأ به على cPanel** | عند الانتقال إلى VPS |

للانتقال لاحقاً: `npm run db:postgres` ثم صدّر البيانات عبر
`/settings/backup` (نسخة JSON) واستوردها في القاعدة الجديدة — ملف النسخ
الاحتياطي محايد تجاه نوع القاعدة.
