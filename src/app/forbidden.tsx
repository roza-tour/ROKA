import Link from 'next/link';
import { ShieldOff, Home } from 'lucide-react';

/** يُعرض عند استدعاء forbidden() — يُرجع Next رمز الحالة 403 */
export default function Forbidden() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10 text-warning">
        <ShieldOff className="h-8 w-8" />
      </span>

      <div>
        <h1 className="text-2xl font-bold">لا تملك صلاحية الوصول</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          هذه الصفحة تتطلب صلاحية لا يمنحها دورك الحالي. راجع مدير النظام إن كنت تحتاجها.
        </p>
      </div>

      <Link
        href="/dashboard"
        className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-600"
      >
        <Home className="h-4 w-4" />
        لوحة التحكم
      </Link>
    </div>
  );
}
