'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect, useTransition } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { cn, debounce } from '@/lib/utils';
import { Button } from './button';

export interface FilterOption {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * شريط بحث وترشيح يعمل عبر معاملات الرابط (URL search params).
 * الحالة تعيش في الرابط، ما يجعل الصفحات قابلة للمشاركة والرجوع للخلف.
 */
export function SearchFilters({
  placeholder = 'ابحث…',
  filters = [],
  children,
  labels,
}: {
  placeholder?: string;
  filters?: FilterOption[];
  children?: React.ReactNode;
  labels?: { clear?: string; filter?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [showFilters, setShowFilters] = useState(false);

  // مزامنة الحقل عند التنقل للخلف/الأمام
  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  function updateParam(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete('page'); // العودة للصفحة الأولى عند تغيير الترشيح
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  const debouncedSearch = debounce((value: string) => updateParam('q', value), 350);

  const activeFilters = filters.filter((f) => searchParams.get(f.name));
  const hasActive = Boolean(query) || activeFilters.length > 0;

  return (
    <div className="mb-4 space-y-3 no-print">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              debouncedSearch(e.target.value);
            }}
            placeholder={placeholder}
            className={cn('input-base ps-9', pending && 'opacity-70')}
            aria-label={placeholder}
          />
        </div>

        {filters.length > 0 && (
          <Button
            variant={showFilters || activeFilters.length ? 'secondary' : 'outline'}
            onClick={() => setShowFilters((v) => !v)}
            icon={<SlidersHorizontal className="h-4 w-4" />}
          >
            {labels?.filter ?? 'تصفية'}
            {activeFilters.length > 0 && (
              <span className="numeric ms-1 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                {activeFilters.length}
              </span>
            )}
          </Button>
        )}

        {hasActive && (
          <Button
            variant="ghost"
            onClick={() => {
              setQuery('');
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
            icon={<X className="h-4 w-4" />}
          >
            {labels?.clear ?? 'مسح'}
          </Button>
        )}

        {children}
      </div>

      {showFilters && filters.length > 0 && (
        <div className="grid animate-fade-in gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {filters.map((filter) => (
            <label key={filter.name} className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {filter.label}
              </span>
              <select
                value={searchParams.get(filter.name) ?? ''}
                onChange={(e) => updateParam(filter.name, e.target.value)}
                className="input-base h-9 cursor-pointer text-sm"
              >
                <option value="">الكل</option>
                {filter.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** حقل تاريخ من/إلى في الرابط */
export function DateRangeFilter({
  labels,
}: {
  labels?: { from?: string; to?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-end gap-2 no-print">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          {labels?.from ?? 'من'}
        </span>
        <input
          type="date"
          value={searchParams.get('from') ?? ''}
          onChange={(e) => update('from', e.target.value)}
          className="input-base h-9 w-auto text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          {labels?.to ?? 'إلى'}
        </span>
        <input
          type="date"
          value={searchParams.get('to') ?? ''}
          onChange={(e) => update('to', e.target.value)}
          className="input-base h-9 w-auto text-sm"
        />
      </label>
    </div>
  );
}
