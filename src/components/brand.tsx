import { cn } from '@/lib/utils';

/**
 * علامة ROKA — «السداسي النابض».
 *
 * رأس البرغي السداسي = رمز الصيانة العالمي (نفتح ونُصلح).
 * خطّ النبض داخله = الجهاز يخرج حيّاً.
 *
 * قواعد الاستخدام:
 *  - العلامة تُرسم دائماً داخل مربّع مستدير — لا تُستعمل عارية على خلفية ملوّنة.
 *  - أصغر مقاس مسموح 16px؛ تحتها تفقد الوضوح.
 *  - في الطباعة أحادية اللون استعمل variant="mono".
 *
 * نفس المسارات مكرّرة في public/icon.svg و src/lib/pdf/brand.ts — إن عدّلت
 * الشكل هنا فعدّلهما معاً.
 */

/** إحداثيات المسارات — المصدر الوحيد للشكل في طبقة الواجهة */
export const BRAND_PATHS = {
  /** السداسي الخارجي */
  hex: 'M32 11l17.3 10v20L32 51 14.7 41V21z',
  /** خطّ النبض الداخلي */
  pulse: 'M21.5 33h4.5l3.5-9 4.5 15.5 3-6.5h6',
} as const;

/** ألوان الهوية — مطابقة لمتغيّرات CSS في globals.css */
export const BRAND_COLORS = {
  teal: '#0D9488',
  tealDark: '#0F766E',
  tealLight: '#14B8A6',
  ink: '#0F172A',
  amber: '#F59E0B',
} as const;

export interface BrandMarkProps {
  /** الطول والعرض بالبكسل */
  size?: number;
  /**
   * solid = مربّع تيل وعلامة بيضاء (الافتراضي)
   * mono  = بلا خلفية، يرث لون النص (للطباعة والأماكن الضيّقة)
   * light = مربّع فاتح وعلامة تيل (على الخلفيات الداكنة الملوّنة)
   */
  variant?: 'solid' | 'mono' | 'light';
  className?: string;
}

/** العلامة وحدها */
export function BrandMark({ size = 32, variant = 'solid', className }: BrandMarkProps) {
  const mono = variant === 'mono';
  const light = variant === 'light';

  const background = mono ? 'none' : light ? 'currentColor' : BRAND_COLORS.teal;
  const stroke = mono ? 'currentColor' : light ? BRAND_COLORS.teal : '#ffffff';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {!mono && <rect width="64" height="64" rx="15" fill={background} />}
      <path
        d={BRAND_PATHS.hex}
        fill="none"
        stroke={stroke}
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d={BRAND_PATHS.pulse}
        fill="none"
        stroke={stroke}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface BrandLogoProps extends BrandMarkProps {
  /** إخفاء الاسم والاكتفاء بالعلامة — للشريط الجانبي المطوي */
  markOnly?: boolean;
  /** اسم المحل — يحلّ محل «ROKA» عند تخصيصه من الإعدادات */
  name?: string;
  /** السطر الصغير تحت الاسم */
  tagline?: string;
}

/** الشعار الكامل: العلامة + الاسم اللاتيني + «روكــا» تحته */
export function BrandLogo({
  size = 34,
  variant = 'solid',
  markOnly = false,
  name = 'ROKA',
  tagline = 'روكــا',
  className,
}: BrandLogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark size={size} variant={variant} />
      {!markOnly && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="truncate text-lg font-bold tracking-wide">{name}</span>
          {tagline && (
            <span className="truncate text-[9px] font-medium tracking-[0.25em] opacity-55">
              {tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
