import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc, getDocs } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { db, rtdb } from '../../firebase';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Activity, Users, AlertTriangle, Shield, Truck } from 'lucide-react';

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
          { id: 'team_alpha', name: 'Team Alpha', priority: 1, vehicle: '🚑', status: 'ready', members: [
            { role: 'Doctor', name: 'Dr. Arjun Mehta', email: 'team1.doctor@reliefmesh.com' },
            { role: 'Nurse', name: 'Priya Sharma', email: 'team1.nurse@reliefmesh.com' },
            { role: 'Paramedic', name: 'Rahul Verma', email: 'team1.paramedic@reliefmesh.com' },
            { role: 'Driver', name: 'Sunil Patil', email: 'team1.driver@reliefmesh.com' },
          ]},
          { id: 'team_bravo', name: 'Team Bravo', priority: 2, vehicle: '🚑', status: 'ready', members: [
            { role: 'Doctor', name: 'Dr. Kavita Iyer', email: 'team2.doctor@reliefmesh.com' },
            { role: 'Nurse', name: 'Anita Desai', email: 'team2.nurse@reliefmesh.com' },
            { role: 'Paramedic', name: 'Vikram Singh', email: 'team2.paramedic@reliefmesh.com' },
            { role: 'Driver', name: 'Manoj Kulkarni', email: 'team2.driver@reliefmesh.com' },
          ]},
          { id: 'team_charlie', name: 'Team Charlie', priority: 3, vehicle: '🚑', status: 'ready', members: [
            { role: 'Doctor', name: 'Dr. Neha Joshi', email: 'team3.doctor@reliefmesh.com' },
            { role: 'Nurse', name: 'Deepika Rao', email: 'team3.nurse@reliefmesh.com' },
            { role: 'Paramedic', name: 'Amit Thakur', email: 'team3.paramedic@reliefmesh.com' },
            { role: 'Driver', name: 'Rajesh Gupta', email: 'team3.driver@reliefmesh.com' },
          ]},
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
          if (data[k].status === 'searching' || data[k].status === 'routed') {
            active++;
            arr.push({ id: k, ...data[k] });
          }
        });
      }
      setActiveSosList(arr);
      setMetrics(m => ({ ...m, activeSos: active }));
    });

    return () => { uZ(); uT(); uV(); uR(); uS(); };
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
    { label: 'Road Blockages', value: metrics.roadBlockages, color: '#f97316', icon: AlertTriangle },
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
