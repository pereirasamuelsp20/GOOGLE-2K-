import React, { createContext, useContext, useState, useEffect } from 'react';
import localforage from 'localforage';
import { generateKeyPair, hasPrivateKey, backupPrivateKey, restorePrivateKey } from '../utils/crypto';
import { startNetworkMonitor } from '../utils/ble';
import { ShieldAlert, Download, Key } from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const MeshContext = createContext();

export function MeshProvider({ children }) {
  const [deviceCode, setDeviceCode] = useState(null);
  const [isKeyReady, setIsKeyReady] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [networkStatus, setNetworkStatus] = useState('online');

  useEffect(() => {
    // Check Identity
    const initIdentity = async () => {
      let code = await localforage.getItem('deviceCode');
      if (!code) {
        code = crypto.randomUUID();
        await localforage.setItem('deviceCode', code);
      }
      setDeviceCode(code);

      const hasKey = await hasPrivateKey();
      if (!hasKey) {
        // Generate new key
        const pubKey = await generateKeyPair();
        await localforage.setItem('publicKey', pubKey);
        setShowBackupModal(true);
      }
      setIsKeyReady(true);
    };

    initIdentity();

    // Sync to Firestore when auth state changes
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const code = await localforage.getItem('deviceCode');
        const pubKey = await localforage.getItem('publicKey');
        if (code && pubKey) {
          await setDoc(doc(db, 'users', user.uid), {
            deviceCode: code,
            publicKey: pubKey,
            email: user.email,
            displayName: user.displayName || 'Citizen'
          }, { merge: true });
        }
      }
    });

    // Start network monitor
    const stopMonitor = startNetworkMonitor(setNetworkStatus);
    return () => {
      stopMonitor();
      unsubscribeAuth();
    };
  }, []);

  return (
    <MeshContext.Provider value={{ deviceCode, networkStatus, isKeyReady }}>
      {children}
      {showBackupModal && <BackupModal onClose={() => setShowBackupModal(false)} />}
    </MeshContext.Provider>
  );
}

export function useMesh() {
  return useContext(MeshContext);
}

function BackupModal({ onClose }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = async () => {
    if (pin.length !== 6 || isNaN(pin)) {
      setError('PIN must be exactly 6 digits');
      return;
    }
    setError('');
    
    try {
      const backupObj = await backupPrivateKey(pin);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj));
      
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "reliefmesh-key-backup.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();

      setDownloaded(true);
    } catch (e) {
      console.error(e);
      setError('Failed to generate backup.');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000,
      backdropFilter: 'blur(5px)'
    }}>
      <div className="glass-panel" style={{ padding: 30, maxWidth: 400, textAlign: 'center' }}>
        <ShieldAlert size={48} color="#dc2626" style={{ marginBottom: 20 }} />
        <h2 style={{ marginBottom: 10 }}>Secure Your Identity</h2>
        <p style={{ color: '#aaa', fontSize: 14, marginBottom: 20 }}>
          Your encryption key is stored ONLY on this device. If you clear your browser data or lose this device, you will lose your chat history.
        </p>
        
        <div style={{ marginBottom: 20, textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 12, color: '#888' }}>
            Set a 6-digit PIN to encrypt your backup:
          </label>
          <input 
            type="password" 
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="000000"
            style={{ 
              width: '100%', padding: 12, borderRadius: 8, 
              background: 'rgba(255,255,255,0.1)', border: '1px solid #333',
              color: 'white', fontSize: 24, textAlign: 'center', letterSpacing: 8
            }}
          />
          {error && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 5 }}>{error}</p>}
        </div>

        {!downloaded ? (
          <button 
            onClick={handleDownload}
            style={{
              width: '100%', padding: 14, borderRadius: 8,
              background: '#dc2626', color: 'white', border: 'none',
              fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10
            }}
          >
            <Download size={18} /> Download Backup File
          </button>
        ) : (
          <button 
            onClick={onClose}
            style={{
              width: '100%', padding: 14, borderRadius: 8,
              background: '#333', color: 'white', border: 'none',
              fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            I have saved it safely
          </button>
        )}
      </div>
    </div>
  );
}
