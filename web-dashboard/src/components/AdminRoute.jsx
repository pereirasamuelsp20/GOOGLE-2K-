import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AuthScreen from '../pages/AuthScreen';

const PRIMARY_ADMIN = 'admin@gmail.com';

export default function AdminRoute({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous) {
        setStatus('unauthenticated');
        return;
      }

      // Primary admin always gets through
      if (user.email?.toLowerCase() === PRIMARY_ADMIN) {
        setStatus('authenticated');
        return;
      }

      // Check Firestore role for other users
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'Admin') {
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      } catch (e) {
        console.warn('AdminRoute: Firestore check failed:', e.message);
        setStatus('unauthenticated');
      }
    });

    return () => unsub();
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a0a', color:'#888', fontSize:14, gap:12 }}>
        <div style={{ width:20, height:20, border:'2px solid #333', borderTopColor:'#dc2626', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
        Loading...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <AuthScreen />;
  }

  return children;
}
