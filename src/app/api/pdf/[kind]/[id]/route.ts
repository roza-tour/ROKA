import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { isLocale, type Locale } from '@/i18n';
import { generatePdf, isPdfKind, pdfHeaders, PDF_PERMISSION } from '@/lib/pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * توليد مستند PDF حقيقي على الخادم.
 *
 *   GET /api/pdf/invoice/<id>            ← عرض في المتصفح
 *   GET /api/pdf/invoice/<id>?dl=1       ← تنزيل
 *   GET /api/pdf/repair/<id>?locale=fr   ← بلغة محددة
 *
 * الأنواع: invoice | repair | quotation
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const { kind, id } = await params;
  if (!isPdfKind(kind)) {
    return NextResponse.json({ error: 'نوع مستند غير معروف' }, { status: 400 });
  }
  if (!can(user, PDF_PERMISSION[kind])) {
    return NextResponse.json({ error: 'لا تملك صلاحية عرض هذا المستند' }, { status: 403 });
  }

  const url = new URL(request.url);
  const localeParam = url.searchParams.get('locale');
  const locale: Locale | undefined = isLocale(localeParam) ? localeParam : undefined;
  const download = url.searchParams.get('dl') === '1';

  try {
    const result = await generatePdf(kind, id, locale);
    if (!result) return NextResponse.json({ error: 'المستند غير موجود' }, { status: 404 });

    await audit({
      action: 'PRINT',
      entity: result.entity,
      entityId: result.entityId,
      summary: `توليد PDF للمستند ${result.number}`,
      user,
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: pdfHeaders(result.filename, download ? 'attachment' : 'inline'),
    });
  } catch (error) {
    console.error('[api/pdf]', error);
    return NextResponse.json({ error: 'تعذّر توليد ملف PDF' }, { status: 500 });
  }
}
