import { NextResponse, type NextRequest } from 'next/server';

/**
 * حارس المسارات على مستوى الحافة (Edge).
 *
 * هذا فحص سطحي لوجود كوكي الجلسة فقط — الغرض منه تجنّب تحميل صفحات
 * محمية بلا داعٍ وإعادة التوجيه بسرعة. التحقق الحقيقي من صحة الجلسة
 * والصلاحيات يتم في كل صفحة وإجراء خادمي عبر requireUser/requirePermission،
 * لأن التحقق من التوقيع وقاعدة البيانات لا يمكن تنفيذه على الحافة.
 */

const SESSION_COOKIE = 'fixel_session';

/** مسارات عامة لا تتطلب تسجيل دخول */
const PUBLIC_PATHS = ['/login', '/track'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (isPublic) return NextResponse.next();

  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    // نحتفظ بالوجهة الأصلية للعودة إليها بعد الدخول
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * كل المسارات عدا:
     * - ملفات Next الداخلية (_next)
     * - مسارات API (لها حراستها الخاصة وتُرجع 401 بدل إعادة التوجيه)
     * - الملفات الثابتة والصور المرفوعة
     * - ملف manifest: المتصفح يجلبه أحياناً بلا كوكيز، وحجبه يمنع
     *   «إضافة إلى الشاشة الرئيسية» على هاتف الفنّي
     */
    '/((?!_next/static|_next/image|api|favicon.ico|icon.svg|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
};
