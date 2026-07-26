import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  /** محاذاة الخلية — الافتراضي بداية السطر */
  align?: 'start' | 'center' | 'end';
  className?: string;
  headerClassName?: string;
  /** إخفاء العمود على الشاشات الصغيرة */
  hideOnMobile?: boolean;
  render: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** رابط عند النقر على الصف */
  rowHref?: (row: T) => string;
  empty?: React.ReactNode;
  className?: string;
  /** صف تذييل (مجاميع) */
  footer?: React.ReactNode;
  dense?: boolean;
}

const ALIGN = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
} as const;

/**
 * جدول بيانات خادمي (بدون حالة) — سريع وقابل للطباعة.
 * البحث والترشيح والصفحات تُدار عبر معاملات الرابط في صفحة القائمة.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  empty,
  className,
  footer,
  dense,
}: DataTableProps<T>) {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground/50" aria-hidden />
        <p className="text-sm text-muted-foreground">{empty ?? 'لا توجد بيانات'}</p>
      </div>
    );
  }

  return (
    <div className={cn('w-full overflow-x-auto rounded-lg border border-border', className)}>
      <table className="table-base">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  ALIGN[col.align ?? 'start'],
                  col.hideOnMobile && 'hidden md:table-cell',
                  col.headerClassName,
                )}
                scope="col"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const href = rowHref?.(row);
            return (
              <tr key={rowKey(row)} className={cn(href && 'cursor-pointer')}>
                {columns.map((col, colIndex) => {
                  const content = col.render(row, index);
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        ALIGN[col.align ?? 'start'],
                        dense && 'py-1.5',
                        col.hideOnMobile && 'hidden md:table-cell',
                        col.className,
                      )}
                    >
                      {/* الرابط يغطي الخلية الأولى فقط لإتاحة أزرار الإجراءات */}
                      {href && colIndex === 0 ? (
                        <Link href={href} className="block hover:text-primary">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        {footer && (
          <tfoot className="bg-muted/40 font-medium">
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- Pagination

export function Pagination({
  page,
  pageSize,
  total,
  baseUrl,
  labels,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** الرابط الأساسي متضمناً معاملات الترشيح، بدون معامل page */
  baseUrl: string;
  labels?: { page?: string; of?: string; previous?: string; next?: string };
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const separator = baseUrl.includes('?') ? '&' : '?';
  const link = (p: number) => `${baseUrl}${separator}page=${p}`;

  const l = {
    page: labels?.page ?? 'صفحة',
    of: labels?.of ?? 'من',
    previous: labels?.previous ?? 'السابق',
    next: labels?.next ?? 'التالي',
  };

  // نوافذ الصفحات: 1 … (p-1) p (p+1) … n
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const visible = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 py-3 no-print"
      aria-label="ترقيم الصفحات"
    >
      <p className="text-sm text-muted-foreground">
        {l.page} <span className="numeric font-medium text-foreground">{page}</span> {l.of}{' '}
        <span className="numeric font-medium text-foreground">{totalPages}</span>
        <span className="mx-2 text-border">·</span>
        <span className="numeric">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        <PageLink href={link(Math.max(1, page - 1))} disabled={page <= 1}>
          {l.previous}
        </PageLink>
        {visible.map((p, i) => (
          <React.Fragment key={p}>
            {i > 0 && visible[i - 1] !== p - 1 && (
              <span className="px-1 text-muted-foreground">…</span>
            )}
            <PageLink href={link(p)} active={p === page}>
              <span className="numeric">{p}</span>
            </PageLink>
          </React.Fragment>
        ))}
        <PageLink href={link(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
          {l.next}
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  active,
  disabled,
  children,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2.5 text-sm transition-colors',
    active
      ? 'bg-primary text-primary-foreground'
      : 'border border-border hover:bg-accent',
    disabled && 'pointer-events-none opacity-40',
  );
  if (disabled) return <span className={className}>{children}</span>;
  return (
    <Link href={href} className={className} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  );
}
