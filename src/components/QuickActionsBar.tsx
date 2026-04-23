import React from 'react';
import { QUICK_ACTIONS } from '../constants';

const ICONS: Record<string, string> = {
  help:     'M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  safe:     'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  medical:  'M12 5v14M5 12h14',
  fire:     'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  location: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
};

interface QuickActionsBarProps {
  onAction: (id: string) => void;
}

export function QuickActionsBar({ onAction }: QuickActionsBarProps) {
  return (
    <div style={{
      background: '#060d1a',
      borderTop: '1px solid #1a2540',
      padding: '9px 0',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto',
        padding: '0 12px',
        scrollbarWidth: 'none',
      }}>
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.id}
            onClick={() => onAction(a.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#0a0f1e',
              border: `1px solid ${a.color}`,
              borderRadius: 20,
              padding: '6px 12px',
              cursor: 'pointer',
              flexShrink: 0,
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.25)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.filter = 'none';
              (e.currentTarget as HTMLButtonElement).style.transform = 'none';
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICONS[a.id]} />
            </svg>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: a.color, whiteSpace: 'nowrap' }}>
              {a.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
