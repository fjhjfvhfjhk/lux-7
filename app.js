/* ============================================================================
   ЛЮКС-7 — РОГАЛИК-КАЗИНО · v2.4
   ============================================================================ */
'use strict';

/* ------------------------------- УТИЛИТЫ -------------------------------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const setText = (sel, v) => { const e = $(sel); if (e) e.textContent = v; };
function ico(name, size) {
  size = size || 20;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><use href="#${name}"/></svg>`;
}

/* ------------------------------- ЗВУК ---------------------------------- */
let AC = null, soundOn = true, musicOn = false;
try { soundOn = localStorage.getItem('lux7_sound') !== '0'; musicOn = localStorage.getItem('lux7_music') === '1'; } catch (e) {}
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
  return AC;
}
function tone(f, dur, type, vol, when) {
  if (!soundOn) return;
  const c = ac(); if (!c) return;
  try {
    const t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol || 0.04, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.03);
  } catch (e) {}
}
const SFX = {
  click: () => tone(430, .05, 'square', .025),
  chip:  () => { tone(880, .06, 'triangle', .04); tone(1320, .05, 'triangle', .025, .04); },
  win:   () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .16, 'triangle', .045, i * .07)),
  big:   () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .22, 'triangle', .055, i * .08)),
  lose:  () => { tone(220, .18, 'sawtooth', .035); tone(160, .26, 'sawtooth', .03, .1); },
  deal:  () => tone(300, .04, 'square', .025),
  tick:  () => tone(700, .025, 'square', .018),
  ach:   () => [784, 1047, 1319, 1568].forEach((f, i) => tone(f, .18, 'triangle', .05, i * .09)),
  event: () => [1047, 1319].forEach((f, i) => tone(f, .14, 'triangle', .05, i * .1)),
  boss:  () => { [130.81, 155.56, 196].forEach((f, i) => tone(f, .45, 'sawtooth', .05, i * .18)); tone(98, .6, 'sine', .04, .55); },
};
function toggleSound() {
  soundOn = !soundOn;
  try { localStorage.setItem('lux7_sound', soundOn ? '1' : '0'); } catch (e) {}
  if (soundOn) { ac(); SFX.chip(); }
  $$('#sndbtn').forEach(b => { b.innerHTML = ico(soundOn ? 'u-sound-on' : 'u-sound-off', 18); b.classList.toggle('on', soundOn); });
}
let musicNodes = null;
function startMusic() {
  const c = ac(); if (!c || musicNodes) return;
  try {
    const master = c.createGain();
    master.gain.value = 0; master.connect(c.destination);
    master.gain.linearRampToValueAtTime(0.022, c.currentTime + 2.5);
    const oscs = [];
    [110, 164.81, 220].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f; g.gain.value = 0.32;
      const lfo = c.createOscillator(), lfoGain = c.createGain();
      lfo.frequency.value = 0.05 + i * 0.02; lfoGain.gain.value = 0.18;
      lfo.connect(lfoGain); lfoGain.connect(g.gain); lfo.start();
      o.connect(g); g.connect(master); o.start();
      oscs.push(o, lfo);
    });
    musicNodes = { master, oscs };
  } catch (e) { musicNodes = null; }
}
function stopMusic() {
  if (!musicNodes) return;
  const c = ac();
  try {
    if (c) musicNodes.master.gain.linearRampToValueAtTime(0, c.currentTime + 0.6);
    setTimeout(() => {
      try { musicNodes.oscs.forEach(o => { try { o.stop(); } catch(e){} }); musicNodes.master.disconnect(); } catch(e){}
      musicNodes = null;
    }, 700);
  } catch (e) { musicNodes = null; }
}
function toggleMusic() {
  musicOn = !musicOn;
  try { localStorage.setItem('lux7_music', musicOn ? '1' : '0'); } catch (e) {}
  if (musicOn) { ac(); startMusic(); } else { stopMusic(); }
  $$('#musbtn').forEach(b => { b.innerHTML = ico(musicOn ? 'u-music-on' : 'u-music-off', 18); b.classList.toggle('on', musicOn); });
}

/* ------------------------------- КОНСТАНТЫ ------------------------------ */
const MAX_FLOOR = 10;
const START_CHIPS = 100;
const MIN_BET = 10;
const BEST_KEY = 'lux7_best_v1';
const RUN_KEY  = 'lux7_run_v1';
const ACH_KEY  = 'lux7_ach_v1';
const REC_KEY  = 'lux7_rec_v1';
const NAME_KEY = 'lux7_name_v1';
const STREAK_BONUS = 0.15;
const STREAK_MIN   = 3;

const PERKS = [
  { id:'hot',    icon:'p-hot',     name:'Горячие барабаны', desc:'Выплаты в Слотах +25%' },
  { id:'counter',icon:'p-counter', name:'Карточный счёт',   desc:'В Хай-Лоу показываются шансы и точный множитель' },
  { id:'dice',   icon:'p-cheat',   name:'Краплёные кости',  desc:'Один бесплатный переброс за игру в Костях' },
  { id:'comp',   icon:'p-comp',    name:'Комп-карта',       desc:'Один раз за забег спасает от банкротства: даёт 50 фишек' },
  { id:'ace',    icon:'p-ace',     name:'Туз в рукаве',     desc:'Блэкджек платит 2:1 вместо 1.5:1' },
  { id:'whale',  icon:'p-whale',   name:'Хайроллер',        desc:'Ставки от 100 фишек платят +20% во всех играх' },
  { id:'lucky',  icon:'p-lucky',   name:'Талисман',         desc:'10% шанс, что проигрышная ставка вернётся' },
  { id:'key',    icon:'p-key',     name:'Скелетный ключ',   desc:'Лифт стоит на 30% дешевле' },
];
const CURSES = [
  { id:'heavy', icon:'c-heavy', name:'Тяжёлый воздух',  desc:'Все выплаты −10%' },
  { id:'tax',   icon:'c-tax',   name:'Налог жадности',   desc:'Лифт стоит +50%' },
  { id:'blood', icon:'c-blood', name:'Кровавый сбор',    desc:'−5% фишек при входе на этаж' },
  { id:'skull', icon:'c-skull', name:'Наблюдатель',      desc:'Черепа на барабанах выпадают вдвое чаще' },
  { id:'cold',  icon:'c-cold',  name:'Холодная колода',  desc:'Хай-Лоу: ничья сжигает банк' },
  { id:'dry',   icon:'c-dry',   name:'Сухой закон',      desc:'Перки не работают на этом этаже' },
];
const CLASSES = [
  { id:'counter', icon:'k-scholar', name:'Считающий',
    desc:'Умный игрок. Начинает с перком «Карточный счёт». Блэкджек платит +5%.',
    perk:'counter', mods:{ bjBonus:0.05 } },
  { id:'fortune', icon:'p-lucky', name:'Фортуна',
    desc:'Родился в рубашке. Начинает с перком «Талисман». Шанс проклятия −25%.',
    perk:'lucky', mods:{ curseResist:0.25 } },
  { id:'rush',    icon:'p-hot', name:'Рисковый',
    desc:'Играет по-крупному. Все выплаты ×1.15, но лифт на 20% дороже.',
    perk:null, mods:{ allPay:1.15, liftCost:1.2 } },
];
const SHOP_ITEMS = [
  { id:'purge',  icon:'s-purge', name:'Снять проклятие', desc:'Убирает проклятие текущего этажа', price:200, once:true },
  { id:'random', icon:'s-gift',  name:'Случайный перк',  desc:'Перк из оставшихся в пуле',        price:400, once:true },
  { id:'ward',   icon:'s-ward',  name:'Оберег',          desc:'Следующий этаж без проклятия',    price:80,  once:true },
  { id:'heal',   icon:'s-heal',  name:'Страховка',       desc:'+40 фишек',                        price:30,  once:true },
];
const BOSSES = {
  3: {
    id:'cheat', icon:'b-cheat', name:'Крупье-обманщик',
    quote:'«Ставки сделаны, господа. И я их уже передвинул.»',
    desc:'Слоты платят вдвое меньше. Зато блэкджек платит +50%.',
    mods: { slotsPay: 0.5, bjBonus: 0.5 },
    rewardChips: 250,
    rewardText: '+250 фишек',
  },
  6: {
    id:'inspector', icon:'b-inspector', name:'Инспектор',
    quote:'«Проверка. У вас всё по правилам? А вот у нас — нет.»',
    desc:'Минимальная ставка 50, максимальная 200. Сыграйте одну партию — и получите перк.',
    mods: { minBet: 50, maxBet: 200 },
    rewardPerk: true,
    rewardText: 'Случайный перк',
  },
  9: {
    id:'keeper', icon:'b-keeper', name:'Хранитель долгов',
    quote:'«Вы задолжали дому. Пора платить.»',
    desc:'15% от каждой победы уходит в кассу. Победите его — и получите всё обратно.',
    mods: { winTax: 0.15 },
    rewardChips: 1000,
    rewardText: '+1000 фишек',
  },
};
const SLOT_SYMBOLS = [
  { id:'cherry', icon:'🍒', w:8, pay:7  },
  { id:'lemon',  icon:'🍋', w:7, pay:9  },
  { id:'bell',   icon:'🔔', w:5, pay:20 },
  { id:'gem',    icon:'💎', w:4, pay:32 },
  { id:'seven',  icon:'7️⃣', w:3, pay:80 },
  { id:'skull',  icon:'💀', w:4, pay:-2 },
];
const SLOT_PAIR_PAY = 1.15;
const BET_STEPS = [10,15,20,25,30,40,50,75,100,150,200,300,400,500,750,
                   1000,1500,2000,3000,4000,5000,7500,10000,15000,20000,
                   30000,50000,75000,100000,250000,500000,1000000];
const ROULETTE_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const rouColor = n => n === 0 ? 'green' : (ROULETTE_RED.has(n) ? 'red' : 'black');
const ROULETTE_BETS = [
  { id:'red',   label:'КРАСНОЕ',     cls:'red',   pay:2, test:n => n !== 0 && ROULETTE_RED.has(n) },
  { id:'black', label:'ЧЁРНОЕ',      cls:'black', pay:2, test:n => n !== 0 && !ROULETTE_RED.has(n) },
  { id:'even',  label:'ЧЁТ',         cls:'',      pay:2, test:n => n !== 0 && n % 2 === 0 },
  { id:'odd',   label:'НЕЧЁТ',       cls:'',      pay:2, test:n => n !== 0 && n % 2 === 1 },
  { id:'low',   label:'1–18',        cls:'',      pay:2, test:n => n >= 1 && n <= 18 },
  { id:'high',  label:'19–36',       cls:'',      pay:2, test:n >= 19 && n <= 36 },
  { id:'d1',    label:'1-я дюжина',  cls:'',      pay:3, test:n => n >= 1 && n <= 12 },
  { id:'d2',    label:'2-я дюжина',  cls:'',      pay:3, test:n => n >= 13 && n <= 24 },
  { id:'d3',    label:'3-я дюжина',  cls:'',      pay:3, test:n => n >= 25 && n <= 36 },
];
const ACHIEVEMENTS = [
  { id:'first_win',   icon:'a-check', name:'Первая кровь',   desc:'Выиграть первую ставку' },
  { id:'streak_3',    icon:'p-hot',   name:'В ударе',        desc:'3 победы подряд' },
  { id:'streak_5',    icon:'p-hot',   name:'Серия',          desc:'5 побед подряд' },
  { id:'big_win',     icon:'a-coins', name:'Жирный куш',     desc:'Выиграть 500+ за одну ставку' },
  { id:'jackpot',     icon:'a-777',   name:'777',            desc:'Три семёрки в слотах' },
  { id:'all_skulls',  icon:'c-skull', name:'Поцелуй смерти', desc:'Поймать три черепа в слотах' },
  { id:'bj_natural',  icon:'p-ace',   name:'Натурал',        desc:'Собрать блэкджек с раздачи' },
  { id:'roulette_red',icon:'a-red',   name:'Красное',        desc:'Выиграть на красном в рулетке' },
  { id:'roulette_zero',icon:'a-zero', name:'Зеро',           desc:'Увидеть зеро в рулетке' },
  { id:'whale',       icon:'p-whale', name:'Кит',            desc:'Поставить 1000+ за один раз' },
  { id:'floors_5',    icon:'a-elev',  name:'Полпути',        desc:'Добраться до 5 этажа' },
  { id:'floors_10',   icon:'a-crown', name:'Вершина',        desc:'Добраться до 10 этажа' },
  { id:'escape',      icon:'a-door',  name:'Свобода',        desc:'Выйти из казино живым' },
  { id:'broke',       icon:'a-broke', name:'На мели',        desc:'Проиграть всё' },
  { id:'boss_1',      icon:'a-boss',  name:'Первая голова',  desc:'Пройти 3-й этаж — Крупье-обманщика' },
  { id:'boss_2',      icon:'a-boss',  name:'Чисто',          desc:'Пройти 6-й этаж — Инспектора' },
  { id:'boss_3',      icon:'a-boss',  name:'Свободен от долгов', desc:'Пройти 9-й этаж — Хранителя долгов' },
];
const LIFT_EVENTS = [
  { name:'Найдена фишка',  desc:'Кто-то обронил у лифта', chips:30,  weight:5 },
  { name:'Фриспин-бонус',  desc:'Автомат выдал премию',     chips:45,  weight:4 },
  { name:'Чип под столом', desc:'Редкая удача',             chips:120, weight:2 },
  { name:'На чай от бара', desc:'Официант расщедрился',     chips:20,  weight:5 },
  { name:'Чаевые крупье',  desc:'Крупье помнит вас',        chips:70,  weight:3 },
];

/* -------------------------------- СОСТОЯНИЕ ----------------------------- */
let S = null;
let busy = false;
let ACH = loadAch();
let RECS = loadRecs();

function loadAch() { try { const raw = localStorage.getItem(ACH_KEY); return new Set(raw ? JSON.parse(raw) : []); } catch (e) { return new Set(); } }
function saveAch() { try { localStorage.setItem(ACH_KEY, JSON.stringify(Array.from(ACH))); } catch (e) {} }
function loadRecs() { try { const raw = localStorage.getItem(REC_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; } }
function saveRecs() { try { localStorage.setItem(REC_KEY, JSON.stringify(RECS)); } catch (e) {} }
function getPlayerName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
function setPlayerName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} }

function unlockAch(id) {
  if (ACH.has(id)) return;
  ACH.add(id); saveAch();
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;
  setTimeout(() => { toast('Достижение: ' + a.name, 'ach', a.icon); SFX.ach(); confettiBurst(35); starPulse(1500, 2); }, 500);
}

function newRun() {
  clearRun();
  S = {
    chips: START_CHIPS, floor: 1, peak: START_CHIPS,
    perks: [], curse: null, boss: null, compUsed: false, keyUsed: false, bet: 25,
    screen: 'class',
    stats: { spins:0, hands:0, rolls:0, highs:0, rou:0, wins:0, biggest:0, floors:1, bosses:0 },
    winStreak: 0, bestStreak: 0,
    cls: null, warded: false,
    over: false, result: null,
  };
  applyTheme();
  setGameTheme(null);
  render();
}
function migrate(s) {
  if (!s || typeof s !== 'object') return null;
  const d = { spins:0, hands:0, rolls:0, highs:0, rou:0, wins:0, biggest:0, floors:1, bosses:0 };
  s.stats = Object.assign(d, s.stats || {});
  if (!Array.isArray(s.perks)) s.perks = [];
  if (typeof s.bet !== 'number' || !isFinite(s.bet)) s.bet = 25;
  if (typeof s.chips !== 'number' || !isFinite(s.chips)) return null;
  if (typeof s.floor !== 'number') s.floor = 1;
  if (typeof s.peak !== 'number') s.peak = s.chips;
  if (typeof s.winStreak !== 'number') s.winStreak = 0;
  if (typeof s.bestStreak !== 'number') s.bestStreak = 0;
  if (!('cls' in s)) s.cls = null;
  if (!('warded' in s)) s.warded = false;
  if (BOSSES[s.floor]) s.boss = BOSSES[s.floor];
  else s.boss = null;
  s.screen = 'hub'; s.over = false;
  delete s._perkChoices; delete s._shopItems;
  return s;
}
function saveRun() {
  try {
    if (!S || S.over || S.screen !== 'hub') return;
    const c = JSON.parse(JSON.stringify(S));
    delete c._perkChoices; delete c._shopItems;
    localStorage.setItem(RUN_KEY, JSON.stringify(c));
  } catch (e) {}
}
function loadRun() {
  try { const raw = localStorage.getItem(RUN_KEY); if (!raw) return null; return migrate(JSON.parse(raw)); }
  catch (e) { return null; }
}
function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch (e) {} }

/* ------------------------------ ТЕМА ЭТАЖА / ИГРЫ ----------------------- */
function themeForFloor(f) {
  if (f <= 3) return 'warm';
  if (f <= 6) return 'ember';
  if (f <= 9) return 'frost';
  return 'royal';
}
function applyTheme() { document.body.dataset.theme = themeForFloor(S ? S.floor : 1); }
function setGameTheme(game) {
  if (game) document.body.dataset.game = game;
  else delete document.body.dataset.game;
}

/* ------------------------------ МОДИФИКАТОРЫ ---------------------------- */
function hasPerk(id) {
  if (S.curse && S.curse.id === 'dry') return false;
  return S.perks.includes(id);
}
function streakMult() { return (S && S.winStreak >= STREAK_MIN) ? 1 + STREAK_BONUS : 1; }
function classMods() { return (S && S.cls && S.cls.mods) ? S.cls.mods : {}; }
function bossMods() { return (S && S.boss && S.boss.mods) ? S.boss.mods : {}; }

function modMult(game) {
  let m = 1;
  if (S.curse && S.curse.id === 'heavy') m *= 0.9;
  if (game === 'slots' && hasPerk('hot')) m *= 1.25;
  if (hasPerk('whale') && S.bet >= 100) m *= 1.2;
  m *= streakMult();
  const cm = classMods(), bm = bossMods();
  if (cm.allPay) m *= cm.allPay;
  if (game === 'blackjack') {
    if (cm.bjBonus) m *= (1 + cm.bjBonus);
    if (bm.bjBonus) m *= (1 + bm.bjBonus);
  }
  if (game === 'slots' && bm.slotsPay) m *= bm.slotsPay;
  return m;
}
function rollCurse() {
  if (S.floor === 1) { S.curse = null; return; }
  if (S.warded) { S.warded = false; S.curse = null; toast('Оберег поглотил проклятие', 'good', 's-ward'); return; }
  const resist = classMods().curseResist || 0;
  const chance = 0.58 * (1 - resist);
  S.curse = Math.random() < chance ? pick(CURSES) : null;
}
function anteCost() {
  let base = 30 + (S.floor - 1) * 55;
  if (S.curse && S.curse.id === 'tax') base *= 1.5;
  if (hasPerk('key') && !S.keyUsed) base *= 0.7;
  const cm = classMods();
  if (cm.liftCost) base *= cm.liftCost;
  return Math.round(base);
}
function minBetNow() { const bm = bossMods(); return bm.minBet || MIN_BET; }
function maxBet() {
  let cap = Math.max(80, S.floor * 90);
  const bm = bossMods();
  if (bm.maxBet) cap = Math.min(cap, bm.maxBet);
  return cap;
}
function betCap() { return Math.max(minBetNow(), Math.min(maxBet(), Math.floor(S.chips))); }

/* ------------------------------ СТАВКА ---------------------------------- */
function betSteps() {
  const cap = betCap();
  const minB = minBetNow();
  const arr = BET_STEPS.filter(s => s <= cap && s >= minB);
  if (!arr.length) arr.push(Math.min(cap, minB));
  if (arr[arr.length - 1] !== cap) arr.push(cap);
  return arr;
}
function nearestStep(v) {
  const steps = betSteps();
  let best = steps[0], bd = Infinity;
  for (const s of steps) { const d = Math.abs(s - v); if (d < bd) { bd = d; best = s; } }
  return best;
}
function syncBetUI() {
  if (!S) return;
  const steps = betSteps();
  let idx = 0, bd = Infinity;
  steps.forEach((v, i) => { const d = Math.abs(v - S.bet); if (d < bd) { bd = d; idx = i; } });
  S.bet = steps[idx];
  const sl = $('#betslider');
  if (sl) {
    if (sl.max !== String(steps.length - 1)) sl.max = String(steps.length - 1);
    if (sl.value !== String(idx)) sl.value = String(idx);
  }
  setText('#betval', fmt(S.bet));
  const pct = S.chips > 0 ? Math.round(S.bet / S.chips * 100) : 0;
  setText('#betpct', pct + '% банка');
  const hb = $('#hrbadge');
  if (hb) {
    if (hasPerk('whale')) {
      hb.style.display = 'flex';
      const on = S.bet >= 100;
      hb.classList.toggle('on', on);
      hb.innerHTML = ico('p-whale', 14) + (on ? ' <span>Хайроллер активен · +20%</span>' : ' <span>Хайроллер: нужна ставка 100+</span>');
    } else hb.style.display = 'none';
  }
  refreshActionLabels();
}
function onBetSlide(v) {
  if (busy) return;
  const steps = betSteps();
  const i = clamp(parseInt(v, 10) || 0, 0, steps.length - 1);
  S.bet = steps[i];
  if (S.bet >= 1000) unlockAch('whale');
  buzz(5); SFX.tick();
  syncBetUI();
  const bv = $('#betval'); if (bv) { bv.classList.remove('changed'); void bv.offsetWidth; bv.classList.add('changed'); }
}
function quickBet(mode) {
  if (busy) return;
  const cap = betCap(), minB = minBetNow();
  if (mode === 'half') S.bet = Math.max(minB, Math.round(S.bet / 2));
  else if (mode === 'double') S.bet = Math.min(cap, S.bet * 2);
  else if (mode === 'min') S.bet = minB;
  else if (mode === 'all') S.bet = cap;
  S.bet = clamp(nearestStep(S.bet), minB, cap);
  if (S.bet >= 1000) unlockAch('whale');
  SFX.tick();
  syncBetUI();
  const bv = $('#betval'); if (bv) { bv.classList.remove('changed'); void bv.offsetWidth; bv.classList.add('changed'); }
}
function refreshActionLabels() {
  $$('.js-betbtn').forEach(b => {
    if (b.disabled) return;
    b.innerHTML = (b.dataset.label || 'Играть') + ' · ' + fmt(S.bet);
  });
}

/* ------------------------------ ТОСТЫ / ЭФФЕКТЫ ------------------------- */
function toast(msg, type, iconName) {
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  if (iconName) t.innerHTML = ico(iconName, 16) + '<span>' + msg + '</span>';
  else t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 1700);
}
function flashStage(sel, win) {
  const el = $(sel); if (!el) return;
  el.classList.remove('win', 'lose'); void el.offsetWidth;
  el.classList.add(win ? 'win' : 'lose');
}
function ripple(e, btn) {
  try {
    const r = btn.getBoundingClientRect();
    const s = document.createElement('span');
    const size = Math.max(r.width, r.height);
    s.className = 'ripple';
    s.style.width = s.style.height = size + 'px';
    s.style.left = ((e.clientX || (r.left + r.width / 2)) - r.left - size / 2) + 'px';
    s.style.top  = ((e.clientY || (r.top + r.height / 2)) - r.top - size / 2) + 'px';
    btn.appendChild(s);
    setTimeout(() => s.remove(), 700);
  } catch (err) {}
}
document.addEventListener('click', e => {
  const b = e.target.closest('.btn, .gcard, .rou-btn, .perk, .ach-item, .class-card, .shop-item .sp');
  if (b) ripple(e, b);
}, true);

function bigWinFX(intensity) {
  starPulse(1800, intensity || 2.5);
  confettiBurst(70);
  SFX.big();
}

/* ---------------------------- СТАВКИ / ВЫПЛАТЫ -------------------------- */
function takeBet(amount) {
  const minB = minBetNow();
  if (amount > S.chips) { toast('Недостаточно фишек', 'bad'); buzz(40); return false; }
  if (amount < minB) { toast('Минимальная ставка ' + minB, 'bad'); return false; }
  S.chips -= amount;
  SFX.chip(); animateChips('down');
  return true;
}
function payout(bet, mult, game) {
  const m = mult * modMult(game);
  let win = Math.round(bet * m);
  const bm = bossMods();
  if (bm.winTax) {
    const net = win - bet;
    if (net > 0) win = bet + Math.round(net * (1 - bm.winTax));
  }
  S.chips += win;
  if (S.chips > S.peak) S.peak = S.chips;
  const net = win - bet;
  if (net > S.stats.biggest) S.stats.biggest = net;
  return win;
}
function registerWin(net) {
  S.stats.wins++;
  S.winStreak++;
  if (S.winStreak > S.bestStreak) S.bestStreak = S.winStreak;
  unlockAch('first_win');
  if (S.winStreak >= 3) unlockAch('streak_3');
  if (S.winStreak >= 5) unlockAch('streak_5');
  if (net >= 500) unlockAch('big_win');
  if (S.winStreak === STREAK_MIN) {
    setTimeout(() => toast('Серия ' + S.winStreak + '! Бонус +15% к выплатам', 'gold', 'p-hot'), 400);
  }
}
function registerLoss() { S.winStreak = 0; }
function onLose(bet) {
  if (hasPerk('lucky') && Math.random() < 0.10) {
    if (bet > 0) S.chips += bet;
    toast('Талисман вернул ставку', 'good', 'p-lucky');
    return true;
  }
  return false;
}
function checkBroke() {
  const mb = minBetNow();
  if (S.chips >= mb) return false;
  if (hasPerk('comp') && !S.compUsed) {
    S.compUsed = true; S.chips = Math.max(50, mb + 10);
    toast('Комп-карта спасла забег: +' + S.chips + ' фишек', 'gold', 'p-comp');
    SFX.big();
    return false;
  }
  unlockAch('broke');
  endRun('bankrupt');
  return true;
}
function animateChips(dir) {
  const cv = $('#chipval'), coin = $('.chip-coin');
  if (cv) { cv.classList.remove('up', 'down'); void cv.offsetWidth; cv.classList.add(dir === 'up' ? 'up' : 'down'); }
  if (coin && dir === 'up') { coin.classList.remove('win'); void coin.offsetWidth; coin.classList.add('win'); }
}

/* ----------------------------- КАРКАС ЭКРАНА ---------------------------- */
function chipCoinSVG() {
  return `<svg viewBox="0 0 40 40" aria-hidden="true">
    <defs><radialGradient id="cg" cx="35%" cy="28%">
      <stop offset="0%" stop-color="#ffeaa7"/><stop offset="55%" stop-color="#f2c96b"/><stop offset="100%" stop-color="#a87520"/>
    </radialGradient></defs>
    <circle cx="20" cy="20" r="19" fill="url(#cg)" stroke="#6b4a12" stroke-width="1.3"/>
    <g class="chip-ring"><circle cx="20" cy="20" r="15.4" fill="none" stroke="#6b4a12" stroke-width="0.9" opacity=".78" stroke-dasharray="2.4 2.4"/></g>
    <circle cx="20" cy="20" r="12.6" fill="none" stroke="#6b4a12" stroke-width="0.6" opacity=".45"/>
    <text x="20" y="26.6" text-anchor="middle" font-size="17" font-weight="900" fill="#3a2606" font-family="Georgia, serif" letter-spacing="-1">7</text>
  </svg>`;
}
function header() {
  const curseBadge = (S.curse && S.screen === 'hub')
    ? `<div class="badge curse" onclick="showCurseInfo()">${ico(S.curse.icon, 12)}<span>${S.curse.name}</span></div>` : '';
  return `
  <div class="hdr">
    <div class="hdr-title serif">Люкс-7<small>Этаж ${S.floor} / ${MAX_FLOOR}${S.boss ? ' · БОСС' : ''}</small></div>
    ${curseBadge}
    <button class="icon-btn ${musicOn ? 'on' : ''}" id="musbtn" onclick="toggleMusic()" title="Музыка">${ico(musicOn ? 'u-music-on' : 'u-music-off', 18)}</button>
    <button class="icon-btn ${soundOn ? 'on' : ''}" id="sndbtn" onclick="toggleSound()" title="Звук">${ico(soundOn ? 'u-sound-on' : 'u-sound-off', 18)}</button>
    <button class="icon-btn" onclick="showHelp()" title="Помощь">${ico('u-help', 18)}</button>
  </div>`;
}
function chipBar() {
  const mb = minBetNow();
  const low = S.chips < mb;
  const veryLow = S.chips < mb * 3 && S.chips >= mb;
  const streakOn = S.winStreak >= STREAK_MIN;
  const valClass = 'chip-val' + (low ? ' low' : '');
  return `
  <div class="chipbar">
    <div class="chip-display">
      <div class="chip-coin" id="coin">${chipCoinSVG()}</div>
      <div>
        <div class="${valClass}" id="chipval">${fmt(S.chips)}</div>
        <div class="chip-sub" id="chipsub">фишек${S.peak > START_CHIPS ? ' · пик ' + fmt(S.peak) : ''}${S.winStreak > 0 ? ' · серия ' + S.winStreak : ''}</div>
      </div>
    </div>
    <div class="badgerow">
      ${S.cls ? `<div class="badge cls">${ico(S.cls.icon, 12)}<span>${S.cls.name}</span></div>` : ''}
      ${S.boss ? `<div class="badge boss">${ico(S.boss.icon, 12)}<span>${S.boss.name}</span></div>` : ''}
      ${streakOn ? `<div class="badge fire">${ico('p-hot', 12)}<span>×${(1+STREAK_BONUS).toFixed(2)}</span></div>` : ''}
      ${veryLow ? `<div class="badge low">${ico('c-skull', 12)}<span>последний шанс</span></div>` : ''}
      ${low ? `<div class="badge low">${ico('c-skull', 12)}<span>финал</span></div>` : `<div class="badge good ${S.chips >= anteCost() ? 'pulse' : ''}" id="liftbadge">Лифт: ${fmt(anteCost())}</div>`}
    </div>
  </div>`;
}
function gameHeader(title, sub) {
  return `
  <div class="hdr">
    <button class="icon-btn" onclick="goHub()">${ico('u-back', 18)}</button>
    <div class="hdr-title serif" style="font-size:14px">${title}<small>${sub}</small></div>
    <button class="icon-btn ${soundOn ? 'on' : ''}" id="sndbtn" onclick="toggleSound()">${ico(soundOn ? 'u-sound-on' : 'u-sound-off', 18)}</button>
    <button class="icon-btn" onclick="showHelp()">${ico('u-help', 18)}</button>
  </div>`;
}
function betBox() {
  const mb = minBetNow(), cap = betCap();
  if (S.bet > cap || S.bet < mb) S.bet = nearestStep(clamp(S.bet, mb, cap));
  const steps = betSteps();
  let idx = 0, bd = Infinity;
  steps.forEach((v, i) => { const d = Math.abs(v - S.bet); if (d < bd) { bd = d; idx = i; } });
  S.bet = steps[idx];
  const pct = S.chips > 0 ? Math.round(S.bet / S.chips * 100) : 0;
  const hrOn = hasPerk('whale') && S.bet >= 100;
  return `
  <div class="betpanel">
    <div class="bet-top">
      <div class="bl">Ставка</div>
      <div class="bp" id="betpct">${pct}% банка</div>
      <div class="bv" id="betval">${fmt(S.bet)}</div>
    </div>
    <input type="range" class="slider betslider" id="betslider"
           min="0" max="${steps.length - 1}" step="1" value="${idx}" oninput="onBetSlide(this.value)">
    <div class="quickrow">
      <button onclick="quickBet('min')">MIN</button>
      <button onclick="quickBet('half')">½</button>
      <button onclick="quickBet('double')">×2</button>
      <button class="gold" onclick="quickBet('all')">ВСЁ</button>
    </div>
    <div class="hrbadge ${hrOn ? 'on' : ''}" id="hrbadge" style="${hasPerk('whale') ? 'display:flex' : 'display:none'}">
      ${ico('p-whale', 14)} ${hrOn ? '<span>Хайроллер активен · +20%</span>' : '<span>Хайроллер: нужна ставка 100+</span>'}
    </div>
  </div>`;
}
function infoBox(label, value, rightLabel, rightValue) {
  return `
  <div class="betpanel">
    <div class="bet-top">
      <div class="bl">${label}</div>
      ${rightLabel ? `<div class="bp">${rightLabel}</div>` : ''}
      <div class="bv">${value}</div>
    </div>
    ${rightValue ? `<div class="bp" style="text-align:left;color:var(--gold2);font-size:12px;margin-top:4px">${rightValue}</div>` : ''}
  </div>`;
}

/* ------------------------------ РЕНДЕР -------------------------------- */
function render() {
  if (!S) return;
  if (S.screen === 'end') { renderEnd(); return; }
  const el = $('#app');
  let body = '';
  switch (S.screen) {
    case 'class':     body = classScreen(); break;
    case 'hub':       body = hubScreen(); break;
    case 'slots':     body = slotsScreen(); break;
    case 'dice':      body = diceScreen(); break;
    case 'highlow':   body = highlowScreen(); break;
    case 'blackjack': body = blackjackScreen(); break;
    case 'roulette':  body = rouletteScreen(); break;
    case 'perks':     body = perksScreen(); break;
    case 'shop':      body = shopScreen(); break;
    case 'records':   body = recordsScreen(); break;
    case 'ach':       body = achScreen(); break;
    default:          body = hubScreen();
  }
  el.innerHTML = `<div class="anim-screen" style="display:flex;flex-direction:column;flex:1">${body}</div>`;
  if (S.screen === 'hub') saveRun();
}

/* ============================= ВЫБОР КЛАССА ============================ */
function classScreen() {
  return `
  <div class="hdr">
    <div class="hdr-title serif" style="font-size:14px">Люкс-7<small>Выбор класса</small></div>
    <button class="icon-btn ${soundOn ? 'on' : ''}" id="sndbtn" onclick="toggleSound()">${ico(soundOn ? 'u-sound-on' : 'u-sound-off', 18)}</button>
    <button class="icon-btn" onclick="showHelp()">${ico('u-help', 18)}</button>
  </div>
  <div class="pad" style="padding-top:8px">
    <div style="font-family:Georgia,serif;font-size:24px;color:var(--gold2);letter-spacing:.08em;text-align:center;margin:14px 0 6px">Кто вы сегодня?</div>
    <div style="font-size:13px;color:var(--mut);text-align:center;margin-bottom:22px;line-height:1.5">
      Каждый забег начинается с выбора роли.<br>На 3, 6 и 9 этажах ждут боссы.
    </div>
    ${CLASSES.map(c => `
      <div class="class-card" onclick="pickClass('${c.id}')">
        <div class="ci">${ico(c.icon, 38)}</div>
        <div>
          <div class="cn">${c.name}</div>
          <div class="cd">${c.desc}</div>
          <div class="cb" style="margin-top:10px">${c.perk ? ico('p-ace', 13) + 'Стартовый перк: ' + (PERKS.find(p => p.id === c.perk) || {}).name : 'Без стартового перка'}</div>
        </div>
      </div>`).join('')}
  </div>
  <div class="bottom">
    <div style="text-align:center;font-size:11.5px;color:var(--mut);line-height:1.5">
      Старт: <b style="color:var(--gold2)">${START_CHIPS}</b> фишек · <b style="color:var(--gold2)">${MAX_FLOOR}</b> этажей · финал при <b style="color:#e08a76">&lt; мин. ставки</b>
    </div>
  </div>`;
}
function pickClass(id) {
  const c = CLASSES.find(x => x.id === id);
  if (!c) return;
  S.cls = c;
  if (c.perk && !S.perks.includes(c.perk)) S.perks.push(c.perk);
  S.screen = 'hub';
  SFX.big(); buzz(30);
  render();
  toast(c.name, 'gold', c.icon);
}

/* ================================ ХАБ ================================== */
function hubScreen() {
  const cost = anteCost();
  const canLift = S.chips >= cost;
  const isExit = S.floor >= MAX_FLOOR;
  const curse = S.curse
    ? `<div class="card" style="margin:10px 0 0;border-color:#5c2a22;background:#1c1210">
         <div style="display:flex;gap:12px;align-items:center">
           <div style="color:#e08a76;display:flex">${ico(S.curse.icon, 26)}</div>
           <div><div style="font-weight:700;color:#e08a76;font-size:13px">${S.curse.name}</div>
           <div style="font-size:11.5px;color:var(--mut);margin-top:2px">${S.curse.desc}</div></div>
         </div></div>` : '';
  const bossCard = S.boss
    ? `<div class="card" style="margin:10px 0 0;border-color:#7a2a22;background:linear-gradient(160deg,#2a1411,#1a0e0c);animation:bossPulse 2.4s ease-in-out infinite" onclick="showBossInfo()">
         <div style="display:flex;gap:12px;align-items:center">
           <div style="color:#ff8a7a;display:flex">${ico(S.boss.icon, 30)}</div>
           <div style="min-width:0;flex:1">
             <div style="font-weight:700;color:#ff8a7a;font-size:13px">${S.boss.name}</div>
             <div style="font-size:11.5px;color:var(--mut);margin-top:2px">${S.boss.desc}</div>
             <div style="font-size:10.5px;color:#ff8a7a;margin-top:4px">Награда: ${S.boss.rewardText}</div>
           </div>
         </div></div>` : '';
  const perks = S.perks.length
    ? `<div class="sect" style="padding:0">Ваши перки (${S.perks.length})</div>
       <div class="perk-list" style="padding:0">${S.perks.map(id => {
          const p = PERKS.find(x => x.id === id);
          return `<div class="pchip">${ico(p.icon, 13)}<span>${p.name}</span></div>`;
       }).join('')}</div>` : '';
  const mb = minBetNow();
  const lowWarn = S.chips < mb * 3 && S.chips >= mb
    ? `<div class="card" style="margin:10px 0 0;border-color:#7a352a;background:#2a1411;animation:dangerPulse 1.4s ease-in-out infinite">
         <div style="display:flex;gap:12px;align-items:center">
           <div style="color:#e08a76;display:flex">${ico('c-skull', 22)}</div>
           <div><div style="font-weight:700;color:#e08a76;font-size:13px">На грани</div>
           <div style="font-size:11.5px;color:var(--mut);margin-top:2px">Меньше ${mb * 3} фишек. Опуститесь ниже ${mb} — и забег закончится.</div></div>
         </div></div>` : '';
  const clsRow = S.cls
    ? `<div class="card" style="margin:10px 0 0;border-color:#2a3d5c;background:#12192a">
         <div style="display:flex;gap:12px;align-items:center">
           <div style="color:#9bbaf5;display:flex">${ico(S.cls.icon, 26)}</div>
           <div><div style="font-weight:700;color:#9bbaf5;font-size:13px">${S.cls.name}</div>
           <div style="font-size:11.5px;color:var(--mut);margin-top:2px">${S.cls.desc}</div></div>
         </div></div>` : '';
  return `
  ${header()}
  ${chipBar()}
  <div class="pad">
    ${bossCard}
    ${clsRow}
    ${curse}
    ${lowWarn}
    ${perks}
  </div>
  <div class="sect pad" style="padding:0 14px">Игровые столы</div>
  <div class="grid">
    ${gcard('blackjack', 'g-bj', 'Блэкджек', 'Минимальный риск.<br>Дилер стоит на 17.', '~99%', '1')}
    ${gcard('roulette', 'g-roulette', 'Рулетка', 'Европейская, одно зеро.<br>Дюжины платят ×3.', '~97%', '2')}
    ${gcard('dice', 'g-dice', 'Кости', 'Ставь на больше/меньше.<br>Сам выбираешь риск.', '~96%', '3')}
    ${gcard('highlow', 'g-hl', 'Хай-Лоу', 'Угадай карту. Удваивай<br>и вовремя забирай.', '~95%', '4')}
    ${gcard('slots', 'g-slots', 'Слоты', 'Редкие, но огромные<br>выплаты. До 80×.', '~95%', '5')}
    ${gcard('records', 'a-crown', 'Рекорды', 'Топ-5 забегов<br>и статистика.', '—', 'R')}
    ${gcard('ach', 'a-check', 'Достижения', ACH.size + ' / ' + ACHIEVEMENTS.length + ' открыто.<br>Собери все.', '—', 'A')}
  </div>
  <div class="bottom">
    <button class="btn ${isExit ? 'grn' : ''} ${canLift && !isExit ? 'pulse' : ''}"
            onclick="takeElevator()" ${canLift ? '' : 'disabled'}>
      ${isExit ? 'Выйти из казино' : 'Лифт на этаж ' + (S.floor + 1)} · ${fmt(cost)}
    </button>
    ${canLift ? '' : `<div style="text-align:center;font-size:11.5px;color:#e08a76;margin-top:9px">Не хватает ${fmt(cost - S.chips)} фишек — играй!</div>`}
  </div>`;
}
function gcard(id, icon, name, desc, ev, kb) {
  return `<div class="gcard" onclick="go('${id}')">
    <div class="ev ${ev.startsWith('~9') ? '' : 'hot'}">${ev}</div>
    <span class="gi">${ico(icon, 40)}</span>
    <div class="gn">${name}</div>
    <div class="gd">${desc}</div>
    ${kb ? `<div class="kb">${kb}</div>` : ''}
  </div>`;
}
function go(screen) {
  if (busy) return;
  if (S.screen === 'hub') saveRun();
  SFX.click();
  S.screen = screen;
  if (!S.over && ['slots','dice','highlow','blackjack','roulette'].includes(screen)) {
    initGame(screen);
    setGameTheme(screen);
  } else {
    setGameTheme(null);
  }
  render();
}
function goHub() {
  if (busy) return;
  SFX.click();
  if (S.over) { S.screen = 'end'; render(); return; }
  S.screen = 'hub';
  setGameTheme(null);
  render();
}

/* ============================== ЛИФТ / ПЕРКИ / МАГАЗИН ================ */
function takeElevator() {
  if (busy) return;
  const cost = anteCost();
  if (S.chips < cost) { toast('Недостаточно фишек', 'bad'); return; }
  if (S.floor >= MAX_FLOOR) { S.chips -= cost; endRun('escaped'); return; }

  S.chips -= cost;
  SFX.chip(); buzz(30);
  if (hasPerk('key') && !S.keyUsed) S.keyUsed = true;
  const app = $('#app');
  if (app) { app.classList.remove('anim-lift'); void app.offsetWidth; app.classList.add('anim-lift'); }

  if (S.boss) { grantBossReward(S.boss); }

  S.floor++;
  S.stats.floors = S.floor;
  if (S.floor >= 5) unlockAch('floors_5');
  if (S.floor >= 10) unlockAch('floors_10');
  S.keyUsed = false;
  applyTheme();
  rollCurse();

  let bossIntro = null;
  if (BOSSES[S.floor]) {
    S.boss = BOSSES[S.floor];
    S.stats.bosses = (S.stats.bosses || 0) + 1;
    bossIntro = S.boss;
  } else {
    S.boss = null;
  }

  if (Math.random() < 0.25) {
    const total = LIFT_EVENTS.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    let ev = LIFT_EVENTS[0];
    for (const e of LIFT_EVENTS) { r -= e.weight; if (r <= 0) { ev = e; break; } }
    S.chips += ev.chips;
    if (S.chips > S.peak) S.peak = S.chips;
    setTimeout(() => {
      toast(ev.name + ': +' + ev.chips + ' фишек', 'gold', 's-gift');
      SFX.event(); confettiBurst(30); starPulse(1200, 1.8);
    }, 620);
  }

  if (S.curse && S.curse.id === 'blood') {
    const loss = Math.round(S.chips * 0.05);
    S.chips = Math.max(0, S.chips - loss);
    toast('Кровавый сбор: −' + fmt(loss), 'bad', 'c-blood');
  }

  if (checkBroke()) return;

  S._shopItems = SHOP_ITEMS.map(it => ({...it, bought:false}));

  const avail = PERKS.filter(p => !S.perks.includes(p.id));
  if (avail.length > 0) {
    S._perkChoices = shuffle(avail).slice(0, 3);
    S.screen = 'perks';
  } else {
    S.screen = 'shop';
  }
  setGameTheme(null);
  render();

  if (bossIntro) setTimeout(() => showBossIntro(bossIntro), 400);
  else if (S.curse) setTimeout(() => toast(S.curse.name + ': ' + S.curse.desc, 'bad', S.curse.icon), 900);
}

function grantBossReward(boss) {
  if (!boss) return;
  if (boss.rewardChips) {
    S.chips += boss.rewardChips;
    if (S.chips > S.peak) S.peak = S.chips;
    setTimeout(() => {
      toast('Босс побеждён: +' + boss.rewardChips + ' фишек', 'gold', boss.icon);
      bigWinFX(3);
    }, 500);
  } else if (boss.rewardPerk) {
    const avail = PERKS.filter(p => !S.perks.includes(p.id));
    if (avail.length) {
      const p = pick(avail);
      S.perks.push(p.id);
      setTimeout(() => {
        toast('Босс побеждён. Перк: ' + p.name, 'gold', p.icon);
        bigWinFX(2.5);
      }, 500);
    }
  }
  if (boss.id === 'cheat') unlockAch('boss_1');
  if (boss.id === 'inspector') unlockAch('boss_2');
  if (boss.id === 'keeper') unlockAch('boss_3');
}
function showBossIntro(boss) {
  SFX.boss();
  starPulse(2400, 3.5);
  $('#modal-root').innerHTML = `
  <div class="modal">
    <div class="modal-in">
      <div class="boss-hero anim-boss">
        <div class="bi">${ico(boss.icon, 64)}</div>
        <div class="bn">${boss.name}</div>
        <div class="bq">${boss.quote}</div>
      </div>
      <div class="boss-sep"></div>
      <div class="boss-stat"><span>Правило этажа</span><span>${boss.desc}</span></div>
      <div class="boss-stat"><span>Награда за прохождение</span><span>${boss.rewardText}</span></div>
      <div class="boss-stat"><span>Следующий этаж</span><span>Этаж ${S.floor + 1}</span></div>
      <button class="btn danger" style="margin-top:18px" onclick="closeModal()">Принять вызов</button>
    </div>
  </div>`;
}
function showBossInfo() {
  if (!S.boss) return;
  const b = S.boss;
  $('#modal-root').innerHTML = `
  <div class="modal" onclick="if(event.target===this)closeModal()">
    <div class="modal-in">
      <h2 style="color:#ff8a7a">${ico(b.icon, 22)}${b.name}</h2>
      <p style="font-style:italic">${b.quote}</p>
      <p style="margin-top:14px">${b.desc}</p>
      <p style="margin-top:12px;color:var(--gold2);font-weight:600">Награда: ${b.rewardText}</p>
      <button class="btn sec" style="margin-top:20px" onclick="closeModal()">Закрыть</button>
    </div>
  </div>`;
}
function perksScreen() {
  const choices = S._perkChoices || [];
  return `
  <div class="hdr">
    <div class="hdr-title serif" style="font-size:14px">Этаж ${S.floor}<small>Выберите один перк</small></div>
    <button class="icon-btn ${soundOn ? 'on' : ''}" id="sndbtn" onclick="toggleSound()">${ico(soundOn ? 'u-sound-on' : 'u-sound-off', 18)}</button>
    <button class="icon-btn" onclick="showHelp()">${ico('u-help', 18)}</button>
  </div>
  <div class="chipbar">
    <div class="chip-display">
      <div class="chip-coin" id="coin">${chipCoinSVG()}</div>
      <div><div class="chip-val">${fmt(S.chips)}</div><div class="chip-sub">фишек · этаж ${S.floor}</div></div>
    </div>
    ${S.boss ? `<div class="badge boss">${ico(S.boss.icon, 12)}<span>${S.boss.name}</span></div>` : ''}
  </div>
  <div class="pad">
    <div style="font-size:12.5px;color:var(--mut);margin-bottom:14px;text-align:center">
      Лифт поднялся. Что-то изменилось в вас.
    </div>
    ${choices.map(p => `
      <div class="perk" onclick="choosePerk('${p.id}')">
        <div class="pi">${ico(p.icon, 28)}</div>
        <div><div class="pn">${p.name}</div><div class="pd">${p.desc}</div></div>
      </div>`).join('')}
  </div>`;
}
function choosePerk(id) {
  S.perks.push(id);
  const p = PERKS.find(x => x.id === id);
  toast(p.name, 'gold', p.icon);
  SFX.big(); buzz(25);
  S.screen = 'shop';
  render();
}
function shopScreen() {
  const items = S._shopItems || (S._shopItems = SHOP_ITEMS.map(it => ({...it, bought:false})));
  const hasCurse = !!S.curse;
  const availPerks = PERKS.filter(p => !S.perks.includes(p.id)).length;
  return `
  <div class="hdr">
    <div class="hdr-title serif" style="font-size:14px">Магазин<small>Этаж ${S.floor} · потратьте фишки</small></div>
    <button class="icon-btn ${soundOn ? 'on' : ''}" id="sndbtn" onclick="toggleSound()">${ico(soundOn ? 'u-sound-on' : 'u-sound-off', 18)}</button>
    <button class="icon-btn" onclick="showHelp()">${ico('u-help', 18)}</button>
  </div>
  <div class="chipbar">
    <div class="chip-display">
      <div class="chip-coin" id="coin">${chipCoinSVG()}</div>
      <div><div class="chip-val">${fmt(S.chips)}</div><div class="chip-sub">фишек</div></div>
    </div>
    ${S.boss ? `<div class="badge boss">${ico(S.boss.icon, 12)}<span>${S.boss.name}</span></div>` : ''}
  </div>
  <div class="pad">
    <div style="font-size:12.5px;color:var(--mut);margin-bottom:14px;text-align:center;line-height:1.5">
      Продавец лениво листает газету. Можно купить пару вещей перед тем, как вернуться к столам.
    </div>
    ${items.map((it, i) => {
      let disabled = false, extra = '';
      if (it.id === 'purge' && !hasCurse) { disabled = true; extra = ' · нет проклятия'; }
      if (it.id === 'random' && availPerks === 0) { disabled = true; extra = ' · все перки собраны'; }
      const canAfford = S.chips >= it.price;
      return `
        <div class="shop-item ${it.bought ? 'bought' : ''} ${disabled ? 'disabled' : ''}">
          <div class="si">${ico(it.icon, 28)}</div>
          <div style="min-width:0;flex:1">
            <div class="sn">${it.name}</div>
            <div class="sd">${it.desc}${extra}</div>
          </div>
          <button class="sp" ${it.bought || disabled || !canAfford ? 'disabled' : ''} onclick="buyShopItem(${i})">
            ${it.bought ? ico('a-check', 14) + '<span>Куплено</span>' : fmt(it.price)}
          </button>
        </div>`;
    }).join('')}
  </div>
  <div class="bottom">
    <button class="btn" onclick="leaveShop()">Дальше, к столам ${ico('u-arrow', 16)}</button>
  </div>`;
}
function buyShopItem(i) {
  const it = S._shopItems[i];
  if (!it || it.bought) return;
  if (S.chips < it.price) { toast('Недостаточно фишек', 'bad'); return; }
  if (it.id === 'purge' && !S.curse) { toast('Нечего снимать', 'bad'); return; }
  if (it.id === 'random' && PERKS.every(p => S.perks.includes(p.id))) { toast('Все перки уже есть', 'bad'); return; }
  S.chips -= it.price;
  it.bought = true;
  SFX.chip();
  applyShopEffect(it.id);
  render();
  if (checkBroke()) return;
}
function applyShopEffect(id) {
  if (id === 'purge') { S.curse = null; toast('Проклятие снято', 'good', 's-purge'); SFX.big(); }
  else if (id === 'random') {
    const avail = PERKS.filter(p => !S.perks.includes(p.id));
    if (avail.length) {
      const p = pick(avail);
      S.perks.push(p.id);
      toast('Получен перк: ' + p.name, 'gold', p.icon);
      bigWinFX(2);
    }
  }
  else if (id === 'ward') { S.warded = true; toast('Оберег установлен', 'good', 's-ward'); SFX.event(); }
  else if (id === 'heal') { S.chips += 40; if (S.chips > S.peak) S.peak = S.chips; toast('+40 фишек', 'good', 's-heal'); animateChips('up'); }
}
function leaveShop() {
  S._shopItems = null; S._perkChoices = null; S.screen = 'hub';
  if (checkBroke()) return;
  render();
}
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ======================== ИНИЦИАЛИЗАЦИЯ ИГР ============================ */
let slotReels = [null, null, null];
let slotMsg = '', slotMsgType = '';
let diceState = null, hlState = null, bjState = null, rouState = null;

const SLOT_ICONS = {
  cherry: `<svg viewBox="0 0 24 24" width="44" height="44"><circle cx="9" cy="16" r="4" fill="#c8503f"/><circle cx="17" cy="17" r="3.5" fill="#e0503f"/><path d="M9 12 Q9 6 15 6 M17 13 Q17 8 20 7" stroke="#4fa87a" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M14 6 Q16 5 18 6" stroke="#4fa87a" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  lemon: `<svg viewBox="0 0 24 24" width="44" height="44"><ellipse cx="12" cy="12" rx="9" ry="7" fill="#e8bd63" stroke="#8a5f18" stroke-width="1.2"/><ellipse cx="12" cy="12" rx="7" ry="5" fill="#f7dc85" stroke="none"/><path d="M4 7 Q3 5 4 4 M20 7 Q21 5 20 4" stroke="#8a5f18" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" width="44" height="44"><path d="M6 16 Q6 8 12 8 Q18 8 18 16 Z" fill="#d9a441" stroke="#6b4a12" stroke-width="1.2" stroke-linejoin="round"/><rect x="5" y="16" width="14" height="2" rx="1" fill="#6b4a12" stroke="none"/><circle cx="12" cy="6" r="2" fill="#f2c96b" stroke="#6b4a12" stroke-width="1.2"/><path d="M12 20 Q10 22 12 22 Q14 22 12 20" fill="#6b4a12" stroke="none"/></svg>`,
  gem: `<svg viewBox="0 0 24 24" width="44" height="44"><path d="M12 3 L20 9 L12 21 L4 9 Z" fill="#5b8dd9" stroke="#2a4d80" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 3 L16 9 L12 21 L8 9 Z" fill="#7fa8f0" stroke="none"/><path d="M4 9 L20 9" stroke="#2a4d80" stroke-width="1" fill="none"/></svg>`,
  seven: `<svg viewBox="0 0 24 24" width="44" height="44"><text x="12" y="21" text-anchor="middle" font-size="22" font-weight="900" fill="#c8503f" font-family="Georgia,serif" stroke="#7a2018" stroke-width="0.4">7</text></svg>`,
  skull: `<svg viewBox="0 0 24 24" width="44" height="44"><path d="M6 10 Q6 3 12 3 Q18 3 18 10 Q18 13 16 14 L16 18 L8 18 L8 14 Q6 13 6 10 Z" fill="#e8e0cd" stroke="#4a3a24" stroke-width="1.3" stroke-linejoin="round"/><circle cx="9.5" cy="11" r="1.8" fill="#1a150f"/><circle cx="14.5" cy="11" r="1.8" fill="#1a150f"/><path d="M10.5 15 L13.5 15" stroke="#4a3a24" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>`,
};
function slotIconHTML(sym) { return SLOT_ICONS[sym.id] || `<span style="font-size:32px">${sym.icon}</span>`; }

function initGame(id) {
  busy = false;
  if (id === 'slots') { slotReels = [pick(SLOT_SYMBOLS), pick(SLOT_SYMBOLS), pick(SLOT_SYMBOLS)]; slotMsg = 'Крутите барабаны'; slotMsgType = ''; }
  if (id === 'dice') { diceState = { target: 50, dir: 'over', value: 0, phase: 'bet', usedReroll: false, msg: '', msgType: '' }; }
  if (id === 'highlow') { hlState = { card: 0, pot: 0, streak: 0, phase: 'bet', lastMult: 0, msg: '', msgType: '' }; drawHL(); }
  if (id === 'blackjack') { bjState = { shoe: makeShoe(), player: [], dealer: [], bet: 0, phase: 'bet', doubled: false, msg: '', msgType: '' }; }
  if (id === 'roulette') { rouState = { pick: null, number: null, phase: 'bet', msg: '', msgType: '' }; }
}

/* ================================ СЛОТЫ ================================ */
function slotsScreen() {
  return `
  ${gameHeader('Слоты', 'Выплаты до 80×')}
  ${chipBar()}
  ${betBox()}
  <div class="stage" id="slotstage">
    <div class="reels">
      <div class="reel" id="r0">${slotIconHTML(slotReels[0])}</div>
      <div class="reel" id="r1">${slotIconHTML(slotReels[1])}</div>
      <div class="reel" id="r2">${slotIconHTML(slotReels[2])}</div>
    </div>
    <div class="msg ${slotMsgType}" id="slotmsg">${slotMsg}</div>
    <div class="paytable">
      ${SLOT_SYMBOLS.map(s => `<span>${SLOT_ICONS[s.id] ? SLOT_ICONS[s.id].replace('width="44" height="44"', 'width="14" height="14"') : s.icon} ${s.pay > 0 ? '×' + s.pay : '−2×'}</span>`).join('')}
      <span style="grid-column:span 3;color:var(--line2)">Пара любых — ×${SLOT_PAIR_PAY.toFixed(2)}</span>
    </div>
  </div>
  <div class="bottom">
    <button class="btn js-betbtn" data-label="Крутить" id="spinbtn" onclick="spin()">Крутить · ${fmt(S.bet)}</button>
  </div>`;
}
function weightedSymbol() {
  let total = 0;
  for (const s of SLOT_SYMBOLS) total += (s.id === 'skull' && S.curse && S.curse.id === 'skull') ? s.w * 2.25 : s.w;
  let r = Math.random() * total;
  for (const s of SLOT_SYMBOLS) {
    const w = (s.id === 'skull' && S.curse && S.curse.id === 'skull') ? s.w * 2.25 : s.w;
    r -= w; if (r <= 0) return s;
  }
  return SLOT_SYMBOLS[0];
}
async function spin() {
  if (busy) return;
  const bet = S.bet;
  if (!takeBet(bet)) return;
  busy = true; S.stats.spins++;
  const btn = $('#spinbtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Крутится...'; }
  const msgEl = $('#slotmsg');
  if (msgEl) { msgEl.textContent = ''; msgEl.className = 'msg'; }
  const final = [weightedSymbol(), weightedSymbol(), weightedSymbol()];
  const els = [$('#r0'), $('#r1'), $('#r2')];
  els.forEach(e => { if (e) { e.dataset.done = ''; e.classList.remove('settled', 'win'); e.classList.add('spin'); } });
  const iv = setInterval(() => {
    els.forEach(e => { if (e && !e.dataset.done) e.innerHTML = slotIconHTML(pick(SLOT_SYMBOLS)); });
    SFX.tick();
  }, 60);
  for (let i = 0; i < 3; i++) {
    await sleep(620 + i * 290);
    if (els[i]) { els[i].dataset.done = '1'; els[i].innerHTML = slotIconHTML(final[i]); els[i].classList.remove('spin'); els[i].classList.add('settled'); }
    buzz(15);
  }
  clearInterval(iv);
  const [a, b, c] = final;
  let mult = 0, label = '', isWin = false, isLose = false;
  if (a.id === b.id && b.id === c.id) {
    if (a.pay > 0) {
      mult = a.pay; label = 'ТРИ ' + (a.id === 'seven' ? 'СЕМЁРКИ' : a.id.toUpperCase()) + ' — ×' + a.pay + '!';
      isWin = true;
      if (a.id === 'seven') { unlockAch('jackpot'); bigWinFX(3); }
    } else { mult = a.pay; label = 'ТРИ ЧЕРЕПА — ставка сгорает вдвое!'; isLose = true; unlockAch('all_skulls'); }
  } else if (a.id === b.id || b.id === c.id || a.id === c.id) {
    mult = SLOT_PAIR_PAY;
    label = 'Пара — ×' + SLOT_PAIR_PAY.toFixed(2);
    isWin = true;
  }
  if (mult > 0) {
    const w = payout(bet, mult, 'slots');
    const net = w - bet;
    registerWin(net);
    slotMsg = label + '  +' + fmt(net);
    slotMsgType = 'win';
    SFX.win(); buzz([20, 40, 20]);
    if (mult >= 20) { bigWinFX(3); }
    else if (mult >= 7) { starPulse(1200, 1.8); }
    els.forEach(e => e && e.classList.add('win'));
    animateChips('up');
  } else if (mult < 0) {
    const extra = Math.min(bet, S.chips);
    S.chips -= extra;
    registerLoss();
    slotMsg = label + '  −' + fmt(bet + extra);
    slotMsgType = 'lose'; SFX.lose(); buzz([60, 50, 60]);
    if (checkBroke()) return;
  } else {
    if (!onLose(bet)) { registerLoss(); slotMsg = 'Пусто.  −' + fmt(bet); slotMsgType = 'lose'; SFX.lose(); }
    else { slotMsg = 'Талисман вернул ставку'; slotMsgType = 'win'; }
    if (checkBroke()) return;
  }
  slotReels = final;
  busy = false;
  if (msgEl) { msgEl.textContent = slotMsg; msgEl.className = 'msg ' + slotMsgType; }
  if (btn) { btn.disabled = false; btn.textContent = 'Крутить · ' + fmt(S.bet); }
  flashStage('#slotstage', isWin && mult > 0);
  refreshDynamic();
}
function refreshDynamic() {
  setText('#chipval', fmt(S.chips));
  setText('#chipsub', 'фишек' + (S.peak > START_CHIPS ? ' · пик ' + fmt(S.peak) : '') + (S.winStreak > 0 ? ' · серия ' + S.winStreak : ''));
  const lb = $('#liftbadge'); if (lb) lb.textContent = 'Лифт: ' + fmt(anteCost());
  const cv = $('#chipval'); if (cv) cv.classList.toggle('low', S.chips < minBetNow());
  syncBetUI();
}

/* ================================ КОСТИ ================================ */
function diceScreen() {
  const d = diceState;
  const mult = diceMultiplier(d.target, d.dir);
  const outs = d.dir === 'over' ? 100 - d.target : d.target - 1;
  const fillLeft = d.dir === 'over' ? d.target : 0;
  const fillW = d.dir === 'over' ? 100 - d.target : d.target - 1;
  return `
  ${gameHeader('Кости', 'd100 · сам выбираешь риск')}
  ${chipBar()}
  ${betBox()}
  <div class="stage" id="dicestage">
    <div class="d100" id="d100">${d.value || '—'}</div>
    <div class="msg ${d.msgType || ''}" id="dicemsg">${d.msg || 'Настройте порог и бросайте'}</div>
    <div style="width:100%">
      <div class="track"><div class="fill" id="dicefill" style="left:${fillLeft}%;width:${fillW}%"></div><div class="mark" id="dicemark" style="left:${d.target}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--mut);margin-top:5px">
        <span>1</span><span id="dicethr">порог ${d.target}</span><span>100</span>
      </div>
    </div>
  </div>
  <div class="pad">
    <div class="toggle" style="margin-bottom:12px">
      <button id="dirover"  class="${d.dir === 'over' ? 'on' : ''}"      onclick="setDiceDir('over')">БОЛЬШЕ <span id="lblover">${d.target}</span></button>
      <button id="dirunder" class="${d.dir === 'under' ? 'on low' : ''}" onclick="setDiceDir('under')">МЕНЬШЕ <span id="lblunder">${d.target}</span></button>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
      <span style="color:var(--mut)">Порог</span>
      <span style="color:var(--gold2);font-weight:700" id="diceTargetBig">${d.target}</span>
    </div>
    <input type="range" class="slider" id="diceslider" min="2" max="99" step="1" value="${d.target}" oninput="onDiceSlide(this.value)">
    <div class="presets">
      <button onclick="setDicePreset(10)">риск 90%</button>
      <button onclick="setDicePreset(25)">25/75</button>
      <button onclick="setDicePreset(50)">50/50</button>
      <button onclick="setDicePreset(90)">деген</button>
    </div>
    <div class="dice-stat">
      <span>Шанс: <b class="hi" id="dicePct">${Math.round(outs)}%</b></span>
      <span>Множитель: <b class="hi" id="diceMult">×${mult.toFixed(2)}</b></span>
      <span>Выигрыш: <b id="diceWin">${fmt(Math.round(S.bet * mult))}</b></span>
    </div>
  </div>
  <div class="bottom">
    <div id="rerollslot">${rerollBtnHTML()}</div>
    <button class="btn js-betbtn" data-label="Бросок" id="rollbtn" onclick="rollDice()">Бросок · ${fmt(S.bet)}</button>
  </div>`;
}
function rerollBtnHTML() {
  const d = diceState;
  if (hasPerk('dice') && !d.usedReroll && d.phase === 'done') return `<button class="btn sec sm" style="margin-bottom:8px" onclick="rerollDice()">${ico('p-cheat', 16)} Переброс (1)</button>`;
  return '';
}
function diceMultiplier(target, dir) {
  const outs = dir === 'over' ? 100 - target : target - 1;
  if (outs <= 0) return 99;
  return Math.min(96, 0.96 * 100 / outs);
}
function onDiceSlide(v) {
  if (busy || !diceState) return;
  diceState.target = clamp(parseInt(v, 10) || 50, 2, 99);
  diceState.phase = 'bet'; diceState.msg = ''; diceState.msgType = '';
  buzz(4); SFX.tick(); updateDiceUI();
}
function setDicePreset(v) {
  if (busy || !diceState) return;
  diceState.target = clamp(v, 2, 99);
  diceState.phase = 'bet'; diceState.msg = ''; diceState.msgType = '';
  const sl = $('#diceslider'); if (sl) sl.value = String(diceState.target);
  SFX.tick(); updateDiceUI();
}
function setDiceDir(dir) {
  if (busy || !diceState) return;
  diceState.dir = dir; diceState.phase = 'bet'; diceState.msg = ''; diceState.msgType = '';
  SFX.click(); render();
}
function updateDiceUI() {
  const d = diceState; if (!d) return;
  const mult = diceMultiplier(d.target, d.dir);
  const outs = d.dir === 'over' ? 100 - d.target : d.target - 1;
  const fillLeft = d.dir === 'over' ? d.target : 0;
  const fillW = d.dir === 'over' ? 100 - d.target : d.target - 1;
  const sl = $('#diceslider'); if (sl && sl.value !== String(d.target)) sl.value = String(d.target);
  setText('#diceTargetBig', d.target); setText('#dicethr', 'порог ' + d.target);
  setText('#lblover', d.target); setText('#lblunder', d.target);
  setText('#dicePct', Math.round(outs) + '%'); setText('#diceMult', '×' + mult.toFixed(2));
  setText('#diceWin', fmt(Math.round(S.bet * mult)));
  const f = $('#dicefill'); if (f) { f.style.left = fillLeft + '%'; f.style.width = fillW + '%'; }
  const m = $('#dicemark'); if (m) m.style.left = d.target + '%';
  const msgEl = $('#dicemsg'); if (msgEl) { msgEl.textContent = d.msg || 'Настройте порог и бросайте'; msgEl.className = 'msg ' + (d.msgType || ''); }
  const el = $('#d100'); if (el && d.value) el.textContent = d.value;
  const rs = $('#rerollslot'); if (rs) rs.innerHTML = rerollBtnHTML();
  refreshActionLabels();
}
function rerollDice() {
  if (busy || !diceState || diceState.phase !== 'done' || diceState.usedReroll) return;
  const bet = diceState.lastBet || 0;
  diceState.usedReroll = true; diceState.phase = 'bet';
  diceState.msg = 'Переброс...'; diceState.msgType = '';
  updateDiceUI();
  setTimeout(() => doReroll(bet), 120);
}
async function doReroll(bet) {
  busy = true;
  const el = $('#d100'), msgEl = $('#dicemsg');
  if (el) { el.classList.add('rolling'); el.classList.remove('win', 'lose'); }
  if (msgEl) { msgEl.textContent = ''; msgEl.className = 'msg'; }
  await sleep(420);
  if (el) el.classList.remove('rolling');
  const value = 1 + rnd(100);
  diceState.value = value;
  if (el) el.textContent = value;
  resolveDice(value, bet);
}
async function rollDice() {
  if (busy) return;
  const bet = S.bet;
  if (!takeBet(bet)) return;
  diceState.lastBet = bet; diceState.phase = 'rolling';
  busy = true; S.stats.rolls++;
  const el = $('#d100'), msgEl = $('#dicemsg'), btn = $('#rollbtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Бросок...'; }
  if (el) { el.classList.add('rolling'); el.classList.remove('win', 'lose'); }
  if (msgEl) { msgEl.textContent = ''; msgEl.className = 'msg'; }
  await sleep(520);
  if (el) el.classList.remove('rolling');
  const value = 1 + rnd(100);
  diceState.value = value;
  if (el) el.textContent = value;
  resolveDice(value, bet);
}
function resolveDice(value, bet) {
  const d = diceState;
  const won = d.dir === 'over' ? value > d.target : value < d.target;
  const mult = diceMultiplier(d.target, d.dir);
  const el = $('#d100');
  if (won) {
    const w = payout(bet, mult, 'dice');
    const net = w - bet;
    registerWin(net);
    d.msg = value + ' — победа!  +' + fmt(net); d.msgType = 'win';
    if (el) el.classList.add('win');
    SFX.win(); buzz([20, 40, 20]);
    if (mult >= 8) bigWinFX(2.8);
    else starPulse(900, 1.5);
    animateChips('up');
  } else {
    if (!onLose(bet)) { registerLoss(); d.msg = value + ' — мимо.  −' + fmt(bet); d.msgType = 'lose'; }
    else { d.msg = 'Талисман вернул ставку'; d.msgType = 'win'; }
    if (el) el.classList.add('lose');
    SFX.lose(); buzz(70);
  }
  d.phase = 'done';
  busy = false;
  if (checkBroke()) return;
  const msgEl = $('#dicemsg');
  if (msgEl) { msgEl.textContent = d.msg; msgEl.className = 'msg ' + d.msgType; }
  const btn = $('#rollbtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Бросок · ' + fmt(S.bet); }
  flashStage('#dicestage', won);
  refreshDynamic();
  const rs = $('#rerollslot'); if (rs) rs.innerHTML = rerollBtnHTML();
}

/* =============================== ХАЙ-ЛОУ =============================== */
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
function hlOdds(card, dir) { const outs = dir === 'high' ? 14 - card : card - 2; return outs <= 0 ? 0 : outs / 13; }
function hlMultiplier(card, dir, streak) {
  const outs = dir === 'high' ? 14 - card : card - 2;
  if (outs <= 0) return 0;
  const base = 0.95 * 13 / outs;
  return Math.min(30, base + 0.06 * (streak || 0));
}
function drawHL() { hlState.card = 2 + rnd(13); return hlState.card; }
function cardFace(v) { return RANKS[v]; }
function highlowScreen() {
  const h = hlState;
  const c = h.card;
  const mHi = hlMultiplier(c, 'high', h.streak);
  const mLo = hlMultiplier(c, 'low', h.streak);
  const oHi = hlOdds(c, 'high'), oLo = hlOdds(c, 'low');
  const showOdds = hasPerk('counter');
  const suit = h.suit || (h.suit = rnd(4));
  return `
  ${gameHeader('Хай-Лоу', 'Угадай и забери')}
  ${chipBar()}
  ${h.phase === 'bet' ? betBox() : infoBox('В банке', fmt(h.pot), 'Серия', h.streak + ' побед подряд')}
  <div class="stage" id="hlstage">
    <div class="hand">
      <div class="pcard ${suit === 1 || suit === 2 ? 'red' : ''}" style="width:76px;height:108px">
        <div class="cr" style="font-size:22px">${cardFace(c)}</div>
        <div style="font-size:26px;text-align:center">${SUITS[suit]}</div>
        <div class="cs" style="font-size:22px">${cardFace(c)}</div>
      </div>
    </div>
    <div class="msg ${h.msgType || ''}" id="hlmsg">${h.msg || 'Следующая карта — больше или меньше?'}</div>
  </div>
  <div class="pad">
    ${h.phase === 'bet' || h.phase === 'guess' ? `
      <div class="row">
        <button class="btn" onclick="guessHL('high')" ${mHi <= 0 || busy ? 'disabled' : ''}>
          ВЫШЕ${showOdds ? ` <span style="opacity:.7;font-size:11px">${(oHi*100).toFixed(0)}%</span>` : ''}
          <div style="font-size:11px;font-weight:600;opacity:.75;margin-top:2px">×${mHi.toFixed(2)}</div>
        </button>
        <button class="btn blu" onclick="guessHL('low')" ${mLo <= 0 || busy ? 'disabled' : ''}>
          НИЖЕ${showOdds ? ` <span style="opacity:.7;font-size:11px">${(oLo*100).toFixed(0)}%</span>` : ''}
          <div style="font-size:11px;font-weight:600;opacity:.75;margin-top:2px">×${mLo.toFixed(2)}</div>
        </button>
      </div>` : ''}
    ${h.phase === 'cash' ? `
      <div class="row">
        <button class="btn grn" onclick="cashHL()">Забрать ${fmt(h.pot)}</button>
        <button class="btn sec" onclick="continueHL()">Дальше</button>
      </div>` : ''}
  </div>
  <div class="bottom">
    ${h.phase === 'bet'
      ? `<button class="btn js-betbtn" data-label="Раздать" id="hlbtn" onclick="startHL()">Раздать · ${fmt(S.bet)}</button>`
      : `<div style="text-align:center;font-size:11.5px;color:var(--mut)">Победа умножает банк. Ничья — пересдача.</div>`}
  </div>`;
}
function startHL() {
  if (busy) return;
  const bet = S.bet;
  if (!takeBet(bet)) return;
  hlState = { card: 0, pot: bet, streak: 0, phase: 'guess', msg: '', msgType: '', baseBet: bet, suit: rnd(4) };
  drawHL(); S.stats.highs++;
  buzz(15); render();
}
async function guessHL(dir) {
  if (busy || !hlState || hlState.phase !== 'guess') return;
  const h = hlState;
  const prev = h.card;
  const m = hlMultiplier(prev, dir, h.streak);
  const outs = dir === 'high' ? 14 - prev : prev - 2;
  if (outs <= 0) { toast('Некуда идти', 'bad'); return; }
  busy = true;
  h.msg = 'Тянем карту...'; h.msgType = '';
  render();
  await sleep(420);
  const next = drawHL();
  const isTie = next === prev;
  const won = dir === 'high' ? next > prev : next < prev;
  if (isTie) {
    const cold = S.curse && S.curse.id === 'cold';
    if (cold) {
      h.pot = 0; h.msg = 'Ничья — холодная колода сжигает банк!'; h.msgType = 'lose';
      SFX.lose(); buzz(90);
      busy = false; h.phase = 'over';
      render();
      setTimeout(() => { hlState = null; S.screen = 'hub'; if (!checkBroke()) render(); }, 1400);
      return;
    }
    h.msg = 'Ничья — пересдача'; h.msgType = '';
    h.card = next; h.suit = rnd(4); h.phase = 'guess';
    busy = false; render();
    return;
  }
  h.suit = rnd(4);
  if (won) {
    h.pot = Math.round(h.pot * m); h.streak++; h.lastMult = m; h.card = next; h.phase = 'cash';
    h.msg = cardFace(next) + ' — верно! Банк ×' + m.toFixed(2) + ' = ' + fmt(h.pot);
    h.msgType = 'win';
    SFX.win(); buzz([20, 40, 20]);
    if (h.streak >= 3) bigWinFX(2.5);
    else if (h.streak >= 2) starPulse(1200, 1.8);
  } else {
    const lost = h.pot;
    h.pot = 0; h.card = next; h.phase = 'over';
    h.msg = cardFace(next) + ' — не угадал. Потеряно ' + fmt(lost);
    h.msgType = 'lose';
    registerLoss(); SFX.lose(); buzz(80);
  }
  busy = false; render();
  flashStage('#hlstage', won);
  if (h.phase === 'over') setTimeout(() => { hlState = null; S.screen = 'hub'; if (!checkBroke()) render(); }, 1500);
}
function cashHL() {
  if (busy || !hlState || hlState.phase !== 'cash') return;
  const winnings = hlState.pot;
  S.chips += winnings;
  if (S.chips > S.peak) S.peak = S.chips;
  const net = winnings - hlState.baseBet;
  if (net > S.stats.biggest) S.stats.biggest = net;
  registerWin(net);
  toast('+' + fmt(winnings), 'gold', 'a-coins');
  if (net >= 500) bigWinFX(3); else { SFX.big(); starPulse(1200, 1.8); }
  buzz(30); animateChips('up');
  hlState = null; S.screen = 'hub';
  render();
}
function continueHL() {
  if (busy || !hlState || hlState.phase !== 'cash') return;
  hlState.phase = 'guess'; hlState.msg = ''; hlState.msgType = '';
  SFX.click(); render();
}

/* ============================== БЛЭКДЖЕК ============================== */
function makeShoe() {
  const s = [];
  for (let d = 0; d < 6; d++) for (let r = 1; r <= 13; r++) for (let k = 0; k < 4; k++) s.push({ r, s: rnd(4) });
  return shuffle(s);
}
function handVal(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.r === 1) { aces++; total += 11; }
    else if (c.r >= 10) total += 10;
    else total += c.r;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
function isSoft(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.r === 1) { aces++; total += 11; }
    else if (c.r >= 10) total += 10;
    else total += c.r;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return aces > 0 && total <= 21;
}
function isBJ(cards) { return cards.length === 2 && handVal(cards) === 21; }
function cardHTML(c, hidden, delay) {
  if (hidden) return `<div class="pcard back" style="animation-delay:${delay || 0}ms"></div>`;
  const red = c.s === 1 || c.s === 2;
  return `<div class="pcard ${red ? 'red' : ''}" style="animation-delay:${delay || 0}ms">
    <div class="cr">${RANKS[c.r]}</div>
    <div class="cs">${SUITS[c.s]}</div>
  </div>`;
}
function blackjackScreen() {
  const b = bjState;
  const pv = handVal(b.player);
  const dv = b.dealer.length ? (b.phase === 'play' ? handVal([b.dealer[0]]) : handVal(b.dealer)) : 0;
  const dealerLabel = b.dealer.length
    ? `<div class="hand-val">${b.phase === 'play' ? handVal([b.dealer[0]]) + ' + ?' : dv}${isSoft(b.dealer) && b.phase !== 'play' ? ' (мягк.)' : ''}</div>`
    : '';
  return `
  ${gameHeader('Блэкджек', 'Дилер стоит на 17')}
  ${chipBar()}
  ${b.phase === 'bet' ? betBox() : infoBox('Ставка', fmt(b.bet), b.doubled ? 'Удвоено' : '', '')}
  <div class="stage" id="bjstage" style="gap:10px">
    <div style="width:100%;text-align:center">
      <div class="hand-label">Дилер</div>
      ${dealerLabel}
      <div class="hand" style="margin-top:5px">
        ${b.dealer.map((c, i) => cardHTML(c, b.phase === 'play' && i === 1, i * 90)).join('') || '<div style="color:var(--line2);font-size:12px;padding:24px 0">—</div>'}
      </div>
    </div>
    <div style="width:100%;height:1px;background:var(--line)"></div>
    <div style="width:100%;text-align:center">
      <div class="hand-label">Вы</div>
      <div class="hand-val">${b.player.length ? pv + (isSoft(b.player) ? ' (мягк.)' : '') : ''}</div>
      <div class="hand" style="margin-top:5px">
        ${b.player.map((c, i) => cardHTML(c, false, i * 90)).join('') || '<div style="color:var(--line2);font-size:12px;padding:24px 0">—</div>'}
      </div>
    </div>
    <div class="msg ${b.msgType || ''}" id="bjmsg">${b.msg || ''}</div>
  </div>
  <div class="bottom">
    ${b.phase === 'bet' ? `<button class="btn js-betbtn" data-label="Раздать" id="bjbtn" onclick="bjDeal()">Раздать · ${fmt(S.bet)}</button>` : ''}
    ${b.phase === 'play' ? `
      <div class="row" style="margin-bottom:8px">
        <button class="btn" onclick="bjHit()" ${busy ? 'disabled' : ''}>Ещё</button>
        <button class="btn sec" onclick="bjStand()" ${busy ? 'disabled' : ''}>Хватит</button>
      </div>
      ${b.player.length === 2 && S.chips >= b.bet
        ? `<button class="btn blu sm" onclick="bjDouble()" ${busy ? 'disabled' : ''}>Удвоить · ${fmt(b.bet)}</button>` : ''}
    ` : ''}
    ${b.phase === 'done' ? `<button class="btn" onclick="bjReset()">Следующая раздача</button>` : ''}
  </div>`;
}
function bjReset() {
  bjState.player = []; bjState.dealer = []; bjState.phase = 'bet';
  bjState.doubled = false; bjState.msg = ''; bjState.msgType = ''; bjState.bet = 0;
  SFX.click(); render();
}
function bjDeal() {
  if (busy) return;
  const bet = S.bet;
  if (!takeBet(bet)) return;
  S.stats.hands++;
  bjState.bet = bet; bjState.doubled = false;
  bjState.player = []; bjState.dealer = [];
  if (bjState.shoe.length < 60) bjState.shoe = makeShoe();
  bjState.player.push(bjState.shoe.pop());
  bjState.dealer.push(bjState.shoe.pop());
  bjState.player.push(bjState.shoe.pop());
  bjState.dealer.push(bjState.shoe.pop());
  bjState.msg = ''; bjState.msgType = '';
  bjState.phase = 'play';
  SFX.deal(); buzz(15); render();
  if (isBJ(bjState.player)) {
    setTimeout(() => { if (isBJ(bjState.dealer)) bjFinish('push', 'У обоих блэкджек — ничья'); else bjFinish('bj', 'БЛЭКДЖЕК!'); }, 420);
  }
}
function bjHit() {
  if (busy || bjState.phase !== 'play') return;
  if (bjState.shoe.length < 60) bjState.shoe = makeShoe();
  bjState.player.push(bjState.shoe.pop());
  SFX.deal();
  const v = handVal(bjState.player);
  if (v > 21) { bjFinish('bust', `Перебор (${v})`); return; }
  if (v === 21) { bjStand(); return; }
  render(); buzz(12);
}
function bjDouble() {
  if (busy || bjState.phase !== 'play' || bjState.player.length !== 2) return;
  if (S.chips < bjState.bet) { toast('Недостаточно фишек', 'bad'); return; }
  S.chips -= bjState.bet; bjState.bet *= 2; bjState.doubled = true;
  if (bjState.shoe.length < 60) bjState.shoe = makeShoe();
  bjState.player.push(bjState.shoe.pop());
  SFX.deal();
  const v = handVal(bjState.player);
  render();
  setTimeout(() => { if (v > 21) bjFinish('bust', `Перебор (${v})`); else bjFinish('stand', null); }, 380);
}
function bjStand() { if (busy || bjState.phase !== 'play') return; bjFinish('stand', null); }
async function bjFinish(reason, text) {
  busy = true;
  bjState.phase = 'done';
  const b = bjState;
  if (reason === 'bust') {
    b.msg = text + ' — ставка потеряна'; b.msgType = 'lose';
    registerLoss(); onLose(b.bet);
    render(); flashStage('#bjstage', false);
    SFX.lose(); buzz(80);
    busy = false; checkBroke(); refreshDynamic();
    return;
  }
  if (reason !== 'bj' || !isBJ(b.dealer)) {
    while (handVal(b.dealer) < 17) {
      await sleep(320);
      if (b.shoe.length < 60) b.shoe = makeShoe();
      b.dealer.push(b.shoe.pop());
      SFX.deal(); render(); buzz(10);
    }
  }
  const pv = handVal(b.player), dv = handVal(b.dealer);
  const pBJ = isBJ(b.player), dBJ = isBJ(b.dealer);
  let isWin = false;
  if (reason === 'bj' && !dBJ) {
    const m = hasPerk('ace') ? 3 : 2.5;
    const w = payout(b.bet, m, 'blackjack');
    const net = w - b.bet;
    registerWin(net); unlockAch('bj_natural');
    b.msg = 'БЛЭКДЖЕК! +' + fmt(net); b.msgType = 'win';
    toast('Блэкджек ×' + m, 'gold', 'p-ace');
    bigWinFX(3.2); buzz([20, 40, 20]);
    isWin = true; animateChips('up');
  } else if (pBJ && dBJ) {
    S.chips += b.bet;
    b.msg = 'У обоих блэкджек — ничья'; b.msgType = '';
  } else if (dBJ) {
    b.msg = 'Блэкджек у дилера — −' + fmt(b.bet); b.msgType = 'lose';
    registerLoss(); onLose(b.bet); SFX.lose(); buzz(70);
  } else if (dv > 21) {
    const w = payout(b.bet, 2, 'blackjack');
    const net = w - b.bet;
    registerWin(net);
    b.msg = 'Дилер перебрал (' + dv + ')! +' + fmt(net); b.msgType = 'win';
    SFX.win(); buzz([20, 40, 20]); isWin = true;
    if (net >= 500) bigWinFX(2.8); else starPulse(1100, 1.6);
    animateChips('up');
  } else if (pv > dv) {
    const w = payout(b.bet, 2, 'blackjack');
    const net = w - b.bet;
    registerWin(net);
    b.msg = pv + ' против ' + dv + ' — победа! +' + fmt(net); b.msgType = 'win';
    SFX.win(); buzz([20, 40, 20]); isWin = true;
    if (net >= 500) bigWinFX(2.8); else starPulse(1100, 1.6);
    animateChips('up');
  } else if (pv === dv) {
    S.chips += b.bet;
    b.msg = pv + ' против ' + dv + ' — ничья'; b.msgType = '';
  } else {
    b.msg = pv + ' против ' + dv + ' — −' + fmt(b.bet); b.msgType = 'lose';
    registerLoss(); onLose(b.bet); SFX.lose(); buzz(70);
  }
  busy = false;
  checkBroke();
  if (!S.over) render();
  if (!S.over) flashStage('#bjstage', isWin);
  refreshDynamic();
}

/* ============================== РУЛЕТКА =============================== */
function rouletteScreen() {
  const r = rouState;
  const sel = r.pick;
  const col = r.number === null ? '' : rouColor(r.number);
  return `
  ${gameHeader('Рулетка', 'Европейская · одно зеро')}
  ${chipBar()}
  ${betBox()}
  <div class="stage" id="roustage" style="gap:12px">
    <div class="wheel ${col}" id="wheel">${r.number === null ? '—' : r.number}</div>
    <div class="msg ${r.msgType || ''}" id="roumsg">${r.msg || 'Выберите ставку'}</div>
  </div>
  <div class="pad">
    <div class="rou-grid">
      ${ROULETTE_BETS.map(b => `
        <button class="rou-btn ${b.cls} ${sel === b.id ? 'sel' : ''}" onclick="pickRou('${b.id}')">
          ${b.label}<small>×${b.pay}</small>
        </button>`).join('')}
    </div>
  </div>
  <div class="bottom">
    <button class="btn js-betbtn" data-label="Крутить" id="roubtn" onclick="spinRoulette()" ${sel ? '' : 'disabled'}>
      ${sel ? 'Крутить · ' + fmt(S.bet) : 'Выберите ставку'}
    </button>
  </div>`;
}
function pickRou(id) {
  if (busy) return;
  rouState.pick = rouState.pick === id ? null : id;
  SFX.click(); buzz(8); render();
}
async function spinRoulette() {
  if (busy || !rouState.pick) return;
  const bet = S.bet;
  if (!takeBet(bet)) return;
  busy = true; S.stats.rou++;
  const b = ROULETTE_BETS.find(x => x.id === rouState.pick);
  const wheel = $('#wheel'), msgEl = $('#roumsg'), btn = $('#roubtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Крутится...'; }
  if (msgEl) { msgEl.textContent = ''; msgEl.className = 'msg'; }
  if (wheel) wheel.className = 'wheel spinning';
  const iv = setInterval(() => { if (wheel) wheel.textContent = rnd(37); SFX.tick(); }, 85);
  await sleep(1500);
  clearInterval(iv);
  const n = rnd(37);
  const col = rouColor(n);
  rouState.number = n;
  if (wheel) { wheel.className = 'wheel ' + col; wheel.textContent = n; }
  const won = b.test(n);
  const colName = col === 'red' ? 'красное' : col === 'black' ? 'чёрное' : 'зеро';
  if (n === 0) unlockAch('roulette_zero');
  if (won) {
    const w = payout(bet, b.pay, 'roulette');
    const net = w - bet;
    registerWin(net);
    if (b.id === 'red') unlockAch('roulette_red');
    rouState.msg = n + ' (' + colName + ') — ' + b.label + ' сыграло!  +' + fmt(net);
    rouState.msgType = 'win';
    if (net >= 500) bigWinFX(2.8); else { SFX.big(); starPulse(1100, 1.6); }
    buzz([20, 40, 20]);
    animateChips('up');
  } else {
    if (!onLose(bet)) {
      registerLoss();
      rouState.msg = n + ' (' + colName + ') — ' + b.label + ' не сыграло.  −' + fmt(bet);
      rouState.msgType = 'lose';
    } else {
      rouState.msg = 'Талисман вернул ставку'; rouState.msgType = 'win';
    }
    SFX.lose(); buzz(70);
  }
  rouState.phase = 'bet';
  busy = false;
  if (checkBroke()) return;
  render();
  flashStage('#roustage', won);
}

/* ============================== ЭКРАНЫ ================================ */
function achScreen() {
  const unlocked = ACH.size;
  return `
  <div class="hdr">
    <button class="icon-btn" onclick="goHub()">${ico('u-back', 18)}</button>
    <div class="hdr-title serif" style="font-size:14px">Достижения<small>${unlocked} / ${ACHIEVEMENTS.length}${S.over ? ' · назад к итогу' : ''}</small></div>
    <button class="icon-btn" onclick="showHelp()">${ico('u-help', 18)}</button>
  </div>
  <div class="pad" style="padding-top:8px">
    <div class="ach-count">Открыто <b>${unlocked}</b> из <b>${ACHIEVEMENTS.length}</b></div>
    ${ACHIEVEMENTS.map(a => {
      const un = ACH.has(a.id);
      return `<div class="ach-item ${un ? 'unlocked' : 'locked'}">
        <div class="ai">${ico(un ? a.icon : 'u-lock', 26)}</div>
        <div><div class="an">${a.name}</div><div class="ad">${a.desc}</div></div>
      </div>`;
    }).join('')}
  </div>`;
}
function recordsScreen() {
  const best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  return `
  <div class="hdr">
    <button class="icon-btn" onclick="goHub()">${ico('u-back', 18)}</button>
    <div class="hdr-title serif" style="font-size:14px">Рекорды<small>Лучший: ${fmt(best)}${S.over ? ' · назад к итогу' : ''}</small></div>
    <button class="icon-btn" onclick="showHelp()">${ico('u-help', 18)}</button>
  </div>
  <div class="pad" style="padding-top:8px">
    <div class="sect" style="margin-top:4px">Топ-5 забегов</div>
    ${RECS.length
      ? RECS.map((r, i) => `
          <div class="rec-row ${r.fresh ? 'new' : ''}">
            <div class="rnum ${i === 0 ? 'g' : ''}">${i + 1}</div>
            <div style="display:flex;gap:6px;align-items:center;min-width:0">
              <span class="rtag ${r.result === 'escaped' ? 'win' : 'dead'}">${ico(r.result === 'escaped' ? 'a-crown' : 'c-skull', 11)}</span>
              <span class="rec-name">${r.name ? r.name : 'Безымянный'}</span>
              <span class="rfl">этаж ${r.floor}</span>
            </div>
            <div class="rchips" style="grid-column:3">${fmt(r.chips)}</div>
            <div class="rfl">${r.date}</div>
          </div>`).join('')
      : `<div style="color:var(--mut);font-size:13px;text-align:center;padding:26px 0">Пока пусто. Сыграйте первый забег.</div>`}
    ${!S.over ? `
    <div class="sect">Текущий забег</div>
    <div style="width:100%">
      <div class="statline"><span>Этаж</span><span>${S.floor} / ${MAX_FLOOR}</span></div>
      <div class="statline"><span>Фишек</span><span>${fmt(S.chips)}</span></div>
      <div class="statline"><span>Пик</span><span>${fmt(S.peak)}</span></div>
      <div class="statline"><span>Побед</span><span>${S.stats.wins}</span></div>
      <div class="statline"><span>Лучшая серия</span><span>${S.bestStreak}</span></div>
      <div class="statline"><span>Боссов встречено</span><span>${S.stats.bosses || 0}</span></div>
      <div class="statline"><span>Спинов слотов</span><span>${S.stats.spins}</span></div>
      <div class="statline"><span>Раздач БД</span><span>${S.stats.hands}</span></div>
      <div class="statline"><span>Бросков костей</span><span>${S.stats.rolls}</span></div>
      <div class="statline"><span>Спинов рулетки</span><span>${S.stats.rou}</span></div>
      <div class="statline"><span>Крупнейший выигрыш</span><span>${fmt(S.stats.biggest)}</span></div>
      <div class="statline" style="border:none"><span>Перков</span><span>${S.perks.length}</span></div>
    </div>` : ''}
    ${RECS.length ? `<button class="btn sec sm" style="margin-top:16px" onclick="clearRecs()">Очистить рекорды</button>` : ''}
  </div>`;
}
function clearRecs() {
  RECS = []; saveRecs();
  toast('Рекорды очищены', 'bad'); render();
}

/* ================================ МОДАЛКИ ============================= */
function closeModal() { $('#modal-root').innerHTML = ''; }
function showHelp() {
  $('#modal-root').innerHTML = `
  <div class="modal" onclick="if(event.target===this)closeModal()">
    <div class="modal-in">
      <h2>${ico('u-help', 20)}ЛЮКС-7 · Как играть</h2>
      <p>Вы начинаете со <b class="k">100 фишками</b> на первом этаже. Цель — подняться на <b class="k">10-й этаж</b> и выйти живым. На <b class="k">3, 6 и 9</b> этажах — боссы.</p>
      <ul>
        <li>Чтобы подняться, платите за лифт. Цена растёт с этажом.</li>
        <li><b style="color:#e08a76">Если осталось меньше минимальной ставки — забег закончен.</b></li>
        <li>Выбираете <b class="k">класс</b> в начале, <b class="k">перк</b> после каждого подъёма и заходите в <b class="k">магазин</b>.</li>
        <li>Со 2-го этажа — шанс <b style="color:#e08a76">проклятия</b>.</li>
        <li>Забег <b>автосохраняется</b> между этажами.</li>
      </ul>
      <h2 style="margin-top:22px">${ico('k-scholar', 18)}Классы</h2>
      <ul>
        <li><b>Считающий</b> — старт с «Карточный счёт», БД +5%.</li>
        <li><b>Фортуна</b> — старт с «Талисман», шанс проклятия −25%.</li>
        <li><b>Рисковый</b> — все выплаты ×1.15, лифт +20%.</li>
      </ul>
      <h2 style="margin-top:22px">${ico('a-boss', 18)}Боссы</h2>
      <p>На <b class="k">3</b> этаже — <b>Крупье-обманщик</b> (слоты ×0.5, БД +50%). На <b class="k">6</b> — <b>Инспектор</b> (ставки от 50 до 200). На <b class="k">9</b> — <b>Хранитель долгов</b> (−15% с каждой победы). Пройдите этаж — получите крупную награду.</p>
      <h2 style="margin-top:22px">${ico('p-hot', 18)}Серии</h2>
      <p>Три победы подряд — <b class="k">+15% к выплатам</b>, пока серия держится.</p>
      <h2 style="margin-top:22px">${ico('s-gift', 18)}Магазин</h2>
      <p>После каждого подъёма: снять проклятие (200), купить перк (400), поставить оберег (80) или взять +40 фишек (30).</p>
      <h2 style="margin-top:22px">${ico('u-help', 18)}Горячие клавиши (ПК)</h2>
      <p>
        <span class="kbd">1</span>–<span class="kbd">5</span> столы ·
        <span class="kbd">Esc</span> назад/закрыть ·
        <span class="kbd">Space</span> основное ·
        <span class="kbd">R</span> рекорды ·
        <span class="kbd">A</span> достижения ·
        <span class="kbd">M</span> звук ·
        <span class="kbd">H</span> помощь
      </p>
      <button class="btn sec" style="margin-top:22px" onclick="closeModal()">Понятно</button>
    </div>
  </div>`;
}
function showCurseInfo() {
  if (!S.curse) return;
  $('#modal-root').innerHTML = `
  <div class="modal" onclick="if(event.target===this)closeModal()">
    <div class="modal-in">
      <h2 style="color:#e08a76">${ico(S.curse.icon, 22)}${S.curse.name}</h2>
      <p>${S.curse.desc}</p>
      <p style="margin-top:12px;font-size:12px">Проклятие действует только на этом этаже.</p>
      <button class="btn sec" style="margin-top:20px" onclick="closeModal()">Закрыть</button>
    </div>
  </div>`;
}
function askNameForRecord() {
  const saved = getPlayerName();
  $('#modal-root').innerHTML = `
  <div class="modal">
    <div class="modal-in">
      <h2>${ico('a-crown', 22)}Новый рекорд!</h2>
      <p style="margin-bottom:16px">${fmt(S.chips)} фишек · этаж ${S.floor}</p>
      <p style="margin-bottom:8px;font-size:12px">Подпишите результат (необязательно):</p>
      <input type="text" class="name-input" id="name-input" maxlength="18" placeholder="Ваше имя или ник" value="${saved.replace(/"/g, '&quot;')}">
      <button class="btn" onclick="submitName()">Сохранить</button>
      <button class="btn sec sm" style="margin-top:8px" onclick="submitName(true)">Пропустить</button>
    </div>
  </div>`;
  setTimeout(() => { const i = $('#name-input'); if (i) i.focus(); }, 300);
}
function submitName(skip) {
  const val = skip ? '' : (($('#name-input') || {}).value || '').trim();
  if (val) setPlayerName(val);
  const rec = RECS.find(r => r.fresh);
  if (rec) { rec.name = val || getPlayerName() || 'Безымянный'; rec.fresh = false; saveRecs(); }
  closeModal(); render();
}

/* ============================ КОНЕЦ ЗАБЕГА ============================= */
function endRun(reason) {
  clearRun();
  S.over = true;
  S.result = reason;
  S.screen = 'end';
  const best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  const isNewBest = S.chips > best;
  if (isNewBest) { localStorage.setItem(BEST_KEY, String(S.chips)); S.newBest = true; }
  S.prevBest = best;
  const rec = {
    chips: S.chips, floor: S.floor, result: reason,
    date: new Date().toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' }),
    fresh: true, name: getPlayerName() || '',
  };
  RECS.forEach(r => r.fresh = false);
  RECS.push(rec);
  RECS.sort((a, b) => b.chips - a.chips);
  RECS = RECS.slice(0, 5);
  saveRecs();
  setGameTheme(null);
  if (reason === 'escaped') { unlockAch('escape'); bigWinFX(4); }
  else SFX.lose();
  buzz([40, 60, 40]);
  render();
  if (isNewBest && S.chips > 0) setTimeout(() => askNameForRecord(), 700);
}
function renderEnd() {
  const el = $('#app');
  const won = S.result === 'escaped';
  const best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  const mb = S.boss && S.boss.mods && S.boss.mods.minBet ? S.boss.mods.minBet : MIN_BET;
  el.innerHTML = `
  <div class="endwrap anim-screen">
    <div class="endicon" style="color:${won ? 'var(--gold2)' : '#e08a76'}">${ico(won ? 'a-crown' : 'c-skull', 72)}</div>
    <div class="endtitle serif">${won ? 'Вы вырвались' : 'Вы разорены'}</div>
    <div class="endlabel" style="margin-top:6px">Итог забега</div>
    <div class="endscore" style="color:${won ? 'var(--gold2)' : '#e08a76'}">${fmt(S.chips)}</div>
    <div class="endlabel">${won ? `Этаж ${MAX_FLOOR} пройден` : `Осталось меньше ${mb} фишек на этаже ${S.floor}`}</div>
    ${S.newBest ? `<div class="badge good" style="margin-top:12px">★ Новый рекорд</div>` : `<div class="badge" style="margin-top:12px">Рекорд: ${fmt(best)}</div>`}
    <div style="width:100%;max-width:340px;margin-top:22px">
      <div class="sect" style="margin:0 0 8px;text-align:left">Ваш топ-5</div>
      ${RECS.map((r, i) => `
        <div class="rec-row ${r.fresh ? 'new' : ''}">
          <div class="rnum ${i === 0 ? 'g' : ''}">${i + 1}</div>
          <div style="display:flex;gap:6px;align-items:center;min-width:0">
            <span class="rtag ${r.result === 'escaped' ? 'win' : 'dead'}">${ico(r.result === 'escaped' ? 'a-crown' : 'c-skull', 11)}</span>
            <span class="rec-name">${r.name ? r.name : 'Безымянный'}</span>
            <span class="rfl">этаж ${r.floor}</span>
          </div>
          <div class="rchips">${fmt(r.chips)}</div>
          <div class="rfl">${r.date}</div>
        </div>`).join('')}
    </div>
    <div style="width:100%;max-width:340px;margin-top:22px">
      <div class="statline"><span>Побед</span><span>${S.stats.wins}</span></div>
      <div class="statline"><span>Лучшая серия</span><span>${S.bestStreak}</span></div>
      <div class="statline"><span>Боссов встречено</span><span>${S.stats.bosses || 0} / 3</span></div>
      <div class="statline"><span>Крупнейший выигрыш</span><span>${fmt(S.stats.biggest)}</span></div>
      <div class="statline"><span>Перков</span><span>${S.perks.length}</span></div>
      <div class="statline"><span>Ачивок открыто</span><span>${ACH.size} / ${ACHIEVEMENTS.length}</span></div>
    </div>
    <div style="width:100%;max-width:340px;margin-top:26px">
      <button class="btn ${won ? 'grn' : ''}" onclick="newRun()">${won ? 'Новый забег' : 'Попробовать снова'}</button>
      <button class="btn blu sm" style="margin-top:9px" onclick="shareResult()">${ico('u-share', 16)} Поделиться результатом</button>
      <div class="row" style="margin-top:9px">
        <button class="btn sec sm" onclick="go('ach')">${ico('a-check', 16)} Достижения</button>
        <button class="btn sec sm" onclick="go('records')">${ico('a-crown', 16)} Рекорды</button>
      </div>
      <button class="btn sec sm" style="margin-top:9px" onclick="showHelp()">${ico('u-help', 16)} Как играть</button>
    </div>
  </div>`;
}
async function shareResult() {
  const won = S.result === 'escaped';
  const text = `ЛЮКС-7 · ${won ? 'вышел живым' : 'обанкротился'} на этаже ${S.floor} с ${fmt(S.chips)} фишек. Боссов: ${S.stats.bosses || 0}/3. Ачивок: ${ACH.size}/${ACHIEVEMENTS.length}. Побей мой результат!`;
  try {
    if (navigator.share && isMobileShare()) { await navigator.share({ title: 'ЛЮКС-7', text }); return; }
    if (navigator.clipboard) { await navigator.clipboard.writeText(text); toast('Скопировано в буфер', 'good', 'u-share'); return; }
    throw new Error('no clipboard');
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      toast('Скопировано', 'good', 'u-share');
    } catch (e2) { toast('Не удалось скопировать', 'bad'); }
  }
}
function isMobileShare() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''); }

/* ====================== ФОН: ЧАСТИЦЫ С ПУЛЬСОМ ========================= */
(function starsCanvas() {
  const cv = document.getElementById('stars'); if (!cv) return;
  const ctx = cv.getContext('2d');
  let W, H, parts = [], DPR = Math.min(window.devicePixelRatio || 1, 2);
  let starPulseT = 0, starPulseStrength = 0;

  window.starPulse = function (durMs, strength) {
    starPulseT = Math.max(starPulseT, performance.now() + (durMs || 1500));
    starPulseStrength = Math.max(starPulseStrength, strength || 2);
  };

  function resize() {
    W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    const n = Math.min(80, Math.round(innerWidth / 20));
    parts = [];
    for (let i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * W, y: Math.random() * H,
        r: (Math.random() * 1.3 + 0.4) * DPR,
        vx: (Math.random() - 0.5) * 0.16 * DPR,
        vy: (Math.random() - 0.5) * 0.16 * DPR,
        a: Math.random() * 0.5 + 0.2,
        hue: Math.random() < 0.35 ? 'gold' : 'white',
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
  function tick() {
    const now = performance.now();
    let boost = 0;
    if (now < starPulseT) {
      const t = (starPulseT - now) / 1500;
      boost = Math.min(1, t) * starPulseStrength;
    } else {
      starPulseStrength = 0;
    }
    const speedK = 1 + boost * 1.5;
    const alphaK = 1 + boost * 0.9;
    const radiusK = 1 + boost * 0.6;
    const pulseWave = 1 + Math.sin(now / 90) * 0.12 * boost;

    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.x += p.vx * speedK; p.y += p.vy * speedK;
      if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
      if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
      ctx.beginPath();
      const r = p.r * 4 * radiusK * pulseWave;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      const a = Math.min(1, p.a * alphaK);
      if (p.hue === 'gold') {
        g.addColorStop(0, `rgba(242,201,107,${a})`);
        g.addColorStop(1, 'rgba(242,201,107,0)');
      } else {
        g.addColorStop(0, `rgba(255,255,255,${a * 0.8})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
      }
      ctx.fillStyle = g;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize(); tick();
})();

/* ============================ КОНФЕТТИ ================================= */
(function confettiCanvas() {
  const cv = document.getElementById('confetti'); if (!cv) return;
  const ctx = cv.getContext('2d');
  let W, H, DPR = Math.min(window.devicePixelRatio || 1, 2);
  let parts = [];
  function resize() {
    W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  }
  const COLORS = ['#f2c96b', '#d9a441', '#c9922f', '#ece4d4', '#c8503f', '#4fa87a'];
  window.confettiBurst = function (n) {
    n = n || 60;
    for (let i = 0; i < n; i++) {
      parts.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.6,
        y: H * 0.35,
        vx: (Math.random() - 0.5) * 12 * DPR,
        vy: (-Math.random() * 14 - 4) * DPR,
        g: 0.55 * DPR,
        size: (Math.random() * 8 + 5) * DPR,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[rnd(COLORS.length)],
        life: 1,
      });
    }
    if (parts.length) run();
  };
  let running = false;
  function run() {
    if (running) return; running = true;
    function step() {
      ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.vy += p.g;
        p.rot += p.vr; p.life -= 0.012;
        if (p.life <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (parts.length) requestAnimationFrame(step); else running = false;
    }
    requestAnimationFrame(step);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();
})();

/* ========================== ГОРЯЧИЕ КЛАВИШИ ============================ */
document.addEventListener('keydown', e => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();

  if (k === 'escape') {
    if ($('#modal-root').innerHTML) { closeModal(); return; }
    if (S && S.screen !== 'hub' && S.screen !== 'class') { goHub(); }
    return;
  }
  if (!S) return;
  if (k === 'm') { toggleSound(); return; }
  if (k === 'h' || k === '?') { showHelp(); return; }

  if (S.over) {
    if (S.screen === 'end') {
      if (k === 'enter' || k === ' ') { e.preventDefault(); newRun(); }
      else if (k === 'a') { e.preventDefault(); go('ach'); }
      else if (k === 'r') { e.preventDefault(); go('records'); }
    }
    return;
  }
  if (S.screen === 'class') {
    if (k === '1') { e.preventDefault(); pickClass(CLASSES[0].id); return; }
    if (k === '2') { e.preventDefault(); pickClass(CLASSES[1].id); return; }
    if (k === '3') { e.preventDefault(); pickClass(CLASSES[2].id); return; }
    return;
  }
  if (S.screen === 'hub') {
    if (k === '1') { e.preventDefault(); go('blackjack'); return; }
    if (k === '2') { e.preventDefault(); go('roulette'); return; }
    if (k === '3') { e.preventDefault(); go('dice'); return; }
    if (k === '4') { e.preventDefault(); go('highlow'); return; }
    if (k === '5') { e.preventDefault(); go('slots'); return; }
    if (k === 'r') { e.preventDefault(); go('records'); return; }
    if (k === 'a') { e.preventDefault(); go('ach'); return; }
    if (k === 'e' || k === 'enter') { e.preventDefault(); takeElevator(); return; }
    return;
  }
  if (k === ' ' || k === 'enter') {
    e.preventDefault();
    if (busy) return;
    if (S.screen === 'slots') spin();
    else if (S.screen === 'dice') rollDice();
    else if (S.screen === 'highlow') { if (hlState && hlState.phase === 'bet') startHL(); }
    else if (S.screen === 'blackjack') { if (bjState && bjState.phase === 'bet') bjDeal(); else if (bjState && bjState.phase === 'done') bjReset(); }
    else if (S.screen === 'roulette') { if (rouState && rouState.pick) spinRoulette(); }
    else if (S.screen === 'shop') leaveShop();
  }
});

/* =============================== СТАРТ ================================= */
(function boot() {
  const saved = loadRun();
  if (saved) {
    S = saved;
    applyTheme();
    setGameTheme(null);
    render();
    setTimeout(() => toast('Забег восстановлен · этаж ' + S.floor, 'gold', 'a-elev'), 200);
    if (S.boss) setTimeout(() => showBossInfo(), 700);
  } else {
    newRun();
  }
  if (musicOn) {
    const startOnFirst = () => {
      try { ac(); if (musicOn) startMusic(); } catch (e) {}
      document.removeEventListener('click', startOnFirst);
      document.removeEventListener('touchstart', startOnFirst);
      document.removeEventListener('keydown', startOnFirst);
    };
    document.addEventListener('click', startOnFirst, { once: true });
    document.addEventListener('touchstart', startOnFirst, { once: true });
    document.addEventListener('keydown', startOnFirst, { once: true });
  }
})();

/* Экспорт в глобальный скоуп для inline-обработчиков */
Object.assign(window, {
  go, goHub, takeElevator, choosePerk, buyShopItem, leaveShop,
  spin, rollDice, rerollDice, setDiceDir, setDicePreset, onDiceSlide, updateDiceUI,
  startHL, guessHL, cashHL, continueHL,
  bjDeal, bjHit, bjStand, bjDouble, bjReset,
  pickRou, spinRoulette,
  pickClass, closeModal, showHelp, showCurseInfo, showBossInfo,
  submitName, newRun, clearRecs, shareResult,
  toggleSound, toggleMusic,
  onBetSlide, quickBet,
  starPulse, confettiBurst,
});
