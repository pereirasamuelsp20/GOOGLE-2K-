import React from 'react';
import type { Message } from '../types';
import { EMERGENCY_META } from '../constants';
import { DeliveryIcon } from './DeliveryIcon';

interface MessageBubbleProps {
  msg: Message;
}

export function MessageBubble({ msg }: MessageBubbleProps) {
  const isMe = msg.sender === 'me';
  const meta = msg.emergencyType ? EMERGENCY_META[msg.emergencyType] : null;

  return (
    <div
      className="msg-row"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMe ? 'flex-end' : 'flex-start',
        marginBottom: 12,
        padding: '0 16px',
        animation: 'msgFadeIn 0.3s ease both',
      }}
    >
      {/* Sender name */}
      {!isMe && msg.senderName && (
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: '#0ea5e9',
          marginBottom: 4, marginLeft: 4, letterSpacing: 0.2,
        }}>
          {msg.senderName}
        </span>
      )}

      {/* Emergency badge */}
      {meta && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: meta.glowColor,
          border: `1px solid ${meta.borderColor}`,
          borderRadius: 8, padding: '5px 10px',
          marginBottom: 5, maxWidth: '92%',
          fontSize: 11.5, fontWeight: 800, color: '#e2e8f0',
        }}>
          {meta.emoji}&nbsp;{meta.label}
        </div>
      )}

      {/* Bubble */}
      <div style={{
        maxWidth: '84%',
        borderRadius: 18,
        ...(isMe
          ? { borderBottomRightRadius: 4, background: '#1a3a6e', border: `1px solid #3b82f6` }
          : { borderBottomLeftRadius:  4, background: '#0a0f1e', border: `1px solid #1a2540` }
        ),
        ...(meta ? {
          border: `1.5px solid ${meta.borderColor}`,
          boxShadow: `0 0 16px ${meta.glowColor}`,
        } : {}),
        padding: '10px 14px',
      }}>
        <p style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.55, color: '#e2e8f0', margin: 0 }}>
          {msg.text}
        </p>

        {/* Location chip */}
        {msg.hasLocation && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(14,165,233,0.08)',
            border: '1px solid rgba(14,165,233,0.25)',
            borderRadius: 8, padding: '4px 8px', marginTop: 7,
            cursor: 'pointer',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#0ea5e9' }}>Tap to view location</span>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 5 }}>
          <span style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(148,163,184,0.6)' }}>{msg.time}</span>
          {isMe && <DeliveryIcon status={msg.status} />}
        </div>
      </div>
    </div>
  );
}
