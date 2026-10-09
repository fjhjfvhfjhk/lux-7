/* ============================================================================
   ЛЮКС-7 · ITEMS.JS — инвентарь (v3.4)
   Изменения:
     • ЛКМ / тап = открыть попап «Использовать / Выбросить».
     • Удержание с движением = перетаскивание (без таймера, чисто по движению).
     • ПКМ-контекстное меню убрано — оно конфликтовало и было неудобно.
     • Всё остальное из v3.3 сохранено:
       — сундук убран из дроп-пула, всегда даёт 2 предмета (или фишки);
       — коллекционер = использовать все типы;
       — перк «Рюкзак» (+3 слота до 8).
   ============================================================================ */
(function () {
  'use strict';

  var STORE_KEY     = 'lux7_items_v1';
  var BASE_SLOTS    = 5;
  var MAX_SLOTS_CAP = 8;
  var DROP_MIN      = 100;
  var DRAG_THRESH   = 12;
  var DROP_GUARD_MS = 3000;
  var SUPPRESS_MS   = 2500;
  var RUN_GAIN_KEY  = 'lux7_run_gain_v1';
  var USED_KEY      = 'lux7_used_types_v1';
  var COLLECTOR_KEY = 'lux7_collector_v1';
  var EASTER_KEY    = 'lux7_easter_v1';

  var ITEMS = {
    gem:   { icon:'i-gem',   rarity:'common', name:'Самоцвет',     desc:'+200 фишек сразу' },
    chest: { icon:'i-chest', rarity:'common', name:'Сундук',       desc:'Открывает 2 случайных предмета' },
    ward:  { icon:'i-ward',  rarity:'rare',   name:'Оберег',       desc:'Снимает проклятие текущего этажа' },
    lucky: { icon:'i-lucky', rarity:'rare',   name:'Клевер',       desc:'Следующая потеря фишек вернётся' },
    ace:   { icon:'i-ace',   rarity:'epic',   name:'Туз в рукаве', desc:'+500 фишек сразу' },
    joker: { icon:'i-joker', rarity:'epic',   name:'Джокер',       desc:'Удваивает баланс (до +3000)' }
  };
  var DROP_POOL = ['gem', 'ward', 'lucky', 'ace', 'joker'];
  var RARITY_W = { common: 7, rare: 3, epic: 1 };
  var RARITY_COLOR = { common: '201,183,142', rare: '155,186,245', epic: '242,201,107' };

  var inv = [];
  var refundNextLoss = false;
  var lastChips = -1;
  var dropGuardUntil = 0;
  var suppressUntil = 0;
  var isOpen = false;
  var usedTypes = {};

  var dragSrc = -1;
  var dragGhost = null;
  var dragStartPos = null;
  var dragReady = false;
  var tipEl = null;
  var popupEl = null;
  var easterClicks = 0;
  var easterTimer = null;

  /* ======================= ЧТЕНИЕ S ===================================== */
  function getS() {
    try { if (typeof S !== 'undefined' && S) return S; } catch (e) {}
    try { if (window.S) return window.S; } catch (e) {}
    return null;
  }
  function isBusy() {
    try { if (typeof busy !== 'undefined' && busy) return true; } catch (e) {}
    try { if (window.busy) return true; } catch (e) {}
    return false;
  }
  function readFloor() {
    var s = getS();
    if (s && typeof s.floor === 'number') return s.floor;
    try {
      var el = document.querySelector('.hdr-title small');
      if (el) {
        var m = String(el.textContent).match(/Этаж\s+(\d+)/i);
        if (m) return parseInt(m[1], 10) || 1;
      }
    } catch (e) {}
    return 1;
  }
  function hasPerk(id) {
    var s = getS();
    if (!s || !Array.isArray(s.perks)) return false;
    return s.perks.indexOf(id) >= 0;
  }
  function slotsMax() {
    return hasPerk('backpack') ? MAX_SLOTS_CAP : BASE_SLOTS;
  }

  /* ======================= ПЕРК «РЮКЗАК» =============================== */
  function registerBackpackPerk() {
    try {
      if (typeof PERKS === 'undefined' || !Array.isArray(PERKS)) return false;
      if (PERKS.some(function (p) { return p.id === 'backpack'; })) return true;
      PERKS.push({ id:'backpack', icon:'i-bag', name:'Рюкзак', desc:'+3 слота в инвентаре (до 8)' });
      return true;
    } catch (e) { return false; }
  }
  var pkTries = 0;
  var pkIv = setInterval(function () {
    pkTries++;
    if (registerBackpackPerk() || pkTries > 40) clearInterval(pkIv);
  }, 100);

  /* ======================= ПАТЧ maxBet ================================== */
  function patchMaxBet() {
    if (typeof window.maxBet !== 'function') return false;
    if (window.__lux7_mbPatched) return true;
    window.maxBet = function () { return Math.max(200, readFloor() * 200); };
    window.__lux7_mbPatched = true;
    return true;
  }
  var mbTries = 0;
  var mbIv = setInterval(function () {
    mbTries++;
    if (patchMaxBet() || mbTries > 50) clearInterval(mbIv);
  }, 100);

  /* ======================= СЧЁТЧИК ЗА ЗАБЕГ ============================= */
  function getRunGain() {
    try { return parseInt(localStorage.getItem(RUN_GAIN_KEY) || '0', 10) || 0; } catch (e) { return 0; }
  }
  function addRunGain() {
    try { localStorage.setItem(RUN_GAIN_KEY, String(getRunGain() + 1)); } catch (e) {}
  }
  function resetRunGain() {
    try { localStorage.setItem(RUN_GAIN_KEY, '0'); } catch (e) {}
    usedTypes = {};
    try { localStorage.setItem(USED_KEY, '{}'); } catch (e) {}
  }
  function loadUsed() {
    try { usedTypes = JSON.parse(localStorage.getItem(USED_KEY) || '{}') || {}; } catch (e) { usedTypes = {}; }
  }
  function saveUsed() {
    try { localStorage.setItem(USED_KEY, JSON.stringify(usedTypes)); } catch (e) {}
  }
  window.LUX7Items_getRunGain = getRunGain;

  /* ======================= АВТООЧИСТКА ================================= */
  var lastScreen = null;
  setInterval(function () {
    var s = getS();
    var cur = s ? (s.screen || '') : '';
    if (cur === 'class' && lastScreen && lastScreen !== 'class') {
      inv = []; saveInv(); renderGrid(); renderFab();
      refundNextLoss = false;
      resetRunGain();
    }
    if (cur) lastScreen = cur;
    ensureSlotsCapacity();
  }, 500);

  function ensureSlotsCapacity() {
    var max = slotsMax();
    if (inv.length > max) {
      inv = inv.slice(0, max);
      saveInv();
      renderGrid();
    }
  }

  /* ======================= КОЛЛЕКЦИОНЕР ================================ */
  function markUsed(id) {
    if (!ITEMS[id]) return;
    if (usedTypes[id]) return;
    usedTypes[id] = true;
    saveUsed();
    checkCollector();
  }
  function checkCollector() {
    var all = Object.keys(ITEMS).every(function (id) { return usedTypes[id]; });
    if (!all) return;
    try { if (localStorage.getItem(COLLECTOR_KEY) === '1') return; } catch (e) {}
    try { localStorage.setItem(COLLECTOR_KEY, '1'); } catch (e) {}
    try { if (typeof unlockAch === 'function') unlockAch('collector'); } catch (e) {}
    setTimeout(function () {
      toast('🏅 Коллекционер: использованы все 6 предметов!', 'gold');
    }, 700);
  }

  /* ======================= УТИЛИТЫ ====================================== */
  function $(s) { return document.querySelector(s); }

  function loadInv() {
    try { var r = localStorage.getItem(STORE_KEY); inv = r ? JSON.parse(r) : []; }
    catch (e) { inv = []; }
    if (!Array.isArray(inv)) inv = [];
    inv = inv.filter(function (id) { return id && ITEMS[id]; });
    var max = slotsMax();
    if (inv.length > max) inv = inv.slice(0, max);
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
    var ids = DROP_POOL.slice();
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
    var max = slotsMax();
    if (inv.length >= max) { if (!silent) toast('Инвентарь полон', 'bad'); return false; }
    inv.push(id); saveInv(); addRunGain(); renderGrid(true); renderFab();
    return true;
  }
  function removeItemAt(i) {
    if (i < 0 || i >= inv.length) return;
    inv.splice(i, 1);
    saveInv(); renderGrid(); renderFab();
  }

  /* ======================= ПАРТИКЛЫ ===================================== */
  function fireItemFlash(rarity) {
    var color = RARITY_COLOR[rarity] || RARITY_COLOR.common;
    var el = document.createElement('div');
    el.className = 'lux-item-flash';
    el.style.setProperty('--fc', color);
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 900);
  }

  /* ======================= ИСПОЛЬЗОВАНИЕ ================================ */
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
      case 'gem':
        S.chips += 200; if (S.chips > S.peak) S.peak = S.chips;
        toast('+200 фишек', 'good', it.icon);
        break;
      case 'ace':
        S.chips += 500; if (S.chips > S.peak) S.peak = S.chips;
        toast('+500 фишек!', 'gold', it.icon);
        break;
      case 'joker': {
        var gain = Math.min(3000, S.chips);
        if (gain <= 0) { toast('Нечего удваивать', 'bad'); consumed = false; break; }
        S.chips += gain; if (S.chips > S.peak) S.peak = S.chips;
        toast('+' + gain + ' фишек!', 'gold', it.icon);
        break;
      }
      case 'ward':
        if (!S.curse) { toast('Нет проклятия', 'bad'); consumed = false; break; }
        S.curse = null; toast('Проклятие снято', 'good', it.icon);
        break;
      case 'lucky':
        if (refundNextLoss) { toast('Уже активно', 'bad'); consumed = false; break; }
        refundNextLoss = true; toast('Клевер: следующая потеря вернётся', 'good', it.icon);
        break;
      case 'chest': {
        inv.splice(i, 1);
        var max = slotsMax();
        var added = 0;
        for (var k = 0; k < 2; k++) {
          if (inv.length >= max) break;
          inv.push(randomItemId());
          added++;
          addRunGain();
        }
        saveInv();
        suppressUntil = performance.now() + SUPPRESS_MS;
        if (added === 2) {
          toast('Сундук: 2 предмета', 'gold', it.icon);
        } else if (added === 1) {
          S.chips += 250; if (S.chips > S.peak) S.peak = S.chips;
          toast('Сундук: 1 предмет + 250 фишек', 'gold', it.icon);
        } else {
          S.chips += 500; if (S.chips > S.peak) S.peak = S.chips;
          toast('Сундук: места нет, +500 фишек', 'gold', it.icon);
        }
        if (isBusy()) refreshChipsLight(); else refreshGameUI(true);
        renderGrid(true); renderFab();
        fireItemFlash(it.rarity);
        markUsed(id);
        return;
      }
    }

    if (consumed) {
      suppressUntil = performance.now() + SUPPRESS_MS;
      fireItemFlash(it.rarity);
      markUsed(id);
      removeItemAt(i);
      if (isBusy()) refreshChipsLight();
      else refreshGameUI(true);
    } else {
      renderGrid();
    }
    renderFab();
  }

  function dropItem(i) {
    var id = inv[i];
    if (!id) return;
    var it = ITEMS[id];
    fireItemFlash(it.rarity);
    removeItemAt(i);
    toast('Выброшено: ' + it.name, 'bad', it.icon);
  }

  /* ======================= ПОПАП ======================================== */
  function showItemPopup(i, slotEl) {
    hideItemPopup();
    var id = inv[i];
    if (!id) return;
    var it = ITEMS[id];

    popupEl = document.createElement('div');
    popupEl.className = 'lux-item-popup ' + it.rarity;
    popupEl.innerHTML =
      '<div class="lip-head">' + ico(it.icon, 16) + '<span>' + it.name + '</span></div>' +
      '<div class="lip-desc">' + it.desc + '</div>' +
      '<button class="lip-use" type="button">Использовать</button>' +
      '<button class="lip-drop" type="button">Выбросить</button>';
    document.body.appendChild(popupEl);

    var r = slotEl.getBoundingClientRect();
    var pw = 200, ph = 150;
    var left = r.left - pw - 12;
    if (left < 8) left = r.right + 12;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    var top = r.top + r.height / 2 - ph / 2;
    top = Math.max(8, Math.min(window.innerHeight - ph - 8, top));
    popupEl.style.left = left + 'px';
    popupEl.style.top = top + 'px';

    popupEl.querySelector('.lip-use').onclick = function (e) {
      e.stopPropagation(); hideItemPopup(); useItem(i);
    };
    popupEl.querySelector('.lip-drop').onclick = function (e) {
      e.stopPropagation(); hideItemPopup(); dropItem(i);
    };
  }
  function hideItemPopup() {
    if (popupEl) { popupEl.remove(); popupEl = null; }
  }
  document.addEventListener('click', function (e) {
    if (popupEl && !popupEl.contains(e.target)) hideItemPopup();
  }, true);

  /* ======================= WATCHER ====================================== */
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
          var chance = delta >= 2000 ? 0.70 : (delta >= 500 ? 0.50 : 0.30);
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
    var max = slotsMax();
    var cnt = document.getElementById('inv-count');
    var filled = inv.filter(Boolean).length;
    if (cnt) cnt.textContent = filled + '/' + max;
    var prevFilled = grid.querySelectorAll('.inv-slot:not(.empty)').length;

    var html = '';
    for (var i = 0; i < max; i++) {
      var id = inv[i];
      if (id && ITEMS[id]) {
        var it = ITEMS[id];
        html += '<div class="inv-slot ' + it.rarity + '" data-i="' + i + '" data-id="' + id + '">' +
          ico(it.icon, 30) + '<span class="inv-rarity"></span></div>';
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

  function openPanel() {
    isOpen = true;
    var panel = document.getElementById('inv-panel');
    var fab = document.getElementById('inv-fab');
    if (panel) { panel.style.display = 'block'; panel.classList.add('on'); }
    if (fab) fab.classList.add('hidden');
    renderGrid();
  }
  function closePanel() {
    isOpen = false;
    hideItemPopup();
    var panel = document.getElementById('inv-panel');
    var fab = document.getElementById('inv-fab');
    if (panel) { panel.classList.remove('on'); panel.style.display = 'none'; }
    if (fab) fab.classList.remove('hidden');
  }
  function togglePanel() { if (isOpen) closePanel(); else openPanel(); }

  /* ======================= ВВОД: ЛКМ/ТАП = попап, движение = drag ======= */
  function onPointerDown(e) {
    if (e.button === 2) return; // ПКМ игнорируем — попап теперь на ЛКМ
    var i = parseInt(e.currentTarget.dataset.i, 10);
    if (isNaN(i) || !inv[i]) return;
    hideItemPopup();
    dragSrc = i;
    dragStartPos = { x: e.clientX, y: e.clientY };
    dragReady = false;
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    try { e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function onPointerMove(e) {
    if (dragSrc < 0 || !dragStartPos) return;
    var dx = e.clientX - dragStartPos.x;
    var dy = e.clientY - dragStartPos.y;
    if (!dragReady && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESH) {
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
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
    var stray = document.querySelectorAll('.inv-slot.dragging, .inv-slot.drop-target');
    for (var k = 0; k < stray.length; k++) {
      stray[k].classList.remove('dragging');
      stray[k].classList.remove('drop-target');
    }
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }

    if (dragReady && dragSrc >= 0) {
      // Перетаскивание — обмен слотов
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var tgt = el && el.closest ? el.closest('.inv-slot') : null;
      if (tgt) {
        var ti = parseInt(tgt.dataset.i, 10);
        var max = slotsMax();
        if (!isNaN(ti) && ti !== dragSrc && ti >= 0 && ti < max) {
          while (inv.length < max) inv.push(null);
          var tmp = inv[dragSrc];
          inv[dragSrc] = inv[ti];
          inv[ti] = tmp;
          while (inv.length && inv[inv.length - 1] === null) inv.pop();
          saveInv(); renderGrid();
        }
      }
    } else if (dragSrc >= 0) {
      // Короткий клик / тап — открыть попап
      var slotEl = document.querySelector('.inv-slot[data-i="' + dragSrc + '"]');
      if (slotEl) showItemPopup(dragSrc, slotEl);
    }
    dragSrc = -1;
    dragReady = false;
    dragStartPos = null;
  }

  function startGhost(x, y, id) {
    if (!ITEMS[id]) return;
    dragGhost = document.createElement('div');
    dragGhost.id = 'inv-ghost';
    dragGhost.innerHTML = ico(ITEMS[id].icon, 28);
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
    if (popupEl) return;
    var id = e.currentTarget.dataset.id;
    if (!id || !ITEMS[id]) return;
    var it = ITEMS[id];
    var t = ensureTip();
    t.innerHTML = '<div class="tt-name ' + it.rarity + '">' + ico(it.icon, 14) + it.name + '</div>' +
                  '<div class="tt-desc">' + it.desc + '</div>' +
                  '<div class="tt-hint">Клик — меню · Удержать и потянуть — переставить</div>';
    var r = e.currentTarget.getBoundingClientRect();
    var tipW = 260;
    var left = r.left - tipW - 12;
    if (left < 8) left = r.right + 12;
    if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
    t.style.left = left + 'px';
    t.style.top = Math.max(8, Math.min(window.innerHeight - 120, r.top)) + 'px';
    t.classList.add('on');
  }
  function onLeave() { if (tipEl) tipEl.classList.remove('on'); }

  /* ======================= ПАСХАЛКА ===================================== */
  function bindEaster() {
    var coin = document.getElementById('coin');
    if (!coin || coin.dataset.easter === '1') return;
    coin.dataset.easter = '1';
    coin.style.cursor = 'pointer';
    coin.addEventListener('click', function () {
      easterClicks++;
      clearTimeout(easterTimer);
      easterTimer = setTimeout(function () { easterClicks = 0; }, 2000);
      if (easterClicks >= 5) { easterClicks = 0; showEasterEgg(); }
    });
  }
  function showEasterEgg() {
    var seen = false;
    try { seen = localStorage.getItem(EASTER_KEY) === '1'; } catch (e) {}
    try { localStorage.setItem(EASTER_KEY, '1'); } catch (e) {}
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.onclick = function (e) { if (e.target === modal) modal.remove(); };
    modal.innerHTML =
      '<div class="modal-in" style="text-align:center">' +
        '<h2 style="justify-content:center">' + ico('a-777', 22) + 'Ты нашёл секрет</h2>' +
        '<p style="font-family:Georgia,serif;font-size:20px;color:var(--gold2);letter-spacing:.1em;margin:20px 0">«' + (seen ? 'Опять ты?' : 'Ты дошёл до конца. За это — 777 фишек счастья.') + '»</p>' +
        '<p style="font-size:12px;color:var(--mut);line-height:1.6">ЛЮКС-7 умеет считать клики. И запоминает тех, кто любит нажимать всё подряд.</p>' +
        '<button class="btn sec" style="margin-top:20px" onclick="this.closest(\'.modal\').remove()">Закрыть</button>' +
      '</div>';
    document.body.appendChild(modal);
    if (!seen) {
      var S = getS();
      if (S && !S.over) {
        S.chips += 777;
        if (S.chips > S.peak) S.peak = S.chips;
        setTimeout(function () {
          toast('+777 фишек за находку', 'gold', 'a-777');
          if (!isBusy()) refreshGameUI(false);
        }, 400);
      }
    }
  }

  /* ======================= CSS =========================================== */
  function injectStyles() {
    if (document.getElementById('items-style')) return;
    var css =
      '#inv-fab{position:fixed;z-index:32;bottom:calc(16px + env(safe-area-inset-bottom,0px));right:14px;width:52px;height:52px;border-radius:50%;background:linear-gradient(180deg,#f7dc85,#c9922f);border:none;cursor:pointer;display:grid;place-items:center;color:#241a06;box-shadow:0 12px 26px rgba(0,0,0,.55);transition:transform .25s,opacity .25s}' +
      '#inv-fab:hover{transform:translateY(-2px) scale(1.04)}' +
      '#inv-fab:active{transform:scale(.94)}' +
      '#inv-fab svg{width:24px;height:24px}' +
      '#inv-fab .inv-fab-badge{position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#c8503f;color:#fff;font-size:10px;font-weight:800;display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.5);font-variant-numeric:tabular-nums}' +
      '#inv-fab.hidden{opacity:0;pointer-events:none;transform:scale(.6)}' +
      '@media (min-width:900px){#inv-fab{bottom:auto;top:50%;right:20px;transform:translateY(-50%);width:56px;height:56px}#inv-fab:hover{transform:translateY(calc(-50% - 2px)) scale(1.05)}#inv-fab.hidden{transform:translateY(-50%) scale(.6)}}' +

      '#inv-panel{position:fixed;top:50%;right:0;width:92px;max-height:80vh;padding:14px 10px 16px;background:linear-gradient(180deg,#251b12,#140d08);border:1px solid #4a3b24;border-right:none;border-radius:16px 0 0 16px;box-shadow:-14px 0 32px rgba(0,0,0,.45);transform:translate(0,-50%);transition:transform .35s cubic-bezier(.2,1,.3,1);overflow-y:auto;overscroll-behavior:contain;z-index:34}' +
      '@media (min-width:900px){#inv-panel{width:112px;padding:16px 12px 18px}}' +

      '.inv-panel-head{display:flex;align-items:center;justify-content:center;gap:5px;position:relative;margin-bottom:12px;padding-right:14px}' +
      '.inv-panel-head .inv-ico{width:22px;height:22px;color:#f2c96b;display:grid;place-items:center}' +
      '.inv-panel-head .inv-ico svg{width:20px;height:20px}' +
      '.inv-panel-head .inv-count-tag{font-size:10px;color:var(--mut);font-weight:700;font-variant-numeric:tabular-nums}' +
      '.inv-panel-head .inv-close{position:absolute;top:-4px;right:-2px;width:22px;height:22px;border-radius:7px;border:1px solid #4a3b24;background:#1e1610;color:var(--mut);cursor:pointer;display:grid;place-items:center;font-size:15px;line-height:1;padding:0;transition:.15s}' +
      '.inv-panel-head .inv-close:active{transform:scale(.9);color:#f2c96b;border-color:#8a6a24}' +

      '.inv-grid{display:grid;grid-template-columns:1fr;gap:8px}' +

      '.inv-slot{aspect-ratio:1;width:100%;border-radius:12px;background:linear-gradient(180deg,#2a1f15,#1a120c);border:1.5px solid #4a3b24;display:grid;place-items:center;position:relative;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:none;transition:transform .15s,border-color .2s,box-shadow .2s}' +
      '.inv-slot.empty{background:rgba(42,34,22,.35);border-style:dashed;border-color:#382d1c;cursor:default}' +
      '.inv-slot.empty::before{content:"";width:5px;height:5px;border-radius:50%;background:rgba(154,141,118,.3)}' +
      '.inv-slot:not(.empty):active{transform:scale(.94)}' +
      '.inv-slot:not(.empty):hover{border-color:#8a6a24;box-shadow:0 0 20px rgba(217,164,65,.2),inset 0 0 12px rgba(217,164,65,.08)}' +
      '.inv-slot.dragging{opacity:.35}' +
      '.inv-slot.drop-target{background:rgba(217,164,65,.18);border-color:#f2c96b;box-shadow:0 0 20px rgba(242,201,107,.5),inset 0 0 14px rgba(242,201,107,.25)}' +
      '.inv-slot svg{pointer-events:none;width:56%;height:56%;position:relative;z-index:1}' +
      '.inv-slot .inv-rarity{position:absolute;top:5px;right:5px;width:6px;height:6px;border-radius:50%;box-shadow:0 0 8px currentColor}' +
      '.inv-slot.common{border-color:#5a4a2c}' +
      '.inv-slot.common svg{color:#c9b78e}' +
      '.inv-slot.common .inv-rarity{background:#c9b78e;color:#c9b78e}' +
      '.inv-slot.rare{border-color:#3a5c8a;box-shadow:inset 0 0 12px rgba(91,141,217,.14)}' +
      '.inv-slot.rare svg{color:#9bbaf5}' +
      '.inv-slot.rare .inv-rarity{background:#9bbaf5;color:#9bbaf5}' +
      '.inv-slot.epic{border-color:#8a6a24;animation:epicShimmer 3s ease-in-out infinite}' +
      '.inv-slot.epic svg{color:#f2c96b}' +
      '.inv-slot.epic .inv-rarity{background:#f2c96b;color:#f2c96b}' +

      '#inv-ghost{position:fixed;width:52px;height:52px;z-index:400;pointer-events:none;display:grid;place-items:center;background:#1a120c;border:2px solid #f2c96b;border-radius:12px;box-shadow:0 16px 38px rgba(0,0,0,.7);transform:translate(-50%,-50%);color:#f2c96b}' +
      '#inv-ghost svg{width:30px;height:30px}' +

      '#inv-tip{position:fixed;z-index:500;max-width:260px;padding:10px 14px;background:rgba(20,16,10,.98);border:1px solid #4a3b24;border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.75);font-size:12.5px;line-height:1.45;pointer-events:none;opacity:0;transition:opacity .15s}' +
      '#inv-tip.on{opacity:1}' +
      '#inv-tip .tt-name{font-weight:800;margin-bottom:4px;display:flex;align-items:center;gap:7px;font-size:13px}' +
      '#inv-tip .tt-name.common{color:#c9b78e}' +
      '#inv-tip .tt-name.rare{color:#9bbaf5}' +
      '#inv-tip .tt-name.epic{color:#f2c96b}' +
      '#inv-tip .tt-desc{color:var(--mut);font-size:11.5px}' +
      '#inv-tip .tt-hint{color:var(--line2);font-size:10.5px;margin-top:6px;padding-top:6px;border-top:1px solid var(--line);letter-spacing:.03em}' +

      '.lux-item-popup{position:fixed;z-index:450;width:200px;padding:12px;background:rgba(20,16,10,.98);border:1px solid #4a3b24;border-radius:12px;box-shadow:0 20px 46px rgba(0,0,0,.85);animation:lipIn .18s cubic-bezier(.2,1,.3,1);display:flex;flex-direction:column;gap:8px}' +
      '.lux-item-popup.rare{border-color:#3a5c8a;box-shadow:0 20px 46px rgba(0,0,0,.85),0 0 22px rgba(91,141,217,.25)}' +
      '.lux-item-popup.epic{border-color:#8a6a24;box-shadow:0 20px 46px rgba(0,0,0,.85),0 0 24px rgba(217,164,65,.3)}' +
      '.lux-item-popup .lip-head{display:flex;align-items:center;gap:7px;font-weight:800;font-size:13px}' +
      '.lux-item-popup.common .lip-head{color:#c9b78e}' +
      '.lux-item-popup.rare .lip-head{color:#9bbaf5}' +
      '.lux-item-popup.epic .lip-head{color:#f2c96b}' +
      '.lux-item-popup .lip-desc{font-size:11.5px;color:var(--mut);line-height:1.45;margin-bottom:4px}' +
      '.lux-item-popup button{padding:9px;border-radius:9px;border:1px solid transparent;font-weight:700;font-size:12px;cursor:pointer;transition:.15s;font-family:inherit}' +
      '.lux-item-popup .lip-use{background:linear-gradient(180deg,#e8bd63,#c9922f);color:#241a06}' +
      '.lux-item-popup .lip-use:active{transform:scale(.96)}' +
      '.lux-item-popup .lip-drop{background:transparent;color:#e08a76;border-color:#5c2a22}' +
      '.lux-item-popup .lip-drop:active{transform:scale(.96);background:rgba(200,80,63,.15)}' +
      '@keyframes lipIn{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}' +

      '.lux-item-flash{position:fixed;left:50%;top:50%;width:8px;height:8px;border-radius:50%;pointer-events:none;z-index:200;transform:translate(-50%,-50%);background:radial-gradient(circle, rgba(var(--fc,217,164,65),.9), transparent 70%);animation:luxFlash .85s cubic-bezier(.2,.9,.3,1)}' +
      '@keyframes luxFlash{0%{opacity:0;width:8px;height:8px}25%{opacity:1}100%{opacity:0;width:340px;height:340px}}' +

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

  function injectUI() {
    if (document.getElementById('inv-fab')) return;
    var fab = document.createElement('button');
    fab.id = 'inv-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Инвентарь');
    fab.innerHTML = ico('i-bag', 24) + '<span class="inv-fab-badge" style="display:none">0</span>';
    fab.addEventListener('click', function (e) { e.stopPropagation(); togglePanel(); });
    document.body.appendChild(fab);

    var panel = document.createElement('div');
    panel.id = 'inv-panel';
    panel.style.display = 'none';
    panel.innerHTML =
      '<div class="inv-panel-head">' +
        '<span class="inv-ico">' + ico('i-bag', 20) + '</span>' +
        '<span class="inv-count-tag" id="inv-count">0/' + BASE_SLOTS + '</span>' +
        '<button class="inv-close" type="button" aria-label="Закрыть">×</button>' +
      '</div>' +
      '<div class="inv-grid" id="inv-grid"></div>';
    document.body.appendChild(panel);

    panel.querySelector('.inv-close').addEventListener('click', closePanel);
    renderGrid();
    renderFab();
  }

  function boot() {
    loadInv();
    loadUsed();
    injectStyles();
    injectSymbols();
    injectUI();
    watchChips();
    patchMaxBet();
    setTimeout(patchMaxBet, 500);
    setTimeout(patchMaxBet, 1500);
    registerBackpackPerk();
    setTimeout(registerBackpackPerk, 800);
    setInterval(bindEaster, 1500);
    bindEaster();

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (popupEl) { hideItemPopup(); return; }
        if (isOpen) closePanel();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.LUX7Items = {
    add: function (id) { return addItem(id); },
    remove: removeItemAt,
    list: function () { return inv.slice(); },
    clear: function () { inv = []; saveInv(); renderGrid(); renderFab(); },
    give: function (id) { return addItem(id); },
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    gain: getRunGain,
    slotsMax: slotsMax
  };
})();
