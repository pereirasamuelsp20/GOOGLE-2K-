import React, { useEffect, useRef } from 'react';

export function BLEPulse({ size = 8 }: { size?: number }) {
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ringRef.current;
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetHeight; // reflow
    el.style.animation = '';
  }, []);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        ref={ringRef}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: '#00d4ff',
          animation: 'blePulse 1.6s ease-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: '#00d4ff',
        }}
      />
    </div>
  );
}
