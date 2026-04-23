import React from 'react';
import type { DeliveryStatus } from '../types';

const CONFIG: Record<DeliveryStatus, { icon: string; color: string; title: string }> = {
  sending:   { icon: '◷',  color: 'rgba(255,255,255,0.4)', title: 'Sending…'           },
  delivered: { icon: '✓✓', color: '#00d4ff',               title: 'Delivered via BLE'  },
  waiting:   { icon: '⏳', color: '#f59e0b',               title: 'Waiting for BLE'    },
  stored:    { icon: '📵', color: '#475569',               title: 'Stored offline'      },
};

export function DeliveryIcon({ status }: { status: DeliveryStatus }) {
  const { icon, color, title } = CONFIG[status];
  return (
    <span title={title} style={{ fontSize: 10, color, lineHeight: 1 }}>
      {icon}
    </span>
  );
}
