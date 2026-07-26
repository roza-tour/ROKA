'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Search } from 'lucide-react';
import { addRepairItemAction, removeRepairItemAction } from '@/app/actions/repairs';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { formatMoney, cn, round } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

interface Item {
  id: string;
  kind: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

interface ServiceOption {
  id: string;
  code: string;
  name: string;
  price: number;
  cost: number;
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  sellPrice: number;
  costPrice: number;
  quantity: number;
}

export function RepairItemsEditor({
  repairId,
  items,
  services,
  products,
  canEdit,
  currency,
  decimals,
  locale,
  labels,
}: {
  repairId: string;
  items: Item[];
  services: ServiceOption[];
  products: ProductOption[];
  canEdit: boolean;
  currency: string;
  decimals: number;
  locale: Locale;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState<'SERVICE' | 'PART' | null>(null);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const money = (v: number) => formatMoney(v, { currency, decimals, locale });
  const total = round(items.reduce((sum, i) => sum + i.total, 0));

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services.slice(0, 60);
    return services
      .filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
      .slice(0, 60);
  }, [services, search]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 60);
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 60);
  }, [products, search]);

  function add(item: Parameters<typeof addRepairItemAction>[1]) {
    startTransition(async () => {
      const result = await addRepairItemAction(repairId, item);
      if (result.ok) {
        toast.success(result.message ?? 'تمت الإضافة');
        setPicker(null);
        setSearch('');
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّرت الإضافة');
      }
    });
  }

  function remove(itemId: string) {
    startTransition(async () => {
      const result = await removeRepairItemAction(itemId);
      if (result.ok) {
        toast.success(result.message ?? 'تم الحذف');
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّر الحذف');
      }
    });
  }

  return (
    <>
      {canEdit && (
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPicker('SERVICE')}
            icon={<Plus className="h-3.5 w-3.5" />}
            disabled={pending}
          >
            {labels.addService}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPicker('PART')}
            icon={<Plus className="h-3.5 w-3.5" />}
            disabled={pending}
          >
            {labels.addPart}
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>{labels.item}</th>
                <th className="w-20 text-center">{labels.quantity}</th>
                <th className="w-28 text-end">{labels.unitPrice}</th>
                <th className="w-24 text-end">{labels.discount}</th>
                <th className="w-28 text-end">{labels.total}</th>
                {canEdit && <th className="w-12" />}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="text-sm">{item.name}</span>
                    <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {item.kind === 'SERVICE'
                        ? labels.service
                        : item.kind === 'PART'
                          ? labels.part
                          : '—'}
                    </span>
                  </td>
                  <td className="numeric text-center">{item.quantity}</td>
                  <td className="numeric text-end">{money(item.unitPrice)}</td>
                  <td className="numeric text-end">
                    {item.discount ? money(item.discount) : '—'}
                  </td>
                  <td className="numeric text-end font-medium">{money(item.total)}</td>
                  {canEdit && (
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => setDeleteId(item.id)}
                        disabled={pending}
                        className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                        aria-label={labels.remove}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40">
              <tr>
                <td colSpan={4} className="text-end font-medium">
                  {labels.total}
                </td>
                <td className="numeric text-end text-base font-bold">{money(total)}</td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* اختيار خدمة أو قطعة */}
      <Dialog
        open={picker !== null}
        onClose={() => {
          setPicker(null);
          setSearch('');
        }}
        title={picker === 'SERVICE' ? labels.addService : labels.addPart}
        size="lg"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={labels.search}
          leading={<Search className="h-4 w-4" />}
          autoFocus
        />
        <div className="mt-3 max-h-[55vh] overflow-y-auto">
          {picker === 'SERVICE' ? (
            filteredServices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {labels.noResults}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filteredServices.map((service) => (
                  <li key={service.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        add({
                          kind: 'SERVICE',
                          serviceId: service.id,
                          name: service.name,
                          quantity: 1,
                          unitPrice: service.price,
                          unitCost: service.cost,
                        })
                      }
                      className="flex w-full items-center justify-between gap-3 px-2 py-2.5 text-start transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{service.name}</span>
                        <span className="numeric block text-[11px] text-muted-foreground">
                          {service.code}
                        </span>
                      </span>
                      <span className="numeric shrink-0 text-sm font-semibold text-primary">
                        {money(service.price)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : filteredProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{labels.noResults}</p>
          ) : (
            <ul className="divide-y divide-border">
              {filteredProducts.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    disabled={pending || product.quantity <= 0}
                    onClick={() =>
                      add({
                        kind: 'PART',
                        productId: product.id,
                        name: product.name,
                        quantity: 1,
                        unitPrice: product.sellPrice,
                        unitCost: product.costPrice,
                      })
                    }
                    className="flex w-full items-center justify-between gap-3 px-2 py-2.5 text-start transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{product.name}</span>
                      <span className="numeric block text-[11px] text-muted-foreground">
                        {product.sku}
                      </span>
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="numeric block text-sm font-semibold text-primary">
                        {money(product.sellPrice)}
                      </span>
                      <span
                        className={cn(
                          'numeric block text-[11px]',
                          product.quantity <= 0 ? 'text-danger' : 'text-muted-foreground',
                        )}
                      >
                        {labels.stock}: {product.quantity}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) remove(deleteId);
        }}
        title={labels.remove}
        message="سيتم حذف البند، وإرجاع القطعة إلى المخزون إن كانت قطعة غيار."
      />
    </>
  );
}
