import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Map, User, LayoutDashboard, LogOut, AlertTriangle, Flame, Radio, Bell, Users, Shield, Truck, MessageCircle } from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function GlobalNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');
  const location = useLocation();

  // Listen for auth state + user role
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user || user.isAnonymous) {
        setUserRole('Citizen');
        setUserName(user ? 'Anonymous' : '');
        return;
      }
      // Real-time listener on user doc
      const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUserRole(data.role || 'Citizen');
          setUserName(data.displayName || user.displayName || user.email?.split('@')[0] || '');
        } else {
          setUserRole('Citizen');
          setUserName(user.displayName || user.email?.split('@')[0] || '');
        }
      });
      return () => unsubUser();
    });
    return () => unsubAuth();
  }, []);

  // Hide nav when not authenticated (auth screen is showing)
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    return null;
  }

  if (location.pathname === '/' || location.pathname === '') {
    return null;
  }

  const isActive = (path) => location.pathname === path;

  const getNavLinkStyle = (path) => ({
    ...navLinkStyle,
    background: isActive(path) ? 'rgba(204, 0, 0, 0.15)' : 'transparent',
    color: isActive(path) ? '#CC0000' : '#ccc',
    borderLeft: isActive(path) ? '3px solid #CC0000' : '3px solid transparent',
  });

  const isAdmin = userRole === 'Admin';

  // Admin-specific nav items (the admin console features as primary)
  const adminNavItems = [
    { path: '/admin', label: 'Overview', icon: LayoutDashboard },
    { path: '/admin/users', label: 'User Management', icon: Users },
    { path: '/admin/mesh-map', label: 'Mesh Map', icon: Map },
    { path: '/admin/live-sos', label: 'Live SOS', icon: Radio },
    { path: '/admin/announcements', label: 'Announcements', icon: Bell },
    { path: '/admin/volunteers', label: 'Volunteers', icon: Users },
    { path: '/admin/teams', label: 'Teams', icon: Truck },
    { path: '/admin/community', label: 'Community', icon: Radio },
  ];

  // Role badge color
  const roleColors = { Admin: '#dc2626', Responder: '#3b82f6', Volunteer: '#f59e0b', Citizen: '#22c55e' };
  const rc = roleColors[userRole] || '#6b7280';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          zIndex: 9999,
          background: 'rgba(20,20,20,0.8)',
          border: '1px solid #333',
          padding: 10,
          borderRadius: 8,
          color: 'white',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)'
        }}
      >
        <Menu size={24} />
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000
        }} onClick={() => setIsOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, width: 280,
              background: '#111', borderRight: '1px solid #333',
              padding: 24, display: 'flex', flexDirection: 'column', gap: 8,
              boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
              transform: 'translateX(0)', transition: 'transform 0.3s ease'
            }}
          >
            {/* Header with user info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ color: 'white', margin: 0, fontSize: 20, fontWeight: 700 }}>ReliefMesh</h2>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* User identity pill */}
            {userName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: rc + '22', border: `2px solid ${rc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: rc, fontWeight: 800, fontSize: 14 }}>{(userName || '?').charAt(0).toUpperCase()}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
                  <div style={{ display: 'inline-block', marginTop: 2, padding: '1px 8px', borderRadius: 8, background: rc + '18', border: `1px solid ${rc}`, color: rc, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{userRole}</div>
                </div>
              </div>
            )}

            {isAdmin ? (
              <>
                {/* Admin Console section label */}
                <div style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, padding: '4px 16px 8px', textTransform: 'uppercase' }}>Admin Console</div>

                {adminNavItems.map(item => {
                  const active = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
                  const Icon = item.icon;
                  return (
                    <Link key={item.path} to={item.path} onClick={() => setIsOpen(false)} style={{
                      ...navLinkStyle,
                      background: active ? 'rgba(204, 0, 0, 0.15)' : 'transparent',
                      color: active ? '#CC0000' : '#ccc',
                      borderLeft: active ? '3px solid #CC0000' : '3px solid transparent',
                    }}>
                      <Icon size={18} /> {item.label}
                    </Link>
                  );
                })}

                <div style={{ margin: '12px 0', height: 1, backgroundColor: '#333' }} />

                <Link to="/profile" onClick={() => setIsOpen(false)} style={getNavLinkStyle('/profile')}>
                  <User size={20} /> Profile
                </Link>
              </>
            ) : (
              <>
                {/* Regular citizen / volunteer / responder menu */}
                <Link to="/sos" onClick={() => setIsOpen(false)} style={getNavLinkStyle('/sos')} id="nav-sos-core">
                  <Flame size={20} /> SOS Core
                </Link>
                <Link to="/dashboard" onClick={() => setIsOpen(false)} style={getNavLinkStyle('/dashboard')}>
                  <LayoutDashboard size={20} /> Dashboard
                </Link>
                <Link to="/map" onClick={() => setIsOpen(false)} style={getNavLinkStyle('/map')}>
                  <Map size={20} /> Citizen Map
                </Link>
                <Link to="/community" onClick={() => setIsOpen(false)} style={getNavLinkStyle('/community')}>
                  <MessageCircle size={20} /> Community Feed
                </Link>
                <Link to="/report-issue" onClick={() => setIsOpen(false)} style={getNavLinkStyle('/report-issue')} id="nav-report-issue">
                  <AlertTriangle size={20} /> Report an Issue
                </Link>

                <div style={{ margin: '12px 0', height: 1, backgroundColor: '#333' }} />

                <Link to="/profile" onClick={() => setIsOpen(false)} style={getNavLinkStyle('/profile')}>
                  <User size={20} /> Profile
                </Link>

                <Link to="/admin" onClick={() => setIsOpen(false)} style={{ ...getNavLinkStyle('/admin'), border: '1px solid rgba(220,38,38,0.2)', marginTop: 8 }}>
                  <LayoutDashboard size={20} /> Admin Console
                </Link>
              </>
            )}

            <div style={{ flex: 1 }} />

            <button
              onClick={async () => {
                setIsOpen(false);
                await signOut(auth);
                window.location.href = '/admin';
              }}
              style={{ ...navLinkStyle, color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', width: '100%' }}
            >
              <LogOut size={20} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const navLinkStyle = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '11px 16px', borderRadius: 8,
  textDecoration: 'none', color: '#ccc',
  fontSize: 14, fontWeight: 500,
  transition: 'background 0.2s'
};
