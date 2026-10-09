/* ============================================================================
   ЛЮКС-7 · EXTRAS.JS — магазин предметов, кража на лифте, финальный счётчик.
   Плюс регистрация Service Worker для оффлайн-режима.
   ============================================================================ */
(function () {
  'use strict';

  var ITEMS_MARKET_KEY = 'lux7_market_stock_v1';
  var MARKET_ITEMS = [
    { id: 'gem',   price: 250 },
    { id: 'chest', price: 400 },
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
  function refreshChips() {
    var S = getS(); if (!S) return;
    try { if (typeof window.refreshDynamic === 'function') window.refreshDynamic(); } catch (e) {}
  }

  /* ======================= 1. МАГАЗИН ПРЕДМЕТОВ ========================= */
  /* Кнопка «Магазин предметов» на экране perks/shop. Открывает модалку
     с 3 случайными предметами, ассортимент меняется на каждом этаже. */

  function rollMarket() {
    // 3 случайных предмета, без дублей, разной цены
    var arr = MARKET_ITEMS.slice();
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr.slice(0, 3);
  }
  function loadMarket() {
    try { var r = JSON.parse(localStorage.getItem(ITEMS_MARKET_KEY) || 'null'); if (r && r.floor === (getS() && getS().floor) && Array.isArray(r.items)) return r.items; } catch (e) {}
    var items = rollMarket();
    try { localStorage.setItem(ITEMS_MARKET_KEY, JSON.stringify({ floor: getS() && getS().floor, items: items })); } catch (e) {}
    return items;
  }

  function openMarket() {
    var S = getS();
    if (!S) return;
    if (isBusy()) return;
    var items = loadMarket();

    function itemName(id) {
      return { gem:'Самоцвет', chest:'Сундук', ward:'Оберег', lucky:'Клевер', ace:'Туз в рукаве', joker:'Джокер' }[id] || id;
    }
    function itemIcon(id) {
      return { gem:'i-gem', chest:'i-chest', ward:'i-ward', lucky:'i-lucky', ace:'i-ace', joker:'i-joker' }[id];
    }

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
        '<p style="text-align:center;margin-bottom:14px;font-size:12px">Ассортимент меняется каждый этаж. Кредит: <b style="color:var(--gold2)" id="market-chips">' + (S.chips || 0).toLocaleString('ru-RU') + '</b></p>' +
        '<div class="market-grid">' + list + '</div>' +
        '<button class="btn sec" style="margin-top:18px" onclick="document.getElementById(\'modal-root\').innerHTML=\'\'">Закрыть</button>' +
      '</div>';
    root.appendChild(modal);

    // Обработчики покупки
    modal.querySelectorAll('.mi-buy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var price = parseInt(btn.dataset.price, 10);
        var id = btn.dataset.id;
        var s = getS();
        if (!s) return;
        if (s.chips < price) { toast('Недостаточно фишек', 'bad'); return; }
        if (!window.LUX7Items) return;
        var ok = window.LUX7Items.add(id, false);
        if (!ok) return;  // инвентарь полон
        s.chips -= price;
        var mc = document.getElementById('market-chips');
        if (mc) mc.textContent = s.chips.toLocaleString('ru-RU');
        btn.disabled = true;
        btn.textContent = '✓';
        btn.style.background = 'linear-gradient(180deg,#5fc08c,#37865c)';
        btn.style.color = '#04210f';
        toast('Куплено: ' + itemName(id), 'gold');
        refreshChips();
      });
    });
  }

  // Патчим leaveShop, чтобы добавить кнопку «Магазин предметов»
  function bindMarketButton() {
    var el = document.querySelector('#app .bottom .btn, #app .bottom button.btn');
    // Кнопка появляется на экране perks/shop. Найдём экран по заголовку.
    var header = document.querySelector('.hdr-title');
    if (!header) return;
    var txt = (header.textContent || '').toLowerCase();
    var isShop = txt.indexOf('магазин') >= 0;
    var isPerks = txt.indexOf('этаж') >= 0 && document.querySelector('.perk');
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
  setInterval(bindMarketButton, 600);

  // CSS для модалки магазина
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

  /* ======================= 2. КРАЖА НА ЛИФТЕ ============================ */
  /* Отслеживаем смену этажа — если этаж стал больше, шанс 15%, что кто-то украдёт предмет. */
  var prevFloor = -1;
  var prevItemCount = -1;

  function checkTheft() {
    var S = getS();
    if (!S) return;
    var floor = S.floor || 0;
    var itemCount = window.LUX7Items ? window.LUX7Items.list().filter(Boolean).length : 0;

    if (prevFloor >= 0 && floor > prevFloor && itemCount > 0) {
      // поднимаемся на этаж
      if (Math.random() < 0.15) {
        var list = window.LUX7Items.list();
        if (list.length > 0) {
          var idx = Math.floor(Math.random() * list.length);
          var stolenId = list[idx];
          var names = { gem:'Самоцвет', chest:'Сундук', ward:'Оберег', lucky:'Клевер', ace:'Туз в рукаве', joker:'Джокер' };
          window.LUX7Items.remove(idx);
          setTimeout(function () {
            toast('Кто-то стащил ' + (names[stolenId] || 'предмет') + '!', 'bad');
          }, 800);
        }
      }
    }
    prevFloor = floor;
    prevItemCount = itemCount;
  }
  setInterval(checkTheft, 500);

  /* ======================= 3. СЧЁТЧИК ПРЕДМЕТОВ В ФИНАЛЕ ================ */
  /* Дорисовываем строку «Предметов найдено» в финальном экране. */
  var finalObserver = new MutationObserver(function () {
    var endwrap = document.querySelector('.endwrap');
    if (!endwrap) return;
    if (endwrap.dataset.itemsAdded === '1') return;
    endwrap.dataset.itemsAdded = '1';

    var gain = window.LUX7Items_getRunGain ? window.LUX7Items_getRunGain() : 0;
    if (!gain) return;

    // Находим блок статистики
    var stats = endwrap.querySelectorAll('.statline');
    if (!stats.length) return;

    var line = document.createElement('div');
    line.className = 'statline';
    line.innerHTML = '<span>Предметов найдено</span><span>' + gain + '</span>';
    var lastStat = stats[stats.length - 1];
    if (lastStat && lastStat.parentNode) lastStat.parentNode.insertBefore(line, lastStat.nextSibling);
  });
  finalObserver.observe(document.body, { childList: true, subtree: true });

  /* ======================= 4. ДОРИСОВКА «КОЛЛЕКТИОНЕР» В ДОСТИЖЕНИЯХ ==== */
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
      '<div class="ai"><svg class="ico" width="26" height="26" viewBox="0 0 24 24"><use href="#' + (got ? 'i-chest' : 'u-lock') + '"/></svg></div>' +
      '<div><div class="an">Коллекционер</div><div class="ad">Собрать все 6 видов предметов одновременно</div></div>';

    // Обновляем счётчик «Открыто X из Y»
    var counter = pad.querySelector('.ach-count b:last-child');
    if (counter) {
      var cur = parseInt(counter.textContent, 10) || 0;
      counter.textContent = String(cur + 1);
    }
    var lastB = pad.querySelector('.ach-count');
    if (lastB) {
      var html = lastB.innerHTML;
      var m = html.match(/из <b>(\d+)<\/b>/);
      if (m) {
        var total = parseInt(m[1], 10) + 1;
        lastB.innerHTML = html.replace(/из <b>\d+<\/b>/, 'из <b>' + total + '</b>');
      }
    }

    pad.appendChild(item);
  });
  achObserver.observe(document.body, { childList: true, subtree: true });

  /* ======================= 5. SERVICE WORKER ============================ */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    // SW можно регистрировать только по https или localhost.
    // GitHub Pages — https, всё ок.
    try {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    } catch (e) {}
  }

  /* ======================= BOOT ========================================= */
  function boot() {
    injectMarketCSS();
    registerSW();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.LUX7Extras = {
    openMarket: openMarket
  };
})();
