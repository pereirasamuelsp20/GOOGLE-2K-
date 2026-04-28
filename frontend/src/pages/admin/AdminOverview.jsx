import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, onValue, remove, set } from 'firebase/database';
import { db, rtdb } from '../../firebase';
import { API_BASE } from '../../apiConfig';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Activity, Users, AlertTriangle, Shield, Truck, Trash2 } from 'lucide-react';

const pulseIconRed = L.divIcon({
  className: 'pulse-icon-container',
  html: '<div style="width:14px;height:14px;background:#dc2626;border-radius:50%;border:2px solid white;box-shadow:0 0 0 0 rgba(220,38,38,0.7);animation:pulseRed 1.5s infinite"></div>',
  iconSize: [24, 24], iconAnchor: [12, 12]
});

export default function AdminOverview() {
  const [metrics, setMetrics] = useState({
    activeSos: 0, teamsReady: 0, pendingVolunteers: 0,
    issuesReported: 0, respondersOnline: 0, roadBlockages: 0
  });
  const [activeSosList, setActiveSosList] = useState([]);
  const [zones, setZones] = useState([]);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

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
    // Zones
    const uZ = onSnapshot(collection(db, 'zones'), snap => {
      const z = [];
      snap.forEach(doc => {
        const d = doc.data();
        const now = Date.now();
        const timeDiff = d.updatedAt?.toMillis ? (now - d.updatedAt.toMillis()) : 0;
        const o = Math.max(0, 1 - (timeDiff / (4 * 3600 * 1000)));
        if (o > 0) z.push({ ...d, dynamicOpacity: o, id: doc.id });
      });
      setZones(z);
    });

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

    // Fetch reported issues from backend for metrics
    const fetchIssueMetrics = async () => {
      try {
        const res = await fetch(`${API_BASE}/reports`);
        if (res.ok) {
          const data = await res.json();
          const total = data.length;
          const roadBlocks = data.filter(r => r.calamityType === 'Road Blocked').length;
          setMetrics(m => ({ ...m, issuesReported: total, roadBlockages: roadBlocks }));
        }
      } catch (e) {
        console.warn('Failed to fetch issue metrics:', e.message);
      }
    };
    fetchIssueMetrics();
    const issueInterval = setInterval(fetchIssueMetrics, 10000);

    return () => { uZ(); uT(); uV(); uR(); uS(); clearInterval(issueInterval); };
  }, []);

  const getZoneColor = (type) => {
    if (type === 'danger') return '#dc2626';
    if (type === 'blocked') return '#f97316';
    if (type === 'safe') return '#22c55e';
    return '#3b82f6';
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

      <h3 style={{ marginBottom: 16 }}>Live Map</h3>
      <div style={{ height: 400, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <MapContainer center={[19.0760, 72.8777]} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {zones.map((z, i) => (
            <Circle
              key={z.id || i}
              center={[z.center?.lat || 0, z.center?.lng || 0]}
              radius={z.radius || 500}
              pathOptions={{ color: getZoneColor(z.type), fillColor: getZoneColor(z.type), fillOpacity: (z.dynamicOpacity || 0.5) * 0.4 }}
            />
          ))}
          {activeSosList.map(sos => (
            <Marker key={sos.id} position={[sos.lat || 0, sos.lng || 0]} icon={pulseIconRed}>
              <Popup>
                <strong>{sos.type}</strong><br />
                Status: {sos.status}<br />
                UID: {sos.uid?.substring(0, 10)}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
