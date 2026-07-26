import { cn } from '@/lib/utils';

/**
 * علامة FIXEL — «البكسل العائد».
 *
 * أربع بكسلات في شبكة 2×2؛ ثلاث ممتلئة والرابعة تعود إلى مكانها.
 * المعنى: نُرجع الناقص — وهو بالضبط ما يفعله محل الصيانة.
 * الاسم نفسه مركّب من Fix + Pixel.
 *
 * قواعد الاستخدام:
 *  - العلامة تُرسم دائماً داخل مربّع مستدير — لا تُستعمل عارية على خلفية ملوّنة.
 *  - أصغر مقاس مسموح 16px؛ تحته تلتصق البكسلات ببعضها.
 *  - في الطباعة أحادية اللون استعمل variant="mono".
 *
 * نفس الشكل مكرّر في public/icon.svg و src/lib/pdf/brand.ts — إن عدّلته
 * هنا فعدّلهما معاً (راجع docs/BRAND.md).
 */

/** هندسة الشبكة في مربّع 64×64 — المصدر الوحيد للشكل في طبقة الواجهة */
export const BRAND_GRID = {
  /** مواضع البكسلات الثلاثة الممتلئة */
  filled: [
    { x: 14, y: 14 },
    { x: 34, y: 14 },
    { x: 14, y: 34 },
  ],
  size: 16,
  radius: 4,
  /** البكسل الرابع — مرسوم بحدّ فقط لأنه «في طريقه للعودة» */
  restored: { x: 35.6, y: 35.6, size: 12.8, radius: 3, stroke: 3.2 },
} as const;

/** ألوان الهوية — مطابقة لمتغيّرات CSS في globals.css */
export const BRAND_COLORS = {
  indigo: '#4F46E5',
  indigoDark: '#4338CA',
  indigoLight: '#6366F1',
  /** لون البكسل العائد — أفتح من الخلفية ليُقرأ أنه «غير مكتمل بعد» */
  restored: '#A5B4FC',
  ink: '#0B1020',
  cyan: '#22D3EE',
} as const;

export interface BrandMarkProps {
  /** الطول والعرض بالبكسل */
  size?: number;
  /**
   * solid = مربّع بنفسجي وبكسلات بيضاء (الافتراضي)
   * mono  = بلا خلفية، يرث لون النص (للطباعة والأماكن الضيّقة)
   * light = مربّع فاتح وبكسلات بنفسجية (على الخلفيات الداكنة الملوّنة)
   */
  variant?: 'solid' | 'mono' | 'light';
  className?: string;
}

/** العلامة وحدها */
export function BrandMark({ size = 32, variant = 'solid', className }: BrandMarkProps) {
  const mono = variant === 'mono';
  const light = variant === 'light';

  const background = light ? 'currentColor' : BRAND_COLORS.indigo;
  const pixel = mono ? 'currentColor' : light ? BRAND_COLORS.indigo : '#ffffff';
  // في الوضع الأحادي لا يوجد تباين لوني، فيبقى الفرق في الحدّ وحده
  const outline = mono || light ? pixel : BRAND_COLORS.restored;
  const { filled, size: px, radius, restored } = BRAND_GRID;

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
      {filled.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x}
          y={cell.y}
          width={px}
          height={px}
          rx={radius}
          fill={pixel}
        />
      ))}
      <rect
        x={restored.x}
        y={restored.y}
        width={restored.size}
        height={restored.size}
        rx={restored.radius}
        fill="none"
        stroke={outline}
        strokeWidth={restored.stroke}
      />
    </svg>
  );
}

export interface BrandLogoProps extends BrandMarkProps {
  /** إخفاء الاسم والاكتفاء بالعلامة — للشريط الجانبي المطوي */
  markOnly?: boolean;
  /** اسم المحل — يحلّ محل «FIXEL» عند تخصيصه من الإعدادات */
  name?: string;
  /** السطر الصغير تحت الاسم */
  tagline?: string;
}

/** الشعار الكامل: العلامة + الاسم اللاتيني + «فيكسل» تحته */
export function BrandLogo({
  size = 34,
  variant = 'solid',
  markOnly = false,
  name = 'FIXEL',
  tagline = 'فيكسل',
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
