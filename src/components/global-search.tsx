'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Loader2, Wrench, User, Package, Receipt, CornerDownLeft } from 'lucide-react';
import { cn, debounce } from '@/lib/utils';

interface SearchResult {
  type: 'repair' | 'customer' | 'product' | 'invoice';
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  meta?: string;
}

const ICONS = {
  repair: Wrench,
  customer: User,
  product: Package,
  invoice: Receipt,
} as const;

const GROUP_LABELS = {
  repair: 'أوامر الصيانة',
  customer: 'العملاء',
  product: 'المنتجات',
  invoice: 'الفواتير',
} as const;

/**
 * بحث عام سريع عبر الأوامر والعملاء والمنتجات والفواتير.
 * يدعم مسح الباركود (الماسح يكتب الرقم ثم Enter).
 */
export function GlobalSearch({ placeholder = 'ابحث…' }: { placeholder?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // اختصار لوحة المفاتيح: Ctrl/Cmd + K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // إغلاق عند النقر خارج المكوّن
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const runSearch = useCallback(
    debounce((value: string) => {
      if (value.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((data: { results: SearchResult[] }) => {
          setResults(data.results ?? []);
          setActiveIndex(0);
        })
        .catch(() => {
          /* تم الإلغاء أو فشل الشبكة */
        })
        .finally(() => setLoading(false));
    }, 250),
    [],
  );

  function onChange(value: string) {
    setQuery(value);
    setOpen(true);
    setLoading(value.trim().length >= 2);
    runSearch(value);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[activeIndex];
      if (target) {
        setOpen(false);
        setQuery('');
        router.push(target.href);
      }
    }
  }

  // تجميع النتائج حسب النوع مع الحفاظ على ترتيب الفهرس للتنقل بالأسهم
  const groups = results.reduce<{ type: SearchResult['type']; items: { r: SearchResult; i: number }[] }[]>(
    (acc, r, i) => {
      const last = acc[acc.length - 1];
      if (last && last.type === r.type) last.items.push({ r, i });
      else acc.push({ type: r.type, items: [{ r, i }] });
      return acc;
    },
    [],
  );

  return (
    <div ref={containerRef} className="relative max-w-md flex-1">
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border border-input bg-background ps-9 pe-16 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="بحث عام"
          autoComplete="off"
        />
        <span className="pointer-events-none absolute inset-y-0 end-2 my-auto hidden h-5 items-center rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground sm:flex">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : '⌘K'}
        </span>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-[70vh] animate-fade-in overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-card">
          {loading && !results.length ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">جارٍ البحث…</p>
          ) : !results.length ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              لا توجد نتائج مطابقة
            </p>
          ) : (
            groups.map((group) => {
              const Icon = ICONS[group.type];
              return (
                <div key={group.type} className="mb-1 last:mb-0">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {GROUP_LABELS[group.type]}
                  </p>
                  {group.items.map(({ r, i }) => (
                    <Link
                      key={`${r.type}-${r.id}`}
                      href={r.href}
                      onClick={() => {
                        setOpen(false);
                        setQuery('');
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={cn(
                        'flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors',
                        i === activeIndex ? 'bg-accent' : 'hover:bg-accent/60',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.title}</span>
                        {r.subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.subtitle}
                          </span>
                        )}
                      </span>
                      {r.meta && (
                        <span className="numeric shrink-0 text-xs text-muted-foreground">
                          {r.meta}
                        </span>
                      )}
                      {i === activeIndex && (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </Link>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
