import { useState } from 'react';
import { supabase } from '../lib/supabase';

const FONT = "'Press Start 2P', monospace";

const inputStyle = {
  width: '100%', padding: '12px', background: '#111128', border: '2px solid #1e1e50',
  color: '#fff', fontFamily: 'inherit', fontSize: '11px', outline: 'none', boxSizing: 'border-box',
};

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username || email.split('@')[0] } },
        });
        if (error) throw error;
        if (data.session) {
          onClose();
        } else {
          setInfo('Account created! Check your email to confirm, then log in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(4,4,12,0.85)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380, background: '#0d0d1f', border: '2px solid #00eaff',
          boxShadow: '0 0 30px #00eaff44', padding: '28px 24px', fontFamily: FONT, color: '#fff',
          position: 'relative',
        }}
      >
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12, background: 'none', border: 'none',
          color: '#888', fontFamily: FONT, fontSize: '14px', cursor: 'pointer',
        }}>✕</button>

        <div style={{ fontSize: '13px', color: '#00eaff', textShadow: '0 0 10px #00eaff88', marginBottom: 20, textAlign: 'center' }}>
          {mode === 'signin' ? '⚔ LOG IN' : '⚔ CREATE ACCOUNT'}
        </div>

        <div style={{ display: 'flex', marginBottom: 20, border: '1px solid #1e1e50' }}>
          <button
            onClick={() => { setMode('signin'); setError(null); setInfo(null); }}
            style={{
              flex: 1, padding: '10px', background: mode === 'signin' ? '#00eaff22' : 'transparent',
              border: 'none', color: mode === 'signin' ? '#00eaff' : '#555', fontFamily: FONT,
              fontSize: '9px', cursor: 'pointer',
            }}
          >SIGN IN</button>
          <button
            onClick={() => { setMode('signup'); setError(null); setInfo(null); }}
            style={{
              flex: 1, padding: '10px', background: mode === 'signup' ? '#00ff8822' : 'transparent',
              border: 'none', color: mode === 'signup' ? '#00ff88' : '#555', fontFamily: FONT,
              fontSize: '9px', cursor: 'pointer',
            }}
          >SIGN UP</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'signup' && (
            <div>
              <label style={{ fontSize: '8px', color: '#888', display: 'block', marginBottom: 6 }}>USERNAME</label>
              <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="trader_99" autoComplete="username" />
            </div>
          )}
          <div>
            <label style={{ fontSize: '8px', color: '#888', display: 'block', marginBottom: 6 }}>EMAIL</label>
            <input style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email" />
          </div>
          <div>
            <label style={{ fontSize: '8px', color: '#888', display: 'block', marginBottom: 6 }}>PASSWORD</label>
            <input style={inputStyle} type="password" required minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </div>

          {error && <div style={{ fontSize: '8px', color: '#ff2d78', border: '1px solid #ff2d78', padding: '8px' }}>{error}</div>}
          {info && <div style={{ fontSize: '8px', color: '#00ff88', border: '1px solid #00ff88', padding: '8px' }}>{info}</div>}

          <button type="submit" disabled={loading} style={{
            padding: '14px', background: mode === 'signin' ? '#00eaff' : '#00ff88', border: 'none',
            color: '#0a0a1a', fontFamily: FONT, fontSize: '10px', cursor: loading ? 'wait' : 'pointer',
            letterSpacing: '1px', marginTop: 6,
          }}>
            {loading ? 'LOADING…' : mode === 'signin' ? 'LOG IN →' : 'CREATE ACCOUNT →'}
          </button>
        </form>
      </div>
    </div>
  );
}
