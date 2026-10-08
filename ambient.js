/* ============================================================================
   ЛЮКС-7 · AMBIENT.JS — комнатный тон и мягкие звуки зала.
   Подключается ПОСЛЕ app.js. Работает только когда включена музыка.
   ============================================================================ */
(function(){
  'use strict';

  var AC = null;
  function ac(){
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
    if (AC && AC.state === 'suspended') { try { AC.resume(); } catch(e){} }
    return AC;
  }
  function musicOn(){
    try { return localStorage.getItem('lux7_music') === '1'; } catch(e){ return false; }
  }

  /* ---------- 1. Комнатный тон ---------- */
  var roomNodes = null;
  function startRoom(){
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
      master.gain.linearRampToValueAtTime(0.009, c.currentTime + 2);

      roomNodes = { src: src, master: master, bp: bp };
    } catch(e){ roomNodes = null; }
  }
  function stopRoom(){
    if (!roomNodes) return;
    var c = ac();
    try {
      if (c) roomNodes.master.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
      var nodes = roomNodes;
      setTimeout(function(){
        try { nodes.src.stop(); nodes.master.disconnect(); } catch(e){}
      }, 900);
      roomNodes = null;
    } catch(e){ roomNodes = null; }
  }
  function tuneRoom(game){
    if (!roomNodes) return;
    var c = ac(); if (!c) return;
    var freqs = { blackjack: 520, roulette: 380, dice: 620, highlow: 460, slots: 720 };
    var f = freqs[game] || 400;
    try { roomNodes.bp.frequency.linearRampToValueAtTime(f, c.currentTime + 1.2); } catch(e){}
  }

  /* ---------- 2. Мягкие "чипы" в фоне (раз в 8–15 сек) ---------- */
  function chipTick(){
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
        } catch(e){}
      }
    }
    setTimeout(chipTick, 8000 + Math.random() * 7000);
  }

  /* ---------- 3. Реакция на смену игровой темы ---------- */
  var obs = new MutationObserver(function(){
    var g = document.body.dataset.game;
    if (g && musicOn()) {
      if (!roomNodes) startRoom();
      tuneRoom(g);
    } else if (!g) {
      stopRoom();
    }
  });
  obs.observe(document.body, { attributes: true, attributeFilter: ['data-game'] });

  /* ---------- 4. Реакция на тумблер музыки ---------- */
  document.addEventListener('click', function(e){
    var t = e.target;
    if (!t || !t.closest) return;
    if (!t.closest('#musbtn')) return;
    setTimeout(function(){
      var g = document.body.dataset.game;
      if (musicOn() && g) { startRoom(); tuneRoom(g); }
      else if (!musicOn()) { stopRoom(); }
    }, 120);
  }, true);

  /* ---------- 5. Первый запуск ---------- */
  window.addEventListener('load', function(){
    setTimeout(function(){
      var g = document.body.dataset.game;
      if (musicOn() && g) { startRoom(); tuneRoom(g); }
      chipTick();
    }, 600);
  });
})();
