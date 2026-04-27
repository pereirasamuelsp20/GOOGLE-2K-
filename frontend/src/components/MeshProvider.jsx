import React, { createContext, useContext, useState, useEffect } from 'react';
import localforage from 'localforage';
import { generateKeyPair, hasPrivateKey } from '../utils/crypto';
import { startNetworkMonitor } from '../utils/ble';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

const MeshContext = createContext();

export function MeshProvider({ children }) {
  const [deviceCode, setDeviceCode] = useState(null);
  const [isKeyReady, setIsKeyReady] = useState(false);
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
        // Generate new key silently — no backup modal
        const pubKey = await generateKeyPair();
        await localforage.setItem('publicKey', pubKey);
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
    </MeshContext.Provider>
  );
}

export function useMesh() {
  return useContext(MeshContext);
}
