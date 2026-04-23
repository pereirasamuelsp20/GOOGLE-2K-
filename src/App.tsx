import React from 'react';
import { BLEChatScreen } from './components/BLEChatScreen';

export default function App() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #0d1f3c 0%, #040810 60%)',
      padding: 24,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <BLEChatScreen />
    </div>
  );
}
