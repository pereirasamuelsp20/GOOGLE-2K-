import React from 'react';
import type { BLEStatus } from '../types';
import { STATUS_CONFIG } from '../constants';
import { SignalBars } from './SignalBars';

interface HeaderProps {
  bleStatus: BLEStatus;
  deviceCount: number;
  onCycleStatus: () => void;
  onToggleDevices: () => void;
  devicePanelOpen: boolean;
}

export function Header({ bleStatus, deviceCount, onCycleStatus, onToggleDevices, devicePanelOpen }: HeaderProps) {
  const { text, color, bars } = STATUS_CONFIG[bleStatus];
  const rssiMap = { connected: -55, searching: -80, offline: -100 };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px',
      background: '#000',
      borderBottom: '1px solid #1a2540',
      flexShrink: 0,
    }}>
      {/* Left: BLE icon + title + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
        {/* BLE icon with pulse ring */}
        <div style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: 'rgba(14,165,233,0.12)',
          border: '1px solid rgba(14,165,233,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: -4, borderRadius: 16,
            border: '1.5px solid rgba(0,212,255,0.35)',
            animation: 'pulseRing 2s ease-out infinite',
          }} />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6.5 6.5 17.5 17.5"/>
            <polyline points="17.5 6.5 6.5 17.5"/>
            <polyline points="12 2 17.5 6.5 12 11 17.5 17.5 12 22"/>
          </svg>
        </div>

        {/* Title + status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: 0.2 }}>
            Offline Emergency Chat
          </p>
          <button
            onClick={onCycleStatus}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', marginTop: 2,
            }}
            title="Click to cycle BLE status"
          >
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: color, boxShadow: `0 0 6px ${color}`,
              animation: 'blink 2s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 10.5, fontWeight: 600, color, letterSpacing: 0.1 }}>
              {text}
            </span>
          </button>
        </div>
      </div>

      {/* Right: signal + device toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SignalBars rssi={rssiMap[bleStatus]} />
        <button
          onClick={onToggleDevices}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: '#0a0f1e',
            border: `1px solid ${devicePanelOpen ? '#0ea5e9' : '#1a2540'}`,
            borderRadius: 20, padding: '5px 10px',
            cursor: 'pointer', transition: 'border-color 0.2s',
          }}
          title="Toggle nearby devices"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="8" r="4"/>
            <circle cx="4" cy="18" r="2"/>
            <circle cx="20" cy="18" r="2"/>
            <path d="M12 12v2M5.5 17L12 14M18.5 17L12 14"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#0ea5e9' }}>{deviceCount}</span>
        </button>
      </div>
    </div>
  );
}
