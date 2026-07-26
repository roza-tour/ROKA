import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { getFinanceSettings, getShopInfo } from '@/lib/settings';
import { db } from '@/lib/db';
import { generateBarcodeDataUrl } from '@/lib/codes';
import { formatMoney } from '@/lib/utils';
import { PrintTrigger } from '@/components/print-trigger';
import { BarcodeSheetControls } from './controls';

export const metadata: Metadata = { title: 'طباعة باركود' };
export const dynamic = 'force-dynamic';

/**
 * ورقة ملصقات باركود قابلة للطباعة (A4، 5×13 ملصق).
 * عدد النسخ يُمرَّر عبر ?count=
 */
export default async function BarcodeSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('inventory:view');
  const { locale, t } = await getI18n();
  const [finance, shop] = await Promise.all([getFinanceSettings(), getShopInfo()]);
  const { id } = await params;
  const search = await searchParams;

  const count = Math.min(65, Math.max(1, Number(search.count) || 24));
  const showPrice = search.price !== '0';

  const product = await db.product.findUnique({
    where: { id },
    select: { name: true, sku: true, barcode: true, sellPrice: true },
  });

  if (!product) notFound();

  const code = product.barcode ?? product.sku;
  const barcodeImage = await generateBarcodeDataUrl(code, {
    height: 10,
    scale: 2,
    includeText: false,
  });

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-black">
      <div className="no-print">
        <PrintTrigger label={t.product.printBarcode} backLabel={t.app.back} />
        <BarcodeSheetControls
          productId={id}
          count={count}
          showPrice={showPrice}
          labels={{ count: 'عدد الملصقات', price: 'إظهار السعر', apply: t.app.apply }}
        />
      </div>

      <div className="grid grid-cols-5 gap-1 p-2">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center border border-dashed border-gray-300 p-1 text-center print-avoid-break"
            style={{ height: '20mm' }}
          >
            <p className="w-full truncate text-[7px] font-medium leading-tight">
              {shop.name}
            </p>
            <p className="w-full truncate text-[7px] leading-tight text-gray-700">
              {product.name}
            </p>
            {barcodeImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={barcodeImage} alt={code} className="my-0.5 h-[8mm] w-auto" />
            )}
            <p className="font-mono text-[6px] leading-none" dir="ltr">
              {code}
            </p>
            {showPrice && (
              <p className="text-[8px] font-bold leading-tight" dir="ltr">
                {money(product.sellPrice)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
