import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { CheckCircle, XCircle, User, Calendar, MapPin, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const ROLE_ORDER = ['Doctor', 'Nurse', 'Paramedic', 'Driver'];
const ROLE_COLORS = { Doctor: '#dc2626', Nurse: '#3b82f6', Paramedic: '#22c55e', Driver: '#f59e0b' };
const ROLE_ICONS = { Doctor: '🩺', Nurse: '💗', Paramedic: '🚑', Driver: '🚗' };

export default function AdminVolunteers() {
  const [requests, setRequests] = useState([]);
  const [teams, setTeams] = useState([]);
  const [processing, setProcessing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'volunteerRequests'), snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setRequests(arr);
    });
    const unsub2 = onSnapshot(collection(db, 'teams'), snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => a.priority - b.priority);
      setTeams(arr);
    });
    return () => { unsub(); unsub2(); };
  }, []);

  const handleAccept = async (req) => {
    setProcessing(req.id);
    try {
      let targetTeam = null;
      for (const t of teams) {
        const hasRole = t.members?.some(m => m.role === req.requestedRole);
        if (!hasRole && (t.status === 'ready' || t.status === 'incomplete')) { targetTeam = t; break; }
      }
      if (!targetTeam) {
        alert(`No team currently needs a ${req.requestedRole}. Consider creating a new team.`);
        setProcessing(null); return;
      }
      const newMember = { uid: req.uid, role: req.requestedRole, name: req.fullName || req.displayName, email: req.email };
      const updatedMembers = [...(targetTeam.members || []), newMember];
      const hasDoctor = updatedMembers.some(m => m.role === 'Doctor');
      const newStatus = updatedMembers.length >= 4 && hasDoctor ? 'ready' : 'incomplete';
      await updateDoc(doc(db, 'teams', targetTeam.id), { members: updatedMembers, status: newStatus });
      await updateDoc(doc(db, 'volunteerRequests', req.id), { status: 'accepted', teamId: targetTeam.id, reviewedAt: serverTimestamp() });
      await setDoc(doc(db, 'users', req.uid), { role: 'Responder', teamId: targetTeam.id, teamRole: req.requestedRole }, { merge: true });
      await setDoc(doc(db, 'responders', req.uid), { name: req.fullName || req.displayName, email: req.email, role: req.requestedRole, teamId: targetTeam.id, available: true }, { merge: true });
    } catch (e) { alert('Error: ' + e.message); }
    setProcessing(null);
  };

  const handleReject = async (req) => {
    setProcessing(req.id);
    try {
      await updateDoc(doc(db, 'volunteerRequests', req.id), { status: 'rejected', reviewedAt: serverTimestamp() });
    } catch (e) { alert('Error: ' + e.message); }
    setProcessing(null);
  };

  const pending = requests.filter(r => r.status === 'pending');
  const processed = requests.filter(r => r.status !== 'pending');

  // Group pending by role category
  const groupedPending = {};
  ROLE_ORDER.forEach(role => { groupedPending[role] = pending.filter(r => r.requestedRole === role); });

  // Group processed by role
  const groupedProcessed = {};
  ROLE_ORDER.forEach(role => { groupedProcessed[role] = processed.filter(r => r.requestedRole === role); });

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 4 }}>Volunteer Requests</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>
        {pending.length} pending · {processed.length} processed
      </p>

      {/* ── Category Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {ROLE_ORDER.map(role => {
          const rc = ROLE_COLORS[role];
          const count = groupedPending[role]?.length || 0;
          const totalAll = requests.filter(r => r.requestedRole === role).length;
          return (
            <div key={role} style={{ background: 'var(--card-bg)', border: `1px solid ${rc}30`, borderTop: `3px solid ${rc}`, borderRadius: 12, padding: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{ROLE_ICONS[role]}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: rc, marginBottom: 4 }}>{role}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{count}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>pending · {totalAll} total</div>
            </div>
          );
        })}
      </div>

      {/* ── Pending Requests by Category ── */}
      {pending.length === 0 && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No pending volunteer requests
        </div>
      )}

      {ROLE_ORDER.map(role => {
        const items = groupedPending[role];
        if (!items || items.length === 0) return null;
        const rc = ROLE_COLORS[role];
        return (
          <div key={role} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>{ROLE_ICONS[role]}</span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: rc }}>{role}</h3>
              <span style={{ background: rc + '18', color: rc, padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(req => {
                const isExp = expandedId === req.id;
                return (
                  <div key={req.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderLeft: `4px solid ${rc}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }} onClick={() => setExpandedId(isExp ? null : req.id)}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: rc + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: rc, fontWeight: 800, fontSize: 16 }}>{(req.fullName || req.displayName || '?').charAt(0).toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{req.fullName || req.displayName}</div>
                        <div style={{ color: '#888', fontSize: 12 }}>{req.email}</div>
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>PENDING</span>
                      {isExp ? <ChevronUp size={16} color="#888"/> : <ChevronDown size={16} color="#888"/>}
                    </div>
                    {isExp && (
                      <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '16px 0' }}>
                          {req.dateOfBirth && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Calendar size={14} color="#888" />
                              <div><div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Date of Birth</div><div style={{ fontSize: 14, fontWeight: 600 }}>{req.dateOfBirth}</div></div>
                            </div>
                          )}
                          {req.address && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <MapPin size={14} color="#888" />
                              <div><div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Address</div><div style={{ fontSize: 14, fontWeight: 600 }}>{req.address}</div></div>
                            </div>
                          )}
                        </div>
                        {req.experience && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><FileText size={14} color="#888" /><span style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Experience</span></div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, fontSize: 13, lineHeight: 1.6, color: '#ccc' }}>{req.experience}</div>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleAccept(req)} disabled={processing === req.id}
                            style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, opacity: processing === req.id ? 0.5 : 1 }}>
                            <CheckCircle size={14} /> Approve
                          </button>
                          <button onClick={() => handleReject(req)} disabled={processing === req.id}
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
          </div>
        );
      })}

      {/* ── History by Category ── */}
      {processed.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 16, color: 'var(--text-muted)' }}>History</h3>
          {ROLE_ORDER.map(role => {
            const items = groupedProcessed[role];
            if (!items || items.length === 0) return null;
            const rc = ROLE_COLORS[role];
            return (
              <div key={role} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>{ROLE_ICONS[role]}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: rc }}>{role}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.slice(0, 10).map(req => (
                    <div key={req.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.7 }}>
                      <div style={{ flex: 1 }}><span style={{ fontWeight: 600, fontSize: 13 }}>{req.fullName || req.displayName}</span></div>
                      <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        background: req.status === 'accepted' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: req.status === 'accepted' ? '#22c55e' : '#ef4444' }}>{req.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
