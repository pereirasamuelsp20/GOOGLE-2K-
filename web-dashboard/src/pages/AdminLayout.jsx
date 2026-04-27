import React from 'react';
import FALLBACK_LOCATIONS from '../data/importantLocations';
import { Routes, Route, useLocation } from 'react-router-dom';
import AdminOverview from './admin/AdminOverview';
import AdminAnnouncements from './admin/AdminAnnouncements';
import AdminVolunteers from './admin/AdminVolunteers';
import AdminTeams from './admin/AdminTeams';
import AdminUsers from './admin/AdminUsers';

// Re-use existing components for sections that already work
import CommunityScreen from './CommunityScreen';

// Inline LiveSOS + Responders from old AdminLayout (kept compact)
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { ref, onValue, update } from 'firebase/database';
import { db, rtdb } from '../firebase';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:4000/api';

const pulseIcon = L.divIcon({
  className: 'pulse-icon-container',
  html: '<div style="width:14px;height:14px;background:#dc2626;border-radius:50%;border:2px solid white;animation:pulseRed 1.5s infinite"></div>',
  iconSize: [24, 24], iconAnchor: [12, 12]
});

function LiveSos() {
  const [sosList, setSosList] = useState([]);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    const uS = onValue(ref(rtdb, 'sos'), snap => {
      const data = snap.val();
      const arr = [];
      if (data) {
        Object.keys(data).forEach(k => {
          if (data[k].status === 'searching' || data[k].status === 'routed') {
            arr.push({ id: k, ...data[k] });
          }
        });
      }
      arr.sort((a, b) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0));
      setSosList(arr);
    });
    const uT = onSnapshot(query(collection(db, 'teams'), where('status', '==', 'ready')), snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => a.priority - b.priority);
      setTeams(arr);
    });
    return () => { uS(); uT(); };
  }, []);

  const handleDispatchTeam = async (sos, team) => {
    try {
      await update(ref(rtdb, `sos/${sos.id}`), { status: 'routed', teamId: team.id });
      await updateDoc(doc(db, 'teams', team.id), { status: 'dispatched', dispatchedSosId: sos.id });
    } catch (e) { alert('Dispatch failed: ' + e.message); }
  };

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ marginBottom: 8 }}>Live SOS Alerts</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        {sosList.length} active alerts | {teams.length} teams ready
      </p>

      {sosList.length === 0 && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No active SOS alerts
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sosList.map(sos => (
          <div key={sos.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderLeft: '4px solid #dc2626', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{sos.type?.toUpperCase()}</span>
                <span style={{ color: '#dc2626', marginLeft: 12, fontSize: 12, fontWeight: 700 }}>{sos.status?.toUpperCase()}</span>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {sos.lat?.toFixed(4)}, {sos.lng?.toFixed(4)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {teams.map(t => (
                <button key={t.id} onClick={() => handleDispatchTeam(sos, t)} style={{
                  background: 'var(--primary-red)', color: 'white', border: 'none',
                  padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12
                }}>
                  Dispatch {t.name}
                </button>
              ))}
              {teams.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No teams ready</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Responders() {
  const [list, setList] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'responders'), snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setList(arr);
    });
    return () => unsub();
  }, []);

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ marginBottom: 8 }}>Responder Network</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        {list.length} total | {list.filter(r => r.available).length} online
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {list.map(r => (
          <div key={r.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: 20, borderRadius: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{r.name || 'Unknown'}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: 6 }}>{r.role}</span>
              <span style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                background: r.available ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                color: r.available ? '#22c55e' : '#888'
              }}>
                {r.available ? 'ONLINE' : 'OFFLINE'}
              </span>
              {r.teamId && <span style={{ fontSize: 11, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', padding: '4px 10px', borderRadius: 6 }}>{r.teamId.replace('_', ' ')}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Location marker icons for admin mesh map ──
const LOCATION_COLORS = { hospital: '#22C55E', fire_station: '#EF4444', police: '#3B82F6', shelter: '#F59E0B' };
const LOCATION_ICONS = { hospital: '🏥', fire_station: '🚒', police: '🚔', shelter: '🏠' };
const LOCATION_LABELS = { hospital: 'Hospital', fire_station: 'Fire Station', police: 'Police Station', shelter: 'Shelter' };

function createLocIcon(type) {
  const c = LOCATION_COLORS[type] || '#888';
  const ic = LOCATION_ICONS[type] || '📍';
  return L.divIcon({
    className: '',
    html: `<svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="${c}" stroke="#fff" stroke-width="2" opacity="0.9"/><text x="15" y="16" text-anchor="middle" dominant-baseline="central" font-size="13">${ic}</text></svg>`,
    iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -17]
  });
}

const fetchLocations = async () => {
  try {
    const res = await fetch(`${API_BASE}/locations`);
    if (!res.ok) throw new Error('Failed to fetch locations');
    return res.json();
  } catch (e) {
    console.warn('[MeshMap] API unavailable, using fallback locations:', e.message);
    return FALLBACK_LOCATIONS;
  }
};

// Mumbai landmarks — same as mobile app's NativeMapComponent
const MUMBAI_LANDMARKS = [
  { name: 'Gateway of India', lat: 18.9220, lng: 72.8347 },
  { name: 'CST Station', lat: 18.9398, lng: 72.8355 },
  { name: 'Bandra-Worli Sea Link', lat: 19.0380, lng: 72.8162 },
  { name: 'Marine Drive', lat: 18.9432, lng: 72.8235 },
  { name: 'Mumbai Airport', lat: 19.0896, lng: 72.8656 },
  { name: 'Haji Ali', lat: 18.9827, lng: 72.8089 },
  { name: 'Juhu Beach', lat: 19.0988, lng: 72.8267 },
  { name: 'Siddhivinayak Temple', lat: 19.0169, lng: 72.8306 },
];

const landmarkIcon = L.divIcon({
  className: '',
  html: '<div style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.2)"></div>',
  iconSize: [8, 8], iconAnchor: [4, 4],
});

// Mesh Map page (full map with SOS + issues + important locations)
function AdminMeshMap() {
  const [sosList, setSosList] = useState([]);
  const [locationFilters, setLocationFilters] = useState({
    hospital: true, fire_station: true, police: true, shelter: true,
  });

  useEffect(() => {
    const uS = onValue(ref(rtdb, 'sos'), snap => {
      const data = snap.val();
      const arr = [];
      if (data) Object.keys(data).forEach(k => arr.push({ id: k, ...data[k] }));
      setSosList(arr);
    });
    return () => uS();
  }, []);

  // Fetch important locations
  const { data: importantLocations = FALLBACK_LOCATIONS } = useQuery({
    queryKey: ['importantLocations'],
    queryFn: fetchLocations,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialData: FALLBACK_LOCATIONS,
    retry: 1,
  });

  const filteredLocations = importantLocations.filter(l => locationFilters[l.type]);

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <MapContainer center={[19.0760, 72.8777]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <ZoomControl position="bottomright" />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {sosList.filter(s => s.lat && s.lng).map(sos => (
          <Marker key={sos.id} position={[sos.lat, sos.lng]} icon={pulseIcon}>
            <Popup>
              <strong>{sos.type}</strong><br />
              Status: {sos.status}<br />
              {sos.teamId && <>Team: {sos.teamId}<br /></>}
            </Popup>
          </Marker>
        ))}
        {/* Important Locations */}
        {filteredLocations.map((loc) => (
          <Marker key={loc.id || `${loc.lat}-${loc.lng}`} position={[loc.lat, loc.lng]} icon={createLocIcon(loc.type)}>
            <Popup>
              <div style={{ color: '#fff', minWidth: 200 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: LOCATION_COLORS[loc.type], marginBottom: 4 }}>
                  {LOCATION_ICONS[loc.type]} {loc.name}
                </div>
                <div style={{ color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  {LOCATION_LABELS[loc.type]}
                </div>
                <div style={{ color: '#bbb', fontSize: 12, lineHeight: 1.4 }}>{loc.address}</div>
                {loc.phone && <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>📞 {loc.phone}</div>}
              </div>
            </Popup>
          </Marker>
        ))}
        {/* Mumbai Landmarks — same as mobile app */}
        {MUMBAI_LANDMARKS.map((lm) => (
          <Marker key={lm.name} position={[lm.lat, lm.lng]} icon={landmarkIcon}>
            <Popup>
              <div style={{ color: '#fff', minWidth: 140 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{lm.name}</div>
                <div style={{ color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Mumbai Landmark</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {/* Legend */}
      <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(13,13,20,0.9)', backdropFilter: 'blur(10px)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '10px 18px', zIndex: 1000, display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#dc2626', marginRight: 6 }} />SOS ({sosList.filter(s => s.status === 'searching').length})</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#f59e0b', marginRight: 6 }} />Routed ({sosList.filter(s => s.status === 'routed').length})</span>
      </div>
      {/* Location filter chips */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(13,13,20,0.9)', backdropFilter: 'blur(10px)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '8px 12px', zIndex: 1000, display: 'flex', gap: 8, fontSize: 11 }}>
        {Object.entries(LOCATION_LABELS).map(([type, label]) => (
          <button
            key={type}
            onClick={() => setLocationFilters(prev => ({ ...prev, [type]: !prev[type] }))}
            style={{
              padding: '4px 10px', borderRadius: 16, border: `1px solid ${locationFilters[type] ? LOCATION_COLORS[type] : '#333'}`,
              background: locationFilters[type] ? LOCATION_COLORS[type] + '22' : 'transparent',
              color: locationFilters[type] ? LOCATION_COLORS[type] : '#888',
              cursor: 'pointer', fontWeight: 600, fontSize: 10,
            }}
          >
            {LOCATION_ICONS[type]} {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <div style={{ height: '100vh', width: '100vw', background: 'var(--bg-color)', overflowY: 'auto', paddingTop: 60 }}>
      <Routes>
        <Route path="/" element={<AdminOverview />} />
        <Route path="/mesh-map" element={<div style={{ height: 'calc(100vh - 60px)' }}><AdminMeshMap /></div>} />
        <Route path="/live-sos" element={<LiveSos />} />
        <Route path="/announcements" element={<AdminAnnouncements />} />
        <Route path="/volunteers" element={<AdminVolunteers />} />
        <Route path="/teams" element={<AdminTeams />} />
        <Route path="/community" element={<CommunityScreen />} />
        <Route path="/users" element={<AdminUsers />} />
      </Routes>
    </div>
  );
}
