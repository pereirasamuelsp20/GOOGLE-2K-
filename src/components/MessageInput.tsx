import React, { useRef, useState } from 'react';

interface MessageInputProps {
  onSend: (text: string) => void;
}

export function MessageInput({ onSend }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = value.trim().length > 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 8,
      padding: '10px 12px 22px',
      background: '#000',
      borderTop: '1px solid #1a2540',
      flexShrink: 0,
    }}>
      {/* Attach */}
      <button style={{
        width: 40, height: 40, borderRadius: 20, flexShrink: 0,
        background: '#0a0f1e', border: '1px solid #1a2540',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'border-color 0.2s',
      }}
        title="Attach file"
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#475569')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a2540')}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>
      </button>

      {/* Input wrapper */}
      <div style={{ flex: 1, position: 'relative' }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKey}
          placeholder="Send nearby emergency message…"
          maxLength={300}
          rows={1}
          style={{
            width: '100%',
            minHeight: 40, maxHeight: 100,
            background: '#0a0f1e',
            color: '#e2e8f0',
            border: `1px solid ${canSend ? '#0ea5e9' : '#1a2540'}`,
            borderRadius: 22,
            padding: '10px 40px 10px 16px',
            fontSize: 13.5, fontWeight: 500,
            fontFamily: 'inherit',
            resize: 'none', outline: 'none',
            lineHeight: 1.45,
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
        />
        {/* BLE indicator inside input */}
        <div style={{
          position: 'absolute', right: 10, bottom: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} title="Sending via BLE">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity={0.7}>
            <polyline points="6.5 6.5 17.5 17.5"/>
            <polyline points="17.5 6.5 6.5 17.5"/>
            <polyline points="12 2 17.5 6.5 12 11 17.5 17.5 12 22"/>
          </svg>
        </div>
      </div>

      {/* Send button */}
      <button
        onClick={submit}
        disabled={!canSend}
        style={{
          width: 40, height: 40, borderRadius: 20, flexShrink: 0,
          background: canSend ? '#3b82f6' : '#0a0f1e',
          border: canSend ? 'none' : '1px solid #1a2540',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: canSend ? 'pointer' : 'default',
          boxShadow: canSend ? '0 0 18px rgba(59,130,246,0.45)' : 'none',
          transition: 'all 0.15s ease',
        }}
        title="Send message"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  );
}
