/**
 * سكربت يعمل قبل رسم الصفحة لتطبيق السمة (فاتح/داكن) فوراً
 * ومنع «وميض» الوضع الخاطئ عند التحميل.
 */
export function ThemeScript({ defaultTheme = 'system' }: { defaultTheme?: string }) {
  const code = `
(function(){
  try {
    var stored = localStorage.getItem('roka_theme') || ${JSON.stringify(defaultTheme)};
    var isDark = stored === 'dark' ||
      (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.dataset.theme = stored;
  } catch (e) {}
})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
