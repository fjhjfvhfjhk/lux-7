/* ============================================================================
   ЛЮКС-7 · AMBIENT.JS — комнатный тон, тональный слой под игру.
   v3.0. Добавлена перекраска частотного слоя в тон игры:
     блэкджек — 174 Гц, рулетка — 146, кости — 196, хай-лоу — 155, слоты — 261.
   ============================================================================ */
(function () {
  'use strict';

  var AC = null;
  function ac() {
    if (!AC) { try { AC = window.__lux7AudioCtx || (window.__lux7AudioCtx = new (window.AudioContext || window.webkitAudioContext)()); } catch (e) {} }
    if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
    return AC;
  }
  function musicOn() {
    try { return localStorage.getItem('lux7_music') === '1'; } catch (e) { return false; }
  }
  function soundOn() {
    try { return localStorage.getItem('lux7_sound') !== '0'; } catch (e) { return true; }
  }

  /* -------------------- Тональный слой под игру ------------------------- */
  var TONE_FREQ = {
    blackjack: 174.61,   // F3 — спокойный фетр
    roulette:  146.83,   // D3 — глубокий кабинет
    dice:      196.00,   // G3 — индиго-холод
    highlow:   155.56,   // D#3 — синий
    slots:     261.63    // C4 — неон
  };
  var toneLayer = null;

  function ensureToneLayer() {
    if (toneLayer) return toneLayer;
    var c = ac(); if (!c) return null;
    try {
      var osc = c.createOscillator();
      var osc2 = c.createOscillator();
      var g = c.createGain();
      osc.type = 'sine'; osc.frequency.value = 174.61;
      osc2.type = 'sine'; osc2.frequency.value = 174.61 * 1.5;
      g.gain.value = 0;
      osc.connect(g); osc2.connect(g); g.connect(c.destination);
      osc.start(); osc2.start();
      toneLayer = { osc: osc, osc2: osc2, gain: g };
    } catch (e) { toneLayer = null; }
    return toneLayer;
  }

  function tuneTone(game) {
    var layer = ensureToneLayer();
    if (!layer) return;
    var c = ac(); if (!c) return;
    var f = TONE_FREQ[game] || 174.61;
    var target = game ? 0.010 : 0;
    try {
      layer.osc.frequency.linearRampToValueAtTime(f, c.currentTime + 1.2);
      layer.osc2.frequency.linearRampToValueAtTime(f * 1.5, c.currentTime + 1.2);
      layer.gain.gain.linearRampToValueAtTime(musicOn() ? target : 0, c.currentTime + 1.2);
    } catch (e) {}
  }

  /* -------------------- Комнатный тон (шумовой) ------------------------- */
  var roomNodes = null;
  function startRoom() {
    if (roomNodes) return;
    var c = ac(); if (!c) return;
    try {
      var bufSize = 2 * c.sampleRate;
      var buf = c.createBuffer(1, bufSize, c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      var src = c.createBufferSource();
      src.buffer = buf; src.loop = true;
      var bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.7;
      var master = c.createGain();
      master.gain.value = 0;
      src.connect(bp); bp.connect(master); master.connect(c.destination);
      src.start();
      master.gain.linearRampToValueAtTime(0.008, c.currentTime + 2);
      roomNodes = { src: src, master: master, bp: bp };
    } catch (e) { roomNodes = null; }
  }
  function stopRoom() {
    if (!roomNodes) return;
    var c = ac();
    try {
      if (c) roomNodes.master.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
      var nodes = roomNodes;
      setTimeout(function () { try { nodes.src.stop(); nodes.master.disconnect(); } catch (e) {} }, 900);
      roomNodes = null;
    } catch (e) { roomNodes = null; }
  }
  function tuneRoom(game) {
    if (!roomNodes) return;
    var c = ac(); if (!c) return;
    var f = { blackjack: 520, roulette: 380, dice: 620, highlow: 460, slots: 720 }[game] || 400;
    try { roomNodes.bp.frequency.linearRampToValueAtTime(f, c.currentTime + 1.2); } catch (e) {}
  }

  /* -------------------- Фоновые чипы ------------------------------------ */
  function chipTick() {
    if (musicOn() && document.body.dataset.game) {
      var c = ac();
      if (c) {
        try {
          var t = c.currentTime;
          var o = c.createOscillator();
          var g = c.createGain();
          o.type = 'triangle';
          o.frequency.setValueAtTime(1700 + Math.random() * 900, t);
          o.frequency.exponentialRampToValueAtTime(450, t + 0.09);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.0055, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
          o.connect(g); g.connect(c.destination);
          o.start(t); o.stop(t + 0.17);
        } catch (e) {}
      }
    }
    setTimeout(chipTick, 8000 + Math.random() * 7000);
  }

  /* -------------------- Реакция на смену игры --------------------------- */
  function reactToGame() {
    var g = document.body.dataset.game || '';
    if (g && musicOn()) {
      if (!roomNodes) startRoom();
      tuneRoom(g);
      tuneTone(g);
    } else if (!g) {
      tuneTone('');
    }
  }
  var obs = new MutationObserver(reactToGame);
  obs.observe(document.body, { attributes: true, attributeFilter: ['data-game'] });

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (!t.closest('#musbtn')) return;
    setTimeout(reactToGame, 120);
  }, true);

  window.addEventListener('load', function () {
    setTimeout(function () {
      var g = document.body.dataset.game;
      if (musicOn() && g) { startRoom(); tuneRoom(g); tuneTone(g); }
      chipTick();
    }, 600);
  });
})();
