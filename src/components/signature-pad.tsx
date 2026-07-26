'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Eraser, PenLine, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * لوحة توقيع تعمل باللمس والفأرة.
 * تُصدِّر التوقيع كصورة PNG بصيغة data URL.
 */
export function SignaturePad({
  value,
  onChange,
  label,
  hint,
  clearLabel = 'مسح التوقيع',
  height = 160,
  className,
}: {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  label: string;
  hint?: string;
  clearLabel?: string;
  height?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasContent, setHasContent] = useState(Boolean(value));

  /** يضبط دقة اللوحة حسب كثافة البكسل ويعيد رسم القيمة الحالية */
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';

    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
  }, [value]);

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [setupCanvas]);

  function pointFrom(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPoint.current = pointFrom(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !lastPoint.current) return;

    const point = pointFrom(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
    setHasContent(true);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    const canvas = canvasRef.current;
    if (canvas && hasContent) onChange(canvas.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    onChange(null);
  }

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <PenLine className="h-4 w-4 text-muted-foreground" />
          {label}
          {hasContent && <Check className="h-4 w-4 text-success" aria-label="موقّع" />}
        </span>
        {hasContent && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-danger"
          >
            <Eraser className="h-3.5 w-3.5" />
            {clearLabel}
          </button>
        )}
      </div>

      <div
        className={cn(
          'relative overflow-hidden rounded-md border-2 border-dashed bg-white',
          hasContent ? 'border-success/40' : 'border-border',
        )}
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-crosshair touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {!hasContent && hint && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
