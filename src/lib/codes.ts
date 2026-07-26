import 'server-only';

import QRCode from 'qrcode';

/**
 * توليد رموز QR والباركود كصور data URL جاهزة للطباعة.
 * كل التوليد يتم على الخادم لتفادي تحميل مكتبات ثقيلة في المتصفح.
 */

/** رمز QR بصيغة data URL (PNG) */
export async function generateQrDataUrl(
  text: string,
  options: { size?: number; margin?: number } = {},
): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: options.size ?? 200,
      margin: options.margin ?? 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch (error) {
    console.error('[codes] فشل توليد QR:', error);
    return '';
  }
}

/** رمز QR بصيغة SVG (أوضح عند الطباعة) */
export async function generateQrSvg(text: string, size = 200): Promise<string> {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  } catch (error) {
    console.error('[codes] فشل توليد QR SVG:', error);
    return '';
  }
}

/**
 * باركود خطي بصيغة data URL (PNG).
 * يختار الترميز تلقائياً: EAN-13 للأرقام ذات 13 خانة، وCode128 لغيرها.
 */
export async function generateBarcodeDataUrl(
  text: string,
  options: { height?: number; includeText?: boolean; scale?: number } = {},
): Promise<string> {
  if (!text) return '';
  try {
    // نستورد نسخة Node صراحةً — نسخة المتصفح تحتاج canvas
    const bwipjs = await import('bwip-js/node');
    const isEan13 = /^\d{13}$/.test(text);

    const buffer = await bwipjs.toBuffer({
      bcid: isEan13 ? 'ean13' : 'code128',
      text,
      scale: options.scale ?? 3,
      height: options.height ?? 12,
      includetext: options.includeText ?? true,
      textxalign: 'center',
      textsize: 9,
      backgroundcolor: 'FFFFFF',
      paddingwidth: 2,
      paddingheight: 2,
    });

    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('[codes] فشل توليد الباركود:', error);
    return '';
  }
}

/** رابط تتبع أمر الصيانة العام */
export function trackingUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/track/${token}`;
}
