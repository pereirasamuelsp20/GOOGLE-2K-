import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users, Crown, UserCheck, UserX, Shield, Search, Trash2, CheckCircle, XCircle } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => {
        if (a.role === 'Admin' && b.role !== 'Admin') return -1;
        if (b.role === 'Admin' && a.role !== 'Admin') return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
      });
      setUsers(arr);
    });
    return () => unsub();
  }, []);

  // Only show users who signed up via web (Pending or Citizen — not yet admin)
  const webSignups = users.filter(u => u.createdAt && u.role !== 'Admin');

  // Current admins list
  const admins = users.filter(u => u.role === 'Admin');

  // Pending admin requests (users who signed up via web and are not yet admin)
  const pendingRequests = webSignups.filter(u =>
    (!searchQuery ||
      (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAcceptAsAdmin = async (uid) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: 'Admin' });
      setConfirmAction(null);
    } catch (e) {
      alert('Failed to accept: ' + e.message);
    }
  };

  const handleDecline = async (uid) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      setConfirmAction(null);
    } catch (e) {
      alert('Failed to decline: ' + e.message);
    }
  };

  const handleRemoveAdmin = async (uid) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      setConfirmAction(null);
    } catch (e) {
      alert('Failed to remove: ' + e.message);
    }
  };

  // Helper: if displayName is a role name or empty, use email prefix instead
  const ROLE_NAMES = ['citizen', 'admin', 'pending', 'responder', 'volunteer'];
  const getDisplayName = (user, fallback = 'Unknown') => {
    const name = user.displayName || '';
    if (!name || ROLE_NAMES.includes(name.toLowerCase())) {
      return user.email ? user.email.split('@')[0] : fallback;
    }
    return name;
  };

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={22} color="#dc2626" /> User Management
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {admins.length} admin{admins.length !== 1 ? 's' : ''} · {webSignups.length} pending sign-up{webSignups.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ─── Current Admins Section ─── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Crown size={16} color="#f59e0b" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Active Admins</h3>
          <span style={{
            background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
            padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700
          }}>
            {admins.length}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {admins.length === 0 ? (
            <div style={{
              background: 'var(--card-bg)', border: '1px solid var(--border-color)',
              borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--text-muted)'
            }}>
              No admins found
            </div>
          ) : (
            admins.map(admin => {
              const isPrimary = admin.email?.toLowerCase() === 'admin@gmail.com';
              return (
                <div key={admin.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                  background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                  borderRadius: 12, transition: 'border-color 0.2s',
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: isPrimary ? 'rgba(245,158,11,0.15)' : 'rgba(220,38,38,0.12)',
                    border: `1px solid ${isPrimary ? 'rgba(245,158,11,0.3)' : 'rgba(220,38,38,0.25)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {isPrimary ? (
                      <Crown size={16} color="#f59e0b" />
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: 800, fontSize: 14 }}>
                        {getDisplayName(admin, '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {getDisplayName(admin, 'Admin')}
                      {isPrimary && (
                        <span style={{
                          fontSize: 9, background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                          padding: '2px 8px', borderRadius: 6, fontWeight: 700, letterSpacing: 0.5
                        }}>PRIMARY</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {admin.email || 'N/A'}
                    </div>
                  </div>

                  {/* Remove button (not for primary admin) */}
                  {!isPrimary && (
                    <button
                      onClick={() => setConfirmAction({ type: 'remove', uid: admin.id, name: admin.displayName, email: admin.email })}
                      style={{
                        background: 'rgba(220,38,38,0.08)', color: '#dc2626',
                        border: '1px solid rgba(220,38,38,0.2)', padding: '7px 14px',
                        borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 5, transition: 'background 0.2s',
                      }}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── Sign-up Requests Section ─── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Users size={16} color="#3b82f6" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Web Sign-up Requests</h3>
          <span style={{
            background: 'rgba(59,130,246,0.12)', color: '#3b82f6',
            padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700
          }}>
            {webSignups.length}
          </span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', height: 42, background: '#1a1a2e',
              border: '1px solid var(--border-color)', borderRadius: 10,
              paddingLeft: 40, paddingRight: 16, color: 'white', fontSize: 13, outline: 'none',
            }}
          />
        </div>

        {/* Requests List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pendingRequests.length === 0 ? (
            <div style={{
              background: 'var(--card-bg)', border: '1px solid var(--border-color)',
              borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14,
            }}>
              {searchQuery ? 'No matching sign-ups found' : 'No new web sign-up requests'}
            </div>
          ) : (
            pendingRequests.map(user => (
              <div key={user.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                borderRadius: 12, transition: 'border-color 0.2s',
              }}>
                {/* Avatar */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ color: '#3b82f6', fontWeight: 800, fontSize: 14 }}>
                    {getDisplayName(user, '?').charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {getDisplayName(user)}
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email || 'N/A'}
                    {user.createdAt && (
                      <span style={{ marginLeft: 8, color: '#444' }}>
                        · {new Date(user.createdAt.seconds ? user.createdAt.seconds * 1000 : user.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Current Role Badge */}
                <span style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  letterSpacing: 0.5, textTransform: 'uppercase',
                  background: user.role === 'Pending' ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
                  color: user.role === 'Pending' ? '#f59e0b' : '#22c55e',
                  border: `1px solid ${user.role === 'Pending' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`,
                }}>
                  {user.role || 'Citizen'}
                </span>

                {/* Accept / Decline Buttons */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => setConfirmAction({ type: 'accept', uid: user.id, name: user.displayName })}
                    title="Accept as Admin"
                    style={{
                      background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                      border: '1px solid rgba(34,197,94,0.25)', padding: '7px 14px',
                      borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <CheckCircle size={13} /> Accept
                  </button>
                  <button
                    onClick={() => setConfirmAction({ type: 'decline', uid: user.id, name: user.displayName })}
                    title="Decline"
                    style={{
                      background: 'rgba(220,38,38,0.08)', color: '#dc2626',
                      border: '1px solid rgba(220,38,38,0.2)', padding: '7px 14px',
                      borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <XCircle size={13} /> Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Confirm Modal ─── */}
      {confirmAction && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100000, backdropFilter: 'blur(4px)',
          }}
          onClick={() => setConfirmAction(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#13131a', border: '1px solid var(--border-color)',
              borderRadius: 16, padding: 28, maxWidth: 420, width: '90%',
            }}
          >
            <h3 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              {confirmAction.type === 'accept' && <><CheckCircle size={18} color="#22c55e" /> Accept as Admin</>}
              {confirmAction.type === 'decline' && <><XCircle size={18} color="#dc2626" /> Decline User</>}
              {confirmAction.type === 'remove' && <><Trash2 size={18} color="#dc2626" /> Remove Admin</>}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              {confirmAction.type === 'accept' && (
                <>Are you sure you want to grant <strong style={{ color: 'white' }}>{confirmAction.name || 'this user'}</strong> full admin access?</>
              )}
              {confirmAction.type === 'decline' && (
                <>This will permanently remove <strong style={{ color: 'white' }}>{confirmAction.name || 'this user'}</strong>'s account.</>
              )}
              {confirmAction.type === 'remove' && (
                <>This will permanently remove <strong style={{ color: 'white' }}>{confirmAction.name || confirmAction.email}</strong> from the admin list and delete their account.</>
              )}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmAction(null)}
                style={{
                  background: 'transparent', border: '1px solid #333', color: '#888',
                  padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === 'accept') handleAcceptAsAdmin(confirmAction.uid);
                  if (confirmAction.type === 'decline') handleDecline(confirmAction.uid);
                  if (confirmAction.type === 'remove') handleRemoveAdmin(confirmAction.uid);
                }}
                style={{
                  background: confirmAction.type === 'accept' ? '#22c55e' : '#dc2626',
                  color: 'white', border: 'none', padding: '10px 20px',
                  borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                }}
              >
                {confirmAction.type === 'accept' ? 'Grant Admin' : confirmAction.type === 'decline' ? 'Decline' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
