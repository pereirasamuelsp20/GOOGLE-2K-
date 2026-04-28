import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, onValue, remove, set } from 'firebase/database';
import { db, rtdb } from '../../firebase';
import { API_BASE } from '../../apiConfig';
import { Activity, Users, AlertTriangle, Shield, Truck, Trash2, Map, Radio, Bell, Clock, ArrowRight, Wifi, Database, Server } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminOverview() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    activeSos: 0, teamsReady: 0, pendingVolunteers: 0,
    issuesReported: 0, respondersOnline: 0, roadBlockages: 0
  });
  const [activeSosList, setActiveSosList] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');

  // Admin cleanup: clear all stuck SOS + roadblocks from Firebase + MongoDB
  const handleCleanup = async () => {
    if (!window.confirm('This will clear ALL active SOS marks, roadblock zones, and resolve all reports. Continue?')) return;
    setCleaningUp(true);
    setCleanupResult(null);
    let results = [];

    try {
      // 1. Clear RTDB SOS entries
      try {
        await remove(ref(rtdb, 'sos'));
        results.push('✅ Cleared all SOS from RTDB');
      } catch (e) {
        results.push('⚠️ RTDB SOS clear failed: ' + e.message);
      }

      // 2. Clear Firestore SOS collection
      try {
        const sosSnap = await getDocs(collection(db, 'sos'));
        let sosCount = 0;
        for (const d of sosSnap.docs) {
          await deleteDoc(doc(db, 'sos', d.id));
          sosCount++;
        }
        results.push(`✅ Deleted ${sosCount} SOS docs from Firestore`);
      } catch (e) {
        results.push('⚠️ Firestore SOS clear failed: ' + e.message);
      }

      // 3. Clear Firestore blocked zones
      try {
        const zonesSnap = await getDocs(collection(db, 'zones'));
        let zoneCount = 0;
        for (const d of zonesSnap.docs) {
          if (d.data().type === 'blocked') {
            await deleteDoc(doc(db, 'zones', d.id));
            zoneCount++;
          }
        }
        results.push(`✅ Deleted ${zoneCount} blocked zones from Firestore`);
      } catch (e) {
        results.push('⚠️ Firestore zones clear failed: ' + e.message);
      }

      // 4. Clear MongoDB reports via backend API
      try {
        const res = await fetch(`${API_BASE}/reports/admin/cleanup`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          results.push(`✅ Resolved ${data.resolvedCount} reports in MongoDB`);
        } else {
          results.push('⚠️ MongoDB cleanup returned ' + res.status);
        }
      } catch (e) {
        results.push('⚠️ MongoDB cleanup failed: ' + e.message);
      }

      // 5. Clear roadblocks specifically
      try {
        const res = await fetch(`${API_BASE}/reports/admin/clear-roadblocks`, { method: 'DELETE' });
        if (res.ok) {
          const data = await res.json();
          results.push(`✅ Resolved ${data.resolvedCount} road blocked reports`);
        }
      } catch (e) { /* already handled above */ }

    } catch (e) {
      results.push('❌ Cleanup error: ' + e.message);
    }

    setCleanupResult(results.join('\n'));
    setCleaningUp(false);
  };

  useEffect(() => {

    // Teams — auto-seed if empty
    const uT = onSnapshot(collection(db, 'teams'), snap => {
      let ready = 0;
      let total = 0;
      snap.forEach(d => { total++; if (d.data().status === 'ready') ready++; });
      setMetrics(m => ({ ...m, teamsReady: ready }));

      // Auto-seed 3 default teams if none exist
      if (total === 0) {
        const defaultTeams = [
          {
            id: 'team_alpha', name: 'Team Alpha', priority: 1, vehicle: '🚑', status: 'ready', members: [
              { role: 'Doctor', name: 'Dr. Arjun Mehta', email: 'team1.doctor@reliefmesh.com' },
              { role: 'Nurse', name: 'Priya Sharma', email: 'team1.nurse@reliefmesh.com' },
              { role: 'Paramedic', name: 'Rahul Verma', email: 'team1.paramedic@reliefmesh.com' },
              { role: 'Driver', name: 'Sunil Patil', email: 'team1.driver@reliefmesh.com' },
            ]
          },
          {
            id: 'team_bravo', name: 'Team Bravo', priority: 2, vehicle: '🚑', status: 'ready', members: [
              { role: 'Doctor', name: 'Dr. Kavita Iyer', email: 'team2.doctor@reliefmesh.com' },
              { role: 'Nurse', name: 'Anita Desai', email: 'team2.nurse@reliefmesh.com' },
              { role: 'Paramedic', name: 'Vikram Singh', email: 'team2.paramedic@reliefmesh.com' },
              { role: 'Driver', name: 'Manoj Kulkarni', email: 'team2.driver@reliefmesh.com' },
            ]
          },
          {
            id: 'team_charlie', name: 'Team Charlie', priority: 3, vehicle: '🚑', status: 'ready', members: [
              { role: 'Doctor', name: 'Dr. Neha Joshi', email: 'team3.doctor@reliefmesh.com' },
              { role: 'Nurse', name: 'Deepika Rao', email: 'team3.nurse@reliefmesh.com' },
              { role: 'Paramedic', name: 'Amit Thakur', email: 'team3.paramedic@reliefmesh.com' },
              { role: 'Driver', name: 'Rajesh Gupta', email: 'team3.driver@reliefmesh.com' },
            ]
          },
        ];
        defaultTeams.forEach(team => {
          setDoc(doc(db, 'teams', team.id), {
            name: team.name, priority: team.priority, vehicle: team.vehicle,
            status: team.status, members: team.members, dispatchedSosId: null, createdAt: Date.now(),
          }, { merge: true }).catch(e => console.warn('Team seed failed:', e.message));
        });
        console.log('✅ Auto-seeded 3 default teams');
      }
    });

    // Volunteer requests
    const uV = onSnapshot(query(collection(db, 'volunteerRequests'), where('status', '==', 'pending')), snap => {
      setMetrics(m => ({ ...m, pendingVolunteers: snap.size }));
    });

    // Responders
    const uR = onSnapshot(query(collection(db, 'responders'), where('available', '==', true)), snap => {
      setMetrics(m => ({ ...m, respondersOnline: snap.size }));
    });

    // SOS (RTDB)
    const sosRef = ref(rtdb, 'sos');
    const uS = onValue(sosRef, snap => {
      const data = snap.val();
      let active = 0;
      const arr = [];
      if (data) {
        Object.keys(data).forEach(k => {
          if (data[k].status === 'searching' || data[k].status === 'routed' || data[k].status === 'responding') {
            active++;
            arr.push({ id: k, ...data[k] });
          }
        });
      }
      setActiveSosList(arr);
      setMetrics(m => ({ ...m, activeSos: active }));
    });

    // Fetch reported issues from backend for metrics + recent reports
    const fetchIssueMetrics = async () => {
      try {
        const res = await fetch(`${API_BASE}/reports`);
        if (res.ok) {
          const data = await res.json();
          const total = data.length;
          const roadBlocks = data.filter(r => r.calamityType === 'Road Blocked').length;
          setMetrics(m => ({ ...m, issuesReported: total, roadBlockages: roadBlocks }));
          setRecentReports(data.slice(0, 5));
          setBackendStatus('online');
        }
      } catch (e) {
        console.warn('Failed to fetch issue metrics:', e.message);
        setBackendStatus('offline');
      }
    };
    fetchIssueMetrics();
    const issueInterval = setInterval(fetchIssueMetrics, 10000);

    // Health check
    const healthCheck = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok) setBackendStatus('online');
        else setBackendStatus('degraded');
      } catch { setBackendStatus('offline'); }
    };
    healthCheck();

    return () => { uT(); uV(); uR(); uS(); clearInterval(issueInterval); };
  }, []);

  const ISSUE_ICONS = {
    'Earthquakes': '🌍', 'Landslides': '🏔', 'Power Outages': '⚡', 'Fire': '🔥',
    'Road Blocked': '🚧', 'Flash Floods': '🌊', 'Car Accident': '🚗',
    'Building Collapse': '🏗', 'Chemical Leaks': '☣', 'Water Logging': '🌊',
    'Gas Leak': '☣', 'Street Light Out': '💡', 'Pothole': '🕳',
  };
  const ISSUE_COLORS = {
    'Earthquakes': '#f97316', 'Landslides': '#a16207', 'Power Outages': '#eab308', 'Fire': '#dc2626',
    'Road Blocked': '#f59e0b', 'Flash Floods': '#3b82f6', 'Car Accident': '#ef4444',
    'Building Collapse': '#78716c', 'Chemical Leaks': '#a855f7', 'Water Logging': '#0ea5e9',
    'Gas Leak': '#a855f7', 'Street Light Out': '#eab308', 'Pothole': '#78716c',
  };

  const SOS_ICONS = { Fire: '🔥', Medical: '🏥', Security: '🛡', General: '⚠' };
  const SOS_STATUS_COLORS = { searching: '#f59e0b', routed: '#3b82f6', responding: '#22c55e' };

  const formatTimeAgo = (ts) => {
    if (!ts) return '';
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  const formatReportTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${day} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const metricCards = [
    { label: 'Active SOS', value: metrics.activeSos, color: '#dc2626', icon: Activity },
    { label: 'Teams Ready', value: metrics.teamsReady, color: '#22c55e', icon: Truck },
    { label: 'Pending Volunteers', value: metrics.pendingVolunteers, color: '#f59e0b', icon: Users },
    { label: 'Responders Online', value: metrics.respondersOnline, color: '#3b82f6', icon: Shield },
    { label: 'Issues Reported', value: metrics.issuesReported, color: '#f97316', icon: AlertTriangle },
    { label: 'Road Blockages', value: metrics.roadBlockages, color: '#ef4444', icon: AlertTriangle },
  ];

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ marginBottom: 8 }}>System Overview</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>Real-time operational status of ReliefMesh</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {metricCards.map(c => (
          <div key={c.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <c.icon size={20} style={{ color: c.color, marginBottom: 8 }} />
            <div className="metric-val" style={{ color: c.color }}>{c.value}</div>
            <div className="metric-label">{c.label}</div>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40, background: c.color, opacity: 0.04 }} />
          </div>
        ))}
      </div>

      {/* Admin Cleanup Button */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={handleCleanup}
          disabled={cleaningUp}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: cleaningUp ? '#333' : 'rgba(220,38,38,0.15)',
            border: '1px solid rgba(220,38,38,0.3)',
            color: '#dc2626', padding: '10px 20px', borderRadius: 10,
            fontWeight: 700, fontSize: 13, cursor: cleaningUp ? 'not-allowed' : 'pointer',
            letterSpacing: 0.5,
          }}
        >
          <Trash2 size={16} />
          {cleaningUp ? 'Cleaning up...' : 'Clear All Stuck Markers'}
        </button>
        {cleanupResult && (
          <pre style={{
            fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.06)',
            padding: '8px 14px', borderRadius: 8, margin: 0, whiteSpace: 'pre-wrap',
            border: '1px solid rgba(34,197,94,0.15)', maxWidth: 500,
          }}>{cleanupResult}</pre>
        )}
      </div>

      {/* ── Quick Actions ── */}
      <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ArrowRight size={18} color="#3b82f6" /> Quick Actions
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'Open Mesh Map', icon: Map, color: '#3b82f6', path: '/admin/mesh-map' },
          { label: 'Manage Teams', icon: Truck, color: '#22c55e', path: '/admin/teams' },
          { label: 'View Volunteers', icon: Users, color: '#f59e0b', path: '/admin/volunteers' },
          { label: 'Announcements', icon: Bell, color: '#a855f7', path: '/admin/announcements' },
          { label: 'User Management', icon: Shield, color: '#dc2626', path: '/admin/users' },
        ].map(action => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--card-bg)', border: '1px solid var(--border-color)',
              borderRadius: 14, padding: '16px 20px', cursor: 'pointer',
              color: '#e0e0e0', fontSize: 14, fontWeight: 600,
              transition: 'all 0.2s', textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = action.color + '60'; e.currentTarget.style.background = action.color + '08'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--card-bg)'; }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: action.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <action.icon size={20} style={{ color: action.color }} />
            </div>
            {action.label}
          </button>
        ))}
      </div>

      {/* ── Two-Column: Activity Feed + System Health ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* ── Recent Activity Feed ── */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24 }}>
          <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
            <Radio size={16} color="#dc2626" /> Live Activity
            <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: 4, background: '#22c55e', animation: 'pulseRed 2s infinite' }} />
          </h3>

          {/* Active SOS */}
          {activeSosList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {activeSosList.slice(0, 5).map(sos => (
                <div key={sos.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(220,38,38,0.04)', borderLeft: `3px solid ${SOS_STATUS_COLORS[sos.status] || '#dc2626'}`,
                }}>
                  <span style={{ fontSize: 20 }}>{SOS_ICONS[sos.type] || '⚠'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{sos.type} Emergency</div>
                    <div style={{ color: '#888', fontSize: 11 }}>
                      {sos.lat?.toFixed(3)}, {sos.lng?.toFixed(3)} · {sos.displayName || 'Anonymous'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#888', fontSize: 10 }}>{formatTimeAgo(sos.timestamp)}</div>
                    <div style={{
                      color: SOS_STATUS_COLORS[sos.status] || '#888', fontSize: 10,
                      fontWeight: 700, textTransform: 'uppercase', marginTop: 2
                    }}>{sos.status}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#555', fontSize: 13 }}>
              <Activity size={24} style={{ marginBottom: 8, opacity: 0.4 }} /><br />
              No active SOS alerts
            </div>
          )}

          {/* Recent Reports */}
          {recentReports.length > 0 && (
            <>
              <div style={{ color: '#666', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>Recent Reports</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentReports.map(r => (
                  <div key={r._id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <span style={{ fontSize: 16 }}>{ISSUE_ICONS[r.calamityType] || '⚠'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: ISSUE_COLORS[r.calamityType] || '#f59e0b' }}>{r.calamityType}</div>
                      <div style={{ color: '#666', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.locationAddress}</div>
                    </div>
                    <span style={{ color: '#555', fontSize: 10, flexShrink: 0 }}>{formatReportTime(r.createdAt)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── System Health ── */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24 }}>
          <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
            <Server size={16} color="#22c55e" /> System Health
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Backend API */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <Wifi size={18} color={backendStatus === 'online' ? '#22c55e' : backendStatus === 'degraded' ? '#f59e0b' : '#dc2626'} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Backend API</div>
                <div style={{ color: '#666', fontSize: 11 }}>Express + MongoDB</div>
              </div>
              <span style={{
                padding: '4px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                background: backendStatus === 'online' ? 'rgba(34,197,94,0.1)' : backendStatus === 'degraded' ? 'rgba(245,158,11,0.1)' : 'rgba(220,38,38,0.1)',
                color: backendStatus === 'online' ? '#22c55e' : backendStatus === 'degraded' ? '#f59e0b' : '#dc2626',
              }}>
                {backendStatus === 'checking' ? '...' : backendStatus}
              </span>
            </div>

            {/* Firebase */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <Database size={18} color="#f59e0b" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Firebase</div>
                <div style={{ color: '#666', fontSize: 11 }}>Firestore + Realtime DB</div>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>Online</span>
            </div>

            {/* Active Resources */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <Activity size={18} color="#3b82f6" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Active Resources</div>
                <div style={{ color: '#666', fontSize: 11 }}>{metrics.respondersOnline} responders · {metrics.teamsReady} teams ready</div>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{metrics.respondersOnline + metrics.teamsReady} total</span>
            </div>

            {/* Pending Items */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <Clock size={18} color="#a855f7" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Pending Items</div>
                <div style={{ color: '#666', fontSize: 11 }}>{metrics.pendingVolunteers} volunteers · {metrics.issuesReported} reports</div>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>{metrics.pendingVolunteers + metrics.issuesReported} total</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
