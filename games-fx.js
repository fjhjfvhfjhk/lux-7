/* ============================================================================
   ЛЮКС-7 · GAMES-FX.JS — win/lose анимации, звуковой слой игр, декор боссов.
   v3.0. Добавлено:
     • Звуковой слой каждой игры (барабаны, кости, карты, рулетка).
     • Усиленный vibrate при крупном проигрыше.
     • Тени боссов по краям экрана на 3/6/9 этажах.
   ============================================================================ */
(function () {
  'use strict';

  var POLL_MS = 70;
  var WIN_MS  = 1300;
  var LOSE_MS = 1000;

  var STAGE_IDS = ['slotstage', 'dicestage', 'hlstage', 'bjstage', 'roustage'];
  var prevCls = {};
  var winTimer = null, loseTimer = null;
  var prevBossFloor = -1;
  var prevBgmGame = '';
  var loopAudio = null;

  /* ======================= ЗВУК: Web Audio ============================== */
  var AC = null;
  function ac() {
    if (!AC) { try { AC = window.__lux7AudioCtx || (window.__lux7AudioCtx = new (window.AudioContext || window.webkitAudioContext)()); } catch (e) {} }
    if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
    return AC;
  }
  function isSoundOn() {
    try { return localStorage.getItem('lux7_sound') !== '0'; } catch (e) { return true; }
  }
  function tone(freq, dur, type, vol, when) {
    if (!isSoundOn()) return;
    var c = ac(); if (!c) return;
    try {
      var t = c.currentTime + (when || 0);
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol || 0.03, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }
  function stopLoopAudio() {
    if (loopAudio) {
      clearInterval(loopAudio.timer);
      loopAudio = null;
    }
  }
  function startLoopAudio(kind) {
    stopLoopAudio();
    if (!isSoundOn()) return;

    if (kind === 'slots') {
      loopAudio = {
        timer: setInterval(function () {
          if (!document.querySelector('#r0.spin,#r1.spin,#r2.spin')) return;
          var base = 1300 + Math.random() * 600;
          tone(base, 0.05, 'square', 0.018);
        }, 110)
      };
    } else if (kind === 'dice') {
      loopAudio = {
        timer: setInterval(function () {
          if (!document.querySelector('.d100.rolling')) return;
          tone(200 + Math.random() * 300, 0.07, 'sawtooth', 0.02);
        }, 130)
      };
    } else if (kind === 'roulette') {
      loopAudio = {
        timer: setInterval(function () {
          if (!document.querySelector('#wheel.spinning')) return;
          tone(2100 + Math.random() * 400, 0.03, 'square', 0.015);
        }, 95)
      };
    } else if (kind === 'blackjack') {
      loopAudio = {
        timer: setInterval(function () {
          // Шорох карт: короткий шумный импульс, пока на сцене раздаются
          if (!document.body.dataset.game || document.body.dataset.game !== 'blackjack') return;
          tone(900 + Math.random() * 400, 0.02, 'triangle', 0.008);
        }, 340)
      };
    }
  }

  /* ======================= CSS =========================================== */
  function injectStyles() {
    if (document.getElementById('games-fx-style')) return;
    var css =
      '#fx-overlay{position:fixed;inset:0;pointer-events:none;z-index:90;opacity:0;will-change:opacity,background;transition:opacity .25s}' +

      'body.fx-win[data-game="blackjack"] #fx-overlay{background:radial-gradient(65% 55% at 50% 45%, rgba(79,168,122,.42), transparent 72%);animation:fxPulseWin 1.25s ease-out}' +
      'body.fx-lose[data-game="blackjack"] #fx-overlay{background:radial-gradient(65% 55% at 50% 45%, rgba(200,80,63,.38), transparent 72%);animation:fxPulseLose .95s ease-out}' +
      'body.fx-win[data-game="blackjack"] .stage{animation:fxScaleUp .55s cubic-bezier(.2,1,.3,1)}' +
      '@keyframes fxScaleUp{0%{transform:scale(1)}45%{transform:scale(1.014)}100%{transform:scale(1)}}' +

      'body.fx-win[data-game="dice"] #fx-overlay{background:radial-gradient(55% 45% at 50% 50%, rgba(91,141,217,.42), transparent 70%);animation:fxPulseWin 1.1s ease-out}' +
      'body.fx-lose[data-game="dice"] #fx-overlay{background:radial-gradient(55% 45% at 50% 50%, rgba(200,80,63,.42), transparent 70%);animation:fxPulseLose .9s ease-out}' +

      'body.fx-win[data-game="highlow"] #fx-overlay{background:linear-gradient(180deg, rgba(91,141,217,.5) 0%, rgba(91,141,217,.15) 40%, transparent 75%);animation:fxWaveDown 1.25s cubic-bezier(.2,.9,.3,1)}' +
      'body.fx-lose[data-game="highlow"] #fx-overlay{background:linear-gradient(180deg, rgba(200,80,63,.4) 0%, transparent 70%);animation:fxWaveDown .9s cubic-bezier(.2,.9,.3,1)}' +

      'body.fx-win[data-game="slots"] #fx-overlay{background:radial-gradient(60% 50% at 50% 45%, rgba(217,77,224,.45), transparent 72%);animation:fxNeonFlash 1.25s ease-out}' +
      'body.fx-lose[data-game="slots"] #fx-overlay{background:radial-gradient(60% 50% at 50% 45%, rgba(200,80,63,.4), transparent 72%);animation:fxPulseLose .95s ease-out}' +

      'body.fx-win[data-game="roulette"] #fx-overlay{background:radial-gradient(55% 45% at 50% 50%, rgba(var(--ambient,217,164,65),.32), transparent 72%);animation:fxPulseWin 1.1s ease-out}' +

      '@keyframes fxPulseWin{0%{opacity:0}22%{opacity:1}100%{opacity:0}}' +
      '@keyframes fxPulseLose{0%{opacity:0}22%{opacity:1}100%{opacity:0}}' +
      '@keyframes fxWaveDown{0%{opacity:1;background-position:0 -40vh}100%{opacity:0;background-position:0 40vh}}' +
      '@keyframes fxNeonFlash{0%,100%{opacity:0}15%{opacity:1}30%{opacity:.5}45%{opacity:1}60%{opacity:.65}}' +

      '.d100{position:relative}' +
      '.d100.rolling::before{content:"";position:absolute;inset:-18px;border:2px dashed rgba(91,141,217,.55);border-radius:50%;animation:diceSwirl 1.1s linear infinite;pointer-events:none}' +
      '@keyframes diceSwirl{to{transform:rotate(360deg)}}' +

      '.reel{position:relative}' +
      '.reel.win::before{content:"";position:absolute;inset:-3px;border:2px solid #d94de0;border-radius:14px;box-shadow:0 0 24px #d94de0, inset 0 0 22px rgba(217,77,224,.6);animation:neonBlink .7s ease-out;pointer-events:none}' +
      '@keyframes neonBlink{0%{opacity:0}30%{opacity:1}60%{opacity:.4}100%{opacity:0}}' +

      'body.fx-win[data-game="blackjack"] .pcard:not(.back){box-shadow:0 3px 14px rgba(79,168,122,.35), 0 0 0 1px rgba(79,168,122,.35)}' +

      /* Тени боссов на 3/6/9 */
      '#boss-shadows{position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;transition:opacity .8s}' +
      '#boss-shadows.on{opacity:.16}' +
      '#boss-shadows .bs{position:absolute;width:220px;height:220px;color:#ff8a7a;filter:blur(3px);animation:bsDrift 14s ease-in-out infinite}' +
      '#boss-shadows .bs svg{width:100%;height:100%}' +
      '#boss-shadows .bs-1{left:-70px;top:18%;animation-delay:0s}' +
      '#boss-shadows .bs-2{right:-70px;top:50%;animation-delay:3.5s;transform:scaleX(-1)}' +
      '#boss-shadows .bs-3{left:40%;bottom:-60px;animation-delay:7s}' +
      '@keyframes bsDrift{0%,100%{transform:translate(0,0) rotate(0)}33%{transform:translate(30px,-24px) rotate(4deg)}66%{transform:translate(-20px,20px) rotate(-4deg)}}' +
      '#boss-shadows .bs-2{animation-name:bsDrift2}' +
      '@keyframes bsDrift2{0%,100%{transform:scaleX(-1) translate(0,0) rotate(0)}33%{transform:scaleX(-1) translate(-30px,-24px) rotate(-4deg)}66%{transform:scaleX(-1) translate(20px,20px) rotate(4deg)}}' +

      '@media (max-width:899px){' +
        'body.fx-win[data-game="blackjack"] .stage,body.fx-win[data-game="dice"] .stage{animation-duration:.45s}' +
        '#boss-shadows{opacity:0 !important}' +
      '}' +

      '@media (prefers-reduced-motion:reduce){' +
        '#fx-overlay{animation:none!important}' +
        '.d100.rolling::before,.reel.win::before,#boss-shadows .bs{animation:none!important}' +
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

  function ensureBossShadows() {
    if (document.getElementById('boss-shadows')) return;
    var wrap = document.createElement('div');
    wrap.id = 'boss-shadows';
    var icon = function (id) {
      return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" style="stroke-width:1;fill:none;stroke:currentColor"><use href="#' + id + '"/></svg>';
    };
    wrap.innerHTML =
      '<div class="bs bs-1">' + icon('b-cheat') + '</div>' +
      '<div class="bs bs-2">' + icon('b-inspector') + '</div>' +
      '<div class="bs bs-3">' + icon('b-keeper') + '</div>';
    document.body.appendChild(wrap);
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
    try { if (navigator.vibrate) navigator.vibrate([20, 40, 20]); } catch (e) {}
    winTimer = setTimeout(function () { document.body.classList.remove('fx-win'); }, WIN_MS);
  }
  function fireLose(intensity) {
    clearTimeout(winTimer); clearTimeout(loseTimer);
    clearFx();
    void document.body.offsetWidth;
    document.body.classList.add('fx-lose');
    try {
      if (navigator.vibrate) {
        if (intensity === 'big') navigator.vibrate([120, 60, 120, 60, 220]);
        else navigator.vibrate([60, 40, 60]);
      }
    } catch (e) {}
    loseTimer = setTimeout(function () { document.body.classList.remove('fx-lose'); }, LOSE_MS);
  }

  /* ======================= POLLING ======================================= */
  function readChips() {
    var cv = document.getElementById('chipval');
    if (!cv) return null;
    return parseInt(String(cv.textContent).replace(/\D/g, ''), 10) || 0;
  }
  var prevChips = null;

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
        else if (hasLose && !hadLose) {
          var cur = readChips();
          var intensity = (cur !== null && prevChips !== null && prevChips - cur >= 500) ? 'big' : 'normal';
          fireLose(intensity);
        }
        prevCls[id] = cls;
      }
    }

    // Тени боссов на 3/6/9
    var S = null;
    try { S = (typeof S !== 'undefined') ? S : null; } catch (e) {}
    var floor = S && S.floor ? S.floor : 0;
    if (floor !== prevBossFloor) {
      prevBossFloor = floor;
      var wrap = document.getElementById('boss-shadows');
      if (wrap) wrap.classList.toggle('on', floor === 3 || floor === 6 || floor === 9);
    }

    // Звуковой слой игры
    var g = document.body.dataset.game || '';
    if (g !== prevBgmGame) {
      prevBgmGame = g;
      startLoopAudio(g);
    }

    prevChips = readChips();
    setTimeout(poll, POLL_MS);
  }

  function boot() {
    injectStyles();
    ensureOverlay();
    ensureBossShadows();
    poll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.LUX7GamesFX = { win: fireWin, lose: fireLose };
})();
