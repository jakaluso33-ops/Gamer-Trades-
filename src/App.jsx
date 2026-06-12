import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ASSETS = {
  BTC: { name: 'BTC/USD', basePrice: 45000, volatility: 0.012, color: '#f7931a' },
  GOLD: { name: 'XAU/USD', basePrice: 2000, volatility: 0.005, color: '#ffd700' },
  SPX: { name: 'S&P 500', basePrice: 5000, volatility: 0.006, color: '#00eaff' },
  OIL: { name: 'OIL/USD', basePrice: 80, volatility: 0.015, color: '#cd853f' },
  ETH: { name: 'ETH/USD', basePrice: 2500, volatility: 0.018, color: '#627eea' },
  EURUSD: { name: 'EUR/USD', basePrice: 1.08, volatility: 0.003, color: '#00ff88' },
};

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D'];
const TIMEFRAME_SPEED = { '1m': 1, '5m': 1.2, '15m': 1.5, '1H': 2, '4H': 2.5, '1D': 3 };

const LEVELS = [
  { name: 'Market Peasant', minXP: 0, color: '#aaaaaa' },
  { name: 'Scalp Ninja', minXP: 100, color: '#00ff88' },
  { name: 'Chart Wizard', minXP: 300, color: '#00eaff' },
  { name: 'Trading God', minXP: 600, color: '#ffe600' },
];

const POWERUPS = [
  { id: 'iron_shield', name: 'IRON SHIELD', desc: "SL won't cost a life once", icon: '🛡️', color: '#00eaff' },
  { id: 'double_xp', name: 'DOUBLE XP', desc: '2x XP for 5 trades', icon: '⚡', color: '#ffe600' },
  { id: 'sniper_mode', name: 'SNIPER MODE', desc: 'See next 3 candle directions', icon: '🎯', color: '#ff2d78' },
  { id: 'bonus_coins', name: 'BONUS COINS', desc: '+$500 instant bonus', icon: '💰', color: '#00ff88' },
  { id: 'fast_forward', name: 'FAST FORWARD', desc: 'Candles 2x speed for 30s', icon: '⏩', color: '#ff7700' },
];

const QUESTS_TEMPLATE = [
  { id: 'win3', name: 'Win 3 Trades', target: 3, type: 'wins', reward: 50, rewardType: 'XP' },
  { id: 'profit500', name: 'Make $500 Profit', target: 500, type: 'profit', reward: 200, rewardType: 'coins' },
  { id: 'stopOrder', name: 'Use Stop Order', target: 1, type: 'stopOrder', reward: 30, rewardType: 'XP' },
];

const MAX_CANDLES = 80;
const MAX_POSITIONS = 3;
const INITIAL_BALANCE = 10000;

// ─── AUDIO ────────────────────────────────────────────────────────────────────

function createAudioCtx() {
  try {
    return new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    return null;
  }
}

function playSound(audioCtxRef, type) {
  try {
    if (!audioCtxRef.current) audioCtxRef.current = createAudioCtx();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    const tone = (freq, start, dur, vol = 0.3, wave = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(vol, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };

    if (type === 'coin') {
      tone(880, 0, 0.08, 0.25, 'sine');
      tone(1320, 0.05, 0.1, 0.2, 'sine');
    } else if (type === 'fill') {
      tone(440, 0, 0.06, 0.2, 'square');
      tone(660, 0.06, 0.08, 0.18, 'square');
    } else if (type === 'stopHit') {
      tone(220, 0, 0.15, 0.35, 'sawtooth');
      tone(110, 0.12, 0.3, 0.3, 'sawtooth');
    } else if (type === 'levelUp') {
      [261, 329, 392, 523].forEach((f, i) => tone(f, i * 0.1, 0.1, 0.25));
    } else if (type === 'criticalHit') {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.12, 0.22, 'square'));
    } else if (type === 'gameOver') {
      [523, 392, 329, 261, 196].forEach((f, i) => tone(f, i * 0.15, 0.18, 0.28, 'sawtooth'));
    } else if (type === 'danger') {
      [0, 0.2, 0.4].forEach(t => tone(150, t, 0.1, 0.28, 'square'));
    }
  } catch (_) {}
}

// ─── PRICE GENERATION ─────────────────────────────────────────────────────────

function generateCandle(prevClose, assetKey) {
  const { volatility } = ASSETS[assetKey];
  const spike = Math.random() < 0.07;
  const vol = volatility * (spike ? 3.5 : 1);
  const bias = (Math.random() - 0.485) * prevClose * vol;
  const open = prevClose;
  const close = Math.max(open + bias, prevClose * 0.0001);
  const wTop = Math.random() * prevClose * vol * 0.6;
  const wBot = Math.random() * prevClose * vol * 0.6;
  const high = Math.max(open, close) + wTop;
  const low = Math.min(open, close) - Math.max(wBot, 0.00001);
  const volume = Math.floor((Math.random() * 900 + 100) * (spike ? 3 : 1));
  return { open, high, low, close, volume };
}

function generateInitialCandles(assetKey) {
  let price = ASSETS[assetKey].basePrice;
  const arr = [];
  for (let i = 0; i < MAX_CANDLES; i++) {
    const c = generateCandle(price, assetKey);
    arr.push(c);
    price = c.close;
  }
  return arr;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getLevelInfo(xp) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) { if (xp >= l.minXP) lvl = l; }
  const idx = LEVELS.indexOf(lvl);
  const next = LEVELS[idx + 1];
  const pct = next ? Math.min(100, ((xp - lvl.minXP) / (next.minXP - lvl.minXP)) * 100) : 100;
  return { level: lvl, next, progress: pct };
}

function fmtPrice(p) {
  if (p == null || isNaN(p)) return '—';
  if (p >= 1000) return p.toFixed(2);
  if (p >= 10) return p.toFixed(3);
  return p.toFixed(5);
}

function fmtPnl(pnl) {
  if (pnl == null) return '—';
  return (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);
}

function calcPnl(pos, price) {
  const mult = pos.direction === 'LONG' ? 1 : -1;
  return (price - pos.entry) * mult * pos.quantity;
}

function calcGrade(pnl) {
  if (pnl >= 500) return 'S';
  if (pnl >= 200) return 'A';
  if (pnl >= 50) return 'B';
  if (pnl >= 0) return 'C';
  if (pnl >= -100) return 'D';
  return 'F';
}

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function App() {
  const audioCtxRef = useRef(null);
  const candleIntervalRef = useRef(null);
  const comboTimerRef = useRef(null);
  const ffTimerRef = useRef(null);
  const continueTimerRef = useRef(null);

  // Chart/Asset
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [timeframe, setTimeframe] = useState('1m');
  const [candlesByAsset, setCandlesByAsset] = useState(() => {
    const o = {};
    for (const k of Object.keys(ASSETS)) o[k] = generateInitialCandles(k);
    return o;
  });

  // Game core
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [dailyPnl, setDailyPnl] = useState(0);
  const [lives, setLives] = useState(3);
  const [xp, setXp] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [continueCountdown, setContinueCountdown] = useState(null);
  const [sessionOver, setSessionOver] = useState(false);
  const [grade, setGrade] = useState('C');

  // Positions & history
  const [positions, setPositions] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);

  // Order inputs
  const [direction, setDirection] = useState('LONG');
  const [orderType, setOrderType] = useState('Market');
  const [quantity, setQuantity] = useState('0.1');
  const [slPrice, setSlPrice] = useState('');
  const [tpPrice, setTpPrice] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPriceInput, setStopPriceInput] = useState('');

  // VFX
  const [coinRain, setCoinRain] = useState([]);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [critHit, setCritHit] = useState(null);
  const [screenShake, setScreenShake] = useState(false);
  const [borderPulse, setBorderPulse] = useState(null);

  // Power-ups
  const [showPowerup, setShowPowerup] = useState(false);
  const [powerupOptions, setPowerupOptions] = useState([]);
  const [activeEffects, setActiveEffects] = useState({
    ironShield: false, doubleXP: 0, sniperMode: false, fastForward: false,
  });
  const [sniperPredictions, setSniperPredictions] = useState([]);

  // Quests
  const [quests, setQuests] = useState(QUESTS_TEMPLATE.map(q => ({ ...q, progress: 0, completed: false })));

  // ── DERIVED ──
  const candles = candlesByAsset[selectedAsset] || [];
  const currentPrice = candles.length ? candles[candles.length - 1].close : ASSETS[selectedAsset].basePrice;
  const livesDisplayed = Math.max(0, Math.ceil(lives));
  const levelInfo = getLevelInfo(xp);
  const multiplier = winStreak >= 5 ? 5 : winStreak >= 3 ? 3 : winStreak >= 2 ? 2 : 1;
  const totalOpenPnl = positions.reduce((s, p) => s + calcPnl(p, currentPrice), 0);

  // ── CANDLE INTERVAL ──
  const startCandleInterval = useCallback(() => {
    if (candleIntervalRef.current) clearInterval(candleIntervalRef.current);
    const speedMult = TIMEFRAME_SPEED[timeframe] || 1;
    const ffMult = activeEffects.fastForward ? 0.5 : 1;
    const ms = Math.floor(1500 * speedMult * ffMult);
    candleIntervalRef.current = setInterval(() => {
      setCandlesByAsset(prev => {
        const next = {};
        for (const k of Object.keys(ASSETS)) {
          const arr = prev[k];
          const nc = generateCandle(arr[arr.length - 1].close, k);
          next[k] = [...arr.slice(-(MAX_CANDLES - 1)), nc];
        }
        return next;
      });
    }, ms);
  }, [timeframe, activeEffects.fastForward]);

  useEffect(() => {
    startCandleInterval();
    return () => { if (candleIntervalRef.current) clearInterval(candleIntervalRef.current); };
  }, [startCandleInterval]);

  // ── CHECK SL/TP ON EACH NEW CANDLE ──
  useEffect(() => {
    if (!positions.length) return;
    const newCandle = candles[candles.length - 1];
    if (!newCandle) return;

    setPositions(prev => {
      let toRemove = [];
      const updated = prev.map(pos => {
        if (pos.asset !== selectedAsset) return pos;
        const pnl = calcPnl(pos, newCandle.close);
        const slHit = pos.sl && (
          (pos.direction === 'LONG' && newCandle.low <= pos.sl) ||
          (pos.direction === 'SHORT' && newCandle.high >= pos.sl)
        );
        const tpHit = pos.tp && (
          (pos.direction === 'LONG' && newCandle.high >= pos.tp) ||
          (pos.direction === 'SHORT' && newCandle.low <= pos.tp)
        );
        if (slHit) { toRemove.push({ pos, exitPrice: pos.sl, reason: 'SL' }); return null; }
        if (tpHit) { toRemove.push({ pos, exitPrice: pos.tp, reason: 'TP' }); return null; }
        return { ...pos, currentPnl: pnl };
      }).filter(Boolean);

      toRemove.forEach(({ pos, exitPrice, reason }) => {
        resolvePosition(pos, exitPrice, reason);
      });

      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  // ── BORDER PULSE CHECK ──
  useEffect(() => {
    if (!positions.length) { setBorderPulse(null); return; }
    const nearSl = positions.some(p => {
      if (!p.sl) return false;
      return Math.abs(currentPrice - p.sl) / currentPrice < 0.005;
    });
    if (nearSl) {
      setBorderPulse('danger');
      playSound(audioCtxRef, 'danger');
    } else if (totalOpenPnl > 0) {
      setBorderPulse('profit');
    } else {
      setBorderPulse(null);
    }
  }, [currentPrice, positions]);

  // ── COMBO COUNTER ──
  useEffect(() => {
    if (comboTimerRef.current) clearInterval(comboTimerRef.current);
    if (positions.length > 0) {
      comboTimerRef.current = setInterval(() => {
        const p = positions.reduce((s, pos) => s + calcPnl(pos, currentPrice), 0);
        if (p > 0) setComboCount(c => c + 1);
      }, 10000);
    } else {
      setComboCount(0);
    }
    return () => { if (comboTimerRef.current) clearInterval(comboTimerRef.current); };
  }, [positions.length]);

  // ── POSITION RESOLUTION ──
  function resolvePosition(pos, exitPrice, reason) {
    const pnl = calcPnl(pos, exitPrice);
    const isWin = pnl > 0;
    const isTp = reason === 'TP';
    const isSl = reason === 'SL';
    const is2R = pos.sl
      ? Math.abs(pnl) >= Math.abs(exitPrice - pos.sl) * pos.quantity * 2
      : false;

    // XP
    let xpGain = isWin ? 15 : 5;
    if (isTp) xpGain = 25;
    setActiveEffects(eff => {
      const actualXp = eff.doubleXP > 0 ? xpGain * 2 : xpGain;
      setXp(prev => {
        const newXp = prev + actualXp;
        if (getLevelInfo(newXp).level !== getLevelInfo(prev).level) {
          playSound(audioCtxRef, 'levelUp');
          spawnFloater('LEVEL UP! ⬆', '#ffe600');
        }
        return newXp;
      });
      return eff.doubleXP > 0 ? { ...eff, doubleXP: eff.doubleXP - 1 } : eff;
    });

    // Balance + daily P&L
    setBalance(b => b + pnl);
    setDailyPnl(d => d + pnl);

    // Lives
    if (isSl) {
      setActiveEffects(eff => {
        if (eff.ironShield) {
          spawnFloater('SHIELD BLOCKED SL!', '#00eaff');
          return { ...eff, ironShield: false };
        }
        setLives(l => {
          const nxt = l - 1;
          playSound(audioCtxRef, 'stopHit');
          triggerShake();
          spawnFloater('-1 LIFE!', '#ff2d78');
          if (nxt <= 0) {
            setTimeout(doGameOver, 200);
          } else {
            setTimeout(doOfferPowerup, 600);
          }
          return nxt;
        });
        return eff;
      });
    } else if (isTp) {
      setLives(l => Math.min(5, l + 0.5));
      playSound(audioCtxRef, 'criticalHit');
      setCritHit(pnl);
      setTimeout(() => setCritHit(null), 2200);
      spawnCoins(pnl);
    } else if (isWin) {
      if (is2R) {
        setLives(l => Math.min(5, l + 1));
        spawnFloater('+1 LIFE!', '#00ff88');
      }
      spawnCoins(pnl);
      playSound(audioCtxRef, 'coin');
    }

    // Win streak
    if (isWin) setWinStreak(s => s + 1);
    else setWinStreak(0);

    // Trade history
    const entry = {
      id: Date.now() + Math.random(),
      asset: pos.asset,
      direction: pos.direction,
      entry: pos.entry,
      exit: exitPrice,
      pnl,
      grade: calcGrade(pnl),
      orderType: pos.orderType,
    };
    setTradeHistory(prev => [entry, ...prev].slice(0, 10));

    // Floating P&L
    spawnFloater((pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2), pnl >= 0 ? '#00ff88' : '#ff2d78');

    // Quests
    updateQuestProgress(isWin, pnl, pos.orderType === 'Stop');
  }

  function updateQuestProgress(isWin, pnl, isStop) {
    setQuests(prev => prev.map(q => {
      if (q.completed) return q;
      let delta = 0;
      if (q.type === 'wins' && isWin) delta = 1;
      if (q.type === 'profit' && pnl > 0) delta = pnl;
      if (q.type === 'stopOrder' && isStop) delta = 1;
      if (delta === 0) return q;
      const np = Math.min(q.target, q.progress + delta);
      const completed = np >= q.target;
      if (completed && !q.completed) {
        if (q.rewardType === 'XP') setXp(x => x + q.reward);
        else { setBalance(b => b + q.reward); spawnFloater('+$' + q.reward + ' QUEST!', '#ffe600'); }
        spawnFloater('QUEST DONE!', '#ffe600');
      }
      return { ...q, progress: np, completed };
    }));
  }

  function doGameOver() {
    setGameOver(true);
    playSound(audioCtxRef, 'gameOver');
    setGrade(dailyPnl >= 1000 ? 'A' : dailyPnl >= 500 ? 'B' : dailyPnl >= 0 ? 'C' : 'F');
    let count = 10;
    setTimeout(() => {
      setContinueCountdown(count);
      continueTimerRef.current = setInterval(() => {
        count--;
        setContinueCountdown(count);
        if (count <= 0) {
          clearInterval(continueTimerRef.current);
          setSessionOver(true);
          setContinueCountdown(null);
        }
      }, 1000);
    }, 3000);
  }

  function doOfferPowerup() {
    const shuffled = [...POWERUPS].sort(() => Math.random() - 0.5);
    setPowerupOptions(shuffled.slice(0, 3));
    setShowPowerup(true);
  }

  function selectPowerup(pu) {
    setShowPowerup(false);
    if (pu.id === 'iron_shield') {
      setActiveEffects(e => ({ ...e, ironShield: true }));
    } else if (pu.id === 'double_xp') {
      setActiveEffects(e => ({ ...e, doubleXP: 5 }));
    } else if (pu.id === 'sniper_mode') {
      setActiveEffects(e => ({ ...e, sniperMode: true }));
      const arr = candlesByAsset[selectedAsset];
      let p = arr[arr.length - 1].close;
      const preds = [];
      for (let i = 0; i < 3; i++) {
        const nc = generateCandle(p, selectedAsset);
        preds.push(nc.close >= nc.open ? 'UP' : 'DOWN');
        p = nc.close;
      }
      setSniperPredictions(preds);
      setTimeout(() => { setActiveEffects(e => ({ ...e, sniperMode: false })); setSniperPredictions([]); }, 12000);
    } else if (pu.id === 'bonus_coins') {
      setBalance(b => b + 500);
      spawnFloater('+$500 BONUS!', '#ffe600');
      playSound(audioCtxRef, 'coin');
    } else if (pu.id === 'fast_forward') {
      setActiveEffects(e => ({ ...e, fastForward: true }));
      if (ffTimerRef.current) clearTimeout(ffTimerRef.current);
      ffTimerRef.current = setTimeout(() => setActiveEffects(e => ({ ...e, fastForward: false })), 30000);
    }
    spawnFloater(pu.name + ' ACTIVE!', pu.color);
  }

  function triggerShake() {
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 700);
  }

  function spawnFloater(text, color) {
    const id = Date.now() + Math.random();
    const x = 35 + Math.random() * 30;
    const y = 30 + Math.random() * 30;
    setFloatingTexts(prev => [...prev, { id, text, color, x, y }]);
    setTimeout(() => setFloatingTexts(prev => prev.filter(t => t.id !== id)), 1600);
  }

  function spawnCoins(pnl) {
    const count = pnl >= 500 ? 24 : pnl >= 100 ? 16 : 8;
    const coins = Array.from({ length: count }, () => ({
      id: Date.now() + Math.random(),
      x: Math.random() * 95,
      delay: Math.random() * 0.6,
      dur: 1.4 + Math.random() * 0.8,
    }));
    setCoinRain(prev => [...prev, ...coins]);
    setTimeout(() => setCoinRain(prev => prev.filter(c => !coins.find(n => n.id === c.id))), 4000);
  }

  // ── OPEN POSITION ──
  function openPosition() {
    if (!audioCtxRef.current) audioCtxRef.current = createAudioCtx();
    if (positions.length >= MAX_POSITIONS) { spawnFloater('MAX POSITIONS!', '#ff2d78'); return; }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0 || qty > 10) { spawnFloater('INVALID QTY', '#ff2d78'); return; }

    let entry = currentPrice;
    if (orderType === 'Limit' && limitPrice) entry = parseFloat(limitPrice);
    if (orderType === 'Stop' && stopPriceInput) entry = parseFloat(stopPriceInput);
    if (isNaN(entry)) return;

    const sl = slPrice ? parseFloat(slPrice) : null;
    const tp = tpPrice ? parseFloat(tpPrice) : null;

    const pos = {
      id: Date.now(),
      asset: selectedAsset,
      direction,
      entry,
      quantity: qty,
      sl,
      tp,
      orderType,
      currentPnl: 0,
    };

    setPositions(prev => [...prev, pos]);
    playSound(audioCtxRef, 'fill');
    spawnFloater('ORDER FILLED!', '#00eaff');
    setSlPrice(''); setTpPrice(''); setLimitPrice(''); setStopPriceInput('');
  }

  function closePositionManual(posId) {
    const pos = positions.find(p => p.id === posId);
    if (!pos) return;
    resolvePosition(pos, currentPrice, 'Manual');
    setPositions(prev => prev.filter(p => p.id !== posId));
  }

  function restartGame() {
    if (continueTimerRef.current) clearInterval(continueTimerRef.current);
    setBalance(INITIAL_BALANCE);
    setDailyPnl(0);
    setLives(3);
    setXp(0);
    setPositions([]);
    setTradeHistory([]);
    setWinStreak(0);
    setComboCount(0);
    setGameOver(false);
    setContinueCountdown(null);
    setSessionOver(false);
    setActiveEffects({ ironShield: false, doubleXP: 0, sniperMode: false, fastForward: false });
    setQuests(QUESTS_TEMPLATE.map(q => ({ ...q, progress: 0, completed: false })));
    setCandlesByAsset(() => {
      const o = {};
      for (const k of Object.keys(ASSETS)) o[k] = generateInitialCandles(k);
      return o;
    });
  }

  // ── SVG CHART ──
  const CHART_H = 380;
  const CHART_VW = 720;
  const PAD = { top: 24, right: 64, bottom: 8, left: 8 };

  function renderCandleChart() {
    const vis = candles.slice(-80);
    if (!vis.length) return null;
    const prices = vis.flatMap(c => [c.high, c.low]);
    let minP = Math.min(...prices);
    let maxP = Math.max(...prices);
    const range = maxP - minP || minP * 0.01 || 1;
    minP -= range * 0.05;
    maxP += range * 0.05;
    const adjRange = maxP - minP;

    const w = CHART_VW - PAD.left - PAD.right;
    const h = CHART_H - PAD.top - PAD.bottom;
    const cw = Math.max(2, w / vis.length - 1);

    const toY = (p) => PAD.top + (1 - (p - minP) / adjRange) * h;
    const toX = (i) => PAD.left + (i + 0.5) * (w / vis.length);

    // Grid
    const gridEls = [];
    for (let i = 0; i <= 5; i++) {
      const p = minP + (adjRange * i) / 5;
      const y = toY(p);
      const lbl = p >= 1000 ? p.toFixed(0) : p >= 10 ? p.toFixed(2) : p.toFixed(4);
      gridEls.push(
        <g key={'g' + i}>
          <line x1={PAD.left} y1={y} x2={CHART_VW - PAD.right} y2={y} stroke="#151530" strokeWidth="1" />
          <text x={CHART_VW - PAD.right + 4} y={y + 4} fill="#334466" fontSize="9" fontFamily="VT323,monospace">{lbl}</text>
        </g>
      );
    }

    // Candles
    const candleEls = vis.map((c, i) => {
      const green = c.close >= c.open;
      const col = green ? '#00ff88' : '#ff2d78';
      const cx = Math.round(toX(i));
      const bTop = toY(Math.max(c.open, c.close));
      const bBot = toY(Math.min(c.open, c.close));
      const bH = Math.max(1, bBot - bTop);
      return (
        <g key={i}>
          <line x1={cx} y1={toY(c.high)} x2={cx} y2={toY(c.low)} stroke={col} strokeWidth="1" opacity="0.65" />
          <rect x={cx - cw / 2} y={bTop} width={cw} height={bH} fill={col} opacity="0.92" rx="0.5" />
        </g>
      );
    });

    // SL / TP lines
    const slTpEls = positions
      .filter(p => p.asset === selectedAsset)
      .flatMap(p => {
        const out = [];
        if (p.sl) {
          const y = toY(p.sl);
          if (y > PAD.top && y < PAD.top + h) {
            out.push(
              <g key={'sl' + p.id}>
                <line x1={PAD.left} y1={y} x2={CHART_VW - PAD.right} y2={y} stroke="#ff2d78" strokeWidth="1.5" strokeDasharray="5,3" />
                <rect x={PAD.left} y={y - 9} width={18} height={12} fill="#ff2d7833" rx="1" />
                <text x={PAD.left + 2} y={y + 1} fill="#ff2d78" fontSize="9" fontFamily="VT323,monospace">SL</text>
              </g>
            );
          }
        }
        if (p.tp) {
          const y = toY(p.tp);
          if (y > PAD.top && y < PAD.top + h) {
            out.push(
              <g key={'tp' + p.id}>
                <line x1={PAD.left} y1={y} x2={CHART_VW - PAD.right} y2={y} stroke="#00ff88" strokeWidth="1.5" strokeDasharray="5,3" />
                <rect x={PAD.left} y={y - 9} width={18} height={12} fill="#00ff8833" rx="1" />
                <text x={PAD.left + 2} y={y + 1} fill="#00ff88" fontSize="9" fontFamily="VT323,monospace">TP</text>
              </g>
            );
          }
        }
        return out;
      });

    // Current price line
    const cpY = toY(currentPrice);
    const cpLbl = fmtPrice(currentPrice);

    return (
      <svg viewBox={`0 0 ${CHART_VW} ${CHART_H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
        <rect width={CHART_VW} height={CHART_H} fill="#040410" />
        {gridEls}
        {slTpEls}
        {candleEls}
        {/* Current price dashed */}
        <line x1={PAD.left} y1={cpY} x2={CHART_VW - PAD.right} y2={cpY} stroke="#ffe600" strokeWidth="1" strokeDasharray="7,4" opacity="0.85" />
        <rect x={CHART_VW - PAD.right + 2} y={cpY - 9} width={PAD.right - 4} height={18} fill="#ffe600" rx="2" />
        <text x={CHART_VW - PAD.right + 4} y={cpY + 5} fill="#000" fontSize="9" fontFamily="VT323,monospace" fontWeight="bold">{cpLbl}</text>
      </svg>
    );
  }

  // Volume data for Recharts
  const volumeData = candles.slice(-50).map((c, i) => ({
    i,
    v: c.volume,
    fill: c.close >= c.open ? '#00ff8855' : '#ff2d7855',
  }));

  // Pixel button style helper
  const pxBtn = (active, col = '#00ff88', extra = {}) => ({
    background: active ? col + '1a' : 'transparent',
    border: `2px solid ${active ? col : '#1e2a3a'}`,
    color: active ? col : '#445566',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '8px',
    padding: '5px 8px',
    cursor: 'pointer',
    boxShadow: active ? `0 0 10px ${col}44, inset 0 0 8px ${col}11` : 'none',
    transition: 'all 0.12s',
    ...extra,
  });

  const sectionHdr = (col = '#00eaff') => ({
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '7px',
    color: col,
    textShadow: `0 0 8px ${col}88`,
    borderBottom: `1px solid ${col}33`,
    paddingBottom: '4px',
    marginBottom: '6px',
    letterSpacing: '0.5px',
  });

  const inputStyle = {
    background: '#070714',
    border: '1px solid #252550',
    color: '#00eaff',
    fontFamily: "'VT323', monospace",
    fontSize: '16px',
    padding: '4px 7px',
    width: '100%',
    outline: 'none',
    borderRadius: '1px',
  };

  const cardStyle = {
    background: '#0c0c22',
    border: '1px solid #1a1a40',
    borderRadius: '2px',
    padding: '8px',
    marginBottom: '6px',
  };

  // ─── CSS KEYFRAMES ─────────────────────────────────────────────────────────
  const css = `
    @keyframes coinFall {
      0%   { transform: translateY(-30px) rotate(0deg) scale(1); opacity:1; }
      80%  { opacity: 0.7; }
      100% { transform: translateY(105vh) rotate(800deg) scale(0.5); opacity:0; }
    }
    @keyframes screenShake {
      0%,100%{transform:translate(0,0)}
      10%{transform:translate(-5px,-3px)}
      20%{transform:translate(5px,3px)}
      30%{transform:translate(-4px,4px)}
      40%{transform:translate(4px,-4px)}
      50%{transform:translate(-3px,5px)}
      60%{transform:translate(3px,-3px)}
      70%{transform:translate(-5px,2px)}
      80%{transform:translate(5px,-2px)}
      90%{transform:translate(-2px,4px)}
    }
    @keyframes floatUp {
      0%   { transform:translateY(0) scale(1); opacity:1; }
      60%  { opacity:0.8; }
      100% { transform:translateY(-90px) scale(0.85); opacity:0; }
    }
    @keyframes slam {
      0%   { transform:scale(3.5) translateY(-20px); opacity:0; }
      35%  { transform:scale(1.15) translateY(0); opacity:1; }
      70%  { transform:scale(0.95); }
      100% { transform:scale(1); opacity:1; }
    }
    @keyframes blink {
      0%,100%{opacity:1} 50%{opacity:0}
    }
    @keyframes borderPulseProfit {
      0%,100%{box-shadow:0 0 0 2px #00ff88,0 0 20px #00ff8844}
      50%{box-shadow:0 0 0 4px #00ff88,0 0 50px #00ff8866}
    }
    @keyframes borderPulseDanger {
      0%,100%{box-shadow:0 0 0 2px #ff2d78,0 0 20px #ff2d7844}
      50%{box-shadow:0 0 0 5px #ff2d78,0 0 50px #ff2d7888}
    }
    @keyframes scanline {
      0%{transform:translateY(-100%)}
      100%{transform:translateY(120vh)}
    }
    @keyframes powerupPop {
      0%{transform:scale(0) rotate(-8deg);opacity:0}
      55%{transform:scale(1.08) rotate(2deg);opacity:1}
      100%{transform:scale(1) rotate(0);opacity:1}
    }
    @keyframes countdownPop {
      0%,100%{transform:scale(1)}
      50%{transform:scale(1.2)}
    }
    @keyframes neonFlicker {
      0%,19%,21%,23%,25%,54%,56%,100%{opacity:1}
      20%,22%,24%,55%{opacity:0.4}
    }
    @keyframes glitch {
      0%,100%{clip-path:inset(0 0 98% 0);transform:translate(0)}
      12%{clip-path:inset(15% 0 70% 0);transform:translate(-3px,1px)}
      28%{clip-path:inset(55% 0 25% 0);transform:translate(3px,-2px)}
      45%{clip-path:inset(75% 0 5% 0);transform:translate(-2px,3px)}
    }
  `;

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0a0a1a',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'VT323', monospace",
        color: '#c0c0d0',
        overflow: 'hidden',
        animation: screenShake ? 'screenShake 0.7s ease' : 'none',
        animation: borderPulse === 'profit'
          ? 'borderPulseProfit 1.2s infinite'
          : borderPulse === 'danger'
          ? 'borderPulseDanger 0.55s infinite'
          : screenShake ? 'screenShake 0.7s ease' : 'none',
      }}
      onClick={() => { if (!audioCtxRef.current) audioCtxRef.current = createAudioCtx(); }}
    >
      <style>{css}</style>

      {/* ── COIN RAIN ── */}
      {coinRain.map(c => (
        <div key={c.id} style={{
          position: 'fixed', left: c.x + 'vw', top: 0, zIndex: 9999,
          fontSize: '22px', pointerEvents: 'none',
          animation: `coinFall ${c.dur}s ${c.delay}s linear forwards`,
        }}>💰</div>
      ))}

      {/* ── FLOATING TEXTS ── */}
      {floatingTexts.map(ft => (
        <div key={ft.id} style={{
          position: 'fixed', left: ft.x + '%', top: ft.y + '%',
          color: ft.color, fontFamily: "'Press Start 2P', monospace", fontSize: '13px',
          textShadow: `0 0 12px ${ft.color}`,
          animation: 'floatUp 1.6s ease-out forwards',
          zIndex: 9998, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>{ft.text}</div>
      ))}

      {/* ── CRITICAL HIT ── */}
      {critHit !== null && (
        <div style={{
          position: 'fixed', top: '28%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9997, textAlign: 'center', pointerEvents: 'none',
          animation: 'slam 0.5s ease-out forwards',
        }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '30px', color: '#ffe600', textShadow: '0 0 25px #ffe600, 0 0 50px #ff7700' }}>
            CRITICAL HIT!
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '22px', color: '#00ff88', textShadow: '0 0 15px #00ff88', marginTop: '10px' }}>
            +${Math.abs(critHit).toFixed(2)}
          </div>
        </div>
      )}

      {/* ── GAME OVER ── */}
      {gameOver && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
          zIndex: 10000, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '22px',
        }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '52px', color: '#ff2d78', textShadow: '0 0 30px #ff2d78, 0 0 60px #ff004477', animation: 'blink 1.1s infinite' }}>
            GAME OVER
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '22px', color: '#ffe600', textShadow: '0 0 15px #ffe600' }}>
            GRADE: {grade}
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: '26px', color: '#00eaff' }}>
            DAILY P&L: {fmtPnl(dailyPnl)}
          </div>
          {continueCountdown !== null && (
            <>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '15px', color: '#00ff88', animation: 'countdownPop 1s infinite' }}>
                CONTINUE? {continueCountdown}s
              </div>
              <button
                style={{ ...pxBtn(true, '#00ff88'), fontSize: '13px', padding: '12px 24px', marginTop: '6px' }}
                onClick={restartGame}
              >
                YES! CONTINUE
              </button>
            </>
          )}
        </div>
      )}

      {/* ── SESSION OVER ── */}
      {sessionOver && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
          zIndex: 10001, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '22px',
        }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '36px', color: '#ff2d78', textShadow: '0 0 20px #ff2d78' }}>
            SESSION OVER
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: '28px', color: '#7788aa' }}>
            Final P&L: {fmtPnl(dailyPnl)} | Grade: {grade}
          </div>
          <button style={{ ...pxBtn(true, '#ffe600'), fontSize: '14px', padding: '14px 28px' }} onClick={restartGame}>
            PLAY AGAIN
          </button>
        </div>
      )}

      {/* ── POWER-UP SELECTION ── */}
      {showPowerup && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
          zIndex: 9990, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '26px',
        }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '20px', color: '#ffe600', textShadow: '0 0 15px #ffe600' }}>
            CHOOSE YOUR POWER-UP
          </div>
          <div style={{ display: 'flex', gap: '22px' }}>
            {powerupOptions.map((pu, i) => (
              <div
                key={pu.id}
                onClick={() => selectPowerup(pu)}
                style={{
                  width: '170px', padding: '18px 14px',
                  background: '#0b0b22',
                  border: `3px solid ${pu.color}`,
                  borderRadius: '3px',
                  cursor: 'pointer', textAlign: 'center',
                  boxShadow: `0 0 24px ${pu.color}44, inset 0 0 20px ${pu.color}0a`,
                  animation: `powerupPop 0.45s ${i * 0.1}s ease-out both`,
                  display: 'flex', flexDirection: 'column', gap: '10px',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06) translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1) translateY(0)'}
              >
                <div style={{ fontSize: '40px', lineHeight: 1 }}>{pu.icon}</div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: pu.color, textShadow: `0 0 8px ${pu.color}`, lineHeight: 1.5 }}>
                  {pu.name}
                </div>
                <div style={{ fontFamily: "'VT323', monospace", fontSize: '16px', color: '#99aabb', lineHeight: 1.3 }}>
                  {pu.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TOP HUD
      ══════════════════════════════════════════════════════ */}
      <div style={{
        height: '58px', flexShrink: 0,
        background: 'linear-gradient(180deg,#0e0e2e 0%,#070716 100%)',
        borderBottom: '2px solid #14143a',
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: '14px',
        boxShadow: '0 2px 20px #00ff8818',
      }}>
        {/* Logo */}
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: '#ffe600', textShadow: '0 0 10px #ffe600', whiteSpace: 'nowrap', letterSpacing: '1px', animation: 'neonFlicker 6s infinite' }}>
          ⚔ CANDLE WARS
        </div>
        <div style={{ width: '1px', height: '30px', background: '#1a1a4a' }} />

        {/* Balance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: '110px' }}>
          <span style={{ fontSize: '9px', color: '#334455', fontFamily: "'Press Start 2P', monospace", fontSize: '6px' }}>BALANCE</span>
          <span style={{ fontSize: '22px', color: '#00ff88', textShadow: '0 0 8px #00ff8877' }}>${balance.toFixed(2)}</span>
        </div>

        {/* Daily P&L */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: '100px' }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: '#334455' }}>DAILY P&L</span>
          <span style={{ fontSize: '22px', color: dailyPnl >= 0 ? '#00ff88' : '#ff2d78', textShadow: `0 0 8px ${dailyPnl >= 0 ? '#00ff8866' : '#ff2d7866'}` }}>
            {fmtPnl(dailyPnl)}
          </span>
        </div>

        {/* XP Bar */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: levelInfo.level.color, textShadow: `0 0 6px ${levelInfo.level.color}88` }}>
              {levelInfo.level.name}
            </span>
            <span style={{ fontSize: '12px', color: '#445566' }}>{xp} XP</span>
          </div>
          <div style={{ height: '9px', background: '#111128', borderRadius: '2px', overflow: 'hidden', border: '1px solid #1e1e50' }}>
            <div style={{
              height: '100%', width: levelInfo.progress + '%',
              background: `linear-gradient(90deg, ${levelInfo.level.color}66, ${levelInfo.level.color})`,
              boxShadow: `0 0 8px ${levelInfo.level.color}88`,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>

        {/* Win streak */}
        {winStreak > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
            <span style={{ fontSize: '18px', lineHeight: 1 }}>🔥</span>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: '#ff7700', textShadow: '0 0 6px #ff7700' }}>
              ×{multiplier}
            </span>
          </div>
        )}

        {/* Combo */}
        {comboCount > 0 && (
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: '#ff2d78', textShadow: '0 0 8px #ff2d78', animation: 'blink 0.9s infinite', whiteSpace: 'nowrap' }}>
            COMBO ×{comboCount}!
          </div>
        )}

        {/* Active effects icons */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {activeEffects.ironShield && <span style={{ fontSize: '18px', filter: 'drop-shadow(0 0 5px #00eaff)' }} title="Iron Shield active">🛡️</span>}
          {activeEffects.doubleXP > 0 && <span style={{ fontSize: '18px', filter: 'drop-shadow(0 0 5px #ffe600)' }} title={`Double XP: ${activeEffects.doubleXP} left`}>⚡</span>}
          {activeEffects.sniperMode && <span style={{ fontSize: '18px', filter: 'drop-shadow(0 0 5px #ff2d78)', animation: 'blink 1s infinite' }} title="Sniper Mode active">🎯</span>}
          {activeEffects.fastForward && <span style={{ fontSize: '18px', filter: 'drop-shadow(0 0 5px #ff7700)' }} title="Fast Forward active">⏩</span>}
        </div>

        {/* Lives */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', marginLeft: 'auto' }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: '#ff2d78', marginRight: '5px' }}>LIVES</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} style={{
              fontSize: '18px',
              opacity: i < lives ? 1 : 0.18,
              filter: i < lives ? 'drop-shadow(0 0 4px #ff2d78)' : 'none',
              transition: 'opacity 0.4s',
            }}>❤️</span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MAIN AREA
      ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ═══ LEFT PANEL ═══ */}
        <div style={{
          width: '200px', flexShrink: 0,
          background: '#080818', borderRight: '2px solid #121232',
          display: 'flex', flexDirection: 'column',
          padding: '8px 8px', gap: '4px', overflowY: 'auto',
        }}>
          {/* Asset list */}
          <div style={sectionHdr('#ffe600')}>MARKETS</div>
          {Object.entries(ASSETS).map(([key, asset]) => {
            const ac = candlesByAsset[key] || [];
            const p = ac.length ? ac[ac.length - 1].close : asset.basePrice;
            const pp = ac.length > 1 ? ac[ac.length - 2].close : p;
            const chg = ((p - pp) / pp) * 100;
            const sel = key === selectedAsset;
            return (
              <div
                key={key}
                onClick={() => setSelectedAsset(key)}
                style={{
                  padding: '7px 8px',
                  background: sel ? asset.color + '14' : '#0a0a1e',
                  border: `1px solid ${sel ? asset.color : '#181838'}`,
                  cursor: 'pointer', borderRadius: '2px',
                  boxShadow: sel ? `0 0 12px ${asset.color}2a` : 'none',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = asset.color + '55'; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = '#181838'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: sel ? asset.color : '#556677' }}>
                    {key}
                  </span>
                  <span style={{ fontSize: '13px', color: chg >= 0 ? '#00ff88' : '#ff2d78' }}>
                    {chg >= 0 ? '▲' : '▼'}{Math.abs(chg).toFixed(2)}%
                  </span>
                </div>
                <div style={{ fontSize: '17px', color: sel ? asset.color : '#8899bb' }}>
                  {fmtPrice(p)}
                </div>
              </div>
            );
          })}

          {/* Level card */}
          <div style={{ ...cardStyle, marginTop: '8px', border: `1px solid ${levelInfo.level.color}44` }}>
            <div style={{ ...sectionHdr(levelInfo.level.color), marginBottom: '4px' }}>RANK</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: levelInfo.level.color, textShadow: `0 0 8px ${levelInfo.level.color}88`, lineHeight: 1.6 }}>
              {levelInfo.level.name}
            </div>
            <div style={{ fontSize: '14px', color: '#556677', marginTop: '2px' }}>{xp} XP</div>
          </div>

          {/* Sniper predictions */}
          {activeEffects.sniperMode && sniperPredictions.length > 0 && (
            <div style={{ ...cardStyle, border: '1px solid #ff2d78', boxShadow: '0 0 12px #ff2d7833' }}>
              <div style={sectionHdr('#ff2d78')}>🎯 SNIPER</div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', padding: '4px 0' }}>
                {sniperPredictions.map((d, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', color: d === 'UP' ? '#00ff88' : '#ff2d78', textShadow: `0 0 8px ${d === 'UP' ? '#00ff88' : '#ff2d78'}` }}>
                      {d === 'UP' ? '↑' : '↓'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#556677' }}>C+{i + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Quests */}
          <div style={cardStyle}>
            <div style={sectionHdr('#ffe600')}>QUESTS</div>
            {quests.map(q => (
              <div key={q.id} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '13px', color: q.completed ? '#00ff88' : '#8899aa', maxWidth: '120px', lineHeight: 1.2 }}>{q.name}</span>
                  <span style={{ fontSize: '12px', color: '#ffe600' }}>+{q.reward}{q.rewardType}</span>
                </div>
                <div style={{ height: '6px', background: '#111128', borderRadius: '3px', overflow: 'hidden', border: '1px solid #1e1e44' }}>
                  <div style={{
                    height: '100%',
                    width: Math.min(100, (q.progress / q.target) * 100) + '%',
                    background: q.completed ? 'linear-gradient(90deg,#00ff8877,#00ff88)' : 'linear-gradient(90deg,#ffe60077,#ffe600)',
                    boxShadow: `0 0 6px ${q.completed ? '#00ff88' : '#ffe600'}`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: '11px', color: '#445566', textAlign: 'right', marginTop: '1px' }}>
                  {q.type === 'profit' ? '$' + Math.floor(q.progress) + ' / $' + q.target : Math.floor(q.progress) + ' / ' + q.target}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ CENTER PANEL ═══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Timeframe bar */}
          <div style={{
            display: 'flex', gap: '5px', padding: '6px 10px',
            background: '#07071c', borderBottom: '1px solid #121232',
            alignItems: 'center', flexShrink: 0,
          }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: ASSETS[selectedAsset].color, textShadow: `0 0 6px ${ASSETS[selectedAsset].color}88`, marginRight: '6px', whiteSpace: 'nowrap' }}>
              {ASSETS[selectedAsset].name}
            </span>
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={pxBtn(tf === timeframe, '#00eaff')}>
                {tf}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '14px', alignItems: 'center' }}>
              <span style={{ fontFamily: "'VT323', monospace", fontSize: '22px', color: ASSETS[selectedAsset].color, textShadow: `0 0 6px ${ASSETS[selectedAsset].color}77` }}>
                {fmtPrice(currentPrice)}
              </span>
              {positions.filter(p => p.asset === selectedAsset).length > 0 && (
                <span style={{ fontFamily: "'VT323', monospace", fontSize: '20px', color: totalOpenPnl >= 0 ? '#00ff88' : '#ff2d78' }}>
                  {fmtPnl(totalOpenPnl)}
                </span>
              )}
            </div>
          </div>

          {/* SVG Chart */}
          <div style={{
            flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0,
          }}>
            {/* CRT scanlines */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
              background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)',
            }} />
            {/* Moving scanline */}
            <div style={{
              position: 'absolute', left: 0, right: 0, height: '4px',
              background: 'linear-gradient(transparent,rgba(0,255,136,0.07),transparent)',
              zIndex: 3, pointerEvents: 'none',
              animation: 'scanline 5s linear infinite',
            }} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              {renderCandleChart()}
            </div>
          </div>

          {/* Volume chart */}
          <div style={{ height: '68px', background: '#040412', borderTop: '1px solid #111128', flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ top: 4, right: 64, bottom: 0, left: 8 }} barCategoryGap="1%">
                <XAxis dataKey="i" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#0d0d24', border: '1px solid #252560', fontFamily: 'VT323,monospace', fontSize: '15px', color: '#00eaff', padding: '4px 8px' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={v => ['Vol: ' + v, '']}
                />
                <Bar dataKey="v" radius={[1, 1, 0, 0]}>
                  {volumeData.map((d, i) => (
                    <rect key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ═══ RIGHT PANEL ═══ */}
        <div style={{
          width: '220px', flexShrink: 0,
          background: '#080818', borderLeft: '2px solid #121232',
          display: 'flex', flexDirection: 'column',
          padding: '8px', gap: '5px', overflowY: 'auto',
        }}>
          <div style={sectionHdr('#ff2d78')}>⚡ ORDER PANEL</div>

          {/* Long / Short */}
          <div style={{ display: 'flex', gap: '5px', marginBottom: '2px' }}>
            <button style={{ ...pxBtn(direction === 'LONG', '#00ff88'), flex: 1, fontSize: '9px' }} onClick={() => setDirection('LONG')}>
              ▲ LONG
            </button>
            <button style={{ ...pxBtn(direction === 'SHORT', '#ff2d78'), flex: 1, fontSize: '9px' }} onClick={() => setDirection('SHORT')}>
              ▼ SHORT
            </button>
          </div>

          {/* Order type */}
          <div style={{ display: 'flex', gap: '3px' }}>
            {['Market', 'Limit', 'Stop'].map(t => (
              <button key={t} style={{ ...pxBtn(orderType === t, '#00eaff'), flex: 1, fontSize: '6px', padding: '5px 2px' }} onClick={() => setOrderType(t)}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Qty */}
          <div>
            <div style={{ fontSize: '11px', color: '#445566', marginBottom: '3px' }}>QTY (UNITS 0.01–10)</div>
            <input type="number" value={quantity} min="0.01" max="10" step="0.01" onChange={e => setQuantity(e.target.value)} style={inputStyle} />
          </div>

          {/* Conditional price inputs */}
          {orderType === 'Limit' && (
            <div>
              <div style={{ fontSize: '11px', color: '#445566', marginBottom: '3px' }}>LIMIT PRICE</div>
              <input type="number" value={limitPrice} placeholder={fmtPrice(currentPrice)} onChange={e => setLimitPrice(e.target.value)} style={inputStyle} />
            </div>
          )}
          {orderType === 'Stop' && (
            <div>
              <div style={{ fontSize: '11px', color: '#445566', marginBottom: '3px' }}>STOP PRICE</div>
              <input type="number" value={stopPriceInput} placeholder={fmtPrice(currentPrice)} onChange={e => setStopPriceInput(e.target.value)} style={inputStyle} />
            </div>
          )}

          {/* SL */}
          <div>
            <div style={{ fontSize: '11px', color: '#ff2d78', marginBottom: '3px' }}>STOP LOSS</div>
            <input type="number" value={slPrice} placeholder="Optional" onChange={e => setSlPrice(e.target.value)} style={{ ...inputStyle, borderColor: slPrice ? '#ff2d78' : '#252550' }} />
          </div>

          {/* TP */}
          <div>
            <div style={{ fontSize: '11px', color: '#00ff88', marginBottom: '3px' }}>TAKE PROFIT</div>
            <input type="number" value={tpPrice} placeholder="Optional" onChange={e => setTpPrice(e.target.value)} style={{ ...inputStyle, borderColor: tpPrice ? '#00ff88' : '#252550' }} />
          </div>

          {/* Mkt price hint */}
          <div style={{ fontSize: '13px', color: '#334455', textAlign: 'center' }}>
            MKT: {fmtPrice(currentPrice)}
          </div>

          {/* BUY / SELL button */}
          <button
            onClick={openPosition}
            style={{
              background: direction === 'LONG' ? '#00ff8818' : '#ff2d7818',
              border: `2px solid ${direction === 'LONG' ? '#00ff88' : '#ff2d78'}`,
              color: direction === 'LONG' ? '#00ff88' : '#ff2d78',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '11px', padding: '11px',
              cursor: 'pointer', width: '100%',
              boxShadow: `0 0 18px ${direction === 'LONG' ? '#00ff8833' : '#ff2d7833'}`,
              transition: 'all 0.12s', marginBottom: '4px',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = `0 0 28px ${direction === 'LONG' ? '#00ff8866' : '#ff2d7866'}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 0 18px ${direction === 'LONG' ? '#00ff8833' : '#ff2d7833'}`; }}
          >
            {direction === 'LONG' ? '▲ BUY' : '▼ SELL'} {orderType.toUpperCase()}
          </button>

          {/* Open positions */}
          <div style={sectionHdr('#00eaff')}>POSITIONS ({positions.length}/{MAX_POSITIONS})</div>
          {positions.length === 0 && (
            <div style={{ fontSize: '13px', color: '#2a3a4a', textAlign: 'center', padding: '10px 0' }}>
              No open positions
            </div>
          )}
          {positions.map(pos => {
            const pnl = calcPnl(pos, currentPrice);
            const inProfit = pnl >= 0;
            return (
              <div key={pos.id} style={{
                background: '#0a0a20',
                border: `1px solid ${inProfit ? '#00ff8833' : '#ff2d7833'}`,
                borderRadius: '2px', padding: '7px',
                boxShadow: inProfit ? '0 0 10px #00ff8818' : '0 0 10px #ff2d7818',
                marginBottom: '5px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{
                    fontFamily: "'Press Start 2P', monospace", fontSize: '6px',
                    color: pos.direction === 'LONG' ? '#00ff88' : '#ff2d78',
                  }}>
                    {pos.direction === 'LONG' ? '▲' : '▼'} {pos.asset}
                  </span>
                  <button
                    onClick={() => closePositionManual(pos.id)}
                    style={{
                      background: 'transparent', border: '1px solid #ff2d78',
                      color: '#ff2d78', fontFamily: "'Press Start 2P', monospace",
                      fontSize: '5px', padding: '2px 5px', cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#ff2d7822'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    CLOSE
                  </button>
                </div>
                <div style={{ fontSize: '13px', color: '#556677', marginBottom: '2px' }}>
                  {fmtPrice(pos.entry)} × {pos.quantity}
                </div>
                {pos.sl && <div style={{ fontSize: '12px', color: '#ff2d78aa' }}>SL: {fmtPrice(pos.sl)}</div>}
                {pos.tp && <div style={{ fontSize: '12px', color: '#00ff88aa' }}>TP: {fmtPrice(pos.tp)}</div>}
                <div style={{
                  fontSize: '20px', fontWeight: 'bold', textAlign: 'right',
                  color: inProfit ? '#00ff88' : '#ff2d78',
                  textShadow: `0 0 8px ${inProfit ? '#00ff8877' : '#ff2d7877'}`,
                }}>
                  {fmtPnl(pnl)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          BOTTOM PANEL — Trade History
      ══════════════════════════════════════════════════════ */}
      <div style={{
        height: '120px', flexShrink: 0,
        background: '#060614', borderTop: '2px solid #121232',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '4px 14px 3px',
          display: 'flex', alignItems: 'center', gap: '14px',
          borderBottom: '1px solid #111128', flexShrink: 0,
        }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: '#ffe600', textShadow: '0 0 8px #ffe60077' }}>
            TRADE HISTORY
          </span>
          <span style={{ fontSize: '13px', color: '#334455' }}>Last 10 trades</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#0a0a22', position: 'sticky', top: 0 }}>
                {['ASSET', 'DIR', 'ENTRY', 'EXIT', 'P&L', 'GR'].map(h => (
                  <th key={h} style={{ padding: '2px 10px', textAlign: 'left', color: '#334455', fontFamily: "'Press Start 2P', monospace", fontSize: '6px', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tradeHistory.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#2a3a4a', padding: '14px', fontSize: '13px' }}>
                    No trades yet — place your first order!
                  </td>
                </tr>
              )}
              {tradeHistory.map(t => {
                const gradeColor = ['S', 'A'].includes(t.grade) ? '#ffe600' : ['B', 'C'].includes(t.grade) ? '#00eaff' : '#ff2d78';
                return (
                  <tr
                    key={t.id}
                    style={{ borderBottom: '1px solid #0e0e24' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#0e0e2a'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '2px 10px', color: ASSETS[t.asset]?.color || '#aabbcc', fontFamily: "'Press Start 2P', monospace", fontSize: '6px' }}>
                      {t.asset}
                    </td>
                    <td style={{ padding: '2px 10px', color: t.direction === 'LONG' ? '#00ff88' : '#ff2d78' }}>
                      {t.direction === 'LONG' ? '▲' : '▼'} {t.direction}
                    </td>
                    <td style={{ padding: '2px 10px', color: '#556677' }}>{fmtPrice(t.entry)}</td>
                    <td style={{ padding: '2px 10px', color: '#556677' }}>{fmtPrice(t.exit)}</td>
                    <td style={{ padding: '2px 10px', color: t.pnl >= 0 ? '#00ff88' : '#ff2d78', textShadow: `0 0 6px ${t.pnl >= 0 ? '#00ff8855' : '#ff2d7855'}` }}>
                      {fmtPnl(t.pnl)}
                    </td>
                    <td style={{ padding: '2px 10px' }}>
                      <span style={{
                        fontFamily: "'Press Start 2P', monospace", fontSize: '7px',
                        color: gradeColor, border: `1px solid ${gradeColor}`,
                        padding: '1px 5px', borderRadius: '1px',
                      }}>
                        {t.grade}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
