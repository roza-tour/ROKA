/**
 * تعريفات أنواع لحزمة bidi-js — الحزمة لا تشحن أنواعاً خاصة بها.
 * نعرّف فقط ما نستخدمه فعلاً: حساب مستويات التضمين وفق خوارزمية
 * Unicode ثنائية الاتجاه (UBA).
 */
declare module 'bidi-js' {
  export interface EmbeddingLevels {
    /** مستوى التضمين لكل محرف — الفردي = من اليمين لليسار */
    levels: Uint8Array;
    /** حدود كل فقرة واتجاهها الأساسي */
    paragraphs: { start: number; end: number; level: number }[];
  }

  export interface Bidi {
    getEmbeddingLevels(text: string, explicitDirection?: 'ltr' | 'rtl'): EmbeddingLevels;
    getReorderSegments(
      text: string,
      embeddingLevels: EmbeddingLevels,
      start?: number,
      end?: number,
    ): [number, number][];
    getReorderedIndices(
      text: string,
      embeddingLevels: EmbeddingLevels,
      start?: number,
      end?: number,
    ): number[];
    getReorderedString(text: string, embeddingLevels: EmbeddingLevels): string;
    getMirroredCharacter(char: string): string | null;
  }

  export default function bidiFactory(): Bidi;
}
