#!/usr/bin/env node
/**
 * بناء حزمة مستقلة جاهزة للرفع على cPanel.
 *
 *   npm run build:cpanel
 *
 * ماذا يفعل؟
 * 1) يولّد عميل Prisma ثم يبني Next بوضع output: 'standalone'.
 * 2) ينسخ public/ و .next/static داخل .next/standalone — وهي خطوة لا يقوم بها
 *    Next تلقائياً، وبدونها تظهر الواجهة بلا CSS ولا صور.
 * 3) ينسخ prisma/ (المخطط + الهجرات + البذور) ليعمل `prisma migrate deploy`
 *    على الخادم.
 * 4) يكتب server.js صغيراً + .htaccess إرشادياً.
 *
 * الناتج: مجلد .next/standalone يُرفع كما هو إلى مجلد التطبيق في cPanel.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.next', 'standalone');

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    console.error(`\n❌ فشل الأمر: ${cmd} ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
  return true;
}

const NPMRC = `# يمنع تنزيل متصفحات/ثنائيات غير لازمة على الخادم المشترك
fund=false
audit=false
`;

const HTACCESS = `# ملف إرشادي — cPanel يولّد نسخته الخاصة عند إنشاء تطبيق Node.js.
# لا تحذف ملف .htaccess الذي ينشئه cPanel في المجلد الجذر للدومين.
`;

console.log('▶ 1/4 توليد عميل Prisma…');
run('npx', ['--no-install', 'prisma', 'generate']);

console.log('\n▶ 2/4 بناء Next (standalone)…');
run('npx', ['--no-install', 'next', 'build'], { BUILD_STANDALONE: '1' });

if (!fs.existsSync(OUT)) {
  console.error('\n❌ لم يُنشأ .next/standalone — تأكد أن BUILD_STANDALONE=1 وصلت إلى next.config.ts');
  process.exit(1);
}

console.log('\n▶ 3/4 نسخ الملفات الثابتة…');
copyDir(path.join(ROOT, 'public'), path.join(OUT, 'public'));
copyDir(path.join(ROOT, '.next', 'static'), path.join(OUT, '.next', 'static'));

console.log('▶ 4/4 نسخ Prisma وملفات التشغيل…');
copyDir(path.join(ROOT, 'prisma'), path.join(OUT, 'prisma'));
fs.writeFileSync(path.join(OUT, '.npmrc'), NPMRC);
fs.writeFileSync(path.join(OUT, '.htaccess.example'), HTACCESS);

// مجلد الرفوعات يجب أن يبقى موجوداً حتى لو كان فارغاً
fs.mkdirSync(path.join(OUT, 'public', 'uploads'), { recursive: true });

const size = spawnSync('du', ['-sh', OUT], { encoding: 'utf8' }).stdout?.trim();

console.log(`
✅ الحزمة جاهزة: .next/standalone${size ? `  (${size.split('\t')[0]})` : ''}

الخطوات على cPanel:
  1. اضغط محتويات .next/standalone في ملف zip وارفعه إلى مجلد التطبيق.
  2. في "Setup Node.js App" اجعل Application startup file = server.js
  3. أضف متغيرات البيئة (DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY…).
  4. من طرفية التطبيق:  npx prisma migrate deploy  ثم  npm run db:seed
  5. أعد تشغيل التطبيق.

⚠️  لا تحذف public/uploads عند كل نشر — احتفظ به أو اربطه بمجلد خارجي.
راجع docs/CPANEL.md للتفاصيل الكاملة.
`);
