import Link from 'next/link';
import { LogIn, KeyRound } from 'lucide-react';

/** يُعرض عند استدعاء unauthorized() — يُرجع Next رمز الحالة 401 */
export default function Unauthorized() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <KeyRound className="h-8 w-8" />
      </span>

      <div>
        <h1 className="text-2xl font-bold">انتهت الجلسة</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          يجب تسجيل الدخول للوصول إلى هذه الصفحة.
        </p>
      </div>

      <Link
        href="/login"
        className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-600"
      >
        <LogIn className="h-4 w-4" />
        تسجيل الدخول
      </Link>
    </div>
  );
}
