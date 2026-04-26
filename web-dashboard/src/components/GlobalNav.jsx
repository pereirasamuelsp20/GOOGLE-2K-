import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Map, User, LayoutDashboard, LogOut, AlertTriangle, Flame } from 'lucide-react';

export default function GlobalNav() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  if (location.pathname === '/' || location.pathname === '') {
    return null; // Don't show on Auth screen
  }

  const isActive = (path) => location.pathname === path;

  const getNavLinkStyle = (path) => ({
    ...navLinkStyle,
    background: isActive(path) ? 'rgba(204, 0, 0, 0.15)' : 'transparent',
    color: isActive(path) ? '#CC0000' : '#ccc',
    borderLeft: isActive(path) ? '3px solid #CC0000' : '3px solid transparent',
  });

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
              padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
              boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
              transform: 'translateX(0)', transition: 'transform 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: 'white', margin: 0, fontSize: 20, fontWeight: 700 }}>Menu</h2>
              <button 
                onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            <Link to="/sos" onClick={() => setIsOpen(false)} style={getNavLinkStyle('/sos')} id="nav-sos-core">
              <Flame size={20} /> SOS Core
            </Link>
            <Link to="/dashboard" onClick={() => setIsOpen(false)} style={getNavLinkStyle('/dashboard')}>
              <LayoutDashboard size={20} /> Dashboard
            </Link>
            <Link to="/map" onClick={() => setIsOpen(false)} style={getNavLinkStyle('/map')}>
              <Map size={20} /> Citizen Map
            </Link>
            <Link to="/report-issue" onClick={() => setIsOpen(false)} style={getNavLinkStyle('/report-issue')} id="nav-report-issue">
              <AlertTriangle size={20} /> Report an Issue
            </Link>
            
            <div style={{ margin: '16px 0', height: 1, backgroundColor: '#333' }} />
            
            <Link to="#" onClick={() => setIsOpen(false)} style={navLinkStyle}>
              <User size={20} /> Profile
            </Link>

            <div style={{ flex: 1 }} />
            
            <Link to="/" onClick={() => setIsOpen(false)} style={{...navLinkStyle, color: '#dc2626'}}>
              <LogOut size={20} /> Sign Out
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

const navLinkStyle = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 16px', borderRadius: 8,
  textDecoration: 'none', color: '#ccc',
  fontSize: 15, fontWeight: 500,
  transition: 'background 0.2s'
};
