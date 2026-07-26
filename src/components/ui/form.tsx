'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------------- Field

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required,
  className,
  htmlFor,
  children,
}: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
          {label}
          {required && <span className="ms-1 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------- Input

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, leading, trailing, type = 'text', ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        type={type}
        className={cn(
          'input-base',
          (type === 'number' || type === 'tel') && 'numeric text-start',
          leading && 'ps-9',
          trailing && 'pe-9',
          invalid && 'border-danger focus-visible:ring-danger',
          className,
        )}
        {...props}
      />
    );

    if (!leading && !trailing) return input;

    return (
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 start-0 flex w-9 items-center justify-center text-muted-foreground">
            {leading}
          </span>
        )}
        {input}
        {trailing && (
          <span className="absolute inset-y-0 end-0 flex w-9 items-center justify-center text-muted-foreground">
            {trailing}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

// ---------------------------------------------------------------- Textarea

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(
      'input-base h-auto resize-y py-2 leading-relaxed',
      invalid && 'border-danger focus-visible:ring-danger',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

// ------------------------------------------------------------------ Select

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  placeholder?: string;
  options?: { value: string; label: string; disabled?: boolean }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, placeholder, options, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'input-base cursor-pointer appearance-none pe-9',
          invalid && 'border-danger focus-visible:ring-danger',
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-muted-foreground"
        aria-hidden
      />
    </div>
  ),
);
Select.displayName = 'Select';

// ---------------------------------------------------------------- Checkbox

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }
>(({ className, label, id, ...props }, ref) => {
  const generated = React.useId();
  const inputId = id ?? generated;
  return (
    <div className="flex items-center gap-2">
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={cn(
          'h-4 w-4 shrink-0 cursor-pointer rounded border-input text-primary',
          'accent-[hsl(var(--primary))] focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        {...props}
      />
      {label && (
        <label htmlFor={inputId} className="cursor-pointer select-none text-sm">
          {label}
        </label>
      )}
    </div>
  );
});
Checkbox.displayName = 'Checkbox';

// ------------------------------------------------------------------ Switch

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  name,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <label className={cn('flex items-center gap-3', disabled && 'opacity-50')}>
      {name && <input type="hidden" name={name} value={checked ? 'true' : 'false'} />}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            'start-0.5',
            checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
      {label && <span className="select-none text-sm">{label}</span>}
    </label>
  );
}

// ------------------------------------------------------------- RadioGroup

export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  name,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; disabled?: boolean }[];
  name?: string;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-md bg-muted p-1', className)}>
      {name && <input type="hidden" name={name} value={value} />}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
            value === o.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- FormSection

export function FormSection({
  title,
  description,
  children,
  className,
  actions,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className={cn('card p-5', className)}>
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

/** شبكة حقول متجاوبة */
export function FormGrid({
  cols = 2,
  children,
  className,
}: {
  cols?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}) {
  const map = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  } as const;
  return <div className={cn('grid gap-4', map[cols], className)}>{children}</div>;
}
