/* ============================================================================
   ЛЮКС-7 · TWEAKS.JS (v3) — минимальный и безопасный.
   Две задачи:
     1) maxBet: этаж × 200 (чтобы «Кит» была достижима).
     2) Очистка инвентаря при старте нового забега.
   Все обращения к S — в try/catch, чтобы не сломать сайт, если S ещё нет.
   ============================================================================ */
(function () {
  'use strict';

  /* -------------------- Чтение номера этажа ----------------------------- */
  function readFloor() {
    // 1. Пробуем S напрямую (lexical scope app.js)
    try {
      if (typeof S !== 'undefined' && S && typeof S.floor === 'number') return S.floor;
    } catch (e) {}
    // 2. Fallback — из заголовка «Этаж N / 10»
    try {
      var el = document.querySelector('.hdr-title small');
      if (el) {
        var m = String(el.textContent).match(/Этаж\s+(\d+)/i);
        if (m) return parseInt(m[1], 10) || 1;
      }
    } catch (e) {}
    return 1;
  }

  /* -------------------- 1. Патч maxBet ---------------------------------- */
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (typeof window.maxBet === 'function' && !window.__lux7_mbPatched) {
      window.maxBet = function () {
        return Math.max(200, readFloor() * 200);
      };
      window.__lux7_mbPatched = true;
    }
    if (window.__lux7_mbPatched || tries > 60) clearInterval(iv);
  }, 100);

  /* -------------------- 2. Очистка инвентаря на новом забеге ------------ */
  var wasInGame = false;
  setInterval(function () {
    var scr = '';
    try {
      if (typeof S !== 'undefined' && S && S.screen) scr = S.screen;
    } catch (e) {}
    if (scr === 'class') {
      if (wasInGame) {
        try {
          if (window.LUX7Items && typeof window.LUX7Items.clear === 'function') {
            window.LUX7Items.clear();
          }
        } catch (e) {}
        wasInGame = false;
      }
    } else if (scr) {
      wasInGame = true;
    }
  }, 500);

})();
