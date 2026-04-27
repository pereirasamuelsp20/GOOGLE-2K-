import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users, Crown, UserCheck, UserX, Shield, Search, Trash2, CheckCircle, XCircle, Stethoscope, Calendar, MapPin, FileText } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [volRequests, setVolRequests] = useState([]);
  const [teams, setTeams] = useState([]);
  const [processing, setProcessing] = useState(null);
  const [expandedReq, setExpandedReq] = useState(null);

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
    // Listen for volunteer role requests
    const unsub2 = onSnapshot(collection(db, 'volunteerRequests'), (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setVolRequests(arr);
    });
    // Listen for teams
    const unsub3 = onSnapshot(collection(db, 'teams'), (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => a.priority - b.priority);
      setTeams(arr);
    });
    return () => { unsub(); unsub2(); unsub3(); };
  }, []);

  // UIDs that have volunteer role requests — exclude from web sign-ups section
  const volRequestUids = new Set(volRequests.map(r => r.uid));
  // Only show users with role 'Pending' — this role is set exclusively by the web auth "Request Access" form.
  // Mobile app signups use roles like 'Citizen' or 'Volunteer' and should NOT appear here.
  const webSignups = users.filter(u => u.role === 'Pending' && !volRequestUids.has(u.id));
  const admins = users.filter(u => u.role === 'Admin');
  const pendingRequests = webSignups.filter(u =>
    (!searchQuery ||
      (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pendingVolReqs = volRequests.filter(r => r.status === 'pending');
  const processedVolReqs = volRequests.filter(r => r.status !== 'pending');

  const handleAcceptAsAdmin = async (uid) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: 'Admin' });
      setConfirmAction(null);
    } catch (e) { alert('Failed to accept: ' + e.message); }
  };

  const handleDecline = async (uid) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      setConfirmAction(null);
    } catch (e) { alert('Failed to decline: ' + e.message); }
  };

  const handleRemoveAdmin = async (uid) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      setConfirmAction(null);
    } catch (e) { alert('Failed to remove: ' + e.message); }
  };

  // ── Volunteer Role Request handlers ──
  const handleAcceptVolunteer = async (req) => {
    setProcessing(req.id);
    try {
      let targetTeam = null;
      for (const t of teams) {
        const hasRole = t.members?.some(m => m.role === req.requestedRole);
        if (!hasRole && (t.status === 'ready' || t.status === 'incomplete')) {
          targetTeam = t;
          break;
        }
      }
      if (!targetTeam) {
        alert(`No team currently needs a ${req.requestedRole}. Consider creating a new team first.`);
        setProcessing(null);
        return;
      }
      // Resolve name — guard against email-as-name (e.g. if displayName was never set properly)
      let resolvedName = req.fullName || req.displayName || '';
      if (!resolvedName || resolvedName.includes('@')) {
        resolvedName = req.email ? req.email.split('@')[0] : 'Unknown';
        // Capitalize first letter
        resolvedName = resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1);
      }
      const newMember = { uid: req.uid, role: req.requestedRole, name: resolvedName, email: req.email };
      const updatedMembers = [...(targetTeam.members || []), newMember];
      const hasDoctor = updatedMembers.some(m => m.role === 'Doctor');
      const newStatus = updatedMembers.length >= 4 && hasDoctor ? 'ready' : 'incomplete';

      await updateDoc(doc(db, 'teams', targetTeam.id), { members: updatedMembers, status: newStatus });
      await updateDoc(doc(db, 'volunteerRequests', req.id), { status: 'accepted', teamId: targetTeam.id, reviewedAt: serverTimestamp() });
      await setDoc(doc(db, 'users', req.uid), { role: 'Responder', teamId: targetTeam.id, teamRole: req.requestedRole }, { merge: true });
      await setDoc(doc(db, 'responders', req.uid), { name: resolvedName, email: req.email, role: req.requestedRole, teamId: targetTeam.id, available: true }, { merge: true });
    } catch (e) { alert('Error accepting: ' + e.message); }
    setProcessing(null);
  };

  const handleRejectVolunteer = async (req) => {
    setProcessing(req.id);
    try {
      await updateDoc(doc(db, 'volunteerRequests', req.id), { status: 'rejected', reviewedAt: serverTimestamp() });
    } catch (e) { alert('Error rejecting: ' + e.message); }
    setProcessing(null);
  };

  const ROLE_NAMES = ['citizen', 'admin', 'pending', 'responder', 'volunteer'];
  const getDisplayName = (user, fallback = 'Unknown') => {
    const name = user.displayName || '';
    if (!name || ROLE_NAMES.includes(name.toLowerCase())) {
      return user.email ? user.email.split('@')[0] : fallback;
    }
    return name;
  };

  const roleColors = { Doctor: '#dc2626', Nurse: '#3b82f6', Paramedic: '#22c55e', Driver: '#f59e0b' };

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={22} color="#dc2626" /> User Management
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {admins.length} admin{admins.length !== 1 ? 's' : ''} · {pendingVolReqs.length} role request{pendingVolReqs.length !== 1 ? 's' : ''} · {webSignups.length} sign-up{webSignups.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ─── Volunteer Role Requests ─── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Stethoscope size={16} color="#f59e0b" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Volunteer Role Requests</h3>
          <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
            {pendingVolReqs.length}
          </span>
        </div>

        {pendingVolReqs.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            No pending volunteer role requests
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingVolReqs.map(req => {
              const rc = roleColors[req.requestedRole] || '#888';
              const isExpanded = expandedReq === req.id;
              return (
                <div key={req.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderLeft: `4px solid ${rc}`, borderRadius: 14, padding: 20, transition: 'all 0.2s' }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => setExpandedReq(isExpanded ? null : req.id)}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: rc + '18', border: `1px solid ${rc}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: rc, fontWeight: 800, fontSize: 16 }}>{(req.fullName || req.displayName || '?').charAt(0).toUpperCase()}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{req.fullName || req.displayName}</div>
                      <div style={{ color: '#888', fontSize: 13 }}>{req.email}</div>
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: rc + '18', color: rc, border: `1px solid ${rc}30` }}>
                      {req.requestedRole}
                    </span>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ marginTop: 16, padding: '16px 0 0', borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                        {req.dateOfBirth && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar size={14} color="#888" />
                            <div>
                              <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Date of Birth</div>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{req.dateOfBirth}</div>
                            </div>
                          </div>
                        )}
                        {req.address && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <MapPin size={14} color="#888" />
                            <div>
                              <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Address</div>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{req.address}</div>
                            </div>
                          </div>
                        )}
                      </div>
                      {req.experience && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <FileText size={14} color="#888" />
                            <span style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Experience</span>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, fontSize: 13, lineHeight: 1.6, color: '#ccc' }}>
                            {req.experience}
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => handleAcceptVolunteer(req)} disabled={processing === req.id}
                          style={{ background: '#22c55e', color: 'white', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, opacity: processing === req.id ? 0.5 : 1 }}>
                          <CheckCircle size={14} /> Approve
                        </button>
                        <button onClick={() => handleRejectVolunteer(req)} disabled={processing === req.id}
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, opacity: processing === req.id ? 0.5 : 1 }}>
                          <XCircle size={14} /> Decline
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Processed history */}
        {processedVolReqs.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ color: '#666', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Request History</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {processedVolReqs.slice(0, 10).map(req => (
                <div key={req.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.7 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{req.fullName || req.displayName}</span>
                    <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>{req.requestedRole}</span>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    background: req.status === 'accepted' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: req.status === 'accepted' ? '#22c55e' : '#ef4444',
                  }}>{req.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Current Admins Section ─── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Crown size={16} color="#f59e0b" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Active Admins</h3>
          <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{admins.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {admins.length === 0 ? (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No admins found</div>
          ) : (
            admins.map(admin => {
              const isPrimary = admin.email?.toLowerCase() === 'admin@gmail.com';
              return (
                <div key={admin.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: isPrimary ? 'rgba(245,158,11,0.15)' : 'rgba(220,38,38,0.12)', border: `1px solid ${isPrimary ? 'rgba(245,158,11,0.3)' : 'rgba(220,38,38,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isPrimary ? <Crown size={16} color="#f59e0b" /> : <span style={{ color: '#dc2626', fontWeight: 800, fontSize: 14 }}>{getDisplayName(admin, '?').charAt(0).toUpperCase()}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {getDisplayName(admin, 'Admin')}
                      {isPrimary && <span style={{ fontSize: 9, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', padding: '2px 8px', borderRadius: 6, fontWeight: 700, letterSpacing: 0.5 }}>PRIMARY</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{admin.email || 'N/A'}</div>
                  </div>
                  {!isPrimary && (
                    <button onClick={() => setConfirmAction({ type: 'remove', uid: admin.id, name: admin.displayName, email: admin.email })}
                      style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
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
          <span style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{webSignups.length}</span>
        </div>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
          <input type="text" placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', height: 42, background: '#1a1a2e', border: '1px solid var(--border-color)', borderRadius: 10, paddingLeft: 40, paddingRight: 16, color: 'white', fontSize: 13, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pendingRequests.length === 0 ? (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              {searchQuery ? 'No matching sign-ups found' : 'No new web sign-up requests'}
            </div>
          ) : (
            pendingRequests.map(user => (
              <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#3b82f6', fontWeight: 800, fontSize: 14 }}>{getDisplayName(user, '?').charAt(0).toUpperCase()}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{getDisplayName(user)}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                    {user.email || 'N/A'}
                    {user.createdAt && <span style={{ marginLeft: 8, color: '#444' }}>· {new Date(user.createdAt.seconds ? user.createdAt.seconds * 1000 : user.createdAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', background: user.role === 'Pending' ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', color: user.role === 'Pending' ? '#f59e0b' : '#22c55e', border: `1px solid ${user.role === 'Pending' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}` }}>
                  {user.role || 'Citizen'}
                </span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setConfirmAction({ type: 'accept', uid: user.id, name: user.displayName })} title="Accept as Admin"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle size={13} /> Accept
                  </button>
                  <button onClick={() => setConfirmAction({ type: 'decline', uid: user.id, name: user.displayName })} title="Decline"
                    style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, backdropFilter: 'blur(4px)' }} onClick={() => setConfirmAction(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#13131a', border: '1px solid var(--border-color)', borderRadius: 16, padding: 28, maxWidth: 420, width: '90%' }}>
            <h3 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              {confirmAction.type === 'accept' && <><CheckCircle size={18} color="#22c55e" /> Accept as Admin</>}
              {confirmAction.type === 'decline' && <><XCircle size={18} color="#dc2626" /> Decline User</>}
              {confirmAction.type === 'remove' && <><Trash2 size={18} color="#dc2626" /> Remove Admin</>}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              {confirmAction.type === 'accept' && <>Are you sure you want to grant <strong style={{ color: 'white' }}>{confirmAction.name || 'this user'}</strong> full admin access?</>}
              {confirmAction.type === 'decline' && <>This will permanently remove <strong style={{ color: 'white' }}>{confirmAction.name || 'this user'}</strong>'s account.</>}
              {confirmAction.type === 'remove' && <>This will permanently remove <strong style={{ color: 'white' }}>{confirmAction.name || confirmAction.email}</strong> from the admin list and delete their account.</>}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmAction(null)} style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => {
                if (confirmAction.type === 'accept') handleAcceptAsAdmin(confirmAction.uid);
                if (confirmAction.type === 'decline') handleDecline(confirmAction.uid);
                if (confirmAction.type === 'remove') handleRemoveAdmin(confirmAction.uid);
              }} style={{ background: confirmAction.type === 'accept' ? '#22c55e' : '#dc2626', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                {confirmAction.type === 'accept' ? 'Grant Admin' : confirmAction.type === 'decline' ? 'Decline' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
