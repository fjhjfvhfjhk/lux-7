/* ============================================================================
   ЛЮКС-7 · ITEMS.JS — инвентарь (v2.7)
   Боковая выезжающая панель справа. FAB в углу.
   Самодостаточный. S читается из глобальной lexical scope app.js.
   ============================================================================ */
(function () {
  'use strict';

  var STORE_KEY     = 'lux7_items_v1';
  var MAX_SLOTS     = 10;
  var DROP_MIN      = 150;
  var DRAG_HOLD_MS  = 380;
  var DROP_GUARD_MS = 3000;
  var SUPPRESS_MS   = 2500;

  var ITEMS = {
    gem:   { icon:'i-gem',   rarity:'common', name:'Самоцвет',     desc:'+200 фишек сразу' },
    chest: { icon:'i-chest', rarity:'common', name:'Сундук',       desc:'Открывает 2 случайных предмета' },
    ward:  { icon:'i-ward',  rarity:'rare',   name:'Оберег',       desc:'Снимает проклятие текущего этажа' },
    lucky: { icon:'i-lucky', rarity:'rare',   name:'Клевер',       desc:'Следующая потеря фишек вернётся' },
    ace:   { icon:'i-ace',   rarity:'epic',   name:'Туз в рукаве', desc:'+500 фишек сразу' },
    joker: { icon:'i-joker', rarity:'epic',   name:'Джокер',       desc:'Удваивает баланс (до +3000)' }
  };
  var RARITY_W = { common: 7, rare: 3, epic: 1 };

  var inv = [];
  var refundNextLoss = false;
  var lastChips = -1;
  var dropGuardUntil = 0;
  var suppressUntil = 0;
  var isOpen = false;

  var dragSrc = -1;
  var dragTimer = null;
  var dragGhost = null;
  var dragStartPos = null;
  var dragReady = false;
  var tipEl = null;

  function $(s) { return document.querySelector(s); }

  function loadInv() {
    try { var r = localStorage.getItem(STORE_KEY); inv = r ? JSON.parse(r) : []; }
    catch (e) { inv = []; }
    if (!Array.isArray(inv)) inv = [];
    inv = inv.filter(function (id) { return id && ITEMS[id]; });
    if (inv.length > MAX_SLOTS) inv = inv.slice(0, MAX_SLOTS);
  }
  function saveInv() { try { localStorage.setItem(STORE_KEY, JSON.stringify(inv)); } catch (e) {} }
  function ico(name, size) {
    size = size || 20;
    return '<svg class="ico" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + name + '"/></svg>';
  }
  function toast(msg, type, iconName) {
    var root = document.getElementById('toasts');
    if (!root) return;
    var t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    if (iconName) t.innerHTML = ico(iconName, 16) + '<span>' + msg + '</span>';
    else t.textContent = msg;
    root.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, 1700);
  }
  function getS() {
    if (typeof window.S !== 'undefined' && window.S) return window.S;
    try { if (typeof S !== 'undefined' && S) return S; } catch (e) {}
    return null;
  }
  function isBusy() {
    if (typeof window.busy !== 'undefined' && window.busy) return true;
    try { if (typeof busy !== 'undefined' && busy) return true; } catch (e) {}
    return false;
  }
  function refreshChipsLight() {
    var S = getS(); if (!S) return;
    var cv = document.getElementById('chipval');
    if (cv) { try { cv.textContent = S.chips.toLocaleString('ru-RU'); } catch (e) {} }
    var cs = document.getElementById('chipsub');
    if (cs) {
      var sub = 'фишек';
      try {
        if (S.peak > 100) sub += ' · пик ' + S.peak.toLocaleString('ru-RU');
        if (S.winStreak > 0) sub += ' · серия ' + S.winStreak;
      } catch (e) {}
      cs.textContent = sub;
    }
  }
  function refreshGameUI(full) {
    try {
      if (full && typeof window.render === 'function') { window.render(); return; }
      if (typeof window.refreshDynamic === 'function') { window.refreshDynamic(); return; }
      if (typeof window.render === 'function') window.render();
    } catch (e) {}
  }

  function randomItemId() {
    var ids = Object.keys(ITEMS);
    var total = 0;
    for (var i = 0; i < ids.length; i++) total += RARITY_W[ITEMS[ids[i]].rarity];
    var r = Math.random() * total;
    for (var j = 0; j < ids.length; j++) {
      r -= RARITY_W[ITEMS[ids[j]].rarity];
      if (r <= 0) return ids[j];
    }
    return 'gem';
  }

  function addItem(id, silent) {
    if (!ITEMS[id]) return false;
    if (inv.length >= MAX_SLOTS) { if (!silent) toast('Инвентарь полон', 'bad'); return false; }
    inv.push(id); saveInv(); renderGrid(true); renderFab();
    return true;
  }
  function removeItemAt(i) {
    if (i < 0 || i >= inv.length) return;
    inv.splice(i, 1);
    saveInv(); renderGrid(); renderFab();
  }

  function useItem(i) {
    var id = inv[i];
    if (!id || !ITEMS[id]) return;
    var it = ITEMS[id];
    var S = getS();
    if (!S) { toast('Игра ещё не готова', 'bad'); return; }
    if (S.over) { toast('Забег окончен', 'bad'); return; }
    if (S.screen === 'class') { toast('Сначала выберите класс', 'bad'); return; }

    var consumed = true;
    switch (id) {
      case 'gem':  S.chips += 200; if (S.chips > S.peak) S.peak = S.chips; toast('+200 фишек', 'good', it.icon); break;
      case 'ace':  S.chips += 500; if (S.chips > S.peak) S.peak = S.chips; toast('+500 фишек!', 'gold', it.icon); break;
      case 'joker': {
        var gain = Math.min(3000, S.chips);
        if (gain <= 0) { toast('Нечего удваивать', 'bad'); consumed = false; break; }
        S.chips += gain; if (S.chips > S.peak) S.peak = S.chips;
        toast('+' + gain + ' фишек!', 'gold', it.icon);
        break;
      }
      case 'ward':
        if (!S.curse) { toast('Нет проклятия', 'bad'); consumed = false; break; }
        S.curse = null; toast('Проклятие снято', 'good', it.icon); break;
      case 'lucky':
        if (refundNextLoss) { toast('Уже активно', 'bad'); consumed = false; break; }
        refundNextLoss = true; toast('Клевер: следующая потеря вернётся', 'good', it.icon); break;
      case 'chest': {
        var opened = 0;
        for (var k = 0; k < 2; k++) {
          if (inv.length >= MAX_SLOTS) break;
          inv.push(randomItemId()); opened++;
        }
        saveInv();
        if (opened === 0) { toast('Инвентарь полон', 'bad'); consumed = false; break; }
        toast('Открыто: ' + opened + ' предм.', 'gold', it.icon);
        break;
      }
    }

    if (consumed) {
      suppressUntil = performance.now() + SUPPRESS_MS;
      removeItemAt(i);
      if (isBusy()) refreshChipsLight();
      else refreshGameUI(true);
    } else {
      renderGrid();
    }
    renderFab();
  }

  function watchChips() {
    var cv = document.getElementById('chipval');
    if (cv) {
      var cur = parseInt(String(cv.textContent).replace(/\D/g, ''), 10) || 0;
      if (lastChips >= 0 && cur !== lastChips) {
        var delta = cur - lastChips;
        var inGame = !!document.body.dataset.game;

        if (delta < 0 && refundNextLoss && inGame) {
          refundNextLoss = false;
          var S = getS();
          if (S) {
            S.chips += -delta;
            if (S.chips > S.peak) S.peak = S.chips;
            toast('Клевер: +' + (-delta) + ' фишек', 'good', 'i-lucky');
            if (!isBusy()) refreshGameUI(false);
          }
        }

        if (inGame && delta >= DROP_MIN && performance.now() > dropGuardUntil && performance.now() > suppressUntil) {
          var chance = delta >= 2000 ? 0.60 : (delta >= 500 ? 0.40 : 0.22);
          if (Math.random() < chance) {
            dropGuardUntil = performance.now() + DROP_GUARD_MS;
            var rid = randomItemId();
            var it = ITEMS[rid];
            if (addItem(rid, true)) {
              setTimeout(function () { toast('Найден: ' + it.name, 'gold', it.icon); }, 250);
            }
          }
        }
      }
      lastChips = cur;
    }
    setTimeout(watchChips, 350);
  }

  /* ======================= РЕНДЕР ======================================= */
  function renderGrid(flashNew) {
    var grid = document.getElementById('inv-grid');
    if (!grid) return;
    var cnt = document.getElementById('inv-count');
    var filled = inv.filter(Boolean).length;
    if (cnt) cnt.textContent = filled + '/' + MAX_SLOTS;
    var prevFilled = grid.querySelectorAll('.inv-slot:not(.empty)').length;

    var html = '';
    for (var i = 0; i < MAX_SLOTS; i++) {
      var id = inv[i];
      if (id && ITEMS[id]) {
        var it = ITEMS[id];
        html += '<div class="inv-slot ' + it.rarity + '" data-i="' + i + '" data-id="' + id + '">' +
          ico(it.icon, 34) + '<span class="inv-rarity"></span></div>';
      } else {
        html += '<div class="inv-slot empty" data-i="' + i + '"></div>';
      }
    }
    grid.innerHTML = html;

    if (flashNew && filled > prevFilled) {
      var slots = grid.querySelectorAll('.inv-slot:not(.empty)');
      var last = slots[slots.length - 1];
      if (last) { last.classList.add('flash-new'); setTimeout(function () { last.classList.remove('flash-new'); }, 800); }
    }
    bindSlots();
  }

  function renderFab() {
    var fab = document.getElementById('inv-fab');
    if (!fab) return;
    var filled = inv.filter(Boolean).length;
    var badge = fab.querySelector('.inv-fab-badge');
    if (badge) {
      if (filled > 0) { badge.textContent = filled; badge.style.display = ''; }
      else badge.style.display = 'none';
    }
    fab.classList.toggle('has-items', filled > 0);
  }

  function bindSlots() {
    var slots = document.querySelectorAll('.inv-slot:not(.empty)');
    for (var k = 0; k < slots.length; k++) {
      (function (slot) {
        slot.onpointerdown = onPointerDown;
        slot.onmouseenter = onHover;
        slot.onmouseleave = onLeave;
      })(slots[k]);
    }
  }

  /* ======================= ОТКРЫТИЕ / ЗАКРЫТИЕ ========================== */
  function openPanel() {
    isOpen = true;
    var overlay = document.getElementById('inv-overlay');
    var panel = document.getElementById('inv-panel');
    var fab = document.getElementById('inv-fab');
    if (overlay) overlay.classList.add('on');
    if (panel) panel.classList.add('on');
    if (fab) fab.classList.add('hidden');
    renderGrid();
    renderFab();
  }
  function closePanel() {
    isOpen = false;
    var overlay = document.getElementById('inv-overlay');
    var panel = document.getElementById('inv-panel');
    var fab = document.getElementById('inv-fab');
    if (overlay) overlay.classList.remove('on');
    if (panel) panel.classList.remove('on');
    if (fab) fab.classList.remove('hidden');
  }
  function togglePanel() { if (isOpen) closePanel(); else openPanel(); }

  /* ======================= DRAG-AND-DROP ================================ */
  function onPointerDown(e) {
    var i = parseInt(e.currentTarget.dataset.i, 10);
    if (isNaN(i) || !inv[i]) return;
    dragSrc = i;
    dragStartPos = { x: e.clientX, y: e.clientY };
    dragReady = false;
    clearTimeout(dragTimer);
    dragTimer = setTimeout(function () {
      dragReady = true;
      startGhost(e.clientX, e.clientY, inv[dragSrc]);
      var src = document.querySelector('.inv-slot[data-i="' + dragSrc + '"]');
      if (src) src.classList.add('dragging');
    }, DRAG_HOLD_MS);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    try { e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  }

  function onPointerMove(e) {
    if (!dragStartPos) return;
    var dx = e.clientX - dragStartPos.x;
    var dy = e.clientY - dragStartPos.y;
    if (!dragReady && Math.sqrt(dx * dx + dy * dy) > 14) {
      clearTimeout(dragTimer);
      dragReady = true;
      startGhost(e.clientX, e.clientY, inv[dragSrc]);
      var src = document.querySelector('.inv-slot[data-i="' + dragSrc + '"]');
      if (src) src.classList.add('dragging');
    }
    if (dragReady && dragGhost) {
      dragGhost.style.left = e.clientX + 'px';
      dragGhost.style.top = e.clientY + 'px';
      var targets = document.querySelectorAll('.inv-slot.drop-target');
      for (var k = 0; k < targets.length; k++) targets[k].classList.remove('drop-target');
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var tgt = el && el.closest ? el.closest('.inv-slot') : null;
      if (tgt && parseInt(tgt.dataset.i, 10) !== dragSrc) tgt.classList.add('drop-target');
    }
  }

  function onPointerUp(e) {
    clearTimeout(dragTimer);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    var stray = document.querySelectorAll('.inv-slot.dragging, .inv-slot.drop-target');
    for (var k = 0; k < stray.length; k++) {
      stray[k].classList.remove('dragging');
      stray[k].classList.remove('drop-target');
    }
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }

    if (dragReady && dragSrc >= 0) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var tgt = el && el.closest ? el.closest('.inv-slot') : null;
      if (tgt) {
        var ti = parseInt(tgt.dataset.i, 10);
        if (!isNaN(ti) && ti !== dragSrc && ti >= 0 && ti < MAX_SLOTS) {
          while (inv.length < MAX_SLOTS) inv.push(null);
          var tmp = inv[dragSrc];
          inv[dragSrc] = inv[ti];
          inv[ti] = tmp;
          while (inv.length && inv[inv.length - 1] === null) inv.pop();
          saveInv(); renderGrid();
        }
      }
    } else if (dragSrc >= 0) {
      useItem(dragSrc);
    }
    dragSrc = -1;
    dragReady = false;
    dragStartPos = null;
  }

  function startGhost(x, y, id) {
    if (!ITEMS[id]) return;
    dragGhost = document.createElement('div');
    dragGhost.id = 'inv-ghost';
    dragGhost.innerHTML = ico(ITEMS[id].icon, 30);
    dragGhost.style.left = x + 'px';
    dragGhost.style.top = y + 'px';
    document.body.appendChild(dragGhost);
  }

  /* ======================= TOOLTIP ====================================== */
  function ensureTip() {
    if (tipEl && document.body.contains(tipEl)) return tipEl;
    tipEl = document.createElement('div');
    tipEl.id = 'inv-tip';
    document.body.appendChild(tipEl);
    return tipEl;
  }
  function onHover(e) {
    if (!window.matchMedia('(hover: hover)').matches) return;
    var id = e.currentTarget.dataset.id;
    if (!id || !ITEMS[id]) return;
    var it = ITEMS[id];
    var t = ensureTip();
    t.innerHTML = '<div class="tt-name ' + it.rarity + '">' + ico(it.icon, 14) + it.name + '</div><div class="tt-desc">' + it.desc + '</div>';
    var r = e.currentTarget.getBoundingClientRect();
    var tipW = 220;
    var left = r.left - tipW - 12;
    if (left < 8) left = r.right + 12;
    if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
    t.style.left = left + 'px';
    t.style.top = Math.max(8, Math.min(window.innerHeight - 100, r.top)) + 'px';
    t.classList.add('on');
  }
  function onLeave() { if (tipEl) tipEl.classList.remove('on'); }

  /* ======================= CSS =========================================== */
  function injectStyles() {
    if (document.getElementById('items-style')) return;
    var css =

      /* ---------- FAB ---------- */
      '#inv-fab{position:fixed;z-index:32;bottom:calc(20px + env(safe-area-inset-bottom,0px));right:14px;width:56px;height:56px;border-radius:50%;background:linear-gradient(180deg,#f7dc85,#c9922f);border:none;cursor:pointer;display:grid;place-items:center;color:#241a06;box-shadow:0 12px 26px rgba(0,0,0,.55),0 0 0 0 rgba(217,164,65,.55);transition:transform .25s,opacity .25s,box-shadow .3s;animation:fabPulse 3s ease-in-out infinite}' +
      '#inv-fab:hover{transform:translateY(-2px) scale(1.04)}' +
      '#inv-fab:active{transform:scale(.94)}' +
      '#inv-fab svg{width:26px;height:26px}' +
      '#inv-fab .inv-fab-badge{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#c8503f;color:#fff;font-size:11px;font-weight:800;display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.5);font-variant-numeric:tabular-nums}' +
      '#inv-fab.has-items{animation:fabPulse 3s ease-in-out infinite}' +
      '#inv-fab.hidden{opacity:0;pointer-events:none;transform:scale(.6)}' +
      '@keyframes fabPulse{0%,100%{box-shadow:0 12px 26px rgba(0,0,0,.55),0 0 0 0 rgba(217,164,65,.55)}50%{box-shadow:0 12px 26px rgba(0,0,0,.55),0 0 0 14px rgba(217,164,65,0)}}' +
      '@media (min-width:900px){' +
        '#inv-fab{bottom:auto;top:50%;right:22px;transform:translateY(-50%);width:64px;height:64px}' +
        '#inv-fab:hover{transform:translateY(calc(-50% - 2px)) scale(1.05)}' +
        '#inv-fab.hidden{transform:translateY(-50%) scale(.6)}' +
      '}' +

      /* ---------- Overlay ---------- */
      '#inv-overlay{position:fixed;inset:0;z-index:33;background:rgba(6,5,4,.5);backdrop-filter:blur(4px);opacity:0;pointer-events:none;transition:opacity .28s}' +
      '#inv-overlay.on{opacity:1;pointer-events:auto}' +

      /* ---------- Боковая панель справа ---------- */
      '#inv-panel{position:fixed;top:0;right:0;bottom:0;z-index:34;' +
        'width:min(340px,86vw);' +
        'padding:calc(env(safe-area-inset-top,0px) + 20px) 16px calc(env(safe-area-inset-bottom,0px) + 22px);' +
        'background:linear-gradient(180deg,#251b12,#140d08);' +
        'border-left:1px solid #4a3b24;' +
        'border-radius:20px 0 0 20px;' +
        'box-shadow:-24px 0 60px rgba(0,0,0,.65), inset 1px 0 0 rgba(242,201,107,.05);' +
        'transform:translateX(103%);' +
        'transition:transform .38s cubic-bezier(.2,1,.3,1);' +
        'overflow-y:auto;' +
        'overscroll-behavior:contain;-webkit-overflow-scrolling:touch}' +
      '#inv-panel.on{transform:translateX(0)}' +

      '@media (min-width:900px){' +
        '#inv-panel{width:400px;border-radius:22px 0 0 22px;padding:28px 22px 24px}' +
      '}' +

      '.inv-panel-head{display:flex;align-items:center;gap:10px;margin-bottom:18px}' +
      '.inv-panel-head .inv-ico{width:32px;height:32px;color:#f2c96b;display:grid;place-items:center}' +
      '.inv-panel-head h3{font-family:Georgia,serif;font-size:17px;color:#f2c96b;letter-spacing:.14em;text-transform:uppercase;margin:0;flex:1}' +
      '.inv-panel-head .inv-count-tag{font-size:11px;color:var(--mut);font-weight:700;font-variant-numeric:tabular-nums}' +
      '.inv-panel-head .inv-close{width:34px;height:34px;border-radius:10px;border:1px solid #4a3b24;background:#1e1610;color:var(--mut);cursor:pointer;display:grid;place-items:center;font-size:20px;line-height:1;padding:0;transition:.15s}' +
      '.inv-panel-head .inv-close:active{transform:scale(.92);color:#f2c96b;border-color:#8a6a24}' +
      '.inv-panel-hint{font-size:11px;color:var(--mut);text-align:center;margin-top:16px;line-height:1.5}' +

      /* ---------- Сетка ---------- */
      '.inv-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}' +
      '@media (min-width:900px){.inv-grid{gap:10px}}' +

      '.inv-slot{aspect-ratio:1;border-radius:12px;background:linear-gradient(180deg,#2a1f15,#1a120c);border:1.5px solid #4a3b24;display:grid;place-items:center;position:relative;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:transform .15s,border-color .2s,box-shadow .2s,background .25s}' +
      '.inv-slot.empty{background:rgba(42,34,22,.3);border-style:dashed;border-color:#382d1c;cursor:default}' +
      '.inv-slot.empty::before{content:"";width:6px;height:6px;border-radius:50%;background:rgba(154,141,118,.3)}' +
      '.inv-slot:not(.empty):active{transform:scale(.92)}' +
      '.inv-slot:not(.empty):hover{border-color:#8a6a24;box-shadow:0 0 22px rgba(217,164,65,.18),inset 0 0 12px rgba(217,164,65,.08)}' +
      '.inv-slot.dragging{opacity:.35}' +
      '.inv-slot.drop-target{background:rgba(217,164,65,.18);border-color:#f2c96b;box-shadow:0 0 22px rgba(242,201,107,.5),inset 0 0 14px rgba(242,201,107,.25)}' +
      '.inv-slot svg{pointer-events:none;width:56%;height:56%;position:relative;z-index:1}' +
      '.inv-slot .inv-rarity{position:absolute;top:5px;right:5px;width:7px;height:7px;border-radius:50%;box-shadow:0 0 8px currentColor}' +
      '.inv-slot.common{border-color:#5a4a2c}' +
      '.inv-slot.common svg{color:#c9b78e}' +
      '.inv-slot.common .inv-rarity{background:#c9b78e;color:#c9b78e}' +
      '.inv-slot.rare{border-color:#3a5c8a;box-shadow:inset 0 0 12px rgba(91,141,217,.14)}' +
      '.inv-slot.rare svg{color:#9bbaf5}' +
      '.inv-slot.rare .inv-rarity{background:#9bbaf5;color:#9bbaf5}' +
      '.inv-slot.epic{border-color:#8a6a24;animation:epicShimmer 3s ease-in-out infinite}' +
      '.inv-slot.epic svg{color:#f2c96b}' +
      '.inv-slot.epic .inv-rarity{background:#f2c96b;color:#f2c96b}' +

      '#inv-ghost{position:fixed;width:58px;height:58px;z-index:400;pointer-events:none;display:grid;place-items:center;background:#1a120c;border:2px solid #f2c96b;border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.7);transform:translate(-50%,-50%);color:#f2c96b}' +
      '#inv-ghost svg{width:34px;height:34px}' +

      '#inv-tip{position:fixed;z-index:500;max-width:240px;padding:10px 14px;background:rgba(20,16,10,.98);border:1px solid #4a3b24;border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.75);font-size:12.5px;line-height:1.45;pointer-events:none;opacity:0;transition:opacity .15s}' +
      '#inv-tip.on{opacity:1}' +
      '#inv-tip .tt-name{font-weight:800;margin-bottom:4px;display:flex;align-items:center;gap:7px;font-size:13px}' +
      '#inv-tip .tt-name.common{color:#c9b78e}' +
      '#inv-tip .tt-name.rare{color:#9bbaf5}' +
      '#inv-tip .tt-name.epic{color:#f2c96b}' +
      '#inv-tip .tt-desc{color:var(--mut);font-size:11.5px}' +

      '.inv-slot.flash-new{animation:invDrop .75s cubic-bezier(.34,1.56,.64,1)}' +
      '@keyframes invDrop{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.18) rotate(4deg);opacity:1}100%{transform:none}}' +
      '@keyframes epicShimmer{0%,100%{box-shadow:inset 0 0 12px rgba(217,164,65,.18),0 0 10px rgba(217,164,65,.15)}50%{box-shadow:inset 0 0 16px rgba(217,164,65,.32),0 0 26px rgba(217,164,65,.4)}}';

    var s = document.createElement('style');
    s.id = 'items-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function injectSymbols() {
    var sprite = document.querySelector('svg.sprite');
    if (!sprite || document.getElementById('i-gem')) return;
    var defs =
      '<symbol id="i-gem" viewBox="0 0 24 24"><path d="M12 3 L20 9 L12 21 L4 9 Z"/><path d="M12 3 L16 9 L12 21 L8 9 Z" opacity=".5"/><path d="M4 9 L20 9" opacity=".6"/></symbol>' +
      '<symbol id="i-chest" viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="11" rx="1.5"/><path d="M3 13 L21 13"/><path d="M3 9 Q3 5 12 5 Q21 5 21 9"/><circle cx="12" cy="15" r="1.2" class="fill-fg"/></symbol>' +
      '<symbol id="i-ward" viewBox="0 0 24 24"><path d="M12 3 L20 6 L20 12 Q20 18 12 21 Q4 18 4 12 L4 6 Z"/><path d="M12 9 L12 15 M9 12 L15 12" stroke-width="1.8"/></symbol>' +
      '<symbol id="i-lucky" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><circle cx="12" cy="16" r="3"/><circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/></symbol>' +
      '<symbol id="i-ace" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 7 Q9 10 9 11.5 Q9 13 10.5 13 Q11 13 11.5 12.5 Q11.5 14 10.5 15 L13.5 15 Q12.5 14 12.5 12.5 Q13 13 13.5 13 Q15 13 15 11.5 Q15 10 12 7 Z" class="fill-fg" stroke-width=".4"/></symbol>' +
      '<symbol id="i-joker" viewBox="0 0 24 24"><path d="M4 18 Q4 14 8 14 L8 10 Q8 7 12 7 Q16 7 16 10 L16 14 Q20 14 20 18 L4 18 Z"/><circle cx="12" cy="5" r="1.6" class="fill-fg"/><path d="M8 10 Q6 8 7 6 M16 10 Q18 8 17 6" stroke-width="1.2"/></symbol>' +
      '<symbol id="i-bag" viewBox="0 0 24 24"><path d="M4 8 L20 8 L19 20 L5 20 Z"/><path d="M9 8 Q9 4 12 4 Q15 4 15 8"/><path d="M9 12 L15 12" opacity=".5"/></symbol>';
    sprite.insertAdjacentHTML('beforeend', defs);
  }

  /* ======================= UI ============================================ */
  function injectUI() {
    if (document.getElementById('inv-fab')) return;

    var fab = document.createElement('button');
    fab.id = 'inv-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Инвентарь');
    fab.innerHTML = ico('i-bag', 26) + '<span class="inv-fab-badge" style="display:none">0</span>';
    fab.addEventListener('click', function (e) { e.stopPropagation(); openPanel(); });
    document.body.appendChild(fab);

    var overlay = document.createElement('div');
    overlay.id = 'inv-overlay';
    overlay.addEventListener('click', closePanel);
    document.body.appendChild(overlay);

    var panel = document.createElement('div');
    panel.id = 'inv-panel';
    panel.innerHTML =
      '<div class="inv-panel-head">' +
        '<span class="inv-ico">' + ico('i-bag', 26) + '</span>' +
        '<h3>Инвентарь</h3>' +
        '<span class="inv-count-tag" id="inv-count">0/' + MAX_SLOTS + '</span>' +
        '<button class="inv-close" type="button" aria-label="Закрыть">×</button>' +
      '</div>' +
      '<div class="inv-grid" id="inv-grid"></div>' +
      '<div class="inv-panel-hint">Тап — использовать · Удержание — переставить</div>';
    document.body.appendChild(panel);

    var closeBtn = panel.querySelector('.inv-close');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    renderGrid();
    renderFab();
  }

  function boot() {
    loadInv();
    injectStyles();
    injectSymbols();
    injectUI();
    watchChips();

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closePanel();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.LUX7Items = {
    add:    function (id) { return addItem(id); },
    remove: removeItemAt,
    list:   function () { return inv.slice(); },
    clear:  function () { inv = []; saveInv(); renderGrid(); renderFab(); },
    give:   function (id) { return addItem(id); },
    open:   openPanel,
    close:  closePanel,
    toggle: togglePanel
  };
})();
