import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, getDoc } from 'firebase/firestore';
import { useMesh } from '../components/MeshProvider';
import { hashSignature, verifySignature } from '../utils/crypto';
import { rewriteAdminPost } from '../utils/ai';
import { Plus, ShieldCheck, ShieldAlert, Navigation, AlertTriangle, MessageSquarePlus, Activity, Sparkles, X } from 'lucide-react';
import localforage from 'localforage';

const GLOBAL_CHANNEL = 'global_emergency';

export default function CommunityScreen() {
  const { networkStatus, deviceCode } = useMesh();
  const [posts, setPosts] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  const currentUser = auth.currentUser;
  const isOffline = networkStatus === 'offline';

  // Check role
  useEffect(() => {
    if (!currentUser) return;
    const checkRole = async () => {
      const uDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (uDoc.exists() && (uDoc.data().role === 'Admin' || uDoc.data().role === 'Responder' || uDoc.data().email?.includes('admin'))) {
        setIsAdmin(true);
      }
    };
    checkRole();
  }, [currentUser]);

  // Load Posts
  useEffect(() => {
    const q = query(collection(db, `channels/${GLOBAL_CHANNEL}/posts`), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, async (snapshot) => {
      const newPosts = [];
      for (const d of snapshot.docs) {
        const data = d.data();

        // Verify signature
        const isValid = await verifySignature(data.signature, data.content, data.timestampStr, data.adminUid);

        newPosts.push({ id: d.id, ...data, verified: isValid });
      }
      setPosts(newPosts);
    });
    return () => unsub();
  }, []);

  const handleReact = async (postId, type) => {
    if (!currentUser) return;
    const postRef = doc(db, `channels/${GLOBAL_CHANNEL}/posts`, postId);
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const reactions = post.reactions || { safe: 0, help: 0, ack: 0 };
    reactions[type] = (reactions[type] || 0) + 1;

    await updateDoc(postRef, { reactions });
  };

  return (
    <div style={{ padding: '80px 20px 20px', backgroundColor: '#0a0a0f', color: 'white', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>

      <div style={{ maxWidth: 600, width: '100%', position: 'relative' }}>
        <h1 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity color="#dc2626" /> Community Broadcasts
        </h1>

        {isOffline && (
          <div style={{ padding: 12, backgroundColor: '#450a0a', color: '#fca5a5', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} />
            Offline Mode. Posts will sync via Mesh Network.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          {posts.map(p => (
            <div key={p.id} style={{
              backgroundColor: '#13131a', borderRadius: 12, padding: 20,
              borderLeft: p.urgent ? '4px solid #dc2626' : 'none',
              position: 'relative'
            }}>
              {p.urgent && (
                <div style={{ position: 'absolute', top: -10, right: 10, background: '#dc2626', color: 'white', padding: '4px 8px', borderRadius: 12, fontSize: 10, fontWeight: 'bold' }}>
                  URGENT
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, borderBottom: '1px solid #1f1f2e', paddingBottom: 10 }}>
                <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.adminName || 'Admin'}
                  {p.verified ?
                    <ShieldCheck size={14} color="#10b981" title="Verified Signature" /> :
                    <ShieldAlert size={14} color="#ef4444" title="Invalid Signature" />
                  }
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {p.timestamp ? new Date(p.timestamp.toDate()).toLocaleString() : 'Just now'}
                </div>
              </div>

              <p style={{ fontSize: 15, lineHeight: 1.5, color: p.verified ? 'white' : '#888' }}>
                {p.content}
              </p>

              {p.tags && p.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
                  {p.tags.map(t => (
                    <span key={t} style={{ background: '#1f1f2e', padding: '4px 10px', borderRadius: 12, fontSize: 11, color: '#a78bfa' }}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => handleReact(p.id, 'safe')} style={reactBtnStyle}>
                  ✅ Safe ({p.reactions?.safe || 0})
                </button>
                <button onClick={() => handleReact(p.id, 'help')} style={reactBtnStyle}>
                  🚨 Need Help ({p.reactions?.help || 0})
                </button>
                <button onClick={() => handleReact(p.id, 'ack')} style={reactBtnStyle}>
                  👍 Acknowledged ({p.reactions?.ack || 0})
                </button>
              </div>

            </div>
          ))}
          {posts.length === 0 && <p style={{ color: '#888' }}>No updates available.</p>}
        </div>

        {/* FAB for Admins */}
        {isAdmin && (
          <button
            onClick={() => setShowComposer(true)}
            style={{
              position: 'fixed', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30,
              backgroundColor: '#dc2626', color: 'white', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(220,38,38,0.4)'
            }}
          >
            <Plus size={24} />
          </button>
        )}

      </div>

      {showComposer && (
        <AdminPostComposer
          onClose={() => setShowComposer(false)}
          isOffline={isOffline}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

const reactBtnStyle = {
  background: '#1f1f2e', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer'
};

function AdminPostComposer({ onClose, isOffline, currentUser }) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState([]);
  const [urgent, setUrgent] = useState(false);
  const [rewriting, setRewriting] = useState(false);

  const ALL_TAGS = ['Evacuation', 'Medical', 'Food', 'Shelter', 'General'];

  const toggleTag = (t) => {
    if (tags.includes(t)) setTags(tags.filter(x => x !== t));
    else setTags([...tags, t]);
  };

  const handleRewrite = async () => {
    if (!content) return;
    setRewriting(true);
    const improved = await rewriteAdminPost(content, tags);
    setContent(improved);
    setRewriting(false);
  };

  const handlePost = async () => {
    if (!content.trim() || !currentUser) return;

    // Generate Signature
    const tsStr = Date.now().toString();
    const sig = await hashSignature(content, tsStr, currentUser.uid);

    const postData = {
      adminUid: currentUser.uid,
      adminName: currentUser.displayName || 'Admin',
      content: content.trim(),
      tags,
      urgent,
      timestampStr: tsStr,
      signature: sig,
      reactions: { safe: 0, help: 0, ack: 0 },
      timestamp: serverTimestamp()
    };

    if (isOffline) {
      // Save to mesh relay queue
      const queue = await localforage.getItem('mesh_relay_queue') || [];
      queue.push({ type: 'channelPost', ...postData });
      await localforage.setItem('mesh_relay_queue', queue);
      alert('Saved offline. Will broadcast via Mesh.');
    } else {
      await addDoc(collection(db, `channels/${GLOBAL_CHANNEL}/posts`), postData);
    }

    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'flex-end', zIndex: 100000,
      backdropFilter: 'blur(5px)'
    }}>
      <div style={{
        background: '#13131a', width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 30, paddingBottom: 50, borderTop: '1px solid #1f1f2e'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: 'white' }}>Broadcast Update</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Enter emergency update..."
          maxLength={500}
          style={{
            width: '100%', height: 120, background: '#1f1f2e', color: 'white',
            border: 'none', borderRadius: 12, padding: 15, fontSize: 16, outline: 'none', resize: 'none'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: '#888', marginTop: 5 }}>
          {content.length}/500
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleRewrite}
              disabled={rewriting || !content}
              style={{
                background: '#4c1d95', color: '#ddd6fe', border: 'none', padding: '8px 16px',
                borderRadius: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                opacity: rewriting || !content ? 0.5 : 1
              }}
            >
              <Sparkles size={14} /> {rewriting ? 'Rewriting...' : 'AI Assist'}
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}>
            <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} />
            URGENT
          </label>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Tags</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ALL_TAGS.map(t => (
              <button
                key={t} onClick={() => toggleTag(t)}
                style={{
                  background: tags.includes(t) ? '#dc2626' : '#1f1f2e',
                  color: 'white', border: 'none', padding: '6px 14px', borderRadius: 16, cursor: 'pointer', fontSize: 12
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handlePost}
          style={{
            width: '100%', background: '#dc2626', color: 'white', border: 'none',
            padding: 16, borderRadius: 12, marginTop: 30, fontSize: 16, fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          Publish to Community
        </button>

      </div>
    </div>
  );
}
