import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getCurrentUser } from '@/lib/auth';
import { randomToken } from '@/lib/crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_SIZE = 6 * 1024 * 1024; // 6 ميغابايت لكل ملف
const MAX_FILES = 8;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

/** رفع صور الأجهزة والإيصالات */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll('files').filter((f): f is File => f instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: 'لم يتم اختيار أي ملف' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `الحد الأقصى ${MAX_FILES} ملفات في المرة الواحدة` },
        { status: 400 },
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const urls: string[] = [];
    for (const file of files) {
      const extension = ALLOWED_TYPES[file.type];
      if (!extension) {
        return NextResponse.json(
          { error: `نوع ملف غير مدعوم: ${file.type || 'غير معروف'}` },
          { status: 400 },
        );
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `الملف أكبر من الحد المسموح (${MAX_SIZE / 1024 / 1024} م.ب)` },
          { status: 400 },
        );
      }

      // اسم عشوائي — لا نثق أبداً باسم الملف الوارد من المتصفح
      const filename = `${Date.now()}-${randomToken(8)}.${extension}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(UPLOAD_DIR, filename), buffer);
      urls.push(`/uploads/${filename}`);
    }

    return NextResponse.json({ urls });
  } catch (error) {
    console.error('[upload]', error);
    return NextResponse.json({ error: 'تعذّر رفع الملفات' }, { status: 500 });
  }
}
