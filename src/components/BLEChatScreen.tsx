import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BLEStatus, Message } from '../types';
import { INITIAL_MESSAGES, NEARBY_DEVICES, QUICK_LABELS } from '../constants';
import { Header } from './Header';
import { DevicePanel } from './DevicePanel';
import { MessageBubble } from './MessageBubble';
import { EmptyState } from './EmptyState';
import { QuickActionsBar } from './QuickActionsBar';
import { MessageInput } from './MessageInput';

let idCounter = 100;
function nextId() { return String(++idCounter); }
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function BLEChatScreen() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [bleStatus, setBleStatus] = useState<BLEStatus>('connected');
  const [devicePanelOpen, setDevicePanelOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll on new messages */
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const cycleStatus = useCallback(() => {
    setBleStatus(s => s === 'connected' ? 'searching' : s === 'searching' ? 'offline' : 'connected');
  }, []);

  const sendMessage = useCallback((text: string) => {
    const initialStatus = bleStatus === 'connected' ? 'sending' : bleStatus === 'searching' ? 'waiting' : 'stored';
    const id = nextId();
    const msg: Message = {
      id, sender: 'me', text, time: nowTime(),
      status: initialStatus, type: 'normal',
    };
    setMessages(prev => [...prev, msg]);

    /* Simulate delivery */
    if (bleStatus === 'connected') {
      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'delivered' } : m));
      }, 1100);
    }
  }, [bleStatus]);

  const sendQuickAction = useCallback((actionId: string) => {
    sendMessage(QUICK_LABELS[actionId] ?? actionId);
  }, [sendMessage]);

  const connectedCount = NEARBY_DEVICES.filter(d => d.status !== 'searching').length;

  return (
    <div style={{
      width: 390, height: 844,
      background: '#000',
      borderRadius: 48,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 0 0 1px #1a2540, 0 0 80px rgba(0,212,255,0.08), 0 40px 120px rgba(0,0,0,0.8)',
      position: 'relative',
    }}>

      {/* ── Status Bar ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 28px 0',
        color: '#e2e8f0', fontSize: 12, fontWeight: 700,
        flexShrink: 0,
      }}>
        <span>9:41</span>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: '#000', border: '2px solid #111',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Signal */}
          <svg width="17" height="12" viewBox="0 0 17 12" fill="#e2e8f0">
            <rect x="0"    y="8"   width="3" height="4"  rx="1"/>
            <rect x="4.5"  y="5.5" width="3" height="6.5" rx="1"/>
            <rect x="9"    y="2.5" width="3" height="9.5" rx="1"/>
            <rect x="13.5" y="0"   width="3" height="12"  rx="1"/>
          </svg>
          {/* WiFi-off */}
          <svg width="15" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <circle cx="12" cy="20" r="1" fill="#475569"/>
          </svg>
          {/* Battery */}
          <svg width="22" height="12" viewBox="0 0 22 12" fill="none" stroke="#e2e8f0" strokeWidth="1.4">
            <rect x="0.7" y="0.7" width="18" height="10.6" rx="2.5"/>
            <rect x="2"   y="2"   width="13" height="8" rx="1.5" fill="#e2e8f0" stroke="none"/>
            <path d="M19.5 4v4" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* ── Header ── */}
      <Header
        bleStatus={bleStatus}
        deviceCount={connectedCount}
        onCycleStatus={cycleStatus}
        onToggleDevices={() => setDevicePanelOpen(o => !o)}
        devicePanelOpen={devicePanelOpen}
      />

      {/* ── Connection Banner ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#050d1a',
        borderBottom: '1.5px solid #0ea5e9',
        padding: '8px 16px',
        flexShrink: 0,
        animation: 'slideDown 0.4s ease both',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#00d4ff', boxShadow: '0 0 8px #00d4ff',
          flexShrink: 0,
        }} />
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round">
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        </svg>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', flex: 1, letterSpacing: 0.2 }}>
          No Internet — BLE Messaging Active
        </span>
        <div style={{
          background: 'rgba(14,165,233,0.12)',
          border: '1px solid #0ea5e9',
          borderRadius: 5, padding: '2px 8px',
        }}>
          <span style={{ fontSize: 9.5, fontWeight: 900, color: '#0ea5e9', letterSpacing: 1.2 }}>BLE</span>
        </div>
      </div>

      {/* ── Device Panel ── */}
      {devicePanelOpen && <DevicePanel devices={NEARBY_DEVICES} />}

      {/* ── Chat Area ── */}
      <div
        ref={chatRef}
        style={{ flex: 1, overflowY: 'auto', padding: '14px 0 8px', scrollbarWidth: 'thin', scrollbarColor: '#1a2540 transparent' }}
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Date divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 20px 12px' }}>
              <div style={{ flex: 1, height: 1, background: '#1a2540' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: 0.5 }}>
                TODAY — EMERGENCY SESSION
              </span>
              <div style={{ flex: 1, height: 1, background: '#1a2540' }} />
            </div>

            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </>
        )}
      </div>

      {/* ── Quick Actions ── */}
      <QuickActionsBar onAction={sendQuickAction} />

      {/* ── Input ── */}
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
