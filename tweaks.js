/* ============================================================================
   ЛЮКС-7 · TWEAKS.JS — минорные правки поверх app.js.
   Подключается последним. Не требует изменений в app.js.
     • Поднимает потолок ставки: этаж × 200 (на 5 этаже = 1000, доступна «Кит»).
     • Выдаёт стартовый набор предметов при новом забеге.
     • Показывает подсказку, как получать предметы (один раз).
   ============================================================================ */
(function () {
  'use strict';

  var HINT_KEY = 'lux7_items_hint_v1';
  var STARTER_KEY = 'lux7_starter_used_v1';

  /* ----------------------- 1. Патч maxBet() ---------------------------- */
  function patchMaxBet() {
    if (typeof window.maxBet !== 'function') return false;
    window.maxBet = function () {
      var S = window.S || null;
      if (!S) { try { S = eval('typeof S !== "undefined" ? S : null'); } catch (e) {} }
      var floor = (S && S.floor) || 1;
      return Math.max(200, floor * 200);
    };
    return true;
  }

  /* ----------------------- 2. Обёртка newRun() -------------------------- */
  function patchNewRun() {
    if (typeof window.newRun !== 'function') return false;
    if (window.__newRunPatched) return true;
    window.__newRunPatched = true;
    var orig = window.newRun;
    window.newRun = function () {
      try { localStorage.removeItem(STARTER_KEY); } catch (e) {}
      var result = orig.apply(this, arguments);
      setTimeout(giveStarter, 500);
      setTimeout(showHintOnce, 1400);
      return result;
    };
    return true;
  }

  /* ----------------------- 3. Стартовый набор -------------------------- */
  function giveStarter() {
    var S = window.S;
    if (!S || S.over || S.screen !== 'hub') return;
    if (S.floor !== 1 || S.chips !== 100) return;
    try { if (localStorage.getItem(STARTER_KEY)) return; } catch (e) {}
    try { localStorage.setItem(STARTER_KEY, '1'); } catch (e) {}
    var api = window.LUX7Items;
    if (!api) return;
    api.give('gem');
    api.give('chest');
    setTimeout(function () {
      makeToast('Стартовый набор: Самоцвет и Сундук', 'gold');
    }, 500);
  }

  /* ----------------------- 4. Подсказка про предметы -------------------- */
  function showHintOnce() {
    try { if (localStorage.getItem(HINT_KEY)) return; } catch (e) {}
    try { localStorage.setItem(HINT_KEY, '1'); } catch (e) {}
    setTimeout(function () {
      makeToast('Предметы падают за крупные выигрыши (+100 и больше)', 'good', 3200);
    }, 1800);
  }

  /* Мини-тост — свою функцию из items.js не экспортируем, чтобы не связываться */
  function makeToast(text, type, ms) {
    var root = document.getElementById('toasts');
    if (!root) return;
    var t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = text;
    root.appendChild(t);
    var dur = ms || 2200;
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { t.remove(); }, 320);
    }, dur);
  }

  /* ----------------------- 5. Boot -------------------------------------- */
  function boot() {
    // app.js определяет maxBet/newRun только после своего выполнения,
    // поэтому поллимся, пока они не появятся.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var ok1 = patchMaxBet();
      var ok2 = patchNewRun();
      if ((ok1 && ok2) || tries > 40) clearInterval(iv);
    }, 100);

    // Стартовый набор / подсказка — тоже поллингом, на случай,
    // если S появился чуть позже.
    setInterval(giveStarter, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.LUX7Tweaks = {
    patchMaxBet: patchMaxBet,
    giveStarter: giveStarter
  };
})();
