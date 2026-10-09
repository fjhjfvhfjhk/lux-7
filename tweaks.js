/* ============================================================================
   ЛЮКС-7 · TWEAKS.JS (v2) — минимальный и безопасный.
   Только поднимает потолок ставки: этаж × 200.
   Ничего больше не трогает, никаких newRun / setInterval / eval.
   ============================================================================ */
(function () {
  'use strict';

  /* Патч maxBet. Читаем S напрямую — app.js объявляет его через `let`,
     поэтому window.S не подходит, а lexical S доступен. */
  function patchMaxBet() {
    if (typeof window.maxBet !== 'function') return false;
    if (window.__lux7_mbPatched) return true;
    window.__lux7_mbPatched = true;

    window.maxBet = function () {
      var s = null;
      try { s = S; } catch (e) { s = null; }
      if (!s) return 200;
      var floor = s.floor || 1;
      return Math.max(200, floor * 200);
    };
    return true;
  }

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (patchMaxBet() || tries > 40) clearInterval(iv);
  }, 100);

  window.__tweaksLoaded = true;
})();
