/* ============================================================================
   ЛЮКС-7 · GAMES-FX.JS — win/lose-анимации и декор для игр (v2).
   Оверлей вынесен в отдельный <div>, а не body::after — исключает
   участие в flex-раскладке и любые сдвиги контента.
   ============================================================================ */
(function () {
  'use strict';

  var POLL_MS = 70;
  var WIN_MS  = 1300;
  var LOSE_MS = 1000;

  var STAGE_IDS = ['slotstage', 'dicestage', 'hlstage', 'bjstage', 'roustage'];
  var prevCls = {};
  var winTimer = null, loseTimer = null;

  /* ======================= CSS =========================================== */
  function injectStyles() {
    if (document.getElementById('games-fx-style')) return;
    var css =

      /* Оверлей — отдельный слой, position:fixed, никак не влияет на layout */
      '#fx-overlay{position:fixed;inset:0;pointer-events:none;z-index:90;opacity:0;' +
        'will-change:opacity,background;transition:opacity .25s}' +

      /* Блэкджек */
      'body.fx-win[data-game="blackjack"] #fx-overlay{background:radial-gradient(65% 55% at 50% 45%, rgba(79,168,122,.42), transparent 72%);animation:fxPulseWin 1.25s ease-out}' +
      'body.fx-lose[data-game="blackjack"] #fx-overlay{background:radial-gradient(65% 55% at 50% 45%, rgba(200,80,63,.38), transparent 72%);animation:fxPulseLose .95s ease-out}' +
      'body.fx-win[data-game="blackjack"] .stage{animation:fxScaleUp .55s cubic-bezier(.2,1,.3,1)}' +
      '@keyframes fxScaleUp{0%{transform:scale(1)}45%{transform:scale(1.014)}100%{transform:scale(1)}}' +

      /* Кости */
      'body.fx-win[data-game="dice"] #fx-overlay{background:radial-gradient(55% 45% at 50% 50%, rgba(91,141,217,.42), transparent 70%);animation:fxPulseWin 1.1s ease-out}' +
      'body.fx-lose[data-game="dice"] #fx-overlay{background:radial-gradient(55% 45% at 50% 50%, rgba(200,80,63,.42), transparent 70%);animation:fxPulseLose .9s ease-out}' +

      /* Хай-Лоу */
      'body.fx-win[data-game="highlow"] #fx-overlay{background:linear-gradient(180deg, rgba(91,141,217,.5) 0%, rgba(91,141,217,.15) 40%, transparent 75%);animation:fxWaveDown 1.25s cubic-bezier(.2,.9,.3,1)}' +
      'body.fx-lose[data-game="highlow"] #fx-overlay{background:linear-gradient(180deg, rgba(200,80,63,.4) 0%, transparent 70%);animation:fxWaveDown .9s cubic-bezier(.2,.9,.3,1)}' +

      /* Слоты */
      'body.fx-win[data-game="slots"] #fx-overlay{background:radial-gradient(60% 50% at 50% 45%, rgba(217,77,224,.45), transparent 72%);animation:fxNeonFlash 1.25s ease-out}' +
      'body.fx-lose[data-game="slots"] #fx-overlay{background:radial-gradient(60% 50% at 50% 45%, rgba(200,80,63,.4), transparent 72%);animation:fxPulseLose .95s ease-out}' +

      /* Рулетка */
      'body.fx-win[data-game="roulette"] #fx-overlay{background:radial-gradient(55% 45% at 50% 50%, rgba(var(--ambient,217,164,65),.32), transparent 72%);animation:fxPulseWin 1.1s ease-out}' +

      /* Keyframes */
      '@keyframes fxPulseWin{0%{opacity:0}22%{opacity:1}100%{opacity:0}}' +
      '@keyframes fxPulseLose{0%{opacity:0}22%{opacity:1}100%{opacity:0}}' +
      '@keyframes fxWaveDown{0%{opacity:1;background-position:0 -40vh}100%{opacity:0;background-position:0 40vh}}' +
      '@keyframes fxNeonFlash{0%,100%{opacity:0}15%{opacity:1}30%{opacity:.5}45%{opacity:1}60%{opacity:.65}}' +

      /* Декор: вихрь вокруг d100 */
      '.d100{position:relative}' +
      '.d100.rolling::before{content:"";position:absolute;inset:-18px;border:2px dashed rgba(91,141,217,.55);border-radius:50%;animation:diceSwirl 1.1s linear infinite;pointer-events:none}' +
      '@keyframes diceSwirl{to{transform:rotate(360deg)}}' +

      /* Декор: неоновая вспышка на выигравшем барабане */
      '.reel{position:relative}' +
      '.reel.win::before{content:"";position:absolute;inset:-3px;border:2px solid #d94de0;border-radius:14px;box-shadow:0 0 24px #d94de0, inset 0 0 22px rgba(217,77,224,.6);animation:neonBlink .7s ease-out;pointer-events:none}' +
      '@keyframes neonBlink{0%{opacity:0}30%{opacity:1}60%{opacity:.4}100%{opacity:0}}' +

      /* Декор: подсветка карт при победе в БД */
      'body.fx-win[data-game="blackjack"] .pcard:not(.back){box-shadow:0 3px 14px rgba(79,168,122,.35), 0 0 0 1px rgba(79,168,122,.35)}' +

      '@media (max-width:899px){' +
        'body.fx-win[data-game="blackjack"] .stage,body.fx-win[data-game="dice"] .stage{animation-duration:.45s}' +
      '}' +

      '@media (prefers-reduced-motion:reduce){' +
        '#fx-overlay{animation:none!important}' +
        '.d100.rolling::before,.reel.win::before{animation:none!important}' +
      '}';

    var s = document.createElement('style');
    s.id = 'games-fx-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function ensureOverlay() {
    if (document.getElementById('fx-overlay')) return;
    var el = document.createElement('div');
    el.id = 'fx-overlay';
    document.body.appendChild(el);
  }

  /* ======================= ТРИГГЕРЫ ====================================== */
  function clearFx() {
    document.body.classList.remove('fx-win', 'fx-lose');
  }
  function fireWin() {
    clearTimeout(winTimer); clearTimeout(loseTimer);
    clearFx();
    void document.body.offsetWidth;
    document.body.classList.add('fx-win');
    winTimer = setTimeout(function () { document.body.classList.remove('fx-win'); }, WIN_MS);
  }
  function fireLose() {
    clearTimeout(winTimer); clearTimeout(loseTimer);
    clearFx();
    void document.body.offsetWidth;
    document.body.classList.add('fx-lose');
    loseTimer = setTimeout(function () { document.body.classList.remove('fx-lose'); }, LOSE_MS);
  }

  /* ======================= POLLING ======================================= */
  function poll() {
    for (var k = 0; k < STAGE_IDS.length; k++) {
      var id = STAGE_IDS[k];
      var el = document.getElementById(id);
      if (!el) { prevCls[id] = ''; continue; }
      var cls = el.className || '';
      var prev = prevCls[id] || '';
      if (cls !== prev) {
        var hadWin  = prev.indexOf('win')  >= 0;
        var hasWin  = cls.indexOf('win')   >= 0;
        var hadLose = prev.indexOf('lose') >= 0;
        var hasLose = cls.indexOf('lose')  >= 0;
        if (hasWin && !hadWin) fireWin();
        else if (hasLose && !hadLose) fireLose();
        prevCls[id] = cls;
      }
    }
    setTimeout(poll, POLL_MS);
  }

  function boot() {
    injectStyles();
    ensureOverlay();
    poll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.LUX7GamesFX = { win: fireWin, lose: fireLose };
})();
