/* ============================================================================
   ЛЮКС-7 · BOSSES-REWORK.JS
   Переработка боссов: теперь они УСЛОЖНЯЮТ игру, а награда — деньги + предмет.
   Подключается последним. Патчит BOSSES, grantBossReward, anteCost,
   bjFinish и takeElevator через обёртки.
   ============================================================================ */
(function () {
  'use strict';

  /* ======================= НОВЫЕ БОССЫ ==================================== */
  const BOSSES_NEW = {
    3: {
      id: 'cheat', icon: 'b-cheat', name: 'Крупье-обманщик',
      quote: '«Ставки сделаны. И колода уже подкручена.»',
      desc: 'BJ платит вдвое меньше (1.5:1 → 0.5:1), слоты приносят лишь 40% выигрыша, все победы урезаны на 10%. Дилер берёт карту на мягких 17.',
      mods: {
        bjBonus: -0.4,           // 2.5× → 1.5×
        slotsPay: 0.4,           // слоты платят 40%
        winTax: 0.10,            // −10% от профита во всех играх
        dealerHitsSoft17: true,  // дилер перебирает мягкие 17
      },
      rewardChips: 250,
      rewardItem: 'random',
      rewardText: '+250 фишек · случайный предмет',
    },
    6: {
      id: 'inspector', icon: 'b-inspector', name: 'Инспектор',
      quote: '«Всё по правилам. Моим правилам.»',
      desc: 'Ставки зажаты от 50 до 200. BJ платит совсем мало (1.5:1 → 0.25:1). Все победы −15%.',
      mods: {
        minBet: 50,
        maxBet: 200,
        bjBonus: -0.5,           // 2.5× → 1.25×
        winTax: 0.15,
      },
      rewardChips: 500,
      rewardItem: 'rare',
      rewardPerk: true,
      rewardText: '+500 фишек · редкий предмет · бонус-перк',
    },
    9: {
      id: 'keeper', icon: 'b-keeper', name: 'Хранитель долгов',
      quote: '«Счёт открыт. Плати сейчас или плати дважды.»',
      desc: 'Забирает 30% с каждого выигрыша. Лифт на этом этаже стоит +70%. На входе сгорает 8% фишек.',
      mods: {
        winTax: 0.30,
        liftMult: 1.7,           // лифт дороже
        preEntry: 0.08,          // −8% фишек при входе
      },
      rewardChips: 1000,
      rewardItem: 'epic',
      rewardText: '+1000 фишек · эпический предмет',
    },
  };

  /* ======================= УТИЛИТЫ ======================================== */
  function exists(fn) { return typeof window[fn] === 'function'; }
  function tryLex(fn) { try { return eval(fn); } catch (e) { return undefined; } }
  function bossModsLocal() {
    try { return (typeof bossMods === 'function') ? bossMods() : {}; } catch (e) { return {}; }
  }
  function sVal() {
    try { return (typeof S !== 'undefined') ? S : null; } catch (e) { return null; }
  }

  function pickBossItem(tier) {
    const pools = {
      random: ['gem', 'ward', 'lucky', 'ace', 'joker'],
      rare:   ['ward', 'lucky'],
      epic:   ['ace', 'joker'],
    };
    const pool = pools[tier] || pools.random;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function itemName(id) {
    return ({
      gem:'Самоцвет', chest:'Сундук', ward:'Оберег',
      lucky:'Клевер', ace:'Туз в рукаве', joker:'Джокер'
    })[id] || id;
  }

  /* ======================= ПАТЧ 1: BOSSES ================================= */
  function patchBosses() {
    if (typeof BOSSES === 'undefined' || !BOSSES) return false;
    if (window.__bossRework_bosses) return true;
    try {
      BOSSES[3] = BOSSES_NEW[3];
      BOSSES[6] = BOSSES_NEW[6];
      BOSSES[9] = BOSSES_NEW[9];
      // Обновляем активного босса в текущем забеге
      const S = sVal();
      if (S && S.boss && BOSSES[S.floor]) S.boss = BOSSES[S.floor];
      window.__bossRework_bosses = true;
      return true;
    } catch (e) { return false; }
  }

  /* ======================= ПАТЧ 2: grantBossReward ======================= */
  function patchGrant() {
    if (window.__bossRework_grant) return true;
    if (!exists('grantBossReward')) return false;
    window.__bossRework_grant = true;

    window.grantBossReward = function (boss) {
      if (!boss) return;
      const S = sVal(); if (!S) return;

      // ----- Деньги -----
      if (boss.rewardChips) {
        S.chips += boss.rewardChips;
        S.peak = Math.max(S.peak || 0, S.chips);
        setTimeout(function () {
          if (typeof toast === 'function') toast('Босс побеждён: +' + boss.rewardChips + ' фишек', 'gold', boss.icon);
          if (typeof bigWinFX === 'function') bigWinFX(3);
          if (typeof refreshDynamic === 'function') refreshDynamic();
        }, 500);
      }

      // ----- Предмет -----
      if (boss.rewardItem && window.LUX7Items) {
        const id = pickBossItem(boss.rewardItem);
        setTimeout(function () {
          const ok = window.LUX7Items.give(id);
          if (ok && typeof toast === 'function') {
            toast('Трофей босса: ' + itemName(id), 'gold');
          } else if (!ok && typeof toast === 'function') {
            toast('Инвентарь полон — трофей потерян', 'bad');
          }
        }, 900);
      }

      // ----- Доп. перк (Инспектор) -----
      if (boss.rewardPerk) {
        try {
          const avail = PERKS.filter(function (p) { return S.perks.indexOf(p.id) < 0; });
          if (avail.length) {
            const p = avail[Math.floor(Math.random() * avail.length)];
            S.perks.push(p.id);
            setTimeout(function () {
              if (typeof toast === 'function') toast('Бонус-перк: ' + p.name, 'gold', p.icon);
              if (typeof render === 'function') render();
            }, 1300);
          }
        } catch (e) {}
      }

      // ----- Ачивки -----
      try {
        if (typeof unlockAch === 'function') {
          if (boss.id === 'cheat') unlockAch('boss_1');
          if (boss.id === 'inspector') unlockAch('boss_2');
          if (boss.id === 'keeper') unlockAch('boss_3');
        }
      } catch (e) {}

      // ----- Автосейв -----
      try { if (typeof saveRun === 'function') saveRun(); } catch (e) {}
    };
    return true;
  }

  /* ======================= ПАТЧ 3: anteCost (liftMult) =================== */
  function patchAnte() {
    if (window.__bossRework_ante) return true;
    if (!exists('anteCost')) return false;
    window.__bossRework_ante = true;

    const orig = window.anteCost;
    window.anteCost = function () {
      let c = orig.apply(this, arguments);
      try {
        const bm = bossModsLocal();
        if (bm && bm.liftMult) c = Math.round(c * bm.liftMult);
      } catch (e) {}
      return c;
    };
    return true;
  }

  /* ======================= ПАТЧ 4: BJ — дилер на мягких 17 ============== */
  function patchBjFinish() {
    if (window.__bossRework_bj) return true;
    if (!exists('bjFinish')) return false;
    window.__bossRework_bj = true;

    const orig = window.bjFinish;
    window.bjFinish = async function (reason, text) {
      // Дилер берёт карту на мягких 17 (перебор для игрока)
      try {
        const bm = bossModsLocal();
        const st = tryLex('bjState');
        if (reason === 'stand' && bm && bm.dealerHitsSoft17 && st) {
          const d = st.dealer;
          const hv = tryLex('handVal');
          const isS = tryLex('isSoft');
          const msh = tryLex('makeShoe');
          const slp = tryLex('sleep');
          const sfx = tryLex('SFX');
          const rndr = window.render;
          const bz = tryLex('buzz');
          if (hv && isS) {
            let guard = 0;
            while ((hv(d) < 17 || (isS(d) && hv(d) === 17)) && guard < 8) {
              guard++;
              if (slp) await slp(320);
              if (st.shoe.length < 60 && msh) st.shoe = msh();
              d.push(st.shoe.pop());
              if (sfx && sfx.deal) sfx.deal();
              if (rndr) rndr();
              if (bz) bz(10);
            }
          }
        }
      } catch (e) {}

      return orig.call(this, reason, text);
    };
    return true;
  }

  /* ======================= ПАТЧ 5: takeElevator (preEntry) ============== */
  function patchElevator() {
    if (window.__bossRework_lift) return true;
    if (!exists('takeElevator')) return false;
    window.__bossRework_lift = true;

    const orig = window.takeElevator;
    window.takeElevator = function () {
      const S0 = sVal();
      const beforeFloor = S0 ? S0.floor : 0;
      const result = orig.apply(this, arguments);
      try {
        const S = sVal();
        if (S && S.floor > beforeFloor && S.boss && S.boss.mods && S.boss.mods.preEntry) {
          const loss = Math.round(S.chips * S.boss.mods.preEntry);
          if (loss > 0) {
            S.chips -= loss;
            setTimeout(function () {
              if (typeof toast === 'function') toast(S.boss.icon + ' ' + S.boss.name + ': −' + (typeof fmt === 'function' ? fmt(loss) : loss) + ' фишек на входе', 'bad');
              if (typeof checkBroke === 'function' && checkBroke()) return;
              if (typeof render === 'function') render();
            }, 700);
          }
        }
      } catch (e) {}
      return result;
    };
    return true;
  }

  /* ======================= ПАТЧ 6: showBossInfo (бейдж «усложняет») ==== */
  function patchBossInfo() {
    if (window.__bossRework_info) return true;
    if (!exists('showBossInfo')) return false;
    window.__bossRework_info = true;

    const orig = window.showBossInfo;
    window.showBossInfo = function () {
      const S = sVal();
      if (!S || !S.boss) return orig && orig.apply(this, arguments);
      const b = S.boss;
      const list = [];
      const m = b.mods || {};
      if (m.winTax)   list.push('Все выигрыши −' + Math.round(m.winTax * 100) + '% от профита');
      if (m.bjBonus != null) {
        const mult = 2.5 * (1 + m.bjBonus);
        list.push('Блэкджек платит ×' + mult.toFixed(2) + ' вместо ×2.5');
      }
      if (m.slotsPay) list.push('Слоты платят ×' + m.slotsPay.toFixed(2) + ' от нормы');
      if (m.dealerHitsSoft17) list.push('Дилер берёт карту на мягких 17');
      if (m.minBet && m.maxBet) list.push('Ставки от ' + m.minBet + ' до ' + m.maxBet);
      if (m.liftMult) list.push('Лифт стоит ×' + m.liftMult.toFixed(2));
      if (m.preEntry) list.push('−' + Math.round(m.preEntry * 100) + '% фишек при входе на этаж');

      document.getElementById('modal-root').innerHTML =
        '<div class="modal" onclick="if(event.target===this)closeModal()">' +
          '<div class="modal-in">' +
            '<h2 style="color:#ff8a7a;justify-content:center">' +
              (typeof ico === 'function' ? ico(b.icon, 24) : '') + b.name +
            '</h2>' +
            '<p style="font-style:italic;text-align:center;color:var(--mut)">' + b.quote + '</p>' +
            '<div style="height:1px;background:linear-gradient(90deg,transparent,#5c2a22,transparent);margin:14px 0"></div>' +
            '<div style="font-size:10px;letter-spacing:.22em;color:#ff8a7a;text-transform:uppercase;margin-bottom:8px">Усложнения этажа</div>' +
            '<ul style="padding-left:18px;margin:0 0 14px">' +
              list.map(function (s) { return '<li style="font-size:12.5px;color:var(--txt);line-height:1.5;margin-bottom:4px">' + s + '</li>'; }).join('') +
            '</ul>' +
            '<div style="font-size:10px;letter-spacing:.22em;color:var(--gold2);text-transform:uppercase;margin-bottom:6px">Награда за прохождение</div>' +
            '<p style="color:var(--gold2);font-weight:700;font-size:13px">' + b.rewardText + '</p>' +
            '<button class="btn sec" style="margin-top:20px" onclick="closeModal()">Закрыть</button>' +
          '</div>' +
        '</div>';
    };
    return true;
  }

  /* ======================= ПАТЧ 7: showBossIntro (список) =============== */
  function patchBossIntro() {
    if (window.__bossRework_intro) return true;
    if (!exists('showBossIntro')) return false;
    window.__bossRework_intro = true;

    const orig = window.showBossIntro;
    window.showBossIntro = function (boss) {
      if (!boss) return;
      try {
        const m = boss.mods || {};
        const list = [];
        if (m.winTax)   list.push('−' + Math.round(m.winTax * 100) + '% от всех выигрышей');
        if (m.bjBonus != null) list.push('Блэкджек: ×' + (2.5 * (1 + m.bjBonus)).toFixed(2) + ' вместо ×2.5');
        if (m.slotsPay) list.push('Слоты платят ×' + m.slotsPay.toFixed(2));
        if (m.dealerHitsSoft17) list.push('Дилер берёт на мягких 17');
        if (m.minBet && m.maxBet) list.push('Ставки от ' + m.minBet + ' до ' + m.maxBet);
        if (m.liftMult) list.push('Лифт +' + Math.round((m.liftMult - 1) * 100) + '%');
        if (m.preEntry) list.push('−' + Math.round(m.preEntry * 100) + '% фишек на входе');

        if (typeof SFX !== 'undefined' && SFX && SFX.boss) SFX.boss();
        if (typeof starPulse === 'function') starPulse(2400, 3.5);

        document.getElementById('modal-root').innerHTML =
          '<div class="modal">' +
            '<div class="modal-in">' +
              '<div class="boss-hero anim-boss">' +
                '<div class="bi">' + (typeof ico === 'function' ? ico(boss.icon, 64) : '') + '</div>' +
                '<div class="bn">' + boss.name + '</div>' +
                '<div class="bq">' + boss.quote + '</div>' +
              '</div>' +
              '<div style="height:1px;background:linear-gradient(90deg,transparent,#5c2a22,transparent);margin:10px 0 14px"></div>' +
              '<div style="font-size:10px;letter-spacing:.22em;color:#ff8a7a;text-transform:uppercase;margin-bottom:8px">Что усложняется</div>' +
              '<ul style="padding-left:18px;margin:0 0 18px">' +
                list.map(function (s) { return '<li style="font-size:12.5px;color:var(--txt);line-height:1.55;margin-bottom:5px">' + s + '</li>'; }).join('') +
              '</ul>' +
              '<div class="boss-stat"><span>Награда за прохождение</span><span>' + boss.rewardText + '</span></div>' +
              '<button class="btn danger" style="margin-top:18px" onclick="closeModal()">Принять вызов</button>' +
            '</div>' +
          '</div>';
      } catch (e) {
        return orig.call(this, boss);
      }
    };
    return true;
  }

  /* ======================= BOOT ========================================== */
  function apply() {
    const ok1 = patchBosses();
    const ok2 = patchGrant();
    const ok3 = patchAnte();
    const ok4 = patchBjFinish();
    const ok5 = patchElevator();
    const ok6 = patchBossInfo();
    const ok7 = patchBossIntro();
    return ok1 && ok2 && ok3 && ok4 && ok5 && ok6 && ok7;
  }

  let tries = 0;
  const iv = setInterval(function () {
    tries++;
    if (apply() || tries > 60) clearInterval(iv);
  }, 100);

  window.LUX7Bosses = {
    BOSSES: BOSSES_NEW,
    _reapply: apply,
  };
})();
