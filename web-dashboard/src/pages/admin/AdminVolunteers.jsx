import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { CheckCircle, XCircle, Clock, User } from 'lucide-react';

export default function AdminVolunteers() {
  const [requests, setRequests] = useState([]);
  const [teams, setTeams] = useState([]);
  const [processing, setProcessing] = useState(null);

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
      // Find a team that needs this role
      let targetTeam = null;
      for (const t of teams) {
        const hasRole = t.members?.some(m => m.role === req.requestedRole);
        if (!hasRole && (t.status === 'ready' || t.status === 'incomplete')) {
          targetTeam = t;
          break;
        }
      }

      if (!targetTeam) {
        alert(`No team currently needs a ${req.requestedRole}. Consider creating a new team.`);
        setProcessing(null);
        return;
      }

      const newMember = { uid: req.uid, role: req.requestedRole, name: req.displayName, email: req.email };
      const updatedMembers = [...(targetTeam.members || []), newMember];
      const hasDoctor = updatedMembers.some(m => m.role === 'Doctor');
      const newStatus = updatedMembers.length >= 4 && hasDoctor ? 'ready' : 'incomplete';

      await updateDoc(doc(db, 'teams', targetTeam.id), {
        members: updatedMembers,
        status: newStatus,
      });

      await updateDoc(doc(db, 'volunteerRequests', req.id), {
        status: 'accepted',
        teamId: targetTeam.id,
        reviewedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'users', req.uid), {
        role: 'Responder',
        teamId: targetTeam.id,
        teamRole: req.requestedRole,
      }, { merge: true });

      await setDoc(doc(db, 'responders', req.uid), {
        name: req.displayName,
        email: req.email,
        role: req.requestedRole,
        teamId: targetTeam.id,
        available: true,
      }, { merge: true });

    } catch (e) {
      alert('Error accepting: ' + e.message);
    }
    setProcessing(null);
  };

  const handleReject = async (req) => {
    setProcessing(req.id);
    try {
      await updateDoc(doc(db, 'volunteerRequests', req.id), {
        status: 'rejected',
        reviewedAt: serverTimestamp(),
      });
    } catch (e) {
      alert('Error rejecting: ' + e.message);
    }
    setProcessing(null);
  };

  const pending = requests.filter(r => r.status === 'pending');
  const processed = requests.filter(r => r.status !== 'pending');

  const statusStyle = (s) => ({
    padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
    background: s === 'accepted' ? 'rgba(34,197,94,0.1)' : s === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
    color: s === 'accepted' ? '#22c55e' : s === 'rejected' ? '#ef4444' : '#f59e0b',
  });

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ marginBottom: 8 }}>Volunteer Requests</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Review and approve volunteer role applications
      </p>

      {pending.length === 0 && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No pending volunteer requests
        </div>
      )}

      {pending.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {pending.map(req => (
            <div key={req.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} color="#f59e0b" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{req.displayName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{req.email}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>REQUESTED ROLE</div>
                <div style={{ fontWeight: 700, color: '#f59e0b' }}>{req.requestedRole}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleAccept(req)} disabled={processing === req.id}
                  style={{ background: '#22c55e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={14} /> Accept
                </button>
                <button onClick={() => handleReject(req)} disabled={processing === req.id}
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <XCircle size={14} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {processed.length > 0 && (
        <>
          <h3 style={{ marginBottom: 12, color: 'var(--text-muted)' }}>History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {processed.slice(0, 20).map(req => (
              <div key={req.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.7 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{req.displayName}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 13 }}>{req.requestedRole}</span>
                </div>
                <span style={statusStyle(req.status)}>{req.status}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
