'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  ScanLine,
  Trash2,
  Plus,
  Minus,
  User,
  X,
  ShoppingCart,
  Percent,
  Ticket,
  Printer,
  CheckCircle2,
  Package,
  Wrench,
} from 'lucide-react';

import { createInvoiceAction, checkCouponAction } from '@/app/actions/invoices';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Input, Select, Field } from '@/components/ui/form';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { calculatePricing } from '@/lib/pricing';
import { cn, formatMoney, round, normalizeDigits } from '@/lib/utils';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/constants';
import type { Locale } from '@/i18n/config';

// ------------------------------------------------------------------ الأنواع

export interface PosProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  sellPrice: number;
  costPrice: number;
  quantity: number;
  categoryId: string | null;
  categoryName: string | null;
}

export interface PosService {
  id: string;
  code: string;
  name: string;
  price: number;
  cost: number;
  categoryId: string | null;
  categoryName: string | null;
  warrantyDays: number;
}

export interface PosCustomer {
  id: string;
  name: string;
  phone: string;
  balance: number;
  loyaltyPoints: number;
}

interface CartLine {
  uid: string;
  kind: 'PRODUCT' | 'SERVICE';
  refId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discount: number;
  /** الكمية المتاحة — للمنتجات فقط */
  available?: number;
  warrantyDays?: number;
}

export interface PosLabels {
  [key: string]: string;
}

let uid = 0;

// ------------------------------------------------------------------ المكوّن

export function PosTerminal({
  products,
  services,
  customers,
  defaultTaxRate,
  taxEnabled,
  currency,
  decimals,
  locale,
  labels,
  preselectedCustomerId,
}: {
  products: PosProduct[];
  services: PosService[];
  customers: PosCustomer[];
  defaultTaxRate: number;
  taxEnabled: boolean;
  currency: string;
  decimals: number;
  locale: Locale;
  labels: PosLabels;
  preselectedCustomerId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'PRODUCTS' | 'SERVICES'>('PRODUCTS');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState(preselectedCustomerId ?? '');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(taxEnabled ? defaultTaxRate : 0);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);

  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountReceived, setAmountReceived] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);

  const money = (v: number) => formatMoney(v, { currency, decimals, locale });

  // ------------------------------------------------------------ التصنيفات
  const categories = useMemo(() => {
    const source = tab === 'PRODUCTS' ? products : services;
    const map = new Map<string, string>();
    for (const item of source) {
      if (item.categoryId && item.categoryName) map.set(item.categoryId, item.categoryName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [tab, products, services]);

  // ------------------------------------------------------------- الترشيح
  const visibleProducts = useMemo(() => {
    const q = normalizeDigits(search.trim().toLowerCase());
    return products
      .filter((p) => (categoryId ? p.categoryId === categoryId : true))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode ?? '').includes(q),
      )
      .slice(0, 120);
  }, [products, search, categoryId]);

  const visibleServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services
      .filter((s) => (categoryId ? s.categoryId === categoryId : true))
      .filter(
        (s) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
      )
      .slice(0, 120);
  }, [services, search, categoryId]);

  // ------------------------------------------------------------- الحسابات
  const pricing = useMemo(
    () =>
      calculatePricing({
        items: cart,
        discountType,
        discountValue,
        taxRate,
        couponDiscount,
      }),
    [cart, discountType, discountValue, taxRate, couponDiscount],
  );

  const received = Number(amountReceived) || 0;
  const change = round(Math.max(0, received - pricing.total));
  const customer = customers.find((c) => c.id === customerId);

  // --------------------------------------------------------- إجراءات السلة
  const addProduct = useCallback((product: PosProduct) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.kind === 'PRODUCT' && l.refId === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.quantity) return prev;
        return prev.map((l) =>
          l.uid === existing.uid ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          uid: `l-${++uid}`,
          kind: 'PRODUCT',
          refId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: product.sellPrice,
          unitCost: product.costPrice,
          discount: 0,
          available: product.quantity,
        },
      ];
    });
  }, []);

  function addService(service: PosService) {
    setCart((prev) => {
      const existing = prev.find((l) => l.kind === 'SERVICE' && l.refId === service.id);
      if (existing) {
        return prev.map((l) =>
          l.uid === existing.uid ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          uid: `l-${++uid}`,
          kind: 'SERVICE',
          refId: service.id,
          name: service.name,
          quantity: 1,
          unitPrice: service.price,
          unitCost: service.cost,
          discount: 0,
          warrantyDays: service.warrantyDays,
        },
      ];
    });
  }

  function updateLine(lineUid: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.uid === lineUid ? { ...l, ...patch } : l)));
  }

  function changeQuantity(line: CartLine, delta: number) {
    const next = round(line.quantity + delta, 3);
    if (next <= 0) {
      setCart((prev) => prev.filter((l) => l.uid !== line.uid));
      return;
    }
    if (line.available !== undefined && next > line.available) {
      toast.warning(labels.insufficientStock, `${labels.stock}: ${line.available}`);
      return;
    }
    updateLine(line.uid, { quantity: next });
  }

  function clearCart() {
    setCart([]);
    setDiscountValue(0);
    setCouponCode('');
    setCouponDiscount(0);
    setAmountReceived('');
  }

  // ---------------------------------------------------- مسح الباركود بالماسح
  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    const code = normalizeDigits(search.trim());
    if (!code) return;

    // مطابقة دقيقة بالباركود أو SKU (سلوك الماسح)
    const match = products.find((p) => p.barcode === code || p.sku === code);
    if (match) {
      if (match.quantity <= 0) {
        toast.error(labels.outOfStock, match.name);
      } else {
        addProduct(match);
        setSearch('');
      }
      return;
    }

    // وإلا: أضف أول نتيجة معروضة
    if (tab === 'PRODUCTS' && visibleProducts.length === 1) {
      addProduct(visibleProducts[0]);
      setSearch('');
    } else if (tab === 'SERVICES' && visibleServices.length === 1) {
      addService(visibleServices[0]);
      setSearch('');
    }
  }

  // اختصار: F2 للتركيز على البحث، F9 للدفع
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === 'F9' && cart.length > 0) {
        event.preventDefault();
        setShowCheckout(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart.length]);

  // -------------------------------------------------------------- الكوبون
  async function applyCoupon() {
    if (!couponCode.trim()) return;
    const result = await checkCouponAction(couponCode, pricing.subtotal);
    if (result.ok && result.discount) {
      setCouponDiscount(result.discount);
      toast.success(labels.couponApplied, money(result.discount));
    } else {
      setCouponDiscount(0);
      toast.error(result.error ?? labels.couponInvalid);
    }
  }

  // -------------------------------------------------------------- الإتمام
  async function checkout(printAfter: boolean) {
    if (!cart.length) return;
    setSubmitting(true);

    const payload = {
      type: 'SALE',
      customerId: customerId || null,
      items: cart.map((line) => ({
        kind: line.kind,
        productId: line.kind === 'PRODUCT' ? line.refId : null,
        serviceId: line.kind === 'SERVICE' ? line.refId : null,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitCost: line.unitCost,
        discount: line.discount,
        taxRate: 0,
      })),
      discountType,
      discountValue,
      taxRate,
      couponCode: couponCode.trim() || null,
      warrantyDays: Math.max(0, ...cart.map((l) => l.warrantyDays ?? 0)),
      payment:
        received > 0
          ? {
              amount: Math.min(received, pricing.total),
              method: paymentMethod,
              reference: reference || null,
            }
          : undefined,
    };

    const formData = new FormData();
    formData.set('payload', JSON.stringify(payload));
    formData.set('redirectTo', 'none');

    try {
      const result: FormState = await createInvoiceAction(null, formData);
      if (result.ok && result.id) {
        toast.success(labels.completed);
        setLastInvoiceId(result.id);
        setShowCheckout(false);
        clearCart();
        setCustomerId('');
        router.refresh();
        if (printAfter) {
          window.open(`/invoices/${result.id}/print?autoprint=1`, '_blank');
        }
      } else {
        toast.error(result.error ?? labels.error);
      }
    } catch {
      toast.error(labels.error);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 40);
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .slice(0, 40);
  }, [customers, customerSearch]);

  // ---------------------------------------------------------------- العرض
  return (
    <div className="grid h-[calc(100dvh-7rem)] gap-4 lg:grid-cols-[1fr_380px]">
      {/* ------------------------------------------------- كتالوج المنتجات */}
      <div className="flex min-h-0 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <ScanLine className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={labels.scanOrSearch}
              className="input-base ps-9"
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className="inline-flex gap-1 rounded-md bg-muted p-1">
            <button
              type="button"
              onClick={() => {
                setTab('PRODUCTS');
                setCategoryId('');
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                tab === 'PRODUCTS' ? 'bg-card shadow-sm' : 'text-muted-foreground',
              )}
            >
              <Package className="h-4 w-4" />
              {labels.products}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('SERVICES');
                setCategoryId('');
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                tab === 'SERVICES' ? 'bg-card shadow-sm' : 'text-muted-foreground',
              )}
            >
              <Wrench className="h-4 w-4" />
              {labels.services}
            </button>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryId('')}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                !categoryId ? 'border-transparent bg-primary text-primary-foreground' : 'border-border hover:bg-accent',
              )}
            >
              {labels.all}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  categoryId === category.id
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border hover:bg-accent',
                )}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border p-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {tab === 'PRODUCTS'
              ? visibleProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    disabled={product.quantity <= 0}
                    className="flex flex-col justify-between gap-1 rounded-lg border border-border p-2.5 text-start transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="line-clamp-2 text-sm font-medium leading-snug">
                      {product.name}
                    </span>
                    <span className="flex items-end justify-between gap-1">
                      <span className="numeric text-sm font-bold text-primary">
                        {money(product.sellPrice)}
                      </span>
                      <span
                        className={cn(
                          'numeric text-[11px]',
                          product.quantity <= 0
                            ? 'text-danger'
                            : product.quantity < 5
                              ? 'text-warning'
                              : 'text-muted-foreground',
                        )}
                      >
                        {product.quantity}
                      </span>
                    </span>
                  </button>
                ))
              : visibleServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => addService(service)}
                    className="flex flex-col justify-between gap-1 rounded-lg border border-border p-2.5 text-start transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <span className="line-clamp-2 text-sm font-medium leading-snug">
                      {service.name}
                    </span>
                    <span className="numeric text-sm font-bold text-primary">
                      {money(service.price)}
                    </span>
                  </button>
                ))}
          </div>

          {(tab === 'PRODUCTS' ? visibleProducts : visibleServices).length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {labels.noResults}
            </p>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ السلة */}
      <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
        {/* العميل */}
        <div className="border-b border-border p-3">
          {customer ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{customer.name}</p>
                <p className="numeric text-xs text-muted-foreground">
                  {customer.phone}
                  {customer.balance < 0 && (
                    <span className="ms-2 text-danger">
                      {labels.debit}: {money(Math.abs(customer.balance))}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomerId('')}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
                aria-label={labels.clear}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowCustomerPicker(true)}
              icon={<User className="h-4 w-4" />}
            >
              {labels.selectCustomer}
            </Button>
          )}
        </div>

        {/* البنود */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{labels.emptyCart}</p>
              <p className="text-xs text-muted-foreground">F2 للبحث · F9 للدفع</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {cart.map((line) => (
                <li key={line.uid} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-snug">{line.name}</span>
                      <span className="numeric block text-xs text-muted-foreground">
                        {money(line.unitPrice)}
                        {line.discount > 0 && ` − ${money(line.discount)}`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCart(cart.filter((l) => l.uid !== line.uid))}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                      aria-label={labels.remove}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => changeQuantity(line, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-accent"
                        aria-label="−"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.uid, { quantity: Number(e.target.value) || 0 })
                        }
                        className="numeric h-7 w-14 rounded border border-input bg-background text-center text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => changeQuantity(line, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-accent"
                        aria-label="+"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <span className="numeric text-sm font-semibold">
                      {money(round(line.quantity * line.unitPrice - line.discount))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* المجاميع */}
        <div className="border-t border-border p-3">
          <div className="mb-3 space-y-1.5 text-sm">
            <Row label={labels.subtotal} value={money(pricing.subtotal)} />

            <div className="flex items-center gap-2">
              <span className="flex-1 text-muted-foreground">{labels.discount}</span>
              <button
                type="button"
                onClick={() => setDiscountType(discountType === 'FIXED' ? 'PERCENT' : 'FIXED')}
                className="flex h-7 w-7 items-center justify-center rounded border border-border text-xs hover:bg-accent"
                title={discountType === 'PERCENT' ? labels.percent : labels.fixed}
              >
                {discountType === 'PERCENT' ? <Percent className="h-3.5 w-3.5" /> : '#'}
              </button>
              <input
                type="number"
                min={0}
                step="any"
                value={discountValue || ''}
                onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                className="numeric h-7 w-20 rounded border border-input bg-background px-2 text-end text-sm"
                placeholder="0"
              />
            </div>

            {couponDiscount > 0 && (
              <Row label={`${labels.coupon} ${couponCode}`} value={`− ${money(couponDiscount)}`} />
            )}

            {taxEnabled && (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-muted-foreground">
                  {labels.tax} ({taxRate}%)
                </span>
                <span className="numeric">{money(pricing.taxAmount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
              <span className="font-semibold">{labels.total}</span>
              <span className="numeric text-xl font-bold">{money(pricing.total)}</span>
            </div>
          </div>

          <div className="mb-2 flex gap-2">
            <Input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder={labels.coupon}
              className="h-9"
              dir="ltr"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={applyCoupon}
              disabled={!couponCode.trim()}
              icon={<Ticket className="h-4 w-4" />}
            >
              {labels.applyCoupon}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={clearCart}
              disabled={!cart.length}
              icon={<Trash2 className="h-4 w-4" />}
            >
              {labels.clearCart}
            </Button>
            <Button
              className="flex-1"
              size="lg"
              onClick={() => {
                setAmountReceived(String(pricing.total));
                setShowCheckout(true);
              }}
              disabled={!cart.length}
            >
              {labels.checkout} (F9)
            </Button>
          </div>

          {lastInvoiceId && (
            <a
              href={`/invoices/${lastInvoiceId}/print`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-md bg-success/10 p-2 text-xs text-success hover:bg-success/20"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {labels.printLast}
            </a>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------ نافذة الدفع */}
      <Dialog
        open={showCheckout}
        onClose={() => !submitting && setShowCheckout(false)}
        title={labels.checkout}
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowCheckout(false)}
              disabled={submitting}
            >
              {labels.cancel}
            </Button>
            <Button
              variant="outline"
              onClick={() => checkout(true)}
              loading={submitting}
              icon={<Printer className="h-4 w-4" />}
            >
              {labels.printAndNew}
            </Button>
            <Button onClick={() => checkout(false)} loading={submitting}>
              {labels.confirm}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-primary/10 p-4 text-center">
            <p className="text-sm text-muted-foreground">{labels.total}</p>
            <p className="numeric text-3xl font-bold text-primary">{money(pricing.total)}</p>
          </div>

          <Field label={labels.method}>
            <Select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              options={PAYMENT_METHODS.map((m) => ({
                value: m,
                label: labels[`method_${m}`] ?? m,
              }))}
            />
          </Field>

          <Field label={labels.amountReceived}>
            <Input
              type="number"
              min={0}
              step="any"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              autoFocus
            />
          </Field>

          {/* أزرار مبالغ سريعة */}
          <div className="flex flex-wrap gap-1.5">
            {[pricing.total, 500, 1000, 2000, 5000, 10000].map((amount, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setAmountReceived(String(amount))}
                className="numeric rounded border border-border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
              >
                {i === 0 ? labels.exact : money(amount)}
              </button>
            ))}
          </div>

          {received > 0 && (
            <div className="space-y-1.5 rounded-md bg-muted/50 p-3 text-sm">
              <Row label={labels.amountReceived} value={money(received)} />
              {received >= pricing.total ? (
                <div className="flex items-center justify-between border-t border-border pt-1.5">
                  <span className="font-medium">{labels.change}</span>
                  <span className="numeric text-lg font-bold text-success">{money(change)}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between border-t border-border pt-1.5">
                  <span className="font-medium">{labels.due}</span>
                  <span className="numeric text-lg font-bold text-danger">
                    {money(round(pricing.total - received))}
                  </span>
                </div>
              )}
            </div>
          )}

          {received < pricing.total && !customerId && (
            <p className="rounded-md bg-warning/10 p-2 text-xs text-warning">
              {labels.creditNeedsCustomer}
            </p>
          )}

          {(paymentMethod === 'CARD' ||
            paymentMethod === 'BANK_TRANSFER' ||
            paymentMethod === 'CHECK') && (
            <Field label={labels.reference}>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" />
            </Field>
          )}
        </div>
      </Dialog>

      {/* -------------------------------------------------- اختيار العميل */}
      <Dialog
        open={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        title={labels.selectCustomer}
        size="md"
      >
        <Input
          value={customerSearch}
          onChange={(e) => setCustomerSearch(e.target.value)}
          placeholder={labels.searchCustomer}
          leading={<Search className="h-4 w-4" />}
          autoFocus
        />
        <ul className="mt-3 max-h-[50vh] divide-y divide-border overflow-y-auto">
          {filteredCustomers.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setCustomerId(c.id);
                  setShowCustomerPicker(false);
                  setCustomerSearch('');
                }}
                className="flex w-full items-center justify-between gap-3 px-2 py-2.5 text-start transition-colors hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="numeric block text-xs text-muted-foreground">{c.phone}</span>
                </span>
                {c.balance < 0 && (
                  <Badge tone="rose" size="sm">
                    {money(Math.abs(c.balance))}
                  </Badge>
                )}
              </button>
            </li>
          ))}
          {filteredCustomers.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">{labels.noResults}</li>
          )}
        </ul>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="numeric">{value}</span>
    </div>
  );
}
