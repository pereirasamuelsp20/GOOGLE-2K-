import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function AuthScreen() {
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }
  const navigate = useNavigate();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Sign In: only admins get through ──
  // Primary admin email — auto-bootstrapped on first login
  const PRIMARY_ADMIN = 'admin@gmail.com';

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, 'users', cred.user.uid);
      const userDoc = await getDoc(userRef);

      // Bootstrap: if this is the primary admin, ensure they have Admin role in Firestore
      if (cred.user.email?.toLowerCase() === PRIMARY_ADMIN) {
        if (!userDoc.exists() || userDoc.data().role !== 'Admin') {
          await setDoc(userRef, {
            displayName: 'Admin',
            email: cred.user.email,
            role: 'Admin',
            createdAt: new Date(),
          }, { merge: true });
        }
        showToast('Welcome back, Admin!');
        setTimeout(() => navigate('/admin'), 1200);
      } else if (userDoc.exists() && userDoc.data().role === 'Admin') {
        showToast('Welcome back, Admin!');
        setTimeout(() => navigate('/admin'), 1200);
      } else {
        await signOut(auth);
        showToast('Access denied. Only administrators can access this dashboard.', 'error');
      }
    } catch (e) {
      showToast('Sign in failed: ' + e.message, 'error');
    }
    setLoading(false);
  };

  // ── Sign Up: creates a pending admin request ──
  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        displayName: fullName,
        email,
        role: 'Pending',
        createdAt: new Date(),
      }, { merge: true });
      // Sign out immediately — they can't access dashboard until approved
      await signOut(auth);
      showToast('Request submitted! An existing admin will review your request.', 'info');
      setEmail('');
      setPassword('');
      setFullName('');
    } catch (e) {
      showToast('Sign up failed: ' + e.message, 'error');
    }
    setLoading(false);
  };

  // ── Google Sign In: check admin role ──
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      if (userDoc.exists() && userDoc.data().role === 'Admin') {
        showToast('Welcome back, Admin!');
        setTimeout(() => navigate('/admin'), 1200);
      } else if (userDoc.exists()) {
        // Existing non-admin user
        await signOut(auth);
        showToast('Access denied. Your admin request is still pending review.', 'error');
      } else {
        // First-time Google sign-in — create pending request
        await setDoc(doc(db, 'users', cred.user.uid), {
          displayName: cred.user.displayName || cred.user.email?.split('@')[0] || 'User',
          email: cred.user.email,
          role: 'Pending',
          createdAt: new Date(),
        }, { merge: true });
        await signOut(auth);
        showToast('Request submitted! An existing admin will review your request.', 'info');
      }
    } catch (e) {
      showToast('Google Sign in failed: ' + e.message, 'error');
    }
    setLoading(false);
  };

  const toastColors = { success: 'var(--accent-green)', error: '#dc2626', info: '#3b82f6' };

  return (
    <div className="auth-container">
      <div className="radial-glow" />

      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
        <div style={{
          width: 56, height: 56, backgroundColor: '#dc2626', borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
        }}>
          <svg width="28" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>ReliefMesh</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Admin Control Panel</p>

        <div className="mesh-badge">
          <div className="pulse-dot" />
          <span>ADMIN ACCESS ONLY</span>
        </div>
      </div>

      <div className="auth-card">
        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border-color)', padding: '16px 16px 0 16px' }}>
          <button onClick={() => setTab('signin')} style={{
            flex: 1, padding: '12px 0', border: 'none', background: 'transparent',
            borderBottom: tab === 'signin' ? '2px solid var(--primary-red)' : '2px solid transparent',
            color: tab === 'signin' ? 'white' : 'var(--text-muted)',
            fontWeight: 600, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s ease'
          }}>
            Admin Sign In
          </button>
          <button onClick={() => setTab('signup')} style={{
            flex: 1, padding: '12px 0', border: 'none', background: 'transparent',
            borderBottom: tab === 'signup' ? '2px solid var(--primary-red)' : '2px solid transparent',
            color: tab === 'signup' ? 'white' : 'var(--text-muted)',
            fontWeight: 600, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s ease'
          }}>
            Request Access
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {tab === 'signin' ? (
            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slideUp 0.2s forwards ease' }}>
              <input type="email" placeholder="Admin email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} />
              <button type="submit" className="btn-primary" style={{ marginTop: 8, opacity: loading ? 0.6 : 1 }} disabled={loading}>
                {loading ? 'Verifying...' : 'Sign in as Admin'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0', gap: 12 }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              </div>

              <button type="button" onClick={handleGoogleSignIn} disabled={loading} style={{
                background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 8, height: 48,
                color: 'white', fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: loading ? 0.6 : 1
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                Continue with Google
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slideUp 0.2s forwards ease' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                Submit a request to become an admin. An existing administrator will review and approve or decline your request.
              </p>
              <input type="text" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} required disabled={loading} />
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
              <input type="password" placeholder="Password (min 6 characters)" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} />
              <button type="submit" className="btn-primary" style={{ marginTop: 8, opacity: loading ? 0.6 : 1 }} disabled={loading}>
                {loading ? 'Submitting...' : 'Request Admin Access'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 40, zIndex: 1 }}>
        {['Restricted Access', 'Admin Only', 'Secure Login'].map(chip => (
          <div key={chip} style={{
            padding: '6px 16px', borderRadius: 20, background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)', fontSize: 12, color: 'var(--text-muted)'
          }}>
            {chip}
          </div>
        ))}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', top: 40, left: '50%', transform: 'translateX(-50%)',
          background: toastColors[toast.type] || toastColors.success,
          color: 'white', padding: '12px 24px', borderRadius: 8, fontWeight: 600,
          zIndex: 1000, animation: 'slideDown 0.3s forwards ease',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', maxWidth: '90vw', textAlign: 'center', fontSize: 14,
        }}>
          {toast.message}
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
