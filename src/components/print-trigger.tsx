'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Printer, ArrowRight } from 'lucide-react';

/**
 * شريط أدوات صفحات الطباعة — يختفي عند الطباعة.
 * يفتح نافذة الطباعة تلقائياً عند وجود ?autoprint=1 في الرابط.
 */
export function PrintTrigger({
  label = 'طباعة',
  backLabel = 'رجوع',
  autoPrint,
}: {
  label?: string;
  backLabel?: string;
  autoPrint?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const shouldPrint =
      autoPrint ??
      new URLSearchParams(window.location.search).get('autoprint') === '1';
    if (!shouldPrint) return;
    // تأخير بسيط لضمان تحميل الصور (QR/باركود) قبل الطباعة
    const timer = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="no-print sticky top-0 z-10 mb-4 flex items-center justify-between gap-2 border-b border-gray-200 bg-white/95 p-3 backdrop-blur">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
      >
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        {backLabel}
      </button>

      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        <Printer className="h-4 w-4" />
        {label}
      </button>
    </div>
  );
}
