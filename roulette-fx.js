/* ============================================================================
   ЛЮКС-7 · ROULETTE-FX.JS — атмосферный эффект выпадения числа (v2)
   Работает через polling класса #wheel — не зависит от пересоздания DOM.
   ============================================================================ */
(function () {
  'use strict';

  /* ======================= ЦВЕТА / ПАРАМЕТРЫ ============================= */
  var PALETTE = {
    red:   { rgb: '200,80,63',  border: 'rgba(220,110,95,.9)',  glow: 'rgba(200,80,63,.55)' },
    black: { rgb: '125,118,105', border: 'rgba(185,178,160,.85)', glow: 'rgba(140,130,110,.55)' },
    green: { rgb: '79,168,122', border: 'rgba(120,210,165,.9)', glow: 'rgba(79,168,122,.55)' }
  };
  var POLL_MS     = 100;
  var WAVE_MS     = 1400;
  var HOLD_MS     = 2200;
  var RING_DELAYS = [0, 150, 300, 450];
  var RING_SIZES  = ['22vmin', '44vmin', '68vmin', '94vmin'];

  var busyUntil = 0;
  var resetTimer = null;
  var lastWheelCls = '';
  var lastColorFired = '';

  /* ======================= СТИЛИ ========================================= */
  function injectStyles() {
    if (document.getElementById('roulette-fx-style')) return;
    var css =
      'body[data-rou="red"]  { --ambient:200,80,63;  }' +
      'body[data-rou="black"]{ --ambient:125,118,105; }' +
      'body[data-rou="green"]{ --ambient:79,168,122;  }' +
      'body[data-rou]{ background:radial-gradient(80% 65% at 50% 50%, rgba(var(--ambient), .30), var(--bg,#0d0b09) 72%); }' +
      'body{ transition:background 1.1s cubic-bezier(.2,1,.3,1), background-color .9s cubic-bezier(.2,1,.3,1); }' +

      /* Вспышка поверх всего, не ловит клики */
      '#rou-flash{position:fixed;inset:0;z-index:22;pointer-events:none;opacity:0}' +
      '#rou-flash.on{animation:rouFlash .55s ease-out}' +
      '@keyframes rouFlash{0%{opacity:0}18%{opacity:.9}100%{opacity:0}}' +

      /* Контейнер волн */
      '#roustage{isolation:isolate;position:relative}' +
      '#rou-rings{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:-1}' +
      '#rou-rings .rr{position:absolute;left:50%;top:50%;width:0;height:0;border-radius:50%;' +
        'border:4px solid var(--rr-c,rgba(220,110,95,.9));' +
        'box-shadow:0 0 22px var(--rr-g,rgba(200,80,63,.5)), inset 0 0 22px var(--rr-g,rgba(200,80,63,.5));' +
        'opacity:0;transform:translate(-50%,-50%);will-change:width,height,opacity,border-width}' +
      '#rou-rings.play .rr{animation:rouWave var(--rr-dur,1.4s) cubic-bezier(.2,.9,.3,1) forwards;animation-delay:var(--rr-delay,0ms)}' +
      '@keyframes rouWave{' +
        '0%  {width:0;height:0;opacity:1;border-width:12px}' +
        '55% {opacity:.55;border-width:3px}' +
        '100%{width:var(--rr-size,60vmin);height:var(--rr-size,60vmin);opacity:0;border-width:1px}' +
      '}';
    var s = document.createElement('style');
    s.id = 'roulette-fx-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ======================= РАЗМЕТКА ====================================== */
  function ensureFlashLayer() {
    if (document.getElementById('rou-flash')) return;
    var el = document.createElement('div');
    el.id = 'rou-flash';
    document.body.appendChild(el);
  }
  function ensureRings() {
    var stage = document.getElementById('roustage');
    if (!stage) return null;
    var existing = stage.querySelector('#rou-rings');
    if (existing) return existing;
    var wrap = document.createElement('div');
    wrap.id = 'rou-rings';
    var html = '';
    for (var i = 0; i < RING_DELAYS.length; i++) {
      html += '<span class="rr" style="--rr-size:' + RING_SIZES[i] +
              ';--rr-delay:' + RING_DELAYS[i] + 'ms;--rr-dur:' + WAVE_MS + 'ms"></span>';
    }
    wrap.innerHTML = html;
    stage.appendChild(wrap);
    return wrap;
  }
  function applyRingColors(color) {
    var rings = document.querySelectorAll('#rou-rings .rr');
    var p = PALETTE[color] || PALETTE.red;
    for (var i = 0; i < rings.length; i++) {
      rings[i].style.setProperty('--rr-c', p.border);
      rings[i].style.setProperty('--rr-g', p.glow);
    }
  }

  /* ======================= ЭФФЕКТ ======================================== */
  function fire(color) {
    if (!color || !PALETTE[color]) return;
    var p = PALETTE[color];

    document.body.dataset.rou = color;

    var rings = ensureRings();
    if (rings) {
      applyRingColors(color);
      rings.classList.remove('play');
      void rings.offsetWidth; // force reflow
      rings.classList.add('play');
    }

    var flash = document.getElementById('rou-flash');
    if (flash) {
      flash.style.background = 'radial-gradient(80% 60% at 50% 50%, rgba(' + p.rgb + ',.55), transparent 65%)';
      flash.classList.remove('on');
      void flash.offsetWidth;
      flash.classList.add('on');
    }

    playTone(color);

    clearTimeout(resetTimer);
    resetTimer = setTimeout(function () {
      delete document.body.dataset.rou;
      var r2 = document.getElementById('rou-rings');
      if (r2) r2.classList.remove('play');
    }, HOLD_MS);
  }

  /* ======================= ЗВУК ========================================== */
  function playTone(color) {
    try {
      var sound = localStorage.getItem('lux7_sound') !== '0';
      var music = localStorage.getItem('lux7_music') === '1';
      if (!sound && !music) return;
      var AC = window.__lux7AudioCtx;
      if (!AC) {
        try { AC = window.__lux7AudioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { return; }
      }
      if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
      var t = AC.currentTime;
      var base = color === 'green' ? 660 : (color === 'red' ? 330 : 220);
      var o1 = AC.createOscillator(), o2 = AC.createOscillator();
      var g = AC.createGain();
      o1.type = 'triangle'; o1.frequency.setValueAtTime(base, t);
      o1.frequency.exponentialRampToValueAtTime(base * 0.5, t + 0.35);
      o2.type = 'sine'; o2.frequency.setValueAtTime(base * 1.5, t);
      o2.frequency.exponentialRampToValueAtTime(base * 0.75, t + 0.35);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o1.connect(g); o2.connect(g); g.connect(AC.destination);
      o1.start(t); o2.start(t);
      o1.stop(t + 0.55); o2.stop(t + 0.55);
    } catch (e) {}
  }

  /* ======================= POLLING ======================================= */
  function parseColor(cls) {
    if (!cls) return null;
    if (cls.indexOf('green') >= 0) return 'green';
    if (cls.indexOf('red')   >= 0) return 'red';
    if (cls.indexOf('black') >= 0) return 'black';
    return null;
  }

  function poll() {
    var wheel = document.getElementById('wheel');
    if (wheel) {
      var cls = wheel.className || '';
      if (cls !== lastWheelCls) {
        var wasSpinning = lastWheelCls.indexOf('spinning') >= 0;
        var isSpinning  = cls.indexOf('spinning') >= 0;
        var color = parseColor(cls);
        if (color && !isSpinning) {
          var colorChanged = color !== lastColorFired;
          var justStopped = wasSpinning;
          if ((colorChanged || justStopped) && performance.now() >= busyUntil) {
            lastColorFired = color;
            busyUntil = performance.now() + 500;
            fire(color);
          }
        }
        lastWheelCls = cls;
      }
    }
    setTimeout(poll, POLL_MS);
  }

  /* ======================= BOOT ========================================== */
  function boot() {
    injectStyles();
    ensureFlashLayer();
    poll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ======================= ЭКСПОРТ ======================================= */
  window.LUX7RouletteFX = { fire: fire };
})();
