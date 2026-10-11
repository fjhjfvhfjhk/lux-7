/* ============================================================================
   ЛЮКС-7 · PLINKO.JS — Плинко (шар падает по пирамиде пегов в слот с ×N).
   Подключается последним, после app.js. Патчит render() и добавляет
   карточку в хаб без правок app.js.
   ============================================================================ */
(function () {
  'use strict';

  /* ---------- Константы ------------------------------------------------- */
  const ROWS = 12;
  const SLOTS = ROWS + 1;   // 13

  // Множители по риску (13 слотов, симметрично). RTP ≈ 99%.
  const RISK_MULT = {
    low:    [8.1, 3,   1.6, 1.4, 1.1, 1,   0.5, 1,   1.1, 1.4, 1.6, 3,   8.1],
    medium: [24,  5.5, 2.4, 1.5, 1.1, 0.7, 0.4, 0.7, 1.1, 1.5, 2.4, 5.5, 24 ],
    high:   [170, 30,  8,   3,   1,   0.5, 0.2, 0.5, 1,   3,   8,   30,  170]
  };

  // Геометрия доски (в % от высоты)
  const TOP_PAD  = 7;    // пустота до первой линии пегов
  const ROW_H    = 6.0;  // расстояние между рядами
  const SLOT_TOP = 82;   // верх ряда слотов
  const SLOT_H   = 12;   // высота слотов

  const P = {
    risk: 'medium',
    lastSlot: null,
    lastMult: null,
    rolling: false
  };

  /* ---------- Утилиты --------------------------------------------------- */
  function isBusyLocal() {
    try { if (typeof busy !== 'undefined' && busy) return true; } catch (e) {}
    return false;
  }
  function fmtMult(m) {
    if (m >= 100) return Math.round(m) + '×';
    if (m >= 10)  return m.toFixed(0) + '×';
    return m.toFixed(1).replace(/\.0$/, '') + '×';
  }
  function slotClass(m) {
    if (m <= 0.4) return 's-crit';
    if (m <= 0.7) return 's-danger';
    if (m <= 1.1) return 's-mid';
    if (m <= 2.5) return 's-good';
    if (m <= 10)  return 's-gold';
    return 's-epic';
  }
  function sleepP(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ---------- SVG-иконка ------------------------------------------------ */
  function injectSprite() {
    const sprite = document.querySelector('svg.sprite');
    if (!sprite || document.getElementById('g-plinko')) return;
    sprite.insertAdjacentHTML('beforeend',
      '<symbol id="g-plinko" viewBox="0 0 24 24">' +
        '<circle cx="12" cy="3.5" r="1.5" class="fill-fg"/>' +
        '<circle cx="9" cy="8.5" r="1"/>' +
        '<circle cx="15" cy="8.5" r="1"/>' +
        '<circle cx="6" cy="13.5" r="1"/>' +
        '<circle cx="12" cy="13.5" r="1"/>' +
        '<circle cx="18" cy="13.5" r="1"/>' +
        '<path d="M3.5 17 L20.5 17 L19 21 L5 21 Z" stroke-width="1.3"/>' +
        '<path d="M8 17 L8 21 M12 17 L12 21 M16 17 L16 21" opacity=".4" stroke-width="1"/>' +
      '</symbol>'
    );
  }

  /* ---------- CSS ------------------------------------------------------- */
  function injectStyles() {
    if (document.getElementById('plinko-style')) return;
    const css =
      // Тема окна
      'body[data-game="plinko"] { --bg:#0b0a18; --hdr-bg:rgba(11,10,24,.72); --ambient:150,130,220; }' +
      'body[data-game="plinko"]::before { background: radial-gradient(60% 40% at 20% 0%, rgba(150,130,220,.10), transparent 70%), radial-gradient(50% 40% at 100% 100%, rgba(150,130,220,.08), transparent 70%); }' +
      'body[data-game="plinko"] .stage { background:linear-gradient(170deg,#13102a,#080714); border-color:#2c2450; }' +
      'body[data-game="plinko"] .bet-top .bv { color:#b8a3ff; }' +
      'body[data-game="plinko"] .btn { background:linear-gradient(180deg,#8b7ae0,#5a45a8); color:#fff; box-shadow:0 4px 16px rgba(139,122,224,.28); }' +
      'body[data-game="plinko"] .btn:hover:not(:disabled) { box-shadow:0 6px 22px rgba(139,122,224,.4); }' +
      'body[data-game="plinko"] .toggle button.on { background:linear-gradient(180deg,#8b7ae0,#5a45a8); color:#fff; }' +
      'body[data-game="plinko"] .toggle button.on.low { background:linear-gradient(180deg,#c8503f,#7a2018); color:#fff; }' +
      'body[data-game="plinko"] #stars { filter: hue-rotate(230deg) saturate(1.3) brightness(1.05); }' +

      // Стадия
      '.plinko-risk-toggle { margin: 10px 14px 0; }' +
      '.plinko-risk-toggle button { padding:11px 4px; font-size:12px; }' +
      '.plinko-stage { margin:12px 14px; }' +
      '.plinko-board {' +
        'position:relative;width:100%;aspect-ratio:13/15;' +
        'background:linear-gradient(180deg,#15122b,#0a0818);' +
        'border:1px solid #2c2450;border-radius:14px;overflow:hidden;' +
        'box-shadow:inset 0 0 40px rgba(0,0,0,.55);' +
      '}' +
      '.plinko-peg {' +
        'position:absolute;width:5px;height:5px;border-radius:50%;' +
        'background:#d9d3ff;transform:translate(-50%,-50%);' +
        'box-shadow:0 0 4px rgba(217,211,255,.5);' +
      '}' +
      '.plinko-ball {' +
        'position:absolute;width:14px;height:14px;border-radius:50%;' +
        'background:radial-gradient(circle at 35% 30%, #fff6d8, #f2c96b 45%, #a87520);' +
        'border:1px solid #6b4a12;' +
        'transform:translate(-50%,-50%);z-index:5;' +
        'box-shadow:0 0 14px rgba(242,201,107,.55);' +
        'will-change:left,top;' +
      '}' +
      '.plinko-ball.landed {' +
        'animation:plinkoLand .55s cubic-bezier(.34,1.56,.64,1);' +
      '}' +
      '@keyframes plinkoLand {' +
        '0% { transform:translate(-50%,-50%) scale(1); }' +
        '40% { transform:translate(-50%,-50%) scale(1.6); }' +
        '100% { transform:translate(-50%,-50%) scale(1); }' +
      '}' +
      '.plinko-slots {' +
        'position:absolute;left:0;right:0;' +
        'display:grid;grid-template-columns:repeat(13,1fr);' +
      '}' +
      '.plinko-slot {' +
        'margin:0 1px;' +
        'display:grid;place-items:center;' +
        'font-size:9.5px;font-weight:800;' +
        'border-radius:7px;border:1px solid;' +
        'letter-spacing:-.02em;font-variant-numeric:tabular-nums;' +
        'color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6);' +
        'transition:transform .35s cubic-bezier(.34,1.56,.64,1), box-shadow .25s;' +
      '}' +
      '.plinko-slot.s-crit   { background:linear-gradient(180deg,#7a2018,#4a1008); border-color:#a8342a; }' +
      '.plinko-slot.s-danger { background:linear-gradient(180deg,#a83a2a,#6b1a10); border-color:#d0503f; }' +
      '.plinko-slot.s-mid    { background:linear-gradient(180deg,#a06020,#6b3c10); border-color:#c98030; }' +
      '.plinko-slot.s-good   { background:linear-gradient(180deg,#b68a26,#7a5a10); border-color:#e8bd63; }' +
      '.plinko-slot.s-gold   { background:linear-gradient(180deg,#e8bd63,#a87520); border-color:#f2c96b; box-shadow:0 0 10px rgba(217,164,65,.35); }' +
      '.plinko-slot.s-epic   { background:linear-gradient(180deg,#c04dff,#6a2099); border-color:#e08aff; box-shadow:0 0 14px rgba(192,77,255,.55); }' +
      '.plinko-slot.hit {' +
        'transform:translateY(-6px) scale(1.18);' +
        'box-shadow:0 0 22px rgba(242,201,107,.7), 0 0 8px rgba(255,255,255,.4);' +
      '}' +
      '@media (min-width:900px) {' +
      '  .plinko-stage { margin:16px 0; }' +
      '  .plinko-slot { font-size:11.5px; }' +
      '}' +
      '@media (max-width:399px) {' +
      '  .plinko-slot { font-size:8.5px; }' +
      '}' +
      '@media (prefers-reduced-motion:reduce) {' +
      '  .plinko-ball, .plinko-ball.landed, .plinko-slot { animation:none !important; transition:none !important; }' +
      '}';
    const s = document.createElement('style');
    s.id = 'plinko-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- Звук ------------------------------------------------------ */
  function snd(f, dur, type, vol, when) {
    try { if (typeof tone === 'function') tone(f, dur, type, vol, when); } catch (e) {}
  }
  function sndDrop() { snd(180, .28, 'sawtooth', .03); }
  function sndTick() { snd(900 + Math.random() * 300, .035, 'square', .02); }
  function sndLand(mult) {
    if (mult >= 10) [523, 659, 784, 1047, 1319].forEach((f, i) => snd(f, .22, 'triangle', .06, i * .08));
    else if (mult >= 3) [523, 659, 784].forEach((f, i) => snd(f, .16, 'triangle', .05, i * .07));
    else if (mult > 1) snd(660, .15, 'triangle', .04);
    else if (mult < 1) snd(200, .22, 'sawtooth', .03);
    else snd(440, .1, 'sine', .03);
  }

  /* ---------- Разметка -------------------------------------------------- */
  function buildBoard() {
    const board = document.getElementById('plinkoBoard');
    if (!board) return;
    // Идемпотентно: не перестраиваем, если уже построено с этим риском
    if (board.dataset.built === '1' && board.dataset.risk === P.risk) return;

    const mults = RISK_MULT[P.risk];
    let html = '';

    // Пеги
    for (let i = 0; i < ROWS; i++) {
      const pegCount = i + 3;
      const rowY = TOP_PAD + i * ROW_H;
      for (let j = 0; j < pegCount; j++) {
        const p = j - (pegCount - 1) / 2;
        const xPct = (p + 6.5) / 13 * 100;
        html += '<div class="plinko-peg" style="left:' + xPct.toFixed(3) + '%;top:' + rowY.toFixed(3) + '%"></div>';
      }
    }

    // Шар
    html += '<div class="plinko-ball" id="plinkoBall"></div>';

    // Слоты
    html += '<div class="plinko-slots" style="top:' + SLOT_TOP + '%;height:' + SLOT_H + '%">';
    for (let i = 0; i < SLOTS; i++) {
      const m = mults[i];
      html += '<div class="plinko-slot ' + slotClass(m) + '" data-idx="' + i + '">' + fmtMult(m) + '</div>';
    }
    html += '</div>';

    board.innerHTML = html;
    board.dataset.built = '1';
    board.dataset.risk = P.risk;
  }

  /* ---------- Экран ----------------------------------------------------- */
  function plinkoScreen() {
    return '' +
      (typeof gameHeader === 'function' ? gameHeader('Плинко', 'Урони шар · риск до 170×') : '') +
      (typeof chipBar === 'function' ? chipBar() : '') +
      (typeof betBox === 'function' ? betBox() : '') +
      '<div class="plinko-risk-toggle toggle">' +
        '<button class="' + (P.risk === 'low' ? 'on low' : '') + '" onclick="setPlinkoRisk(\'low\')">НИЗКИЙ</button>' +
        '<button class="' + (P.risk === 'medium' ? 'on' : '') + '" onclick="setPlinkoRisk(\'medium\')">СРЕДНИЙ</button>' +
        '<button class="' + (P.risk === 'high' ? 'on' : '') + '" onclick="setPlinkoRisk(\'high\')">ВЫСОКИЙ</button>' +
      '</div>' +
      '<div class="plinko-stage">' +
        '<div class="plinko-board" id="plinkoBoard"></div>' +
      '</div>' +
      '<div class="bottom">' +
        '<button class="btn js-betbtn" data-label="Уронить шар" id="plinkoDropBtn" onclick="dropPlinkoBall()" ' + (P.rolling ? 'disabled' : '') + '>' +
          (P.rolling ? 'Шар падает...' : 'Уронить шар · ' + (typeof fmt === 'function' && typeof S !== 'undefined' && S ? fmt(S.bet) : '')) +
        '</button>' +
      '</div>';
  }

  /* ---------- Действия -------------------------------------------------- */
  function setRisk(r) {
    if (P.rolling || !RISK_MULT[r]) return;
    P.risk = r;
    try { if (typeof SFX !== 'undefined' && SFX && SFX.click) SFX.click(); } catch (e) {}
    if (typeof render === 'function') render();
  }

  async function dropBall() {
    if (P.rolling || isBusyLocal()) return;
    if (typeof S === 'undefined' || !S || S.over) return;

    const bet = S.bet;
    if (typeof takeBet !== 'function' || !takeBet(bet)) return;

    P.rolling = true;
    const btn = document.getElementById('plinkoDropBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Шар падает...'; }

    // RNG: 12 L/R решений
    const decisions = [];
    for (let i = 0; i < ROWS; i++) decisions.push(Math.random() < 0.5);
    let p = 0;
    for (const d of decisions) p += d ? 0.5 : -0.5;
    const slotIdx = Math.round(p + 6);
    const mult = RISK_MULT[P.risk][slotIdx];
    P.lastSlot = slotIdx;
    P.lastMult = mult;

    // Выплата сразу (RNG честный; анимация — театр)
    const w = (typeof payout === 'function') ? payout(bet, mult, 'plinko') : 0;
    const net = w - bet;

    // Анимация
    const board = document.getElementById('plinkoBoard');
    const ball  = document.getElementById('plinkoBall');

    if (board && ball) {
      board.querySelectorAll('.plinko-slot.hit').forEach(el => el.classList.remove('hit'));

      const W = board.clientWidth;
      const H = board.clientHeight;
      const topPx    = H * TOP_PAD / 100;
      const rowHpx   = H * ROW_H / 100;
      const slotTopPx = H * SLOT_TOP / 100;
      const slotHpx  = H * SLOT_H / 100;

      const path = [];
      path.push({ x: W / 2, y: topPx - H * 0.035 });
      let pp = 0;
      for (let i = 0; i < ROWS; i++) {
        pp += decisions[i] ? 0.5 : -0.5;
        path.push({ x: (pp + 6.5) / 13 * W, y: topPx + (i + 1) * rowHpx });
      }
      const finalY = slotTopPx + slotHpx * 0.45;

      ball.style.left = path[0].x + 'px';
      ball.style.top  = path[0].y + 'px';
      ball.classList.remove('landed');
      ball.classList.add('falling');
      sndDrop();

      for (let i = 1; i < path.length; i++) {
        await tweenBall(ball, path[i - 1], path[i], 92 + i * 4);
        sndTick();
        ball.style.transform = 'translate(-50%,-50%) scale(1.18)';
        await sleepP(45);
        ball.style.transform = 'translate(-50%,-50%) scale(1)';
      }
      await tweenBall(ball, path[path.length - 1], { x: path[path.length - 1].x, y: finalY }, 200);
      ball.classList.remove('falling');
      ball.classList.add('landed');

      const slotEl = board.querySelector('.plinko-slot[data-idx="' + slotIdx + '"]');
      if (slotEl) slotEl.classList.add('hit');
    }

    // Эффекты
    sndLand(mult);
    if (mult > 1) {
      if (typeof registerWin === 'function') registerWin(net);
      if (mult >= 10) {
        if (typeof bigWinFX === 'function') bigWinFX(3);
      } else if (mult >= 3) {
        if (typeof starPulse === 'function') starPulse(1300, 1.9);
      }
    } else if (mult < 1) {
      if (typeof registerLoss === 'function') registerLoss();
      try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
    }

    P.rolling = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Уронить шар · ' + (typeof fmt === 'function' ? fmt(S.bet) : ''); }

    if (typeof checkBroke === 'function' && checkBroke()) return;
    if (typeof refreshDynamic === 'function') refreshDynamic();
  }

  function tweenBall(ball, from, to, duration) {
    return new Promise(resolve => {
      const startT = performance.now();
      function step(now) {
        const t = Math.min(1, (now - startT) / duration);
        const e = 1 - Math.pow(1 - t, 3);
        ball.style.left = (from.x + (to.x - from.x) * e) + 'px';
        ball.style.top  = (from.y + (to.y - from.y) * e) + 'px';
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  /* ---------- Инъекция карточки в хаб ----------------------------------- */
  function injectPlinkoCard() {
    const grid = document.querySelector('#app .grid');
    if (!grid) return;
    if (grid.querySelector('[data-plinko]')) return;

    const icoFn = typeof ico === 'function'
      ? ico
      : function (n, s) { return '<svg width="' + s + '" height="' + s + '"><use href="#' + n + '"/></svg>'; };

    const card = document.createElement('div');
    card.className = 'gcard';
    card.dataset.plinko = '1';
    card.onclick = function () {
      if (typeof go === 'function') go('plinko');
    };
    card.innerHTML =
      '<div class="ev">~99%</div>' +
      '<span class="gi">' + icoFn('g-plinko', 40) + '</span>' +
      '<div class="gn">Плинко</div>' +
      '<div class="gd">Урони шар. Риск<br>до 170×.</div>' +
      '<div class="kb">6</div>';

    const anchor = grid.querySelector('[onclick*="records"]');
    if (anchor) grid.insertBefore(card, anchor);
    else grid.appendChild(card);
  }

  /* ---------- Патч render ----------------------------------------------- */
  function patchRender() {
    const origRender = window.render;
    if (typeof origRender !== 'function') return false;
    if (window.__lux7_plinko_patched) return true;

    window.render = function () {
      try {
        if (typeof S !== 'undefined' && S && S.screen === 'plinko') {
          document.body.dataset.game = 'plinko';
          const app = document.getElementById('app');
          if (app) {
            app.innerHTML = '<div class="anim-screen" style="display:flex;flex-direction:column;flex:1">' + plinkoScreen() + '</div>';
            buildBoard();
          }
          return;
        }
        if (document.body.dataset.game === 'plinko') {
          delete document.body.dataset.game;
        }
      } catch (e) {}
      return origRender.apply(this, arguments);
    };
    window.__lux7_plinko_patched = true;
    return true;
  }

  /* ---------- Наблюдатель ----------------------------------------------- */
  function observe() {
    const obs = new MutationObserver(() => {
      injectPlinkoCard();
      const board = document.getElementById('plinkoBoard');
      if (board && (!board.dataset.built || board.dataset.risk !== P.risk)) buildBoard();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- Клавиатура ------------------------------------------------ */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // '6' — открыть Плинко с хаба
    if (e.key === '6') {
      try {
        if (typeof S !== 'undefined' && S && S.screen === 'hub') {
          e.preventDefault();
          if (typeof go === 'function') go('plinko');
        }
      } catch (err) {}
      return;
    }

    // Пробел/Enter — уронить шар, если мы в Плинко
    if (e.key === ' ' || e.key === 'Enter') {
      try {
        if (typeof S !== 'undefined' && S && S.screen === 'plinko') {
          if (!P.rolling && typeof dropPlinkoBall === 'function') dropPlinkoBall();
        }
      } catch (err) {}
    }
  });

  /* ---------- Экспорт --------------------------------------------------- */
  window.plinkoScreen = plinkoScreen;
  window.setPlinkoRisk = setRisk;
  window.dropPlinkoBall = dropBall;
  window.LUX7Plinko = { getState: function () { return P; } };

  /* ---------- Boot ------------------------------------------------------ */
  function init() {
    injectSprite();
    injectStyles();
    if (!patchRender()) {
      let tries = 0;
      const iv = setInterval(() => {
        tries++;
        if (patchRender() || tries > 30) clearInterval(iv);
      }, 100);
    }
    observe();
    injectPlinkoCard();
    const board = document.getElementById('plinkoBoard');
    if (board) buildBoard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
