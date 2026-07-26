'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { Globe, Check } from 'lucide-react';
import { setLocaleAction } from '@/app/actions/auth';
import { LOCALES, LOCALE_META, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export function LocaleSwitcher({ current }: { current?: Locale }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function select(locale: Locale) {
    setOpen(false);
    startTransition(() => {
      void setLocaleAction(locale);
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="تغيير اللغة"
      >
        <Globe className="h-[18px] w-[18px]" />
        {current && <span className="hidden sm:inline">{LOCALE_META[current].nativeName}</span>}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-1 w-44 animate-fade-in overflow-hidden rounded-md border border-border bg-popover p-1 shadow-card"
        >
          {LOCALES.map((locale) => (
            <button
              key={locale}
              type="button"
              role="menuitem"
              onClick={() => select(locale)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-sm transition-colors hover:bg-accent',
                current === locale && 'font-medium',
              )}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>{LOCALE_META[locale].flag}</span>
                {LOCALE_META[locale].nativeName}
              </span>
              {current === locale && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
