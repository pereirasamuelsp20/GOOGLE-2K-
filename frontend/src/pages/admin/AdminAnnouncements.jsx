import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Send, Trash2, AlertTriangle, Info, Bell } from 'lucide-react';

const GLOBAL_CHANNEL = 'global_emergency';

export default function AdminAnnouncements() {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Guideline');
  const [audience, setAudience] = useState('All');
  const [urgent, setUrgent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const q = query(collection(db, `channels/${GLOBAL_CHANNEL}/posts`), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setPosts(arr);
    });
    return () => unsub();
  }, []);

  const handleSend = async () => {
    if (!content.trim()) return;
    setSending(true);
    const user = auth.currentUser;
    try {
      const tsStr = Date.now().toString();
      // Simple hash signature
      const encoder = new TextEncoder();
      const data = encoder.encode(content + tsStr + (user?.uid || 'admin'));
      const hashBuf = await crypto.subtle.digest('SHA-256', data);
      const sig = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

      await addDoc(collection(db, `channels/${GLOBAL_CHANNEL}/posts`), {
        adminUid: user?.uid || 'admin',
        adminName: user?.displayName || 'Admin',
        content: content.trim(),
        category,
        audience,
        urgent,
        tags: [category],
        timestampStr: tsStr,
        signature: sig,
        reactions: { safe: 0, help: 0, ack: 0 },
        timestamp: serverTimestamp(),
      });
      setContent('');
      setUrgent(false);
    } catch (e) {
      alert('Failed to send: ' + e.message);
    }
    setSending(false);
  };

  const handleDelete = async (postId) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, `channels/${GLOBAL_CHANNEL}/posts`, postId));
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    }
  };

  const catIcon = { Guideline: Info, 'Emergency Alert': AlertTriangle, Info: Bell };
  const catColor = { Guideline: '#3b82f6', 'Emergency Alert': '#dc2626', Info: '#22c55e' };

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ marginBottom: 8 }}>Announcements & Guidelines</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Broadcast to all roles in real-time
      </p>

      {/* Composer */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, marginBottom: 32 }}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Type your announcement or guideline..."
          maxLength={1000}
          style={{
            width: '100%', height: 100, background: 'rgba(255,255,255,0.04)', color: 'white',
            border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, fontSize: 15,
            outline: 'none', resize: 'none', fontFamily: 'inherit'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginTop: 6, marginBottom: 16 }}>
          <span>{content.length}/1000</span>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>CATEGORY</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Guideline', 'Emergency Alert', 'Info'].map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: category === c ? (catColor[c] || '#333') : 'rgba(255,255,255,0.05)',
                  color: category === c ? 'white' : '#aaa',
                  border: category === c ? 'none' : '1px solid var(--border-color)'
                }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>AUDIENCE</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['All', 'Clients', 'Responders', 'Volunteers'].map(a => (
                <button key={a} onClick={() => setAudience(a)} style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: audience === a ? '#6366f1' : 'rgba(255,255,255,0.05)',
                  color: audience === a ? 'white' : '#aaa',
                  border: audience === a ? 'none' : '1px solid var(--border-color)'
                }}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 20 }}>
            <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} />
            <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>URGENT</span>
          </label>
        </div>

        <button onClick={handleSend} disabled={sending || !content.trim()} style={{
          background: 'var(--primary-red)', color: 'white', border: 'none',
          padding: '12px 24px', borderRadius: 10, cursor: 'pointer', fontWeight: 700,
          fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
          opacity: sending || !content.trim() ? 0.5 : 1
        }}>
          <Send size={16} /> {sending ? 'Sending...' : 'Broadcast to All'}
        </button>
      </div>

      {/* Past announcements */}
      <h3 style={{ marginBottom: 16 }}>Recent Broadcasts ({posts.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {posts.map(p => {
          const CatIcon = catIcon[p.category] || Info;
          const cc = catColor[p.category] || '#888';
          return (
            <div key={p.id} style={{
              background: 'var(--card-bg)', border: '1px solid var(--border-color)',
              borderLeft: p.urgent ? '4px solid #dc2626' : '1px solid var(--border-color)',
              borderRadius: 12, padding: 18
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CatIcon size={14} color={cc} />
                  <span style={{ fontWeight: 700 }}>{p.adminName || 'Admin'}</span>
                  {p.urgent && <span style={{ background: '#dc2626', color: 'white', padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700 }}>URGENT</span>}
                  {p.audience && p.audience !== 'All' && (
                    <span style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700 }}>
                      {p.audience}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {p.timestamp?.toDate ? new Date(p.timestamp.toDate()).toLocaleString() : 'Just now'}
                  </span>
                  <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p style={{ color: '#ddd', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{p.content}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
