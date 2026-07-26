'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app-error]', error);
  }, [error]);

  // أخطاء الصلاحيات تُعرض برسالة مختلفة عن الأخطاء التقنية
  const isPermission =
    error.message.includes('صلاحية') || error.message.includes('تسجيل الدخول');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
          isPermission ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'
        }`}
      >
        {isPermission ? (
          <ShieldOff className="h-7 w-7" />
        ) : (
          <AlertTriangle className="h-7 w-7" />
        )}
      </span>

      <div>
        <h1 className="text-xl font-bold">
          {isPermission ? 'لا تملك صلاحية الوصول' : 'حدث خطأ غير متوقع'}
        </h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {isPermission
            ? 'راجع مدير النظام إن كنت تحتاج هذه الصلاحية.'
            : error.message || 'تعذّر تحميل هذه الصفحة. حاول مرة أخرى.'}
        </p>
        {error.digest && (
          <p className="numeric mt-2 font-mono text-[11px] text-muted-foreground" dir="ltr">
            {error.digest}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {!isPermission && (
          <Button onClick={reset} icon={<RotateCcw className="h-4 w-4" />}>
            إعادة المحاولة
          </Button>
        )}
        <Link href="/dashboard">
          <Button variant="outline" icon={<Home className="h-4 w-4" />}>
            لوحة التحكم
          </Button>
        </Link>
      </div>
    </div>
  );
}
