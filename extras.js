/* ============================================================================
   ЛЮКС-7 · EXTRAS.JS (v2) — магазин, кража, счётчик, SW.
   Исправления:
     • Магазин: списывает фишки, сохраняет, обновляет UI, обновляет баланс.
     • Кнопка магазина появляется на экране перков/магазина без сбоев.
     • Service Worker по-прежнему регистрируется.
   ============================================================================ */
(function () {
  'use strict';

  var ITEMS_MARKET_KEY = 'lux7_market_stock_v1';
  var MARKET_ITEMS = [
    { id: 'gem',   price: 250 },
    { id: 'chest', price: 350 },
    { id: 'ward',  price: 350 },
    { id: 'lucky', price: 300 },
    { id: 'ace',   price: 900 },
    { id: 'joker', price: 1400 }
  ];

  function $(s) { return document.querySelector(s); }
  function getS() {
    try { if (typeof S !== 'undefined' && S) return S; } catch (e) {}
    try { if (window.S) return window.S; } catch (e) {}
    return null;
  }
  function isBusy() {
    try { if (typeof busy !== 'undefined' && busy) return true; } catch (e) {}
    return false;
  }
  function toast(msg, type) {
    var root = document.getElementById('toasts');
    if (!root) return;
    var t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, 1700);
  }
  function refreshUI() {
    try {
      if (typeof window.refreshDynamic === 'function') { window.refreshDynamic(); return; }
      if (typeof window.render === 'function') window.render();
    } catch (e) {}
  }
  function refreshChipOnly() {
    var s = getS(); if (!s) return;
    var cv = document.getElementById('chipval');
    if (cv) { try { cv.textContent = s.chips.toLocaleString('ru-RU'); } catch (e) {} }
    var cs = document.getElementById('chipsub');
    if (cs) {
      var sub = 'фишек';
      try {
        if (s.peak > 100) sub += ' · пик ' + s.peak.toLocaleString('ru-RU');
        if (s.winStreak > 0) sub += ' · серия ' + s.winStreak;
      } catch (e) {}
      cs.textContent = sub;
    }
  }

  /* ======================= МАГАЗИН ПРЕДМЕТОВ ============================= */
  function rollMarket() {
    var arr = MARKET_ITEMS.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr.slice(0, 3);
  }
  function loadMarket() {
    var s = getS();
    var floor = s ? s.floor : 1;
    try {
      var r = JSON.parse(localStorage.getItem(ITEMS_MARKET_KEY) || 'null');
      if (r && r.floor === floor && Array.isArray(r.items)) return r.items;
    } catch (e) {}
    var items = rollMarket();
    try { localStorage.setItem(ITEMS_MARKET_KEY, JSON.stringify({ floor: floor, items: items })); } catch (e) {}
    return items;
  }

  function itemName(id) {
    return { gem:'Самоцвет', chest:'Сундук', ward:'Оберег', lucky:'Клевер', ace:'Туз в рукаве', joker:'Джокер' }[id] || id;
  }
  function itemIcon(id) {
    return { gem:'i-gem', chest:'i-chest', ward:'i-ward', lucky:'i-lucky', ace:'i-ace', joker:'i-joker' }[id];
  }

  function openMarket() {
    var S = getS();
    if (!S) return;
    if (isBusy()) return;
    var items = loadMarket();

    var root = document.getElementById('modal-root');
    if (!root) return;
    root.innerHTML = '';
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.onclick = function (e) { if (e.target === modal) root.innerHTML = ''; };

    var list = '';
    items.forEach(function (it, i) {
      list += '<div class="market-item" data-i="' + i + '">' +
        '<div class="mi-icon"><svg class="ico" width="28" height="28" viewBox="0 0 24 24"><use href="#' + itemIcon(it.id) + '"/></svg></div>' +
        '<div class="mi-name">' + itemName(it.id) + '</div>' +
        '<button class="mi-buy" data-price="' + it.price + '" data-id="' + it.id + '">' + it.price + '</button>' +
      '</div>';
    });

    modal.innerHTML =
      '<div class="modal-in">' +
        '<h2 style="justify-content:center">🛒 Магазин предметов</h2>' +
        '<p style="text-align:center;margin-bottom:14px;font-size:12px">Ассортимент обновляется каждый этаж. У вас: <b style="color:var(--gold2)" id="market-chips">' + (S.chips || 0).toLocaleString('ru-RU') + '</b> фишек</p>' +
        '<div class="market-grid">' + list + '</div>' +
        '<button class="btn sec" style="margin-top:18px" onclick="document.getElementById(\'modal-root\').innerHTML=\'\'">Закрыть</button>' +
      '</div>';
    root.appendChild(modal);

    modal.querySelectorAll('.mi-buy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var price = parseInt(btn.dataset.price, 10);
        var id = btn.dataset.id;
        var s = getS();
        if (!s) return;
        if (s.chips < price) { toast('Недостаточно фишек', 'bad'); return; }
        if (!window.LUX7Items) return;

        var ok = window.LUX7Items.add(id, false);
        if (!ok) { toast('Инвентарь полон', 'bad'); return; }

        // Списываем сразу
        s.chips -= price;
        if (s.chips < 0) s.chips = 0;

        // Сохраняем забег, чтобы не потерять баланс
        try {
          if (typeof saveRun === 'function') saveRun();
          else {
            // Fallback через localStorage
            try {
              var runKey = 'lux7_run_v1';
              var raw = localStorage.getItem(runKey);
              if (raw) {
                var data = JSON.parse(raw);
                data.chips = s.chips;
                localStorage.setItem(runKey, JSON.stringify(data));
              }
            } catch (e) {}
          }
        } catch (e) {}

        var mc = document.getElementById('market-chips');
        if (mc) mc.textContent = s.chips.toLocaleString('ru-RU');
        refreshChipOnly();

        btn.disabled = true;
        btn.textContent = '✓ Куплено';
        btn.style.background = 'linear-gradient(180deg,#5fc08c,#37865c)';
        btn.style.color = '#04210f';
        toast('Куплено: ' + itemName(id), 'gold');
      });
    });
  }

  /* ======================= КНОПКА МАГАЗИНА ============================= */
  var marketBtnTries = 0;
  function bindMarketButton() {
    marketBtnTries++;
    if (marketBtnTries > 200) { clearInterval(marketIv); return; }

    var existing = document.getElementById('open-market-btn');
    if (existing && !document.body.contains(existing)) existing = null;

    var hdr = document.querySelector('.hdr-title');
    if (!hdr) return;
    var txt = (hdr.textContent || '').toLowerCase();
    var isShop = txt.indexOf('магазин') >= 0;
    var isPerks = document.querySelector('#app .perk') !== null;

    if (!isShop && !isPerks) return;
    if (document.getElementById('open-market-btn')) return;

    var container = document.querySelector('#app .pad') || document.querySelector('#app');
    if (!container) return;
    var btn = document.createElement('button');
    btn.id = 'open-market-btn';
    btn.className = 'btn blu sm';
    btn.style.marginTop = '10px';
    btn.textContent = '🛒 Магазин предметов';
    btn.addEventListener('click', openMarket);
    container.appendChild(btn);
  }
  var marketIv = setInterval(bindMarketButton, 600);

  function injectMarketCSS() {
    if (document.getElementById('extras-style')) return;
    var css =
      '.market-grid{display:grid;grid-template-columns:1fr;gap:10px}' +
      '.market-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line2);border-radius:12px;background:var(--panel2)}' +
      '.market-item .mi-icon{width:36px;height:36px;display:grid;place-items:center;color:var(--gold2)}' +
      '.market-item .mi-name{flex:1;font-weight:700;font-size:13.5px}' +
      '.market-item .mi-buy{padding:9px 14px;border-radius:9px;border:none;background:linear-gradient(180deg,#e8bd63,#c9922f);color:#241a06;font-weight:800;font-size:12px;cursor:pointer;font-variant-numeric:tabular-nums;transition:.15s;font-family:inherit;min-width:70px}' +
      '.market-item .mi-buy:active{transform:scale(.95)}' +
      '.market-item .mi-buy:disabled{cursor:default}' +
      '@media (min-width:600px){.market-grid{grid-template-columns:repeat(3,1fr)}.market-item{flex-direction:column;text-align:center}.market-item .mi-name{flex:0}}';
    var s = document.createElement('style');
    s.id = 'extras-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ======================= КРАЖА НА ЛИФТЕ ============================== */
  var prevFloor = -1;
  function checkTheft() {
    var s = getS();
    if (!s) return;
    var floor = s.floor || 0;
    if (prevFloor >= 0 && floor > prevFloor && window.LUX7Items) {
      var list = window.LUX7Items.list().filter(Boolean);
      if (list.length > 0 && Math.random() < 0.15) {
        var idx = Math.floor(Math.random() * list.length);
        var stolenId = list[idx];
        var names = { gem:'Самоцвет', chest:'Сундук', ward:'Оберег', lucky:'Клевер', ace:'Туз в рукаве', joker:'Джокер' };
        window.LUX7Items.remove(idx);
        setTimeout(function () {
          toast('Кто-то стащил ' + (names[stolenId] || 'предмет') + '!', 'bad');
        }, 800);
      }
    }
    prevFloor = floor;
  }
  setInterval(checkTheft, 500);

  /* ======================= СЧЁТЧИК В ФИНАЛЕ ============================= */
  var finalObserver = new MutationObserver(function () {
    var endwrap = document.querySelector('.endwrap');
    if (!endwrap) return;
    if (endwrap.dataset.itemsAdded === '1') return;
    endwrap.dataset.itemsAdded = '1';
    var gain = window.LUX7Items_getRunGain ? window.LUX7Items_getRunGain() : 0;
    if (!gain) return;
    var stats = endwrap.querySelectorAll('.statline');
    if (!stats.length) return;
    var line = document.createElement('div');
    line.className = 'statline';
    line.innerHTML = '<span>Предметов найдено</span><span>' + gain + '</span>';
    var lastStat = stats[stats.length - 1];
    if (lastStat && lastStat.parentNode) lastStat.parentNode.insertBefore(line, lastStat.nextSibling);
  });
  finalObserver.observe(document.body, { childList: true, subtree: true });

  /* ======================= «КОЛЛЕКТИОНЕР» В СПИСКЕ АЧИВОК ============== */
  var achObserver = new MutationObserver(function () {
    var pad = document.querySelector('#app .pad');
    var title = document.querySelector('.hdr-title');
    if (!pad || !title) return;
    var txt = title.textContent || '';
    if (txt.indexOf('Достижения') < 0 && txt.indexOf('ДОСТИЖЕНИЯ') < 0) return;
    if (pad.dataset.collectorAdded === '1') return;
    pad.dataset.collectorAdded = '1';

    var got = false;
    try { got = localStorage.getItem('lux7_collector_v1') === '1'; } catch (e) {}

    var item = document.createElement('div');
    item.className = 'ach-item ' + (got ? 'unlocked' : 'locked');
    item.style.marginTop = '8px';
    item.innerHTML =
      '<div class="ai"><svg class="ico" width="26" height="26" viewBox="0 0 24 24"><use href="#' + (got ? 'i-ace' : 'u-lock') + '"/></svg></div>' +
      '<div><div class="an">Коллекционер</div><div class="ad">Использовать все 6 типов предметов за один забег</div></div>';

    var lastB = pad.querySelector('.ach-count');
    if (lastB) {
      var html = lastB.innerHTML;
      var m = html.match(/из <b>(\d+)<\/b>/);
      if (m) {
        var total = parseInt(m[1], 10) + 1;
        lastB.innerHTML = html.replace(/из <b>\d+<\/b>/, 'из <b>' + total + '</b>');
      }
      var m2 = html.match(/Открыто <b>(\d+)<\/b>/);
      if (m2 && got) {
        var cur = parseInt(m2[1], 10) + 1;
        lastB.innerHTML = lastB.innerHTML.replace(/Открыто <b>\d+<\/b>/, 'Открыто <b>' + cur + '</b>');
      }
    }
    pad.appendChild(item);
  });
  achObserver.observe(document.body, { childList: true, subtree: true });

  /* ======================= SERVICE WORKER ============================== */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try { navigator.serviceWorker.register('./sw.js').catch(function () {}); } catch (e) {}
  }

  function boot() {
    injectMarketCSS();
    registerSW();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.LUX7Extras = { openMarket: openMarket };
})();
