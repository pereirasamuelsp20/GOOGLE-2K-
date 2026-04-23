import React from 'react';

export function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', padding: '40px 30px', gap: 14,
    }}>
      <div style={{
        width: 96, height: 96, borderRadius: '50%',
        background: 'rgba(14,165,233,0.08)',
        border: '1.5px solid rgba(14,165,233,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'emptyPulse 2.4s ease-in-out infinite',
      }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6.5 6.5 17.5 17.5"/>
          <polyline points="17.5 6.5 6.5 17.5"/>
          <polyline points="12 2 17.5 6.5 12 11 17.5 17.5 12 22"/>
        </svg>
      </div>

      <p style={{ fontSize: 16, fontWeight: 800, color: '#94a3b8', textAlign: 'center', margin: 0 }}>
        No nearby emergency messages
      </p>
      <p style={{ fontSize: 12.5, fontWeight: 500, color: '#475569', textAlign: 'center', lineHeight: 1.65, margin: 0 }}>
        Messages will appear when nearby users connect via BLE
      </p>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#0a0f1e', border: '1px solid #1a2540',
        borderRadius: 20, padding: '6px 14px', marginTop: 4,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#00d4ff',
          animation: 'scanPulse 1.4s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
          Scanning for devices…
        </span>
      </div>
    </div>
  );
}
