import { NextResponse } from 'next/server';

import { generatePdf, isPdfKind, pdfHeaders, verifyPdfLink } from '@/lib/pdf';
import { isLocale, type Locale } from '@/i18n';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * تنزيل مستند PDF عبر **رابط موقّع** بدون جلسة.
 *
 *   /api/pdf/public/invoice/<id>?exp=<unix>&sig=<hex>
 *
 * هذا ما يُرسَل للعميل في رسالة واتساب أو بريد: خادم Meta وعميل البريد
 * لا يملكان جلسة، لكن التوقيع يثبت أن الرابط صادر عنّا وأنه لم ينتهِ بعد.
 * التوقيع مرتبط بالنوع والمعرّف معاً، فلا يفتح رابطُ فاتورةٍ فاتورةً أخرى.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params;
  const url = new URL(request.url);

  const check = verifyPdfLink(kind, id, url.searchParams.get('exp'), url.searchParams.get('sig'));
  if (!check.ok) {
    return NextResponse.json(
      {
        error:
          check.reason === 'expired'
            ? 'انتهت صلاحية هذا الرابط. اطلب نسخة جديدة من المحل.'
            : 'رابط غير صالح',
      },
      { status: check.reason === 'expired' ? 410 : 403 },
    );
  }

  if (!isPdfKind(kind)) {
    return NextResponse.json({ error: 'نوع مستند غير معروف' }, { status: 400 });
  }

  const localeParam = url.searchParams.get('locale');
  const locale: Locale | undefined = isLocale(localeParam) ? localeParam : 'ar';

  try {
    const result = await generatePdf(kind, id, locale);
    if (!result) return NextResponse.json({ error: 'المستند غير موجود' }, { status: 404 });

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: pdfHeaders(
        result.filename,
        url.searchParams.get('dl') === '1' ? 'attachment' : 'inline',
      ),
    });
  } catch (error) {
    console.error('[api/pdf/public]', error);
    return NextResponse.json({ error: 'تعذّر توليد ملف PDF' }, { status: 500 });
  }
}
