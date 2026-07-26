#!/usr/bin/env node
/**
 * تبديل قاعدة البيانات المستهدفة في مخطط Prisma.
 *
 *   node scripts/switch-db.mjs mysql       ← لاستضافة cPanel (MySQL/MariaDB)
 *   node scripts/switch-db.mjs postgresql
 *   node scripts/switch-db.mjs sqlite      ← للتطوير المحلي
 *
 * لماذا هذا السكربت؟
 * Prisma يحوّل حقل String افتراضياً إلى VARCHAR(191) في MySQL — وهذا يكسر
 * الحقول الطويلة (التوقيع الرقمي بصيغة base64، سجل التدقيق، تقرير حالة الجهاز،
 * الشروط والأحكام…). السكربت يضيف @db.Text / @db.LongText تلقائياً للحقول
 * التي تحتاجها، ويزيلها عند العودة إلى SQLite الذي لا يدعم هذه الأنواع.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = path.join(ROOT, 'prisma', 'schema.prisma');

/**
 * الحقول التي تتجاوز 191 حرفاً بصيغة "Model.field".
 * LONG = حقول قد تتجاوز 64 كيلوبايت (تحتاج LONGTEXT في MySQL).
 */
const TEXT_FIELDS = new Set([
  'Branch.address',
  'Setting.value',
  'User.permissions',
  'User.notes',
  'Session.userAgent',
  'AuditLog.summary',
  'AuditLog.userAgent',
  'Customer.address',
  'Customer.notes',
  'Device.passcodeEnc',
  'Device.notes',
  'RepairOrder.problemDescription',
  'RepairOrder.diagnosis',
  'RepairOrder.workDone',
  'RepairOrder.internalNotes',
  'RepairOrder.accessories',
  'RepairOrder.conditionReport',
  'RepairOrder.damageMarks',
  'RepairOrder.photos',
  'RepairOrder.warrantyTerms',
  'RepairItem.notes',
  'RepairStatusEvent.note',
  'Service.description',
  'Product.description',
  'Product.compatibleWith',
  'Supplier.address',
  'Supplier.notes',
  'PurchaseOrder.notes',
  'Invoice.notes',
  'Invoice.terms',
  'InvoiceItem.description',
  'Payment.notes',
  'Coupon.description',
  'Quotation.notes',
  'Quotation.terms',
  'QuotationItem.description',
  'Warranty.terms',
  'Warranty.claimNotes',
  'InstallmentPlan.notes',
  'Expense.description',
  'Expense.notes',
  'Expense.receiptUrl',
  'Attendance.notes',
  'Payroll.notes',
  'NotificationTemplate.subject',
  'NotificationTemplate.body',
  'NotificationLog.subject',
  'NotificationLog.body',
  'NotificationLog.error',
  'Appointment.description',
  'Appointment.notes',
  'BackupLog.error',
]);

/** حقول قد تتجاوز 64 كيلوبايت — التواقيع وسجل التدقيق */
const LONG_TEXT_FIELDS = new Set([
  'RepairOrder.customerSignature',
  'RepairOrder.employeeSignature',
  'AuditLog.before',
  'AuditLog.after',
]);

const PROVIDERS = {
  sqlite: { name: 'sqlite', text: null, longText: null },
  mysql: { name: 'mysql', text: '@db.Text', longText: '@db.LongText' },
  postgresql: { name: 'postgresql', text: '@db.Text', longText: '@db.Text' },
};

function main() {
  const target = (process.argv[2] ?? '').toLowerCase();
  const provider = PROVIDERS[target];

  if (!provider) {
    console.error('❌ استخدم: node scripts/switch-db.mjs <sqlite|mysql|postgresql>');
    process.exit(1);
  }

  let schema = fs.readFileSync(SCHEMA, 'utf8');

  // 1) تبديل المزوّد
  schema = schema.replace(
    /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]+"/s,
    `$1"${provider.name}"`,
  );

  // 2) تنظيف أي تعليقات نوعية سابقة ثم إضافة المناسبة
  let currentModel = null;
  const lines = schema.split('\n');
  let annotated = 0;

  const output = lines.map((line) => {
    const modelMatch = /^model\s+(\w+)\s*\{/.exec(line);
    if (modelMatch) {
      currentModel = modelMatch[1];
      return line;
    }
    if (/^\}/.test(line)) {
      currentModel = null;
      return line;
    }
    if (!currentModel) return line;

    // احذف أي @db.* سابق حتى نعيد البناء من الصفر
    let cleaned = line.replace(/\s+@db\.(Text|LongText|MediumText)/g, '');

    const fieldMatch = /^(\s+)(\w+)(\s+)(String\??)(.*)$/.exec(cleaned);
    if (!fieldMatch) return cleaned;

    const [, indent, field, gap, type, rest] = fieldMatch;
    const key = `${currentModel}.${field}`;

    let annotation = null;
    if (LONG_TEXT_FIELDS.has(key)) annotation = provider.longText;
    else if (TEXT_FIELDS.has(key)) annotation = provider.text;
    if (!annotation) return cleaned;

    annotated++;

    // ضع التعليق قبل التعليق النصي (//) إن وُجد
    const commentIndex = rest.indexOf('//');
    if (commentIndex >= 0) {
      const before = rest.slice(0, commentIndex).trimEnd();
      const comment = rest.slice(commentIndex);
      return `${indent}${field}${gap}${type}${before} ${annotation} ${comment}`;
    }
    return `${indent}${field}${gap}${type}${rest.trimEnd()} ${annotation}`;
  });

  fs.writeFileSync(SCHEMA, output.join('\n'));

  // 3) إعادة التنسيق (محاذاة الأعمدة) — اختياري، نتجاهل الفشل
  const fmt = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['--no-install', 'prisma', 'format', '--schema', SCHEMA],
    { cwd: ROOT, stdio: 'ignore' },
  );
  if (fmt.status !== 0) {
    console.log('ℹ️  تعذّر تشغيل prisma format — المخطط صالح لكن المحاذاة غير مرتّبة.');
  }

  console.log(`✅ تم ضبط المخطط على: ${provider.name}`);
  if (annotated > 0) {
    console.log(`   أُضيف نوع نصي طويل إلى ${annotated} حقلاً`);
  } else {
    console.log('   (SQLite لا يحتاج أنواعاً نصية خاصة)');
  }
  console.log('\nالخطوة التالية:');
  console.log('   npx prisma generate');
  console.log(
    target === 'sqlite' ? '   npx prisma db push' : '   npx prisma migrate deploy   (أو db push للتجربة)',
  );
}

main();
