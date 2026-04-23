import React from 'react';

interface SignalBarsProps {
  rssi: number;
  color?: string;
  size?: 'sm' | 'md';
}

export function rssiToBars(rssi: number): number {
  if (rssi > -65) return 3;
  if (rssi > -78) return 2;
  if (rssi > -90) return 1;
  return 0;
}

export function SignalBars({ rssi, color = '#0ea5e9', size = 'md' }: SignalBarsProps) {
  const bars = rssiToBars(rssi);
  const heights = size === 'sm' ? [4, 7, 10] : [5, 8, 12];
  const widths  = size === 'sm' ? 2.5 : 3.5;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5 }}>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: widths,
            height: h,
            borderRadius: 2,
            background: i < bars ? color : '#334155',
            transition: 'background 0.3s',
          }}
        />
      ))}
    </div>
  );
}
