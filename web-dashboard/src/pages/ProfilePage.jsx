import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Shield, Edit3, LogOut, Star, Users, Phone, Clock } from 'lucide-react';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [user, setUser] = useState(null);
  const [isAnon, setIsAnon] = useState(true);
  const navigate = useNavigate();

  // Listen for auth state then subscribe to user doc
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (!authUser) {
        setIsAnon(true);
        setProfile({ displayName: 'Not signed in', role: 'Citizen' });
        setLoading(false);
        return;
      }

      const anonymous = authUser.isAnonymous;
      setIsAnon(anonymous);

      if (anonymous) {
        setProfile({ displayName: 'Anonymous Citizen', role: 'Citizen' });
        setLoading(false);
        return;
      }

      // Real-time listener on user doc — picks up name/role changes instantly
      const unsubUser = onSnapshot(doc(db, 'users', authUser.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          setEditName(data.displayName || '');
        } else {
          // Firestore doc doesn't exist yet — use auth profile
          const fb = {
            displayName: authUser.displayName || authUser.email?.split('@')[0] || 'User',
            email: authUser.email,
            role: 'Citizen'
          };
          setProfile(fb);
          setEditName(fb.displayName);
        }
        setLoading(false);
      });

      return () => unsubUser();
    });
    return () => unsubAuth();
  }, []);

  const handleSave = async () => {
    if (!editName.trim() || isAnon || !user) return;
    const trimmed = editName.trim();
    // Update Firestore user doc
    await setDoc(doc(db, 'users', user.uid), { displayName: trimmed }, { merge: true });
    // Also update Firebase Auth profile so name persists across logins
    try {
      await updateProfile(user, { displayName: trimmed });
    } catch (e) {
      console.warn('Auth displayName update failed (non-fatal):', e.message);
    }
    setProfile(p => ({ ...p, displayName: trimmed }));
    setEditing(false);
  };

  const handleSignOut = () => {
    auth.signOut();
    navigate('/');
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div style={{ color: '#888' }}>Loading...</div></div>;

  const displayName = profile?.displayName || 'User';
  const initials = displayName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const roleColors = { Admin: '#dc2626', Responder: '#3b82f6', Volunteer: '#f59e0b', Citizen: '#22c55e' };
  const rc = roleColors[profile?.role] || '#6b7280';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', justifyContent: 'center', padding: '80px 20px 40px' }}>
      <div style={{ maxWidth: 500, width: '100%' }}>
        {isAnon && (
          <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#fbbf24', fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 14 }}>Anonymous Session</div>
              <div style={{ color: '#aaa', fontSize: 12 }}>Sign in to unlock all features</div>
            </div>
          </div>
        )}

        {/* Avatar */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 90, height: 90, borderRadius: 45, background: '#1a1a2e', border: `3px solid ${rc}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
          }}>
            <span style={{ color: 'white', fontSize: 32, fontWeight: 900 }}>{initials}</span>
          </div>
          <div>
            {editing ? (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, color: 'white', padding: '8px 14px', fontSize: 16, width: 200 }} autoFocus />
                <button onClick={handleSave} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Save</button>
                <button onClick={() => setEditing(false)} style={{ background: 'none', border: '1px solid #333', color: '#888', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0 }}>{displayName}</h2>
                {!isAnon && <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><Edit3 size={14} /></button>}
              </div>
            )}
            <div style={{ display: 'inline-block', marginTop: 10, padding: '4px 14px', borderRadius: 16, border: `1px solid ${rc}`, background: rc + '18', color: rc, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              {profile?.role || 'Citizen'}
            </div>
          </div>
        </div>

        {/* Info */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
          {[
            { icon: User, label: 'User ID', value: isAnon ? 'Anonymous' : user?.uid?.substring(0, 20) + '...' },
            { icon: Mail, label: 'Email', value: isAnon ? 'Not available' : (profile?.email || user?.email || 'Not set') },
            { icon: Phone, label: 'Phone', value: isAnon ? 'Not available' : (profile?.phone || 'Not set') },
            { icon: Shield, label: 'Account Type', value: isAnon ? 'Anonymous Session' : 'Registered Member' },
            { icon: Clock, label: 'Member Since', value: isAnon ? 'N/A' : (profile?.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : (user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown')) },
            ...(profile?.teamId ? [{ icon: Users, label: 'Team', value: profile.teamId.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }] : []),
            ...(profile?.teamRole ? [{ icon: Star, label: 'Team Role', value: profile.teamRole }] : []),
          ].map((item, i, arr) => (
            <div key={item.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <item.icon size={16} color="#888" />
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ color: '#e0e0e0', fontSize: 14 }}>{item.value}</div>
                </div>
              </div>
              {i < arr.length - 1 && <div style={{ height: 1, background: '#1a1a2e', marginLeft: 66 }} />}
            </div>
          ))}
        </div>

        {/* Actions */}
        {isAnon && (
          <button onClick={() => navigate('/')} style={{
            width: '100%', background: '#dc2626', color: 'white', border: 'none',
            padding: 16, borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: 15, marginBottom: 12
          }}>
            Create Account / Sign In
          </button>
        )}
        <button onClick={handleSignOut} style={{
          width: '100%', background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.2)',
          color: '#FF3B30', padding: 16, borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
        }}>
          <LogOut size={16} /> Sign Out Securely
        </button>
      </div>
    </div>
  );
}
