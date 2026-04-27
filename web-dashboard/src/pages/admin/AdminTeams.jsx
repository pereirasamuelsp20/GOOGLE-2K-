import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users, Shield, CheckCircle, AlertTriangle, Plus, Truck, Database } from 'lucide-react';
import { seed as seedTeams } from '../../utils/seedTeams';

const roleColors = { Doctor: '#dc2626', Nurse: '#3b82f6', Paramedic: '#22c55e', Driver: '#f59e0b' };

export default function AdminTeams() {
  const [teams, setTeams] = useState([]);
  const [dispatching, setDispatching] = useState(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    let hasAutoSeeded = false;
    const unsub = onSnapshot(collection(db, 'teams'), async (snap) => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.priority || 99) - (b.priority || 99));
      setTeams(arr);

      // Auto-seed if no teams exist OR all teams have zero members (all vacant)
      const allEmpty = arr.length === 0 || arr.every(t => !t.members || t.members.length === 0);
      if (allEmpty && !hasAutoSeeded && !seeding) {
        hasAutoSeeded = true;
        setSeeding(true);
        try {
          await seedTeams();
          console.log('✅ Auto-seeded 3 default teams with 12 members');
        } catch (e) {
          console.warn('Auto-seed failed:', e.message);
        }
        setSeeding(false);
      }
    });
    return () => unsub();
  }, []);

  const handleAddTeam = async () => {
    const num = teams.length + 1;
    const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
    const name = `Team ${names[num - 1] || num}`;
    try {
      await addDoc(collection(db, 'teams'), {
        name,
        priority: num,
        vehicle: '🚑',
        status: 'incomplete',
        members: [],
        dispatchedSosId: null,
        createdAt: Date.now(),
      });
    } catch (e) {
      alert('Failed to create team: ' + e.message);
    }
  };

  const handleResetTeam = async (teamId) => {
    try {
      await updateDoc(doc(db, 'teams', teamId), {
        status: 'ready',
        dispatchedSosId: null,
      });
    } catch (e) {
      alert('Failed to reset: ' + e.message);
    }
  };

  const handleSeed = async () => {
    if (!window.confirm('This will create 3 default teams (Alpha, Bravo, Charlie) with 12 Firebase accounts. Password for all: Relief123. Continue?')) return;
    setSeeding(true);
    try {
      await seedTeams();
      alert('✅ Teams seeded! All 12 accounts created with password: Relief123');
    } catch (e) {
      alert('❌ Seed failed: ' + e.message);
    }
    setSeeding(false);
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Team Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {teams.length} teams | {teams.filter(t => t.status === 'ready').length} ready for dispatch
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {teams.length === 0 && (
            <button onClick={handleSeed} disabled={seeding} style={{
              background: 'rgba(99,102,241,0.15)', color: '#818cf8',
              border: '1px solid rgba(99,102,241,0.3)',
              padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
              opacity: seeding ? 0.6 : 1
            }}>
              <Database size={16} /> {seeding ? 'Seeding...' : 'Seed Default Teams'}
            </button>
          )}
          <button onClick={handleAddTeam} style={{
            background: 'var(--primary-red)', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 14
          }}>
            <Plus size={16} /> Add Team
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
        {teams.map(team => {
          const hasDoctor = team.members?.some(m => m.role === 'Doctor');
          const isComplete = team.members?.length >= 4 && hasDoctor;
          const statusColor = team.status === 'ready' ? '#22c55e' : team.status === 'dispatched' ? '#f59e0b' : '#888';

          return (
            <div key={team.id} style={{
              background: 'var(--card-bg)', border: `1px solid ${team.status === 'dispatched' ? 'rgba(245,158,11,0.3)' : 'var(--border-color)'}`,
              borderRadius: 16, padding: 24, position: 'relative'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{team.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    Priority {team.priority} | {team.vehicle || '🚑'}
                  </div>
                </div>
                <div style={{
                  padding: '5px 12px', borderRadius: 8, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                  background: statusColor + '18', color: statusColor, border: `1px solid ${statusColor}40`,
                  textTransform: 'uppercase'
                }}>
                  {team.status}
                </div>
              </div>

              {/* Dispatch alert */}
              {team.status === 'dispatched' && team.dispatchedSosId && (
                <div style={{
                  background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 10, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <AlertTriangle size={14} color="#f59e0b" />
                  <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>
                    Dispatched to SOS #{team.dispatchedSosId?.substring(0, 10)}
                  </span>
                </div>
              )}

              {/* Members */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {['Doctor', 'Nurse', 'Paramedic', 'Driver'].map(role => {
                  const member = team.members?.find(m => m.role === role);
                  const rc = roleColors[role];
                  return (
                    <div key={role} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      background: member ? 'rgba(255,255,255,0.03)' : 'transparent',
                      borderRadius: 8, border: member ? 'none' : '1px dashed #333'
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: 4,
                        background: member ? rc : '#333'
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: rc, width: 80 }}>{role}</span>
                      {member ? (
                        <span style={{ fontSize: 13, color: '#ccc' }}>{member.name}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#555', fontStyle: 'italic' }}>Vacant</span>
                      )}
                      {role === 'Doctor' && (
                        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#dc2626', fontWeight: 700, letterSpacing: 0.5 }}>REQUIRED</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Readiness */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: isComplete ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                borderRadius: 8, border: `1px solid ${isComplete ? 'rgba(34,197,94,0.15)' : '#222'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={14} color={isComplete ? '#22c55e' : '#555'} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: isComplete ? '#22c55e' : '#888' }}>
                    {team.members?.length || 0}/4 Members {isComplete ? '— Ready' : '— Incomplete'}
                  </span>
                </div>
                {team.status === 'dispatched' && (
                  <button onClick={() => handleResetTeam(team.id)} style={{
                    background: 'rgba(255,255,255,0.08)', color: '#ccc', border: '1px solid #333',
                    padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600
                  }}>
                    Reset
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
