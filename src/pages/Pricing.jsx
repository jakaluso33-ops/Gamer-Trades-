import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MONTHLY_PRICE_ID, ANNUAL_PRICE_ID } from '../lib/pricing';

const FREE_FEATURES = [
  'Unlimited paper trading',
  '6 simulated assets (BTC, GOLD, SPX…)',
  'XP & leveling system',
  'Daily quests',
  'Basic leaderboard',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Live PvP trading competitions',
  'AI opponent battles',
  'Cash prize pool tournaments',
  'Advanced analytics & replay',
  'Priority support',
];

const style = document.createElement('style');
style.textContent = `
  @keyframes pricePulse { 0%,100%{box-shadow:0 0 12px #00ff88,0 0 24px #00ff8844} 50%{box-shadow:0 0 24px #00ff88,0 0 48px #00ff8866} }
  @keyframes proBorder  { 0%,100%{box-shadow:0 0 12px #ffe600,0 0 24px #ffe60044} 50%{box-shadow:0 0 28px #ffe600,0 0 56px #ffe60066} }
  @keyframes glitch { 0%,100%{text-shadow:2px 0 #ff2d78,-2px 0 #00eaff} 25%{text-shadow:-2px 0 #ff2d78,2px 0 #00eaff} 50%{text-shadow:0 0 #ff2d78,0 0 #00eaff} }
  @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { to{transform:rotate(360deg)} }
  .price-card-free  { animation: pricePulse 2s ease infinite; }
  .price-card-pro   { animation: proBorder 1.5s ease infinite; }
  .glitch-title     { animation: glitch 3s ease infinite; }
  .fade-up          { animation: fadeUp .5s ease forwards; }
`;
document.head.appendChild(style);

export default function Pricing({ onBack, session, onRequestAuth }) {
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setToast({ type: 'success', msg: '🎉 Payment successful! Welcome to Pro!' });
      setTimeout(() => setToast(null), 5000);
    }
  }, []);

  async function handleSubscribe(plan) {
    if (plan === 'free') { onBack(); return; }

    if (!session) {
      setToast({ type: 'error', msg: 'Log in first to subscribe.' });
      setTimeout(() => setToast(null), 5000);
      onRequestAuth?.();
      return;
    }

    setLoading(plan);
    const priceId = billing === 'monthly' ? MONTHLY_PRICE_ID : ANNUAL_PRICE_ID;

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId,
          successUrl: `${window.location.origin}${window.location.pathname}?success=true`,
          cancelUrl: `${window.location.origin}${window.location.pathname}#pricing`,
        },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'No checkout URL returned');
      window.location.href = data.url;
    } catch (err) {
      setToast({ type: 'error', msg: `Error: ${err.message}` });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLoading(null);
    }
  }

  const monthlyDisplay = billing === 'monthly' ? '$15.99' : '$13.33';
  const savingsTag = billing === 'annual' ? 'SAVE 17%' : null;

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a1a', color: '#fff',
      fontFamily: "'Press Start 2P', monospace",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 16px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Scanline */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.15) 2px,rgba(0,0,0,.15) 4px)',
      }} />

      {/* Back button */}
      <button onClick={onBack} style={{
        position: 'absolute', top: 20, left: 20, background: 'none',
        border: '2px solid #00eaff', color: '#00eaff', fontFamily: 'inherit',
        fontSize: '9px', padding: '8px 14px', cursor: 'pointer', zIndex: 10,
      }}>← BACK</button>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#00ff8822' : '#ff2d7822',
          border: `2px solid ${toast.type === 'success' ? '#00ff88' : '#ff2d78'}`,
          color: toast.type === 'success' ? '#00ff88' : '#ff2d78',
          padding: '12px 20px', fontSize: '9px', zIndex: 999,
          animation: 'fadeUp .3s ease',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40, zIndex: 1 }}>
        <div style={{ fontSize: '11px', color: '#ffe600', marginBottom: 8 }}>⚔ CHOOSE YOUR PLAN ⚔</div>
        <h1 className="glitch-title" style={{
          fontSize: 'clamp(18px, 4vw, 28px)', color: '#00ff88',
          letterSpacing: '2px', margin: '12px 0',
        }}>GAMER TRADES</h1>
        <div style={{ fontSize: '9px', color: '#888', marginTop: 8 }}>
          Paper trade. Compete. Dominate.
        </div>
      </div>

      {/* Billing toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40,
        background: '#111', border: '2px solid #333', padding: '8px 16px', zIndex: 1,
      }}>
        <span style={{ fontSize: '9px', color: billing === 'monthly' ? '#00ff88' : '#555' }}>MONTHLY</span>
        <div
          onClick={() => setBilling(b => b === 'monthly' ? 'annual' : 'monthly')}
          style={{
            width: 44, height: 22, background: billing === 'annual' ? '#ffe600' : '#333',
            borderRadius: 11, cursor: 'pointer', position: 'relative', transition: 'background .2s',
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: billing === 'annual' ? 25 : 3,
            width: 16, height: 16, background: '#0a0a1a', borderRadius: '50%',
            transition: 'left .2s',
          }} />
        </div>
        <span style={{ fontSize: '9px', color: billing === 'annual' ? '#ffe600' : '#555' }}>
          ANNUAL
          {billing === 'annual' && <span style={{ color: '#00ff88', marginLeft: 6 }}>♦ SAVE $32</span>}
        </span>
      </div>

      {/* Cards */}
      <div style={{
        display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center',
        zIndex: 1, width: '100%', maxWidth: 800,
      }}>
        {/* Free card */}
        <div className="price-card-free fade-up" style={{
          flex: '1 1 300px', maxWidth: 360,
          background: '#0d0d1f', border: '2px solid #00ff88',
          padding: '32px 28px', position: 'relative',
        }}>
          <div style={{ fontSize: '10px', color: '#00ff88', marginBottom: 8 }}>FREE PLAN</div>
          <div style={{ fontSize: '28px', color: '#fff', margin: '12px 0 4px' }}>$0</div>
          <div style={{ fontSize: '8px', color: '#555', marginBottom: 28 }}>forever</div>
          <ul style={{ listStyle: 'none', padding: 0, marginBottom: 32 }}>
            {FREE_FEATURES.map(f => (
              <li key={f} style={{
                fontSize: '8px', color: '#aaa', padding: '7px 0',
                borderBottom: '1px solid #1a1a2e',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ color: '#00ff88' }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <button onClick={() => handleSubscribe('free')} style={{
            width: '100%', padding: '14px', background: 'transparent',
            border: '2px solid #00ff88', color: '#00ff88', fontFamily: 'inherit',
            fontSize: '9px', cursor: 'pointer', letterSpacing: '1px',
          }}>
            PLAY FREE →
          </button>
        </div>

        {/* Pro card */}
        <div className="price-card-pro fade-up" style={{
          flex: '1 1 300px', maxWidth: 360,
          background: '#0d0d1f', border: '2px solid #ffe600',
          padding: '32px 28px', position: 'relative',
        }}>
          {/* Hot badge */}
          <div style={{
            position: 'absolute', top: -14, right: 20,
            background: '#ff2d78', color: '#fff', fontSize: '8px',
            padding: '4px 10px', letterSpacing: '1px',
          }}>🔥 MOST POPULAR</div>

          <div style={{ fontSize: '10px', color: '#ffe600', marginBottom: 8 }}>PRO PLAN</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, margin: '12px 0 4px' }}>
            <span style={{ fontSize: '28px', color: '#fff' }}>{monthlyDisplay}</span>
            <span style={{ fontSize: '9px', color: '#888', paddingBottom: 6 }}>/mo</span>
            {savingsTag && (
              <span style={{
                fontSize: '8px', background: '#00ff8822', color: '#00ff88',
                border: '1px solid #00ff88', padding: '2px 6px', marginLeft: 4, paddingBottom: 6,
              }}>{savingsTag}</span>
            )}
          </div>
          <div style={{ fontSize: '8px', color: '#555', marginBottom: 28 }}>
            {billing === 'annual' ? 'billed $159.99 annually' : 'billed monthly'}
          </div>

          <ul style={{ listStyle: 'none', padding: 0, marginBottom: 32 }}>
            {PRO_FEATURES.map(f => (
              <li key={f} style={{
                fontSize: '8px', color: '#ddd', padding: '7px 0',
                borderBottom: '1px solid #1a1a2e',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ color: '#ffe600' }}>★</span> {f}
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleSubscribe('pro')}
            disabled={!!loading}
            style={{
              width: '100%', padding: '14px',
              background: loading === 'pro' ? '#333' : '#ffe600',
              border: '2px solid #ffe600',
              color: loading === 'pro' ? '#ffe600' : '#0a0a1a',
              fontFamily: 'inherit', fontSize: '9px', cursor: loading ? 'wait' : 'pointer',
              letterSpacing: '1px', fontWeight: 'bold',
            }}
          >
            {loading === 'pro'
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #ffe600', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                  LOADING…
                </span>
              : 'GO PRO →'}
          </button>

          <div style={{ textAlign: 'center', fontSize: '7px', color: '#555', marginTop: 12 }}>
            Cancel anytime · No contracts
          </div>
        </div>
      </div>

      {/* Sandbox note */}
      <div style={{
        marginTop: 48, padding: '14px 20px', border: '1px solid #333',
        fontSize: '7px', color: '#555', maxWidth: 600, textAlign: 'center', zIndex: 1,
      }}>
        🧪 SANDBOX MODE — Use Stripe test card: <span style={{ color: '#00eaff' }}>4242 4242 4242 4242</span> · Any future date · Any CVC
      </div>

      {/* Feature comparison */}
      <div style={{ marginTop: 48, width: '100%', maxWidth: 600, zIndex: 1 }}>
        <div style={{ fontSize: '10px', color: '#ffe600', textAlign: 'center', marginBottom: 20 }}>
          ⚔ BATTLE FEATURES ⚔
        </div>
        {[
          ['Paper Trading', '✓', '✓'],
          ['Asset Pairs', '6', '6 + more coming'],
          ['Competitions', '✗', '✓'],
          ['AI Opponents', '✗', '✓'],
          ['Prize Pools', '✗', '✓'],
          ['Leaderboard', 'Global', 'Global + Pro-only'],
          ['Analytics', 'Basic', 'Advanced'],
          ['Support', 'Community', 'Priority'],
        ].map(([feat, free, pro]) => (
          <div key={feat} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            padding: '10px 0', borderBottom: '1px solid #1a1a2e', fontSize: '8px',
          }}>
            <span style={{ color: '#888' }}>{feat}</span>
            <span style={{ color: free === '✗' ? '#333' : '#00ff88', textAlign: 'center' }}>{free}</span>
            <span style={{ color: pro === '✗' ? '#333' : '#ffe600', textAlign: 'center' }}>{pro}</span>
          </div>
        ))}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          padding: '6px 0', fontSize: '7px',
        }}>
          <span />
          <span style={{ color: '#00ff88', textAlign: 'center' }}>FREE</span>
          <span style={{ color: '#ffe600', textAlign: 'center' }}>PRO</span>
        </div>
      </div>
    </div>
  );
}
