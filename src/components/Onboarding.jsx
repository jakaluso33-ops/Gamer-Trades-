import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MONTHLY_PRICE_ID } from '../lib/pricing';

const FONT_H = "'Press Start 2P', monospace";
const FONT_B = "'VT323', monospace";

const QUESTS = {
  scalper: [
    { icon: '⚡', name: '5 Quick Trades', xp: '+25 XP', desc: 'Open & close 5 positions' },
    { icon: '🎯', name: 'Hit 3 Win Streak', xp: '+40 XP', desc: 'Win 3 trades in a row' },
    { icon: '💨', name: 'Scalp $200 P&L', xp: '+35 XP', desc: 'Net positive $200 in one session' },
  ],
  swing: [
    { icon: '🌊', name: 'Hold for 10 Mins', xp: '+30 XP', desc: 'Keep a position open 10+ minutes' },
    { icon: '📊', name: 'Use 3 Assets', xp: '+20 XP', desc: 'Trade BTC, GOLD and SPX today' },
    { icon: '🎯', name: '+$500 in One Trade', xp: '+50 XP', desc: 'Hit $500 profit on a single trade' },
  ],
  position: [
    { icon: '🏔️', name: 'Strategic Entry', xp: '+30 XP', desc: 'Set SL & TP on every trade' },
    { icon: '💎', name: 'Low Frequency Day', xp: '+40 XP', desc: 'Max 3 trades, each must profit' },
    { icon: '📈', name: '$1,000 Daily P&L', xp: '+60 XP', desc: 'End the session up $1,000' },
  ],
  beginner: [
    { icon: '🎮', name: 'First Trade', xp: '+15 XP', desc: 'Open your first position' },
    { icon: '📖', name: 'Try All Assets', xp: '+20 XP', desc: 'Trade each of the 6 markets' },
    { icon: '✅', name: 'Close in Profit', xp: '+25 XP', desc: 'Close any position with a gain' },
  ],
};

const TYPE_CARDS = [
  { id: 'scalper', icon: '⚡', name: 'Scalper', desc: 'In and out fast. Dozens of trades per session targeting small, quick moves.' },
  { id: 'swing', icon: '🌊', name: 'Swing Trader', desc: 'Hold positions for hours. Ride momentum and catch bigger price swings.' },
  { id: 'position', icon: '🏔️', name: 'Position Trader', desc: 'Patience is your edge. Fewer, larger trades based on macro trends.' },
  { id: 'beginner', icon: '🎮', name: 'Just Exploring', desc: 'New to trading. Here to learn the basics through gameplay without the pressure.' },
];

const MISSION_TITLES = { scalper: 'Scalper Missions', swing: 'Swing Trader Missions', position: 'Position Trader Missions', beginner: 'Starter Missions' };
const MISSION_SUBS = {
  scalper: 'Fast in, fast out — rack up trades and XP',
  swing: 'Catch the wave — patience pays off',
  position: 'Think big, trade smart',
  beginner: 'Learn the ropes — every win counts',
};

const btnNext = {
  padding: '10px 28px', fontFamily: FONT_H, fontSize: '9px', letterSpacing: '1px',
  textTransform: 'uppercase', cursor: 'pointer', border: '2px solid #00eaff',
  background: 'transparent', color: '#00eaff',
};
const btnBack = {
  padding: '10px 20px', fontFamily: FONT_H, fontSize: '9px', letterSpacing: '.5px',
  textTransform: 'uppercase', cursor: 'pointer', border: '1px solid #1e1e44',
  background: 'transparent', color: '#445566',
};
const stepCount = { fontSize: '7px', color: '#fff', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '6px', textTransform: 'uppercase', fontFamily: FONT_H };
const eyebrow = { fontSize: '9px', color: '#ffe600', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px', fontFamily: FONT_H };

export default function Onboarding({ session, onRequestAuth, onComplete }) {
  const [step, setStep] = useState(0);
  const [traderType, setTraderType] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setStep(1), 1800);
    return () => clearTimeout(t);
  }, []);

  function next() { setStep(s => s + 1); }
  function back() { setStep(s => Math.max(1, s - 1)); }

  async function startTrial() {
    if (!session) { onRequestAuth(); return; }
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: MONTHLY_PRICE_ID,
          successUrl: `${window.location.origin}${window.location.pathname}?success=true`,
          cancelUrl: `${window.location.origin}${window.location.pathname}?success=false`,
        },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'No checkout URL returned');
      window.location.href = data.url;
    } catch (err) {
      setCheckoutError(err.message);
      setCheckingOut(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 5000, background: '#0a0a1a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT_B, color: '#c8d8e8', overflow: 'auto', padding: '20px',
    }}>
      {/* scanline overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.18) 3px,rgba(0,0,0,.18) 4px)',
      }} />

      {step >= 1 && step <= 4 && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 2 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              width: '8px', height: '8px', border: `2px solid ${i < step ? '#00ff88' : i === step ? '#ffe600' : '#1e1e44'}`,
              background: i < step ? '#00ff88' : i === step ? '#ffe600' : 'transparent',
              boxShadow: i === step ? '0 0 6px #ffe600' : 'none',
            }} />
          ))}
        </div>
      )}

      {/* ── STEP 0: BOOT ── */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', zIndex: 2 }}>
          <div style={{
            fontFamily: FONT_H, fontSize: 'clamp(20px,5vw,36px)', color: '#ffe600',
            textShadow: '0 0 16px #ffe60088', letterSpacing: '2px', textAlign: 'center', lineHeight: 1.3,
            animation: 'neonFlicker 2s infinite',
          }}>
            ⚔ CANDLE WARS<br />TRADING ARENA
          </div>
          <div style={{ fontSize: '11px', color: '#00eaff', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Paper Trade · Level Up · Compete
          </div>
          <div style={{ width: '280px', height: '6px', background: '#111128', border: '1px solid #1e1e44', overflow: 'hidden', marginTop: '18px' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg,#00ff88,#00eaff)', animation: 'bootFill 1.6s ease forwards' }} />
          </div>
          <div style={{ fontSize: '10px', color: '#fff', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
            INITIALIZING
          </div>
        </div>
      )}

      {/* ── STEP 1: WELCOME ── */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '640px', zIndex: 2 }}>
          <div style={stepCount}>Step 1 of 4</div>
          <div style={eyebrow}>Welcome, Trader</div>
          <h1 style={{ fontFamily: FONT_H, fontSize: 'clamp(20px,5vw,38px)', color: '#00ff88', textShadow: '0 0 16px #00ff8866', letterSpacing: '1px', lineHeight: 1.4, marginBottom: '20px' }}>
            The market<br />is a game.<br />Play it.
          </h1>
          <p style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold', lineHeight: 1.7, marginBottom: '32px' }}>
            CANDLE WARS is a real-time paper trading simulation where every trade earns XP,
            every win streak powers up your multiplier, and you compete against real players
            and AI for leaderboard glory — with zero real money at risk.
          </p>
          <button onClick={next} style={btnNext}>Continue →</button>
        </div>
      )}

      {/* ── STEP 2: HOW IT WORKS ── */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '800px', zIndex: 2 }}>
          <div style={stepCount}>Step 2 of 4</div>
          <div style={eyebrow}>How It Works</div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', margin: '10px 0 32px' }}>
            {[
              { icon: '📈', label: 'Trade', desc: 'Go Long or Short on BTC, GOLD, S&P 500, OIL, ETH & EUR/USD with live simulated prices. Set Stop Loss & Take Profit.' },
              { icon: '⚡', label: 'Level Up', desc: 'Every win earns XP. Build win streaks for fire multipliers. Complete daily quests. Climb 8 ranks from Market Peasant to Trading God.' },
              { icon: '⚔️', label: 'Compete', desc: 'Battle AI opponents and real players in live tournaments. Pro members enter cash prize pool competitions and climb ranked leaderboards.' },
            ].map(c => (
              <div key={c.label} style={{ flex: '1 1 200px', maxWidth: '230px', padding: '22px 18px', background: '#0f0f28', border: '1px solid #1e1e44', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div style={{ fontSize: '30px' }}>{c.icon}</div>
                <div style={{ fontFamily: FONT_H, fontSize: '9px', color: '#ffe600', letterSpacing: '1px' }}>{c.label}</div>
                <div style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold', lineHeight: 1.6 }}>{c.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={back} style={btnBack}>← Back</button>
            <button onClick={next} style={btnNext}>Continue →</button>
          </div>
        </div>
      )}

      {/* ── STEP 3: TRADER TYPE ── */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '800px', zIndex: 2 }}>
          <div style={stepCount}>Step 3 of 4</div>
          <div style={eyebrow}>Choose Your Style</div>
          <h2 style={{ fontFamily: FONT_H, fontSize: 'clamp(14px,3vw,22px)', color: '#00ff88', marginBottom: '8px' }}>
            What kind of trader are you?
          </h2>
          <p style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '20px' }}>
            Pick one — we'll set up your daily quests
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '28px' }}>
            {TYPE_CARDS.map(t => (
              <div key={t.id} onClick={() => setTraderType(t.id)} style={{
                flex: '1 1 160px', maxWidth: '185px', padding: '18px 14px', cursor: 'pointer',
                background: traderType === t.id ? '#1a1a2e' : '#0f0f28',
                border: `2px solid ${traderType === t.id ? '#ffe600' : '#1e1e44'}`,
                boxShadow: traderType === t.id ? '0 0 20px #ffe60033' : 'none',
                textAlign: 'center', transition: 'all .15s',
              }}>
                <div style={{ fontSize: '26px', marginBottom: '8px' }}>{t.icon}</div>
                <div style={{ fontFamily: FONT_H, fontSize: '9px', color: '#ffe600', letterSpacing: '1px', marginBottom: '6px' }}>{t.name}</div>
                <div style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', lineHeight: 1.5 }}>{t.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={back} style={btnBack}>← Back</button>
            <button onClick={next} disabled={!traderType} style={{ ...btnNext, opacity: traderType ? 1 : .4, pointerEvents: traderType ? 'auto' : 'none' }}>
              {traderType ? 'Continue →' : 'Select a Style →'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: MISSION BRIEF ── */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '520px', zIndex: 2 }}>
          <div style={stepCount}>Step 4 of 4</div>
          <div style={eyebrow}>Mission Briefing</div>
          <h2 style={{ fontFamily: FONT_H, fontSize: 'clamp(14px,3vw,22px)', color: '#00ff88', marginBottom: '8px' }}>
            {MISSION_TITLES[traderType || 'beginner']}
          </h2>
          <p style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '24px' }}>
            {MISSION_SUBS[traderType || 'beginner']}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginBottom: '28px' }}>
            {QUESTS[traderType || 'beginner'].map(q => (
              <div key={q.name} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', background: '#0f0f28', border: '1px solid #1e1e44', textAlign: 'left' }}>
                <div style={{ fontSize: '22px', flexShrink: 0 }}>{q.icon}</div>
                <div>
                  <div style={{ fontFamily: FONT_H, fontSize: '9px', color: '#c8d8e8', letterSpacing: '.5px', marginBottom: '4px' }}>{q.name}</div>
                  <div style={{ fontSize: '12px', color: '#ffe600' }}>{q.xp} · {q.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={back} style={btnBack}>← Back</button>
            <button onClick={next} style={{ ...btnNext, background: '#00eaff', color: '#0a0a1a' }}>See Plans →</button>
          </div>
        </div>
      )}

      {/* ── STEP 5: PLAN SELECT ── */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '760px', zIndex: 2 }}>
          <div style={eyebrow}>⚔ Choose Your Arena ⚔</div>
          <p style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '20px' }}>
            Start free · Upgrade anytime
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginBottom: '20px' }}>
            {/* Free */}
            <div style={{ flex: '1 1 280px', maxWidth: '320px', padding: '28px 24px', background: '#0f0f28', border: '2px solid #00ff88', textAlign: 'left' }}>
              <div style={{ fontFamily: FONT_H, fontSize: '9px', color: '#00ff88', letterSpacing: '1px', marginBottom: '8px' }}>Solo Trader — Free</div>
              <div style={{ fontSize: '28px', color: '#fff', marginBottom: '4px' }}>$0</div>
              <div style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '20px' }}>No credit card needed · forever free</div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px' }}>
                {[
                  ['✓', '#00ff88', 'Unlimited paper trading (solo)'],
                  ['✓', '#00ff88', '6 simulated assets — BTC, GOLD, SPX…'],
                  ['✓', '#00ff88', 'XP, 8 rank levels & daily quests'],
                  ['✓', '#00ff88', 'View global leaderboard'],
                ].map(([mark, col, text]) => (
                  <li key={text} style={{ fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #1e1e44', display: 'flex', gap: '8px', color: '#fff', fontWeight: 'bold' }}>
                    <span style={{ color: col }}>{mark}</span> {text}
                  </li>
                ))}
                {['Live competitions vs AI', 'PvP trading vs real users', 'Cash prize tournaments'].map(text => (
                  <li key={text} style={{ fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #1e1e44', display: 'flex', gap: '8px', color: '#556677', opacity: .6 }}>
                    <span>🔒</span> {text}
                  </li>
                ))}
              </ul>
              <button onClick={() => onComplete('free')} style={{
                width: '100%', padding: '13px', fontFamily: FONT_H, fontSize: '9px', letterSpacing: '1px',
                textTransform: 'uppercase', cursor: 'pointer', border: '2px solid #00ff88', background: 'transparent', color: '#00ff88', fontWeight: 'bold',
              }}>Start Solo Trading →</button>
              <div style={{ fontSize: '10px', color: '#fff', fontWeight: 'bold', textAlign: 'center', marginTop: '8px', textTransform: 'uppercase' }}>
                Paper trades only · no opponents · upgrade anytime
              </div>
            </div>

            {/* Pro / Trial */}
            <div style={{ flex: '1 1 280px', maxWidth: '320px', padding: '28px 24px', background: '#0f0f28', border: '2px solid #ffe600', textAlign: 'left', position: 'relative', animation: 'trialGlow 2s ease infinite' }}>
              <div style={{
                position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)',
                background: '#ffe600', color: '#0a0a1a', fontSize: '8px', padding: '3px 12px',
                letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: FONT_H,
              }}>🔥 7-Day Free Trial</div>
              <div style={{ fontFamily: FONT_H, fontSize: '9px', color: '#ffe600', letterSpacing: '1px', marginBottom: '8px' }}>Arena Pro — Compete Live</div>
              <div style={{ fontSize: '28px', color: '#fff', marginBottom: '4px' }}>$15.99<span style={{ fontSize: '12px', color: '#fff' }}>/mo</span></div>
              <div style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '20px' }}>after 7-day free trial · cancel anytime</div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px' }}>
                {[
                  'Everything in Solo (Free)',
                  'Trade LIVE vs our AI bot',
                  'PvP vs real users in real time',
                  'Enter cash prize pool tournaments',
                  'Ranked competitive leaderboard',
                  'Advanced analytics & trade replay',
                ].map(text => (
                  <li key={text} style={{ fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #1e1e44', display: 'flex', gap: '8px', color: '#fff', fontWeight: 'bold' }}>
                    <span style={{ color: '#ffe600' }}>★</span> {text}
                  </li>
                ))}
              </ul>
              {checkoutError && (
                <div style={{ fontSize: '10px', color: '#ff2d78', border: '1px solid #ff2d78', padding: '8px', marginBottom: '10px' }}>{checkoutError}</div>
              )}
              <button onClick={startTrial} disabled={checkingOut} style={{
                width: '100%', padding: '13px', fontFamily: FONT_H, fontSize: '10px', letterSpacing: '1px',
                textTransform: 'uppercase', cursor: checkingOut ? 'wait' : 'pointer', border: '2px solid #ffe600',
                background: '#ffe600', color: '#0a0a1a', fontWeight: 'bold',
              }}>
                {checkingOut ? 'LOADING…' : session ? 'Start 7-Day Free Trial →' : 'Log In to Start Trial →'}
              </button>
              <div style={{ fontSize: '10px', color: '#fff', fontWeight: 'bold', textAlign: 'center', marginTop: '8px', textTransform: 'uppercase' }}>
                No charge for 7 days · $15.99/mo after · cancel anytime
              </div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            🧪 Sandbox · Test card: <span style={{ color: '#00eaff' }}>4242 4242 4242 4242</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bootFill { from{width:0} to{width:100%} }
        @keyframes trialGlow { 0%,100%{box-shadow:0 0 0 2px #ffe600,0 0 20px #ffe60044} 50%{box-shadow:0 0 0 2px #ffe600,0 0 40px #ffe60088} }
      `}</style>
    </div>
  );
}
