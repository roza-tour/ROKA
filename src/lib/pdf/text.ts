import bidiFactory from 'bidi-js';
import type PDFDocument from 'pdfkit';

/**
 * محرّك النص ثنائي الاتجاه (BiDi) لملفات PDF.
 *
 * لماذا نحتاجه؟
 * ------------------------------------------------------------------
 * pdfkit يعتمد على fontkit الذي **يشكّل** الحروف العربية بشكل صحيح
 * (الأشكال الأولية/الوسطية/النهائية والليجاتورات)، لكنه **يرصّ الكلمات من
 * اليسار إلى اليمين**. النتيجة أن جملة مثل «فاتورة ضريبية» تُطبع مقلوبة
 * الكلمات: «ضريبية فاتورة». كما أنه لا ينفّذ خوارزمية Unicode ثنائية
 * الاتجاه (UBA)، فتختلط الأرقام والنصوص اللاتينية داخل الجملة العربية.
 *
 * الحل هنا:
 *   1. نحسب مستويات التضمين (embedding levels) عبر bidi-js — تنفيذ كامل لـ UBA.
 *   2. نقسّم النص إلى مقاطع متساوية المستوى، ونرتّبها بصرياً وفق القاعدة L2.
 *   3. داخل كل مقطع نقسّم إلى كلمات ونعكس ترتيبها إن كان المقطع RTL.
 *   4. نرسم **كل كلمة على حدة بإحداثي x صريح** — الكلمة المفردة يشكّلها
 *      fontkit بشكل مثالي، وبهذا نتحكّم نحن في الترتيب والتباعد والمحاذاة.
 *
 * كل دوال هذا الملف نقيّة بالنسبة للمستند: لا تغيّر الخط أو الحجم، بل
 * تستخدم ما هو مضبوط حالياً على `doc`.
 */

const bidi = bidiFactory();

export type Align = 'start' | 'end' | 'center' | 'left' | 'right';
export type Direction = 'rtl' | 'ltr';

/** الأقواس والرموز التي تُعكس بصرياً في السياق من اليمين لليسار */
const MIRRORED: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
  '«': '»',
  '»': '«',
  '‹': '›',
  '›': '‹',
};

function mirrorChars(text: string): string {
  return text.replace(/[()[\]{}<>«»‹›]/g, (c) => MIRRORED[c] ?? c);
}

/**
 * محارف تحكّم الاتجاه غير المرئية: LRM وRLM وALM وعلامات التضمين والعزل.
 *
 * `Intl.DateTimeFormat` بلغة عربية يحقن U+200F داخل التواريخ
 * («‏23/‏07/2026»). في المتصفح هذه المحارف مفيدة، أما هنا فهي ضارّة مرّتين:
 *   1. لا يملك الخط رسماً لها فتظهر مربّعاً فارغاً ▯.
 *   2. تقلب ترتيب أجزاء التاريخ لأننا نحدّد الاتجاه صراحةً لكل نداء أصلاً.
 * لذا نزيلها عند مدخل المحرّك.
 */
const BIDI_CONTROLS = /[‎‏؜‪-‮⁦-⁩]/g;

/** ينظّف النص من محارف التحكّم قبل أي قياس أو رسم */
export function sanitize(text: string): string {
  return text.replace(BIDI_CONTROLS, '');
}

interface Token {
  /** نص الكلمة بترتيبها المنطقي — fontkit يتكفّل بتشكيلها */
  text: string;
  /** هل هذه فجوة بين كلمتين؟ */
  space: boolean;
}

/**
 * يحوّل نصاً منطقياً إلى سلسلة كلمات بالترتيب البصري الصحيح.
 * مُصدَّرة لأغراض الاختبار.
 */
export function visualTokens(raw: string, baseDir: Direction): Token[] {
  const text = sanitize(raw);
  if (!text) return [];

  const { levels } = bidi.getEmbeddingLevels(text, baseDir);

  // 1) مقاطع متتالية متساوية المستوى
  const runs: { start: number; end: number; level: number }[] = [];
  for (let i = 0; i < text.length; i++) {
    const level = levels[i];
    const last = runs[runs.length - 1];
    if (last && last.level === level) last.end = i + 1;
    else runs.push({ start: i, end: i + 1, level });
  }

  // 2) القاعدة L2: من أعلى مستوى نزولاً حتى أدنى مستوى فردي، اعكس كل
  //    سلسلة متجاورة من المقاطع التي مستواها >= المستوى الحالي.
  let maxLevel = 0;
  let minOdd = Number.MAX_SAFE_INTEGER;
  for (const run of runs) {
    if (run.level > maxLevel) maxLevel = run.level;
    if (run.level % 2 === 1 && run.level < minOdd) minOdd = run.level;
  }

  const ordered = runs.slice();
  for (let level = maxLevel; level >= minOdd; level--) {
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].level < level) continue;
      let j = i;
      while (j + 1 < ordered.length && ordered[j + 1].level >= level) j++;
      const segment = ordered.slice(i, j + 1).reverse();
      ordered.splice(i, segment.length, ...segment);
      i = j;
    }
  }

  // 3) تقسيم كل مقطع إلى كلمات + عكس ترتيبها داخل المقاطع RTL
  const tokens: Token[] = [];
  for (const run of ordered) {
    const slice = text.slice(run.start, run.end);
    const rtl = run.level % 2 === 1;
    const parts = slice.split(/(\s+)/).filter((part) => part.length > 0);
    const sequence = rtl ? parts.slice().reverse() : parts;

    for (const part of sequence) {
      if (/^\s+$/.test(part)) tokens.push({ text: ' ', space: true });
      else tokens.push({ text: rtl ? mirrorChars(part) : part, space: false });
    }
  }

  // تنظيف الفجوات الطرفية والمكرّرة
  const cleaned: Token[] = [];
  for (const token of tokens) {
    if (token.space && (cleaned.length === 0 || cleaned[cleaned.length - 1].space)) continue;
    cleaned.push(token);
  }
  while (cleaned.length > 0 && cleaned[cleaned.length - 1].space) cleaned.pop();

  return cleaned;
}

type Doc = InstanceType<typeof PDFDocument>;

interface Measured {
  tokens: (Token & { width: number })[];
  width: number;
}

function measure(doc: Doc, text: string, baseDir: Direction): Measured {
  const spaceWidth = doc.widthOfString(' ');
  const tokens = visualTokens(text, baseDir).map((token) => ({
    ...token,
    width: token.space ? spaceWidth : doc.widthOfString(token.text),
  }));
  return { tokens, width: tokens.reduce((sum, token) => sum + token.width, 0) };
}

/** عرض النص بالخط والحجم الحاليين — بديل آمن لـ doc.widthOfString للنص العربي */
export function textWidth(doc: Doc, text: string, baseDir: Direction = 'rtl'): number {
  return measure(doc, text, baseDir).width;
}

function resolveAlign(align: Align, baseDir: Direction): 'left' | 'right' | 'center' {
  if (align === 'center') return 'center';
  if (align === 'left' || align === 'right') return align;
  const isStart = align === 'start';
  if (baseDir === 'rtl') return isStart ? 'right' : 'left';
  return isStart ? 'left' : 'right';
}

export interface DrawTextOptions {
  align?: Align;
  baseDir?: Direction;
  /** قصّ النص بـ «…» إن تجاوز العرض بدل الالتفاف */
  ellipsis?: boolean;
}

/**
 * يرسم سطراً واحداً داخل صندوق بعرض `width` — دون التفاف.
 * يُرجع العرض الفعلي المرسوم.
 */
export function drawText(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  width: number,
  options: DrawTextOptions = {},
): number {
  const baseDir = options.baseDir ?? 'rtl';
  const align = resolveAlign(options.align ?? 'start', baseDir);
  let measured = measure(doc, text, baseDir);

  if (options.ellipsis && measured.width > width) {
    // نقصّ من نهاية النص المنطقي حتى يتّسع، ثم نعيد الحساب
    let candidate = sanitize(text);
    while (candidate.length > 1 && measure(doc, `${candidate}…`, baseDir).width > width) {
      candidate = candidate.slice(0, -1);
    }
    measured = measure(doc, `${candidate.trimEnd()}…`, baseDir);
  }

  let cursor = x;
  if (align === 'right') cursor = x + width - measured.width;
  else if (align === 'center') cursor = x + (width - measured.width) / 2;

  for (const token of measured.tokens) {
    if (!token.space) doc.text(token.text, cursor, y, { lineBreak: false });
    cursor += token.width;
  }

  return measured.width;
}

export interface DrawParagraphOptions extends DrawTextOptions {
  lineGap?: number;
  /** أقصى عدد أسطر — ما زاد يُقصّ بـ «…» */
  maxLines?: number;
}

/**
 * يرسم فقرة مع التفاف تلقائي واحترام أسطر `\n` الصريحة.
 * يُرجع الارتفاع الكلي المرسوم.
 */
export function drawParagraph(
  doc: Doc,
  raw: string,
  x: number,
  y: number,
  width: number,
  options: DrawParagraphOptions = {},
): number {
  const text = sanitize(raw);
  if (!text) return 0;

  const baseDir = options.baseDir ?? 'rtl';
  const align = resolveAlign(options.align ?? 'start', baseDir);
  const lineHeight = doc.currentLineHeight() + (options.lineGap ?? 2);
  const spaceWidth = doc.widthOfString(' ');

  // نلتفّ على مستوى الكلمات المنطقية ثم نرتّب كل سطر بصرياً على حدة —
  // هذا هو التصرّف الصحيح: خوارزمية BiDi تُطبَّق على السطر بعد الالتفاف.
  const logicalLines = text.split(/\r?\n/);
  const wrapped: string[] = [];

  for (const logicalLine of logicalLines) {
    const words = logicalLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      wrapped.push('');
      continue;
    }
    let current = '';
    let currentWidth = 0;
    for (const word of words) {
      const wordWidth = doc.widthOfString(word);
      const extra = current ? spaceWidth + wordWidth : wordWidth;
      if (current && currentWidth + extra > width) {
        wrapped.push(current);
        current = word;
        currentWidth = wordWidth;
      } else {
        current = current ? `${current} ${word}` : word;
        currentWidth += extra;
      }
    }
    if (current) wrapped.push(current);
  }

  const limit = options.maxLines ?? wrapped.length;
  const lines = wrapped.slice(0, limit);
  const truncated = wrapped.length > limit;

  lines.forEach((line, index) => {
    const isLast = index === lines.length - 1;
    const content = truncated && isLast ? `${line}…` : line;
    if (content) {
      drawText(doc, content, x, y + index * lineHeight, width, { align, baseDir });
    }
  });

  return lines.length * lineHeight;
}

/** ارتفاع فقرة لو رُسمت — بدون رسم (لحساب التخطيط مسبقاً) */
export function paragraphHeight(
  doc: Doc,
  raw: string,
  width: number,
  options: { lineGap?: number; maxLines?: number } = {},
): number {
  const text = sanitize(raw);
  if (!text) return 0;
  const lineHeight = doc.currentLineHeight() + (options.lineGap ?? 2);
  const spaceWidth = doc.widthOfString(' ');
  let count = 0;

  for (const logicalLine of text.split(/\r?\n/)) {
    const words = logicalLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      count += 1;
      continue;
    }
    let current = '';
    let currentWidth = 0;
    for (const word of words) {
      const wordWidth = doc.widthOfString(word);
      const extra = current ? spaceWidth + wordWidth : wordWidth;
      if (current && currentWidth + extra > width) {
        count += 1;
        current = word;
        currentWidth = wordWidth;
      } else {
        current = current ? `${current} ${word}` : word;
        currentWidth += extra;
      }
    }
    if (current) count += 1;
  }

  return Math.min(count, options.maxLines ?? count) * lineHeight;
}
