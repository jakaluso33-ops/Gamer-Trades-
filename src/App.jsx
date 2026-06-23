import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import Pricing from './pages/Pricing';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const ASSETS = {
  BTC:    { name: 'BTC/USD',  basePrice: 45000, volatility: 0.012, color: '#f7931a' },
  GOLD:   { name: 'XAU/USD',  basePrice: 2000,  volatility: 0.005, color: '#ffd700' },
  SPX:    { name: 'S&P 500',  basePrice: 5000,  volatility: 0.006, color: '#00eaff' },
  OIL:    { name: 'OIL/USD',  basePrice: 80,    volatility: 0.015, color: '#cd853f' },
  ETH:    { name: 'ETH/USD',  basePrice: 2500,  volatility: 0.018, color: '#627eea' },
  EURUSD: { name: 'EUR/USD',  basePrice: 1.08,  volatility: 0.003, color: '#00ff88' },
};

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D'];
const TF_SPEED   = { '1m': 1, '5m': 1.2, '15m': 1.5, '1H': 2, '4H': 2.5, '1D': 3 };

const LEVELS = [
  { name: 'MARKET PEASANT', minXP: 0,    color: '#aaaaaa' },
  { name: 'CANDLE SQUIRE',  minXP: 50,   color: '#88cc88' },
  { name: 'SCALP NINJA',    minXP: 120,  color: '#00ff88' },
  { name: 'CHART WIZARD',   minXP: 250,  color: '#00eaff' },
  { name: 'TREND MASTER',   minXP: 420,  color: '#4488ff' },
  { name: 'VOLUME LORD',    minXP: 650,  color: '#cc44ff' },
  { name: 'ALGO WARRIOR',   minXP: 950,  color: '#ff8800' },
  { name: 'TRADING GOD',    minXP: 1400, color: '#ffe600' },
];

const POWERUPS = [
  { id: 'iron_shield',  name: 'IRON SHIELD',   desc: "SL won't cost a life (1x)",   icon: '🛡️', color: '#00eaff',  rarity: 'COMMON' },
  { id: 'double_xp',   name: 'DOUBLE XP',      desc: '2× XP for next 5 trades',    icon: '⚡', color: '#ffe600',  rarity: 'RARE' },
  { id: 'sniper_mode', name: 'SNIPER MODE',    desc: 'See next 3 candle directions',icon: '🎯', color: '#ff2d78',  rarity: 'RARE' },
  { id: 'bonus_coins', name: 'BONUS COINS',    desc: '+$500 instant balance bonus', icon: '💰', color: '#00ff88',  rarity: 'COMMON' },
  { id: 'fast_forward',name: 'FAST FORWARD',   desc: 'Candles 2× speed for 30s',   icon: '⏩', color: '#ff7700',  rarity: 'LEGENDARY' },
];

const QUESTS_TPL = [
  { id: 'win3',     name: 'Win 3 Trades',   target: 3,   type: 'wins',      reward: 50,  rt: 'XP'   },
  { id: 'profit500',name: 'Make $500 P&L',  target: 500, type: 'profit',    reward: 200, rt: 'coins'},
  { id: 'stopOrd',  name: 'Use Stop Order', target: 1,   type: 'stopOrder', reward: 30,  rt: 'XP'   },
];

const MAX_CANDLES = 80;
const MAX_POS     = 3;
const INIT_BAL    = 10000;

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO
// ─────────────────────────────────────────────────────────────────────────────
function mkAudio() {
  try { return new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
}
function playSound(ref, type) {
  try {
    if (!ref.current) ref.current = mkAudio();
    const ctx = ref.current; if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const tone = (f, s, d, v = 0.28, w = 'sine') => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = w; o.frequency.value = f;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(v, t + s);
      g.gain.exponentialRampToValueAtTime(0.001, t + s + d);
      o.start(t + s); o.stop(t + s + d + 0.05);
    };
    if (type === 'coin')      { tone(880, 0, .08, .22); tone(1320, .05, .1, .18); }
    else if (type === 'fill') { tone(440, 0, .06, .2, 'square'); tone(660, .06, .08, .18, 'square'); }
    else if (type === 'slHit'){ tone(220, 0, .15, .32, 'sawtooth'); tone(110, .12, .3, .28, 'sawtooth'); }
    else if (type === 'lvlUp'){ [261,329,392,523].forEach((f,i)=>tone(f,i*.1,.1,.22)); }
    else if (type === 'crit') { [523,659,784,1047,1319].forEach((f,i)=>tone(f,i*.08,.12,.2,'square')); }
    else if (type === 'over') { [523,392,329,261,196].forEach((f,i)=>tone(f,i*.15,.18,.25,'sawtooth')); }
    else if (type === 'danger'){ [0,.2,.4].forEach(s=>tone(150,s,.1,.25,'square')); }
    else if (type === 'power') { [523,659,784,1047].forEach((f,i)=>tone(f,i*.09,.1,.2)); }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE GENERATION
// ─────────────────────────────────────────────────────────────────────────────
function genCandle(prevClose, assetKey) {
  const { volatility: v } = ASSETS[assetKey];
  const spike = Math.random() < .07;
  const vol = v * (spike ? 3.5 : 1);
  const open = prevClose;
  const close = Math.max(open + (Math.random() - .485) * open * vol, open * .0001);
  const wH = Math.random() * open * vol * .6;
  const wL = Math.random() * open * vol * .6;
  const high = Math.max(open, close) + wH;
  const low  = Math.min(open, close) - Math.max(wL, .00001);
  const volume = Math.floor((Math.random() * 900 + 100) * (spike ? 3 : 1));
  return { open, high, low, close, volume };
}
function genInitCandles(assetKey) {
  let p = ASSETS[assetKey].basePrice;
  const arr = [];
  for (let i = 0; i < MAX_CANDLES; i++) {
    const c = genCandle(p, assetKey); arr.push(c); p = c.close;
  }
  return arr;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function getLevelInfo(xp) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.minXP) lvl = l;
  const idx = LEVELS.indexOf(lvl);
  const next = LEVELS[idx + 1];
  const pct = next ? Math.min(100, ((xp - lvl.minXP) / (next.minXP - lvl.minXP)) * 100) : 100;
  return { level: lvl, next, progress: pct };
}
function fmtP(p) {
  if (p == null || isNaN(p)) return '—';
  if (p >= 1000) return p.toFixed(2);
  if (p >= 10)   return p.toFixed(3);
  return p.toFixed(5);
}
function fmtPnl(pnl) {
  if (pnl == null) return '—';
  return (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);
}
function calcPnl(pos, price) {
  return (price - pos.entry) * (pos.direction === 'LONG' ? 1 : -1) * pos.quantity;
}
function sessionGrade(pnl, winRate) {
  if (pnl >= 500 && winRate >= 60) return 'S';
  if (pnl >= 200 && winRate >= 50) return 'A';
  if (pnl >= 0   && winRate >= 40) return 'B';
  if (pnl >= -100) return 'C';
  if (pnl >= -300) return 'D';
  return 'F';
}
const GRADE_COLOR = { S:'#ffe600', A:'#00ff88', B:'#00eaff', C:'#ff8800', D:'#ff7777', F:'#ff2d78' };

// ─────────────────────────────────────────────────────────────────────────────
// CSS KEYFRAMES (injected once)
// ─────────────────────────────────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes coinFall {
  0%   { transform:translateY(-30px) rotate(0deg) scale(1); opacity:1; }
  80%  { opacity:.7; }
  100% { transform:translateY(105vh) rotate(800deg) scale(.5); opacity:0; }
}
@keyframes skullFall {
  0%   { transform:translateY(-30px) rotate(0deg); opacity:1; }
  100% { transform:translateY(105vh) rotate(360deg); opacity:0; }
}
@keyframes screenShake {
  0%,100%{transform:translate(0,0)}
  10%{transform:translate(-6px,-3px)}
  20%{transform:translate(6px,3px)}
  30%{transform:translate(-5px,4px)}
  40%{transform:translate(5px,-4px)}
  50%{transform:translate(-3px,5px)}
  60%{transform:translate(3px,-3px)}
  70%{transform:translate(-6px,2px)}
  80%{transform:translate(6px,-2px)}
  90%{transform:translate(-2px,4px)}
}
@keyframes floatUp {
  0%  { transform:translateY(0) scale(1); opacity:1; }
  60% { opacity:.8; }
  100%{ transform:translateY(-90px) scale(.85); opacity:0; }
}
@keyframes slam {
  0%  { transform:scale(3.5) translateY(-20px); opacity:0; }
  35% { transform:scale(1.15) translateY(0); opacity:1; }
  70% { transform:scale(.95); }
  100%{ transform:scale(1); opacity:1; }
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes fastBlink { 0%,100%{opacity:1} 50%{opacity:.1} }
@keyframes scanline {
  0%  { transform:translateY(-100%); }
  100%{ transform:translateY(120vh); }
}
@keyframes powerPop {
  0%  { transform:scale(0) rotate(-8deg); opacity:0; }
  55% { transform:scale(1.08) rotate(2deg); opacity:1; }
  100%{ transform:scale(1) rotate(0); opacity:1; }
}
@keyframes cdPop { 0%,100%{transform:scale(1)} 50%{transform:scale(1.2)} }
@keyframes neonFlicker {
  0%,19%,21%,23%,25%,54%,56%,100%{opacity:1}
  20%,22%,24%,55%{opacity:.4}
}
@keyframes borderGreen {
  0%,100%{box-shadow:0 0 0 2px #00ff88,0 0 20px #00ff8844}
  50%    {box-shadow:0 0 0 4px #00ff88,0 0 50px #00ff8866}
}
@keyframes borderDanger {
  0%,100%{box-shadow:0 0 0 3px #ff2d78,0 0 25px #ff2d7855}
  50%    {box-shadow:0 0 0 6px #ff2d78,0 0 55px #ff2d7888}
}
@keyframes borderFire {
  0%  {box-shadow:0 0 0 3px #ff8800,0 0 30px #ff880066}
  33% {box-shadow:0 0 0 4px #ffe600,0 0 40px #ffe60055}
  66% {box-shadow:0 0 0 3px #ff4400,0 0 30px #ff440066}
  100%{box-shadow:0 0 0 3px #ff8800,0 0 30px #ff880066}
}
@keyframes critSlam {
  0%  { transform:translateX(-50%) scale(3) translateY(-20px); opacity:0; }
  40% { transform:translateX(-50%) scale(1.1); opacity:1; }
  70% { transform:translateX(-50%) scale(.97); }
  100%{ transform:translateX(-50%) scale(1); opacity:1; }
}
@keyframes dangerPulse {
  0%,100%{opacity:1; transform:scale(1);}
  50%{opacity:.6; transform:scale(1.06);}
}
@keyframes shieldOrbit {
  0%  { transform:rotate(0deg) translateX(22px) rotate(0deg); }
  100%{ transform:rotate(360deg) translateX(22px) rotate(-360deg); }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SVG CANDLE CHART
// ─────────────────────────────────────────────────────────────────────────────
const CHART_W = 720;
const CHART_H = 370;
const PAD = { t: 20, r: 66, b: 6, l: 6 };

function CandleChart({ candles, positions, currentPrice, assetKey, onFireMode }) {
  const vis = candles.slice(-80);
  if (!vis.length) return null;

  const prices = vis.flatMap(c => [c.high, c.low]);
  let minP = Math.min(...prices), maxP = Math.max(...prices);
  const rng = maxP - minP || minP * .01 || 1;
  minP -= rng * .06; maxP += rng * .06;
  const aRng = maxP - minP;
  const W = CHART_W - PAD.l - PAD.r;
  const H = CHART_H - PAD.t - PAD.b;
  const cw = Math.max(2, W / vis.length - 1);
  const toY = p => PAD.t + (1 - (p - minP) / aRng) * H;
  const toX = i => PAD.l + (i + .5) * (W / vis.length);

  // grid
  const grid = Array.from({ length: 6 }, (_, i) => {
    const p = minP + aRng * i / 5;
    const y = toY(p);
    const lbl = p >= 1000 ? p.toFixed(0) : p >= 10 ? p.toFixed(2) : p.toFixed(4);
    return (
      <g key={i}>
        <line x1={PAD.l} y1={y} x2={CHART_W - PAD.r} y2={y} stroke="#151530" strokeWidth="1" />
        <text x={CHART_W - PAD.r + 3} y={y + 4} fill="#334466" fontSize="9" fontFamily="VT323,monospace">{lbl}</text>
      </g>
    );
  });

  // candles
  const candleEls = vis.map((c, i) => {
    const up = c.close >= c.open;
    const col = up ? '#00ff88' : '#ff2d78';
    const cx = Math.round(toX(i));
    const bT = toY(Math.max(c.open, c.close));
    const bB = toY(Math.min(c.open, c.close));
    const bH = Math.max(1, bB - bT);
    return (
      <g key={i}>
        <line x1={cx} y1={toY(c.high)} x2={cx} y2={toY(c.low)} stroke={col} strokeWidth="1" opacity=".6" />
        <rect x={cx - cw / 2} y={bT} width={cw} height={bH} fill={col} opacity=".9" rx=".5" />
      </g>
    );
  });

  // SL / TP / entry lines
  const lineEls = positions.filter(p => p.asset === assetKey).flatMap(p => {
    const elems = [];
    const inProfit = calcPnl(p, currentPrice) > 0;

    // Entry
    const ey = toY(p.entry);
    if (ey > PAD.t && ey < PAD.t + H) {
      elems.push(
        <g key={'e' + p.id}>
          <line x1={PAD.l} y1={ey} x2={CHART_W - PAD.r} y2={ey}
            stroke={p.direction === 'LONG' ? '#00eaff' : '#ff8800'} strokeWidth="1" strokeDasharray="8,5" opacity=".5" />
        </g>
      );
    }

    // SL — gold if in profit
    if (p.sl) {
      const sy = toY(p.sl);
      const slColor = inProfit ? '#FFD700' : '#ff2d78';
      if (sy > PAD.t && sy < PAD.t + H) {
        elems.push(
          <g key={'sl' + p.id}>
            <line x1={PAD.l} y1={sy} x2={CHART_W - PAD.r} y2={sy}
              stroke={slColor} strokeWidth={inProfit ? 2 : 1.5} strokeDasharray="5,3" />
            <rect x={PAD.l} y={sy - 9} width={inProfit ? 40 : 18} height={12} fill={slColor + '22'} rx="1" />
            <text x={PAD.l + 2} y={sy + 1} fill={slColor} fontSize="9" fontFamily="VT323,monospace">
              {inProfit ? '🛡 SL' : 'SL'}
            </text>
          </g>
        );
      }
    }

    // TP
    if (p.tp) {
      const ty = toY(p.tp);
      if (ty > PAD.t && ty < PAD.t + H) {
        elems.push(
          <g key={'tp' + p.id}>
            <line x1={PAD.l} y1={ty} x2={CHART_W - PAD.r} y2={ty}
              stroke="#00ff88" strokeWidth="1.5" strokeDasharray="5,3" />
            <rect x={PAD.l} y={ty - 9} width={18} height={12} fill="#00ff8822" rx="1" />
            <text x={PAD.l + 2} y={ty + 1} fill="#00ff88" fontSize="9" fontFamily="VT323,monospace">TP</text>
          </g>
        );
      }
    }
    return elems;
  });

  // Current price
  const cpY = toY(currentPrice);
  const cpLbl = fmtP(currentPrice);

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
      <rect width={CHART_W} height={CHART_H} fill="#040410" />
      {grid}
      {lineEls}
      {candleEls}
      <line x1={PAD.l} y1={cpY} x2={CHART_W - PAD.r} y2={cpY}
        stroke="#ffe600" strokeWidth="1" strokeDasharray="7,4" opacity=".85" />
      <rect x={CHART_W - PAD.r + 2} y={cpY - 9} width={PAD.r - 4} height={18} fill="#ffe600" rx="2" />
      <text x={CHART_W - PAD.r + 4} y={cpY + 5} fill="#000" fontSize="9"
        fontFamily="VT323,monospace" fontWeight="bold">{cpLbl}</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState(
    window.location.hash === '#pricing' ? 'pricing' : 'game'
  );

  // inject CSS once
  useEffect(() => {
    if (!document.getElementById('cw-kf')) {
      const s = document.createElement('style');
      s.id = 'cw-kf'; s.textContent = KEYFRAMES;
      document.head.appendChild(s);
    }
  }, []);

  if (page === 'pricing') {
    return <Pricing onBack={() => { window.location.hash = ''; setPage('game'); }} />;
  }

  const audioRef        = useRef(null);
  const candleIntRef    = useRef(null);
  const comboIntRef     = useRef(null);
  const ffTimerRef      = useRef(null);
  const continueIntRef  = useRef(null);
  const coinIntRef      = useRef(null);

  // ── MARKET ──────────────────────────────────────────────────────────────
  const [asset, setAsset] = useState('BTC');
  const [tf, setTf]       = useState('1m');
  const [candleMap, setCandleMap] = useState(() => {
    const o = {};
    for (const k of Object.keys(ASSETS)) o[k] = genInitCandles(k);
    return o;
  });

  // ── GAME CORE ────────────────────────────────────────────────────────────
  const [balance, setBalance]   = useState(INIT_BAL);
  const [dailyPnl, setDailyPnl] = useState(0);
  const [lives, setLives]       = useState(3);          // 0–3, halves allowed
  const [xp, setXp]             = useState(0);
  const [streak, setStreak]     = useState(0);
  const [combo, setCombo]       = useState(0);

  // session stats for end-screen
  const [statWins, setStatWins]   = useState(0);
  const [statLoss, setStatLoss]   = useState(0);
  const [statBest, setStatBest]   = useState(null);
  const [statWorst,setStatWorst]  = useState(null);
  const [statMaxStreak, setStatMaxStreak] = useState(0);

  // ── TRADING ──────────────────────────────────────────────────────────────
  const [positions, setPositions]       = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);

  // ── ORDER FORM ───────────────────────────────────────────────────────────
  const [direction, setDirection]         = useState('LONG');
  const [orderType, setOrderType]         = useState('Market');
  const [quantity, setQuantity]           = useState('0.1');
  const [slPrice, setSlPrice]             = useState('');
  const [tpPrice, setTpPrice]             = useState('');
  const [limitPrice, setLimitPrice]       = useState('');
  const [stopPriceIn, setStopPriceIn]     = useState('');

  // ── PHASE ────────────────────────────────────────────────────────────────
  // 'playing' | 'gameOver' | 'continue' | 'powerup' | 'sessionOver'
  const [phase, setPhase]               = useState('playing');
  const [continueCountdown, setContinueCd] = useState(10);

  // ── VFX ──────────────────────────────────────────────────────────────────
  const [coinRain, setCoinRain]       = useState([]);
  const [skullRain, setSkullRain]     = useState([]);
  const [floats, setFloats]           = useState([]);
  const [critHit, setCritHit]         = useState(null);
  const [shaking, setShaking]         = useState(false);
  const [borderMode, setBorderMode]   = useState('none'); // none|green|danger|fire

  // ── POWER-UPS ────────────────────────────────────────────────────────────
  const [puOptions, setPuOptions] = useState([]);
  const [effects, setEffects]     = useState({ ironShield: false, doubleXP: 0, sniperMode: false, fastForward: false });
  const [sniperPreds, setSniperPreds] = useState([]);

  // ── QUESTS ───────────────────────────────────────────────────────────────
  const [quests, setQuests] = useState(QUESTS_TPL.map(q => ({ ...q, progress: 0, done: false })));

  // ── DERIVED ──────────────────────────────────────────────────────────────
  const candles      = candleMap[asset] || [];
  const currentPrice = candles.length ? candles[candles.length - 1].close : ASSETS[asset].basePrice;
  const levelInfo    = getLevelInfo(xp);
  const multiplier   = streak >= 5 ? 5 : streak >= 3 ? 3 : streak >= 2 ? 2 : 1;
  const onFire       = streak >= 5;
  const totalOpenPnl = positions.reduce((s, p) => s + calcPnl(p, currentPrice), 0);

  // ── CANDLE INTERVAL ──────────────────────────────────────────────────────
  const startCandles = useCallback(() => {
    if (candleIntRef.current) clearInterval(candleIntRef.current);
    const ms = Math.floor(1500 * (TF_SPEED[tf] || 1) * (effects.fastForward ? .5 : 1));
    candleIntRef.current = setInterval(() => {
      setCandleMap(prev => {
        const next = {};
        for (const k of Object.keys(ASSETS)) {
          const arr = prev[k];
          const nc = genCandle(arr[arr.length - 1].close, k);
          next[k] = [...arr.slice(-(MAX_CANDLES - 1)), nc];
        }
        return next;
      });
    }, ms);
  }, [tf, effects.fastForward]);

  useEffect(() => {
    startCandles();
    return () => { if (candleIntRef.current) clearInterval(candleIntRef.current); };
  }, [startCandles]);

  // ── SL/TP CHECK on each new candle ───────────────────────────────────────
  useEffect(() => {
    if (!positions.length) return;
    const nc = candles[candles.length - 1];
    if (!nc) return;
    const toResolve = [];
    const updated = positions.map(pos => {
      if (pos.asset !== asset) return pos;
      const slHit = pos.sl && ((pos.direction === 'LONG' && nc.low <= pos.sl) || (pos.direction === 'SHORT' && nc.high >= pos.sl));
      const tpHit = pos.tp && ((pos.direction === 'LONG' && nc.high >= pos.tp) || (pos.direction === 'SHORT' && nc.low <= pos.tp));
      if (slHit) { toResolve.push({ pos, exitPrice: pos.sl, reason: 'SL' }); return null; }
      if (tpHit) { toResolve.push({ pos, exitPrice: pos.tp, reason: 'TP' }); return null; }
      return { ...pos, currentPnl: calcPnl(pos, nc.close) };
    }).filter(Boolean);
    if (toResolve.length) {
      setPositions(updated);
      toResolve.forEach(({ pos, exitPrice, reason }) => resolvePosition(pos, exitPrice, reason));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  // ── BORDER + COIN RAIN (continuous while in profit) ──────────────────────
  useEffect(() => {
    if (coinIntRef.current) clearInterval(coinIntRef.current);
    if (!positions.length) { setBorderMode('none'); setCoinRain([]); return; }

    const nearSl = positions.some(p => {
      if (!p.sl) return false;
      const dist = Math.abs(currentPrice - p.sl);
      const range = Math.abs(p.entry - p.sl);
      return range > 0 && dist / range < .3;
    });

    if (onFire) {
      setBorderMode('fire');
    } else if (nearSl) {
      setBorderMode('danger');
      playSound(audioRef, 'danger');
    } else if (totalOpenPnl > 0) {
      setBorderMode('green');
    } else {
      setBorderMode('none');
    }

    // Continuous coin drizzle while in profit
    if (totalOpenPnl > 0) {
      const intensity = totalOpenPnl > 300 ? 3 : totalOpenPnl > 50 ? 2 : 1;
      const spawnCoins = () => {
        const count = intensity === 3 ? 6 : intensity === 2 ? 3 : 1;
        const batch = Array.from({ length: count }, () => ({
          id: Date.now() + Math.random(),
          x: Math.random() * 95,
          delay: Math.random() * .3,
          dur: 1.4 + Math.random() * .8,
        }));
        setCoinRain(prev => [...prev.slice(-40), ...batch]);
        setTimeout(() => setCoinRain(prev => prev.filter(c => !batch.find(b => b.id === c.id))), 3000);
      };
      spawnCoins();
      coinIntRef.current = setInterval(spawnCoins, 1800);
    } else {
      setCoinRain([]);
    }
    return () => { if (coinIntRef.current) clearInterval(coinIntRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.length, Math.round(totalOpenPnl), onFire]);

  // ── COMBO COUNTER ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (comboIntRef.current) clearInterval(comboIntRef.current);
    if (!positions.length) { setCombo(0); return; }
    comboIntRef.current = setInterval(() => {
      if (positions.reduce((s, p) => s + calcPnl(p, currentPrice), 0) > 0) {
        setCombo(c => c + 1);
      }
    }, 10000);
    return () => { if (comboIntRef.current) clearInterval(comboIntRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.length]);

  // ── CONTINUE COUNTDOWN ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'continue') return;
    if (continueIntRef.current) clearInterval(continueIntRef.current);
    setContinueCd(10);
    continueIntRef.current = setInterval(() => {
      setContinueCd(c => {
        if (c <= 1) {
          clearInterval(continueIntRef.current);
          setPhase('sessionOver');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(continueIntRef.current);
  }, [phase]);

  // ── POSITION RESOLUTION ──────────────────────────────────────────────────
  function resolvePosition(pos, exitPrice, reason) {
    const pnl    = calcPnl(pos, exitPrice);
    const isWin  = pnl > 0;
    const isTp   = reason === 'TP';
    const isSl   = reason === 'SL';
    const is2R   = pos.sl ? Math.abs(pnl) >= Math.abs(exitPrice - pos.sl) * pos.quantity * 2 : false;

    // XP
    const baseXp = isTp ? 25 : isWin ? 15 : 5;
    const xpGain = effects.doubleXP > 0 ? baseXp * 2 : baseXp;
    setXp(prev => {
      const nw = prev + xpGain;
      if (getLevelInfo(nw).level !== getLevelInfo(prev).level) {
        playSound(audioRef, 'lvlUp');
        spawn('LEVEL UP! ⬆', '#ffe600');
      }
      return nw;
    });
    if (effects.doubleXP > 0) setEffects(e => ({ ...e, doubleXP: e.doubleXP - 1 }));

    // Balance
    setBalance(b => b + pnl);
    setDailyPnl(d => d + pnl);

    // Session stats
    if (isWin) {
      setStatWins(w => w + 1);
      setStreak(s => {
        const ns = s + 1;
        setStatMaxStreak(m => Math.max(m, ns));
        return ns;
      });
    } else {
      setStatLoss(l => l + 1);
      setStreak(0);
      setCombo(0);
    }
    setStatBest(b  => b  == null ? pnl : Math.max(b, pnl));
    setStatWorst(w => w  == null ? pnl : Math.min(w, pnl));

    // Lives
    if (isSl) {
      if (effects.ironShield) {
        setEffects(e => ({ ...e, ironShield: false }));
        spawn('SHIELD BLOCKED SL!', '#00eaff');
        playSound(audioRef, 'power');
      } else {
        setLives(l => {
          const nl = l - 1;
          playSound(audioRef, 'slHit');
          triggerShake();
          triggerSkullRain();
          spawn('-1 LIFE!', '#ff2d78');
          if (nl <= 0) {
            setTimeout(() => setPhase('gameOver'), 200);
          } else {
            setTimeout(() => offerPowerup(), 800);
          }
          return Math.max(0, nl);
        });
      }
    }
    if (isTp) {
      setLives(l => Math.min(3, l + .5));
      playSound(audioRef, 'crit');
      setCritHit(pnl);
      setTimeout(() => setCritHit(null), 2400);
      burstCoins(pnl);
    } else if (isWin) {
      if (is2R) { setLives(l => Math.min(3, l + 1)); spawn('+1 LIFE!', '#00ff88'); }
      playSound(audioRef, 'coin');
    }

    // History
    setTradeHistory(prev => [{
      id: Date.now() + Math.random(),
      asset: pos.asset,
      direction: pos.direction,
      entry: pos.entry,
      exit: exitPrice,
      pnl,
      reason,
      orderType: pos.orderType,
    }, ...prev].slice(0, 10));

    spawn(fmtPnl(pnl), pnl >= 0 ? '#00ff88' : '#ff2d78');
    updateQuests(isWin, pnl, pos.orderType === 'Stop');
  }

  function updateQuests(isWin, pnl, isStop) {
    setQuests(prev => prev.map(q => {
      if (q.done) return q;
      let delta = 0;
      if (q.type === 'wins'      && isWin)  delta = 1;
      if (q.type === 'profit'    && pnl > 0) delta = pnl;
      if (q.type === 'stopOrder' && isStop) delta = 1;
      if (!delta) return q;
      const np = Math.min(q.target, q.progress + delta);
      const done = np >= q.target;
      if (done && !q.done) {
        if (q.rt === 'XP') setXp(x => x + q.reward);
        else { setBalance(b => b + q.reward); spawn('+$' + q.reward + ' QUEST!', '#ffe600'); }
        spawn('✓ QUEST DONE!', '#ffe600');
      }
      return { ...q, progress: np, done };
    }));
  }

  // ── VFX helpers ──────────────────────────────────────────────────────────
  function triggerShake() {
    setShaking(true); setTimeout(() => setShaking(false), 700);
  }
  function triggerSkullRain() {
    const skulls = Array.from({ length: 16 }, () => ({
      id: Date.now() + Math.random(),
      x: Math.random() * 95,
      delay: Math.random() * .6,
      dur: 1.2 + Math.random() * .8,
    }));
    setSkullRain(skulls);
    setTimeout(() => setSkullRain([]), 3500);
  }
  function spawn(text, color) {
    const id = Date.now() + Math.random();
    setFloats(prev => [...prev, { id, text, color, x: 30 + Math.random() * 40, y: 25 + Math.random() * 30 }]);
    setTimeout(() => setFloats(prev => prev.filter(t => t.id !== id)), 1700);
  }
  function burstCoins(pnl) {
    const count = pnl >= 400 ? 28 : pnl >= 100 ? 18 : 10;
    const batch = Array.from({ length: count }, () => ({
      id: Date.now() + Math.random(),
      x: Math.random() * 95,
      delay: Math.random() * .5,
      dur: 1.3 + Math.random() * .9,
    }));
    setCoinRain(prev => [...prev, ...batch]);
    setTimeout(() => setCoinRain(prev => prev.filter(c => !batch.find(b => b.id === c.id))), 4200);
  }

  // ── POWER-UP ─────────────────────────────────────────────────────────────
  function offerPowerup() {
    const shuffled = [...POWERUPS].sort(() => Math.random() - .5);
    setPuOptions(shuffled.slice(0, 3));
    setPhase('powerup');
  }
  function selectPowerup(pu) {
    setPhase('playing');
    if (pu.id === 'iron_shield')  setEffects(e => ({ ...e, ironShield: true }));
    else if (pu.id === 'double_xp')   setEffects(e => ({ ...e, doubleXP: 5 }));
    else if (pu.id === 'sniper_mode') {
      setEffects(e => ({ ...e, sniperMode: true }));
      const arr = candleMap[asset];
      let p = arr[arr.length - 1].close;
      const preds = [];
      for (let i = 0; i < 3; i++) {
        const nc = genCandle(p, asset);
        preds.push(nc.close >= nc.open ? 'UP' : 'DOWN');
        p = nc.close;
      }
      setSniperPreds(preds);
      setTimeout(() => { setEffects(e => ({ ...e, sniperMode: false })); setSniperPreds([]); }, 12000);
    }
    else if (pu.id === 'bonus_coins') {
      setBalance(b => b + 500);
      spawn('+$500 BONUS!', '#ffe600');
      playSound(audioRef, 'coin');
    }
    else if (pu.id === 'fast_forward') {
      setEffects(e => ({ ...e, fastForward: true }));
      if (ffTimerRef.current) clearTimeout(ffTimerRef.current);
      ffTimerRef.current = setTimeout(() => setEffects(e => ({ ...e, fastForward: false })), 30000);
    }
    spawn(pu.name + ' ACTIVE!', pu.color);
    playSound(audioRef, 'power');
  }

  // ── OPEN POSITION ─────────────────────────────────────────────────────────
  function openPosition() {
    if (!audioRef.current) audioRef.current = mkAudio();
    if (positions.length >= MAX_POS) { spawn('MAX POSITIONS!', '#ff2d78'); return; }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0 || qty > 10) { spawn('INVALID QTY!', '#ff2d78'); return; }
    let entry = currentPrice;
    if (orderType === 'Limit' && limitPrice)  entry = parseFloat(limitPrice);
    if (orderType === 'Stop' && stopPriceIn)  entry = parseFloat(stopPriceIn);
    if (isNaN(entry)) return;
    const sl = slPrice ? parseFloat(slPrice) : null;
    const tp = tpPrice ? parseFloat(tpPrice) : null;
    setPositions(prev => [...prev, { id: Date.now(), asset, direction, entry, quantity: qty, sl, tp, orderType, currentPnl: 0 }]);
    playSound(audioRef, 'fill');
    spawn('ORDER FILLED!', '#00eaff');
    setSlPrice(''); setTpPrice(''); setLimitPrice(''); setStopPriceIn('');
  }

  function closeManual(posId) {
    const pos = positions.find(p => p.id === posId);
    if (!pos) return;
    resolvePosition(pos, currentPrice, 'Manual');
    setPositions(prev => prev.filter(p => p.id !== posId));
  }

  // ── RESTART ───────────────────────────────────────────────────────────────
  function restart() {
    clearInterval(continueIntRef.current);
    setBalance(INIT_BAL); setDailyPnl(0); setLives(3); setXp(0);
    setPositions([]); setTradeHistory([]); setStreak(0); setCombo(0);
    setStatWins(0); setStatLoss(0); setStatBest(null); setStatWorst(null); setStatMaxStreak(0);
    setPhase('playing'); setCoinRain([]); setSkullRain([]); setShaking(false); setBorderMode('none');
    setEffects({ ironShield: false, doubleXP: 0, sniperMode: false, fastForward: false });
    setQuests(QUESTS_TPL.map(q => ({ ...q, progress: 0, done: false })));
    setCandleMap(() => { const o = {}; for (const k of Object.keys(ASSETS)) o[k] = genInitCandles(k); return o; });
  }

  // ── VOLUME DATA ───────────────────────────────────────────────────────────
  const volData = useMemo(() => candles.slice(-60).map((c, i) => ({
    i, v: c.volume, up: c.close >= c.open,
  })), [candles]);

  // ── STYLE HELPERS ─────────────────────────────────────────────────────────
  const pxBtn = (active, col = '#00ff88', extra = {}) => ({
    background: active ? col + '1a' : 'transparent',
    border: `2px solid ${active ? col : '#1e2a3a'}`,
    color: active ? col : '#445566',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '8px', padding: '5px 8px',
    cursor: 'pointer',
    boxShadow: active ? `0 0 10px ${col}44, inset 0 0 8px ${col}11` : 'none',
    transition: 'all .12s', ...extra,
  });
  const secHdr = (col = '#00eaff') => ({
    fontFamily: "'Press Start 2P', monospace", fontSize: '7px',
    color: col, textShadow: `0 0 8px ${col}88`,
    borderBottom: `1px solid ${col}33`, paddingBottom: '4px', marginBottom: '6px', letterSpacing: '.5px',
  });
  const inpStyle = {
    background: '#070714', border: '1px solid #252550', color: '#00eaff',
    fontFamily: "'VT323', monospace", fontSize: '16px',
    padding: '4px 7px', width: '100%', outline: 'none', borderRadius: '1px',
  };

  // Main wrapper animation — only one at a time
  const wrapAnim = shaking ? 'screenShake .7s ease'
    : borderMode === 'green'  ? 'borderGreen 1.2s infinite'
    : borderMode === 'danger' ? 'borderDanger .55s infinite'
    : borderMode === 'fire'   ? 'borderFire 1s infinite'
    : 'none';

  // Session over stats
  const totalTrades = statWins + statLoss;
  const winRate = totalTrades > 0 ? Math.round((statWins / totalTrades) * 100) : 0;
  const endGrade = sessionGrade(dailyPnl, winRate);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: '100vw', height: '100vh', background: '#0a0a1a',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'VT323', monospace", color: '#c0c0d0',
        overflow: 'hidden', animation: wrapAnim,
      }}
      onClick={() => { if (!audioRef.current) audioRef.current = mkAudio(); }}
    >

      {/* ── COIN RAIN ── */}
      {coinRain.map(c => (
        <div key={c.id} style={{
          position: 'fixed', left: c.x + 'vw', top: 0, zIndex: 9999,
          fontSize: '20px', pointerEvents: 'none',
          animation: `coinFall ${c.dur}s ${c.delay}s linear forwards`,
        }}>💰</div>
      ))}

      {/* ── SKULL RAIN ── */}
      {skullRain.map(s => (
        <div key={s.id} style={{
          position: 'fixed', left: s.x + 'vw', top: 0, zIndex: 9999,
          fontSize: '22px', pointerEvents: 'none',
          animation: `skullFall ${s.dur}s ${s.delay}s linear forwards`,
        }}>💀</div>
      ))}

      {/* ── FLOATING TEXTS ── */}
      {floats.map(ft => (
        <div key={ft.id} style={{
          position: 'fixed', left: ft.x + '%', top: ft.y + '%',
          color: ft.color, fontFamily: "'Press Start 2P', monospace", fontSize: '13px',
          textShadow: `0 0 12px ${ft.color}`,
          animation: 'floatUp 1.7s ease-out forwards',
          zIndex: 9998, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>{ft.text}</div>
      ))}

      {/* ── CRITICAL HIT ── */}
      {critHit !== null && (
        <div style={{
          position: 'fixed', top: '26%', left: '50%',
          zIndex: 9997, textAlign: 'center', pointerEvents: 'none',
          animation: 'critSlam .5s ease-out forwards',
        }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '28px', color: '#ffe600', textShadow: '0 0 25px #ffe600, 0 0 50px #ff770066', lineHeight: 1.3 }}>
            ⭐ CRITICAL HIT! ⭐
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '22px', color: '#00ff88', textShadow: '0 0 15px #00ff88', marginTop: '10px' }}>
            +${Math.abs(critHit).toFixed(2)}
          </div>
          <div style={{ fontSize: '28px', marginTop: '8px' }}>🎉💥🎉</div>
        </div>
      )}

      {/* ── DANGER ZONE BADGE ── */}
      {borderMode === 'danger' && (
        <div style={{
          position: 'fixed', top: '80px', right: '20px', zIndex: 9990,
          fontFamily: "'Press Start 2P', monospace", fontSize: '8px',
          color: '#ff2d78', border: '2px solid #ff2d78', padding: '6px 12px',
          background: '#ff2d7811', boxShadow: '0 0 15px #ff2d7855',
          animation: 'dangerPulse .5s infinite',
        }}>⚠ DANGER ZONE ⚠</div>
      )}

      {/* ── GAME OVER OVERLAY ── */}
      {phase === 'gameOver' && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)',
          zIndex: 10000, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '18px',
        }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '52px', color: '#ff2d78', textShadow: '0 0 30px #ff2d78, 0 0 60px #ff004477', animation: 'slam .6s ease-out forwards, blink 1.2s .7s infinite' }}>
            GAME OVER
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px', color: '#ff6666' }}>
            ALL LIVES LOST
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: '24px', color: '#7788aa' }}>
            Loading stats…
          </div>
          {/* Auto-advance to continue after 3s */}
          {setTimeout(() => { if (phase === 'gameOver') setPhase('continue'); }, 3000) && null}
        </div>
      )}

      {/* ── CONTINUE SCREEN ── */}
      {phase === 'continue' && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.93)',
          zIndex: 10000, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '16px',
          fontFamily: "'Press Start 2P', monospace",
        }}>
          <div style={{ fontSize: '26px', color: '#ff2d78', animation: 'blink 1.1s infinite' }}>
            CONTINUE?
          </div>

          <div style={{
            border: '3px solid #ff2d78', padding: '24px 36px',
            background: '#07071a', boxShadow: '0 0 40px #ff2d7844',
            display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '340px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#556677' }}>
              <span>ACCOUNT BALANCE</span>
              <span style={{ color: '#00ff88' }}>${balance.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#556677' }}>
              <span>TRADES TODAY</span>
              <span style={{ color: '#ffe600' }}>{totalTrades}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#556677' }}>
              <span>WIN RATE</span>
              <span style={{ color: '#00eaff' }}>{winRate}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#556677' }}>
              <span>DAILY P&L</span>
              <span style={{ color: dailyPnl >= 0 ? '#00ff88' : '#ff2d78' }}>{fmtPnl(dailyPnl)}</span>
            </div>
          </div>

          <div style={{ fontSize: '40px', color: '#ff2d78', textShadow: '0 0 20px #ff2d78', animation: 'cdPop 1s infinite', minWidth: '60px', textAlign: 'center' }}>
            {continueCountdown}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '340px' }}>
            <button
              onClick={offerPowerup}
              style={{ ...pxBtn(true, '#00ff88'), fontSize: '11px', padding: '13px', width: '100%', animation: 'blink 1.5s infinite' }}
            >
              ▶ INSERT COIN / NEW TRADE
            </button>
            <button
              onClick={() => setPhase('sessionOver')}
              style={{ ...pxBtn(false, '#ff2d78'), fontSize: '9px', padding: '10px', width: '100%' }}
            >
              ✕ END SESSION
            </button>
          </div>
        </div>
      )}

      {/* ── POWER-UP SELECTION ── */}
      {phase === 'powerup' && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
          zIndex: 10001, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '24px',
        }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '18px', color: '#ffe600', textShadow: '0 0 15px #ffe600' }}>
            ⚡ CHOOSE YOUR POWER-UP ⚡
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {puOptions.map((pu, i) => (
              <div key={pu.id} onClick={() => selectPowerup(pu)}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07) translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                style={{
                  width: '165px', padding: '18px 14px',
                  background: '#0b0b22', border: `3px solid ${pu.color}`,
                  borderRadius: '3px', cursor: 'pointer', textAlign: 'center',
                  boxShadow: `0 0 24px ${pu.color}44, inset 0 0 20px ${pu.color}0a`,
                  animation: `powerPop .45s ${i * .1}s ease-out both`,
                  display: 'flex', flexDirection: 'column', gap: '10px',
                  transition: 'transform .12s',
                }}>
                <div style={{ fontSize: '38px', lineHeight: 1 }}>{pu.icon}</div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: pu.color, letterSpacing: '.5px' }}>{pu.rarity}</div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: pu.color, textShadow: `0 0 8px ${pu.color}`, lineHeight: 1.5 }}>{pu.name}</div>
                <div style={{ fontFamily: "'VT323', monospace", fontSize: '15px', color: '#99aabb', lineHeight: 1.3 }}>{pu.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SESSION OVER ── */}
      {phase === 'sessionOver' && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.97)',
          zIndex: 10002, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '18px',
          fontFamily: "'Press Start 2P', monospace",
        }}>
          <div style={{ fontSize: '32px', color: '#ff2d78', textShadow: '0 0 20px #ff2d78', animation: 'neonFlicker 4s infinite' }}>
            SESSION OVER
          </div>
          <div style={{ fontSize: '9px', color: '#334455', letterSpacing: '2px' }}>POST-BATTLE REPORT</div>

          <div style={{
            border: '2px solid #1a1a44', padding: '24px 32px',
            background: '#0a0a20', boxShadow: '0 0 40px #ff2d7822',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 30px',
            fontSize: '9px', minWidth: '360px',
          }}>
            {[
              ['FINAL P&L',   fmtPnl(dailyPnl),           dailyPnl >= 0 ? '#00ff88' : '#ff2d78'],
              ['WIN RATE',    winRate + '%',                 '#00eaff'],
              ['TOTAL TRADES',totalTrades,                   '#c0c0d0'],
              ['WIN STREAK',  statMaxStreak + '×',           '#ff8800'],
              ['BEST TRADE',  statBest != null ? fmtPnl(statBest) : '—',  '#00ff88'],
              ['WORST TRADE', statWorst != null ? fmtPnl(statWorst) : '—','#ff2d78'],
            ].map(([label, val, col]) => (
              <React.Fragment key={label}>
                <div style={{ color: '#445566' }}>{label}</div>
                <div style={{ color: col, textShadow: `0 0 6px ${col}55` }}>{val}</div>
              </React.Fragment>
            ))}
          </div>

          {/* Grade */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8px', color: '#334455', marginBottom: '6px' }}>PERFORMANCE GRADE</div>
            <div style={{
              fontSize: '80px', color: GRADE_COLOR[endGrade],
              textShadow: `0 0 30px ${GRADE_COLOR[endGrade]}, 0 0 60px ${GRADE_COLOR[endGrade]}55`,
              animation: 'slam .6s ease-out forwards', lineHeight: 1,
            }}>{endGrade}</div>
          </div>

          <button style={{ ...pxBtn(true, '#ffe600'), fontSize: '13px', padding: '14px 28px', marginTop: '4px' }} onClick={restart}>
            ▶ PLAY AGAIN
          </button>
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
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: '#ffe600', textShadow: '0 0 10px #ffe600', whiteSpace: 'nowrap', letterSpacing: '1px', animation: 'neonFlicker 6s infinite' }}>
          ⚔ CANDLE WARS
        </div>
        <div style={{ width: '1px', height: '30px', background: '#1a1a4a' }} />

        {/* Balance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: '110px' }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: '#334455' }}>BALANCE</span>
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '130px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: levelInfo.level.color, textShadow: `0 0 6px ${levelInfo.level.color}88` }}>
              {levelInfo.level.name}
            </span>
            <span style={{ fontSize: '12px', color: '#445566' }}>{xp} XP</span>
          </div>
          <div style={{ height: '8px', background: '#111128', borderRadius: '2px', overflow: 'hidden', border: '1px solid #1e1e50' }}>
            <div style={{ height: '100%', width: levelInfo.progress + '%', background: `linear-gradient(90deg,${levelInfo.level.color}66,${levelInfo.level.color})`, boxShadow: `0 0 8px ${levelInfo.level.color}88`, transition: 'width .6s ease' }} />
          </div>
        </div>

        {/* Streak / On Fire */}
        {streak > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', minWidth: '40px' }}>
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{onFire ? '🔥' : '⚡'}</span>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: onFire ? '#ffe600' : '#ff7700', textShadow: `0 0 6px ${onFire ? '#ffe600' : '#ff7700'}` }}>×{multiplier}</span>
          </div>
        )}

        {/* Combo */}
        {combo > 0 && (
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: '#ff2d78', textShadow: '0 0 8px #ff2d78', animation: 'blink .9s infinite', whiteSpace: 'nowrap' }}>
            COMBO ×{combo}!
          </div>
        )}

        {/* Active effects */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {effects.ironShield  && <span style={{ fontSize: '16px', filter: 'drop-shadow(0 0 5px #00eaff)' }} title="Iron Shield">🛡️</span>}
          {effects.doubleXP > 0 && <span style={{ fontSize: '16px', filter: 'drop-shadow(0 0 5px #ffe600)' }} title={`2× XP: ${effects.doubleXP} left`}>⚡</span>}
          {effects.sniperMode  && <span style={{ fontSize: '16px', filter: 'drop-shadow(0 0 5px #ff2d78)', animation: 'blink 1s infinite' }} title="Sniper Mode">🎯</span>}
          {effects.fastForward && <span style={{ fontSize: '16px', filter: 'drop-shadow(0 0 5px #ff7700)' }} title="Fast Forward">⏩</span>}
        </div>

        {/* Upgrade button */}
        <button onClick={() => { window.location.hash = '#pricing'; setPage('pricing'); }} style={{
          background: 'linear-gradient(135deg,#ffe600,#ff8800)',
          border: 'none', color: '#0a0a1a', fontFamily: "'Press Start 2P', monospace",
          fontSize: '7px', padding: '6px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
          boxShadow: '0 0 10px #ffe60066',
        }}>⭐ PRO</button>

        {/* Lives — 3 hearts */}
        <div style={{ display: 'flex', gap: '2px', alignItems: 'center', marginLeft: 'auto' }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: '#ff2d78', marginRight: '5px' }}>LIVES</span>
          {[0, 1, 2].map(i => {
            const full = lives > i;
            const half = !full && lives > i - .5 && lives <= i;
            return (
              <span key={i} style={{
                fontSize: '18px',
                opacity: full ? 1 : .2,
                filter: full ? 'drop-shadow(0 0 4px #ff2d78)' : 'none',
                transition: 'opacity .4s',
                animation: full && lives <= 1 ? 'blink 1s infinite' : 'none',
              }}>
                {full ? '❤️' : half ? '🩸' : '🖤'}
              </span>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MAIN AREA
      ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ═══ LEFT PANEL ═══ */}
        <div style={{ width: '200px', flexShrink: 0, background: '#080818', borderRight: '2px solid #121232', display: 'flex', flexDirection: 'column', padding: '8px', gap: '4px', overflowY: 'auto' }}>
          <div style={secHdr('#ffe600')}>MARKETS</div>
          {Object.entries(ASSETS).map(([key, a]) => {
            const arr = candleMap[key] || [];
            const p  = arr.length ? arr[arr.length - 1].close : a.basePrice;
            const pp = arr.length > 1 ? arr[arr.length - 2].close : p;
            const chg = ((p - pp) / pp) * 100;
            const sel = key === asset;
            return (
              <div key={key} onClick={() => setAsset(key)}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = a.color + '55'; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = '#181838'; }}
                style={{
                  padding: '7px 8px', background: sel ? a.color + '14' : '#0a0a1e',
                  border: `1px solid ${sel ? a.color : '#181838'}`,
                  cursor: 'pointer', borderRadius: '2px',
                  boxShadow: sel ? `0 0 12px ${a.color}2a` : 'none',
                  transition: 'all .15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: sel ? a.color : '#556677' }}>{key}</span>
                  <span style={{ fontSize: '13px', color: chg >= 0 ? '#00ff88' : '#ff2d78' }}>{chg >= 0 ? '▲' : '▼'}{Math.abs(chg).toFixed(2)}%</span>
                </div>
                <div style={{ fontSize: '17px', color: sel ? a.color : '#8899bb' }}>{fmtP(p)}</div>
              </div>
            );
          })}

          {/* Rank card */}
          <div style={{ background: '#0c0c22', border: `1px solid ${levelInfo.level.color}44`, borderRadius: '2px', padding: '8px', marginTop: '8px' }}>
            <div style={{ ...secHdr(levelInfo.level.color), marginBottom: '3px' }}>RANK</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: levelInfo.level.color, textShadow: `0 0 8px ${levelInfo.level.color}88`, lineHeight: 1.6 }}>
              {levelInfo.level.name}
            </div>
            <div style={{ fontSize: '14px', color: '#556677', marginTop: '2px' }}>{xp} XP</div>
          </div>

          {/* Sniper predictions */}
          {effects.sniperMode && sniperPreds.length > 0 && (
            <div style={{ background: '#0c0c22', border: '1px solid #ff2d78', borderRadius: '2px', padding: '8px', boxShadow: '0 0 12px #ff2d7833' }}>
              <div style={secHdr('#ff2d78')}>🎯 SNIPER SCAN</div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                {sniperPreds.map((d, i) => (
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

          {/* Quests */}
          <div style={{ background: '#0c0c22', border: '1px solid #1a1a40', borderRadius: '2px', padding: '8px' }}>
            <div style={secHdr('#ffe600')}>QUESTS</div>
            {quests.map(q => (
              <div key={q.id} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '13px', color: q.done ? '#00ff88' : '#8899aa', maxWidth: '115px', lineHeight: 1.2 }}>{q.done ? '✓ ' : ''}{q.name}</span>
                  <span style={{ fontSize: '12px', color: '#ffe600' }}>+{q.reward}{q.rt}</span>
                </div>
                <div style={{ height: '5px', background: '#111128', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: Math.min(100, (q.progress / q.target) * 100) + '%',
                    background: q.done ? 'linear-gradient(90deg,#00ff8877,#00ff88)' : 'linear-gradient(90deg,#ffe60077,#ffe600)',
                    boxShadow: `0 0 6px ${q.done ? '#00ff88' : '#ffe600'}`,
                    transition: 'width .5s',
                  }} />
                </div>
                <div style={{ fontSize: '11px', color: '#445566', textAlign: 'right', marginTop: '1px' }}>
                  {q.type === 'profit' ? '$' + Math.floor(q.progress) + '/$' + q.target : Math.floor(q.progress) + '/' + q.target}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ CENTER CHART ═══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Timeframe + ticker bar */}
          <div style={{ display: 'flex', gap: '5px', padding: '5px 10px', background: '#07071c', borderBottom: '1px solid #121232', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: ASSETS[asset].color, textShadow: `0 0 6px ${ASSETS[asset].color}88`, marginRight: '6px', whiteSpace: 'nowrap' }}>
              {ASSETS[asset].name}
            </span>
            {TIMEFRAMES.map(t => (
              <button key={t} onClick={() => setTf(t)} style={pxBtn(t === tf, '#00eaff')}>{t}</button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '14px', alignItems: 'center' }}>
              <span style={{ fontFamily: "'VT323', monospace", fontSize: '22px', color: ASSETS[asset].color, textShadow: `0 0 6px ${ASSETS[asset].color}77` }}>
                {fmtP(currentPrice)}
              </span>
              {positions.some(p => p.asset === asset) && (
                <span style={{ fontFamily: "'VT323', monospace", fontSize: '20px', color: totalOpenPnl >= 0 ? '#00ff88' : '#ff2d78' }}>
                  {fmtPnl(totalOpenPnl)}
                </span>
              )}
              {onFire && <span style={{ fontSize: '20px', animation: 'neonFlicker 2s infinite' }}>🔥 ON FIRE</span>}
            </div>
          </div>

          {/* SVG Chart with CRT overlay */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
            {/* Static scanlines */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.07) 3px,rgba(0,0,0,.07) 4px)' }} />
            {/* Moving scanline */}
            <div style={{ position: 'absolute', left: 0, right: 0, height: '4px', background: 'linear-gradient(transparent,rgba(0,255,136,.07),transparent)', zIndex: 3, pointerEvents: 'none', animation: 'scanline 5s linear infinite' }} />
            {/* Vignette */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,.35) 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              <CandleChart candles={candles} positions={positions} currentPrice={currentPrice} assetKey={asset} onFireMode={onFire} />
            </div>
          </div>

          {/* Volume chart */}
          <div style={{ height: '68px', background: '#040412', borderTop: '1px solid #111128', flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volData} margin={{ top: 4, right: 66, bottom: 0, left: 6 }} barCategoryGap="1%">
                <XAxis dataKey="i" hide />
                <YAxis hide />
                <Bar dataKey="v" radius={[1, 1, 0, 0]} isAnimationActive={false}>
                  {volData.map((d, i) => (
                    <Cell key={i} fill={d.up ? '#00ff8844' : '#ff2d7844'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ═══ RIGHT PANEL ═══ */}
        <div style={{ width: '218px', flexShrink: 0, background: '#080818', borderLeft: '2px solid #121232', display: 'flex', flexDirection: 'column', padding: '8px', gap: '5px', overflowY: 'auto' }}>

          <div style={secHdr('#ff2d78')}>⚡ ORDER PANEL</div>

          {/* Long / Short */}
          <div style={{ display: 'flex', gap: '5px', marginBottom: '2px' }}>
            <button style={{ ...pxBtn(direction === 'LONG', '#00ff88'), flex: 1, fontSize: '9px' }} onClick={() => setDirection('LONG')}>▲ LONG</button>
            <button style={{ ...pxBtn(direction === 'SHORT', '#ff2d78'), flex: 1, fontSize: '9px' }} onClick={() => setDirection('SHORT')}>▼ SHORT</button>
          </div>

          {/* Order type */}
          <div style={{ display: 'flex', gap: '3px' }}>
            {['Market', 'Limit', 'Stop'].map(t => (
              <button key={t} style={{ ...pxBtn(orderType === t, '#00eaff'), flex: 1, fontSize: '6px', padding: '5px 2px' }} onClick={() => setOrderType(t)}>
                {t === 'Market' ? 'INSTANT' : t === 'Limit' ? 'SNIPER' : 'TRAP'}
              </button>
            ))}
          </div>

          {/* Qty */}
          <div>
            <div style={{ fontSize: '11px', color: '#445566', marginBottom: '3px' }}>QTY (0.01–10 UNITS)</div>
            <input type="number" value={quantity} min="0.01" max="10" step="0.01" onChange={e => setQuantity(e.target.value)} style={inpStyle} />
          </div>

          {orderType === 'Limit' && (
            <div>
              <div style={{ fontSize: '11px', color: '#445566', marginBottom: '3px' }}>LIMIT PRICE</div>
              <input type="number" value={limitPrice} placeholder={fmtP(currentPrice)} onChange={e => setLimitPrice(e.target.value)} style={inpStyle} />
            </div>
          )}
          {orderType === 'Stop' && (
            <div>
              <div style={{ fontSize: '11px', color: '#445566', marginBottom: '3px' }}>STOP PRICE</div>
              <input type="number" value={stopPriceIn} placeholder={fmtP(currentPrice)} onChange={e => setStopPriceIn(e.target.value)} style={inpStyle} />
            </div>
          )}

          <div>
            <div style={{ fontSize: '11px', color: '#ff2d78', marginBottom: '3px' }}>STOP LOSS</div>
            <input type="number" value={slPrice} placeholder="Optional" onChange={e => setSlPrice(e.target.value)} style={{ ...inpStyle, borderColor: slPrice ? '#ff2d78' : '#252550' }} />
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#00ff88', marginBottom: '3px' }}>TAKE PROFIT</div>
            <input type="number" value={tpPrice} placeholder="Optional" onChange={e => setTpPrice(e.target.value)} style={{ ...inpStyle, borderColor: tpPrice ? '#00ff88' : '#252550' }} />
          </div>

          <div style={{ fontSize: '13px', color: '#334455', textAlign: 'center' }}>MKT: {fmtP(currentPrice)}</div>

          <button onClick={openPosition}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = `0 0 28px ${direction === 'LONG' ? '#00ff8866' : '#ff2d7866'}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 0 18px ${direction === 'LONG' ? '#00ff8833' : '#ff2d7833'}`; }}
            style={{
              background: direction === 'LONG' ? '#00ff8818' : '#ff2d7818',
              border: `2px solid ${direction === 'LONG' ? '#00ff88' : '#ff2d78'}`,
              color: direction === 'LONG' ? '#00ff88' : '#ff2d78',
              fontFamily: "'Press Start 2P', monospace", fontSize: '11px', padding: '11px',
              cursor: 'pointer', width: '100%',
              boxShadow: `0 0 18px ${direction === 'LONG' ? '#00ff8833' : '#ff2d7833'}`,
              transition: 'all .12s', marginBottom: '4px',
            }}>
            {direction === 'LONG' ? '▲ LONG ATTACK!' : '▼ SHORT STRIKE!'}
          </button>

          {/* Open Positions */}
          <div style={secHdr('#00eaff')}>POSITIONS ({positions.length}/{MAX_POS})</div>
          {!positions.length && (
            <div style={{ fontSize: '13px', color: '#2a3a4a', textAlign: 'center', padding: '10px 0' }}>No open positions</div>
          )}
          {positions.map(pos => {
            const pnl = calcPnl(pos, currentPrice);
            const inProfit = pnl >= 0;
            const slInProfit = inProfit && pos.sl;
            return (
              <div key={pos.id} style={{
                background: '#0a0a20',
                border: `1px solid ${inProfit ? '#00ff8833' : '#ff2d7833'}`,
                borderRadius: '2px', padding: '7px',
                boxShadow: inProfit ? '0 0 10px #00ff8818' : '0 0 10px #ff2d7818',
                marginBottom: '5px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: pos.direction === 'LONG' ? '#00ff88' : '#ff2d78' }}>
                    {pos.direction === 'LONG' ? '▲' : '▼'} {pos.asset}
                  </span>
                  <button onClick={() => closeManual(pos.id)}
                    style={{ background: 'transparent', border: '1px solid #ff2d78', color: '#ff2d78', fontFamily: "'Press Start 2P', monospace", fontSize: '5px', padding: '2px 5px', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#ff2d7822'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    CLOSE
                  </button>
                </div>
                <div style={{ fontSize: '13px', color: '#556677', marginBottom: '2px' }}>{fmtP(pos.entry)} × {pos.quantity}</div>
                {pos.sl && (
                  <div style={{ fontSize: '12px', color: slInProfit ? '#FFD700' : '#ff2d78aa', marginBottom: '1px' }}>
                    {slInProfit ? '🛡' : ''} SL: {fmtP(pos.sl)}
                    {slInProfit && <span style={{ color: '#FFD700', marginLeft: '4px', fontSize: '10px' }}>PROTECTED</span>}
                  </div>
                )}
                {pos.tp && <div style={{ fontSize: '12px', color: '#00ff88aa' }}>TP: {fmtP(pos.tp)}</div>}
                <div style={{ fontSize: '20px', fontWeight: 'bold', textAlign: 'right', color: inProfit ? '#00ff88' : '#ff2d78', textShadow: `0 0 8px ${inProfit ? '#00ff8877' : '#ff2d7877'}` }}>
                  {fmtPnl(pnl)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          BOTTOM — Trade History
      ══════════════════════════════════════════════════════ */}
      <div style={{ height: '118px', flexShrink: 0, background: '#060614', borderTop: '2px solid #121232', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '3px 14px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid #111128', flexShrink: 0 }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: '#ffe600', textShadow: '0 0 8px #ffe60077' }}>TRADE HISTORY</span>
          <span style={{ fontSize: '13px', color: '#334455' }}>{totalTrades} trades · {winRate}% WR</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#0a0a22', position: 'sticky', top: 0 }}>
                {['ASSET','DIR','ENTRY','EXIT','P&L','HOW'].map(h => (
                  <th key={h} style={{ padding: '2px 10px', textAlign: 'left', color: '#334455', fontFamily: "'Press Start 2P', monospace", fontSize: '6px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!tradeHistory.length && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#2a3a4a', padding: '14px', fontSize: '13px' }}>No trades yet — place your first order!</td></tr>
              )}
              {tradeHistory.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #0e0e24' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#0e0e2a'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '2px 10px', color: ASSETS[t.asset]?.color || '#aabbcc', fontFamily: "'Press Start 2P', monospace", fontSize: '6px' }}>{t.asset}</td>
                  <td style={{ padding: '2px 10px', color: t.direction === 'LONG' ? '#00ff88' : '#ff2d78' }}>{t.direction === 'LONG' ? '▲' : '▼'} {t.direction}</td>
                  <td style={{ padding: '2px 10px', color: '#556677' }}>{fmtP(t.entry)}</td>
                  <td style={{ padding: '2px 10px', color: '#556677' }}>{fmtP(t.exit)}</td>
                  <td style={{ padding: '2px 10px', color: t.pnl >= 0 ? '#00ff88' : '#ff2d78', textShadow: `0 0 6px ${t.pnl >= 0 ? '#00ff8855' : '#ff2d7855'}` }}>{fmtPnl(t.pnl)}</td>
                  <td style={{ padding: '2px 10px', color: t.reason === 'TP' ? '#00ff88' : t.reason === 'SL' ? '#ff2d78' : '#556677', fontFamily: "'Press Start 2P', monospace", fontSize: '6px' }}>
                    {t.reason === 'TP' ? '🎯 TP' : t.reason === 'SL' ? '💀 SL' : '✋ MAN'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
