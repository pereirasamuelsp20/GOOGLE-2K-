import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function AdminRoute({ children }) {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous) { setStatus('denied'); return; }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data().role === 'Admin') {
          setStatus('admin');
        } else {
          await signOut(auth);
          setStatus('denied');
        }
      } catch { setStatus('denied'); }
    });
    return () => unsub();
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a0a', color:'#888', fontSize:14, gap:12 }}>
        <div style={{ width:20, height:20, border:'2px solid #333', borderTopColor:'#dc2626', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
        Verifying admin access...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return status === 'denied' ? <Navigate to="/" replace /> : children;
}
