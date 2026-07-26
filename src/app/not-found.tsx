import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <FileQuestion className="h-8 w-8" />
      </span>

      <div>
        <h1 className="text-2xl font-bold">الصفحة غير موجودة</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          الرابط الذي فتحته غير صحيح أو أن السجل حُذف.
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
