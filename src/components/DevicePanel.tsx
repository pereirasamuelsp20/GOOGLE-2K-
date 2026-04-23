import React from 'react';
import type { NearbyDevice } from '../types';
import { SignalBars } from './SignalBars';

const DOT_COLOR: Record<NearbyDevice['status'], string> = {
  connected: '#22c55e',
  weak:      '#f59e0b',
  searching: '#334155',
};

const STATUS_LABEL: Record<NearbyDevice['status'], string> = {
  connected: 'Connected',
  weak:      'Weak Signal',
  searching: 'Searching',
};

interface DevicePanelProps {
  devices: NearbyDevice[];
}

export function DevicePanel({ devices }: DevicePanelProps) {
  return (
    <div style={{
      background: '#060d1a',
      borderBottom: '1px solid #1a2540',
      padding: '10px 16px',
      animation: 'slideDown 0.25s ease both',
      flexShrink: 0,
    }}>
      <p style={{
        fontSize: 9.5, fontWeight: 900, color: '#475569',
        letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase',
      }}>
        Nearby Devices
      </p>

      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 2 }}>
        {devices.map(d => (
          <div key={d.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {/* Avatar */}
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: '#0a0f1e',
              border: `1.5px solid ${d.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 900, color: d.color,
              position: 'relative',
            }}>
              {d.status === 'searching'
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                : d.initials
              }
              {/* Status dot */}
              <div style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 9, height: 9, borderRadius: '50%',
                background: DOT_COLOR[d.status],
                border: '1.5px solid #060d1a',
              }} />
            </div>

            <SignalBars rssi={d.rssi} color={d.color} size="sm" />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#475569' }}>{d.initials}</span>
            <span style={{ fontSize: 8, fontWeight: 600, color: '#334155' }}>{STATUS_LABEL[d.status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
