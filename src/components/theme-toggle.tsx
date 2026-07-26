'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

const OPTIONS: { value: Theme; icon: React.ElementType; label: string }[] = [
  { value: 'light', icon: Sun, label: 'فاتح' },
  { value: 'dark', icon: Moon, label: 'داكن' },
  { value: 'system', icon: Monitor, label: 'حسب النظام' },
];

function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('roka_theme', theme);
  document.cookie = `roka_theme=${theme}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeToggle({ compact = true }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem('roka_theme') as Theme) ?? 'system';
    setTheme(stored);

    // متابعة تغيّر تفضيل النظام أثناء وضع "system"
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if ((localStorage.getItem('roka_theme') as Theme) === 'system') applyTheme('system');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  function select(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden />;
  }

  if (compact) {
    // زر واحد يدور بين الأوضاع الثلاثة
    const index = OPTIONS.findIndex((o) => o.value === theme);
    const current = OPTIONS[index] ?? OPTIONS[2];
    const Icon = current.icon;
    return (
      <button
        type="button"
        onClick={() => select(OPTIONS[(index + 1) % OPTIONS.length].value)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={`السمة: ${current.label}`}
        aria-label={`السمة: ${current.label}`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </button>
    );
  }

  return (
    <div className="inline-flex gap-1 rounded-md bg-muted p-1">
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => select(o.value)}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors',
              theme === o.value
                ? 'bg-card font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
