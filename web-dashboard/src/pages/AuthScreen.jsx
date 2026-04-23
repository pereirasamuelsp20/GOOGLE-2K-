import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function AuthScreen() {
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Citizen');
  const [toastMessage, setToastMessage] = useState(null);
  const navigate = useNavigate();

  const handleSOSBypass = async () => {
    try {
      await signInAnonymously(auth);
      navigate('/dashboard');
    } catch (e) {
      console.error(e);
      navigate('/dashboard');
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Route based on what the user actually is. But for demo, just let them go to their dest
      // Admin -> /admin, Citizen -> /map
      setToastMessage("Welcome back to ReliefMesh!");
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (e) {
      alert("Sign in failed: " + e.message);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Create user doc if responder/admin for assignment logic
      if (role === 'Responder' || role === 'Admin' || role === 'Volunteer') {
        await setDoc(doc(db, 'responders', cred.user.uid), {
          name: fullName,
          email,
          role,
          available: true
        });
      }
      setToastMessage("Welcome! We're glad you joined ReliefMesh.");
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (e) {
      alert("Sign up failed: " + e.message);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setToastMessage("Welcome to ReliefMesh!");
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (e) {
      alert("Google Sign in failed: " + e.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="radial-glow" />

      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
        <div style={{
          width: 56, height: 56, backgroundColor: '#dc2626', borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
        }}>
          {/* Lightning Bolt SVG */}
          <svg width="28" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>ReliefMesh</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Emergency response, even when networks fail</p>

        <div className="mesh-badge">
          <div className="pulse-dot" />
          <span>MESH NETWORK ACTIVE</span>
        </div>
      </div>

      <div className="auth-card">
        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border-color)', padding: '16px 16px 0 16px' }}>
          <button
            onClick={() => setTab('signin')}
            style={{
              flex: 1, padding: '12px 0', border: 'none', background: 'transparent',
              borderBottom: tab === 'signin' ? '2px solid var(--primary-red)' : '2px solid transparent',
              color: tab === 'signin' ? 'white' : 'var(--text-muted)',
              fontWeight: 600, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => setTab('signup')}
            style={{
              flex: 1, padding: '12px 0', border: 'none', background: 'transparent',
              borderBottom: tab === 'signup' ? '2px solid var(--primary-red)' : '2px solid transparent',
              color: tab === 'signup' ? 'white' : 'var(--text-muted)',
              fontWeight: 600, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            Sign Up
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {tab === 'signin' ? (
            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slideUp 0.2s forwards ease' }}>
              <input type="email" placeholder="Your_Email@gmail.com" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>Sign in to ReliefMesh</button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0', gap: 12 }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              </div>

              <button type="button" onClick={handleGoogleSignIn} style={{
                background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 8, height: 48,
                color: 'white', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                Continue with Google
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slideUp 0.2s forwards ease' }}>
              <input type="text" placeholder="Name Surname" value={fullName} onChange={e => setFullName(e.target.value)} required />
              <input type="email" placeholder="Your_Email@gmail.com" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />

              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {['Citizen', 'Volunteer', 'Responder', 'Admin'].map(r => (
                  <button key={r} type="button" onClick={() => setRole(r)} style={{
                    padding: '8px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: '1px solid',
                    borderColor: role === r ? 'var(--primary-red)' : 'var(--border-color)',
                    background: role === r ? 'rgba(220,38,38,0.1)' : 'transparent',
                    color: role === r ? 'white' : 'var(--text-muted)', cursor: 'pointer'
                  }}>
                    {r}
                  </button>
                ))}
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>Create account</button>
            </form>
          )}
        </div>
      </div>

      <div style={{ marginTop: 32, zIndex: 1, textAlign: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>In an emergency? </span>
        <button
          onClick={handleSOSBypass}
          style={{ background: 'transparent', border: 'none', color: 'var(--primary-red)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Send SOS without login →
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 40, zIndex: 1 }}>
        {['Offline mesh', 'Live SOS', 'Safe routing'].map(chip => (
          <div key={chip} style={{
            padding: '6px 16px', borderRadius: 20, background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)', fontSize: 12, color: 'var(--text-muted)'
          }}>
            {chip}
          </div>
        ))}
      </div>

      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 40,
          background: 'var(--accent-green)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: 8,
          fontWeight: 600,
          zIndex: 1000,
          animation: 'slideDown 0.3s forwards ease',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {toastMessage}
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
