import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore';
import { ref, update, onValue } from 'firebase/database';
import { db, rtdb } from '../firebase';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import * as geofire from 'geofire-common'; // Note: geofire-common exports distanceBetween, but user explicitly asked "calculate distance using Haversine formula in JS" so I'll write the raw Haversine below.

// Haversine Distance Formula (km)
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const pulseIconRed = L.divIcon({
  className: 'pulse-icon-container',
  html: '<div style="width: 14px; height: 14px; background-color: #dc2626; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); animation: pulseRed 1.5s infinite;"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

function Overview() {
  const [metrics, setMetrics] = useState({ activeSos: 0, unassigned: 0, respondersOnline: 0, critZones: 0 });
  const [zones, setZones] = useState([]);
  const [activeSosList, setActiveSosList] = useState([]);

  useEffect(() => {
    // Zones
    const uZ = onSnapshot(collection(db, 'zones'), snap => {
      let crit = 0;
      const z = [];
      const now = Date.now();
      snap.forEach(doc => {
        const d = doc.data();
        if(d.confidence >= 0.5) crit++;
        const timeDiff = d.updatedAt?.toMillis ? (now - d.updatedAt.toMillis()) : 0;
        const o = Math.max(0, 1 - (timeDiff / (4*3600*1000)));
        if (o > 0) z.push({...d, dynamicOpacity: o, id: doc.id});
      });
      setZones(z);
      setMetrics(m => ({ ...m, critZones: crit }));
    });

    // Responders
    const uR = onSnapshot(query(collection(db, 'responders'), where('available', '==', true)), snap => {
      setMetrics(m => ({ ...m, respondersOnline: snap.size, unassigned: snap.size }));
    });

    // SOS (RTDB)
    const sosRef = ref(rtdb, 'sos');
    const uS = onValue(sosRef, snap => {
      const data = snap.val();
      let active = 0;
      const sosArr = [];
      if (data) {
        Object.keys(data).forEach(k => {
          if (data[k].status === 'searching' || data[k].status === 'routed') {
            active++;
            sosArr.push({ id: k, ...data[k] });
          }
        });
      }
      setActiveSosList(sosArr);
      setMetrics(m => ({ ...m, activeSos: active }));
    });

    return () => { uZ(); uR(); uS(); };
  }, []);

  const getZoneColor = (type) => {
    if(type === 'danger') return '#dc2626';
    if(type === 'blocked') return '#f97316';
    if(type === 'safe') return '#22c55e';
    return '#3b82f6';
  };

  return (
    <div style={{ padding: 32 }}>
      <h2>System Overview</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: 24, marginBottom: 32 }}>
        <div className="metric-card">
          <div className="metric-val" style={{ color: 'var(--primary-red)' }}>{metrics.activeSos}</div>
          <div className="metric-label">Active SOS</div>
        </div>
        <div className="metric-card">
          <div className="metric-val" style={{ color: 'var(--accent-orange)' }}>{metrics.unassigned}</div>
          <div className="metric-label">Unassigned</div>
        </div>
        <div className="metric-card">
          <div className="metric-val" style={{ color: 'var(--accent-green)' }}>{metrics.respondersOnline}</div>
          <div className="metric-label">Responders Online</div>
        </div>
        <div className="metric-card">
          <div className="metric-val" style={{ color: 'var(--primary-red)' }}>{metrics.critZones}</div>
          <div className="metric-label">Critical Zones</div>
        </div>
      </div>

      <div style={{ height: 380, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <MapContainer center={[19.0760, 72.8777]} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {zones.map((z, i) => (
            <Circle 
              key={z.id || i}
              center={[z.center.lat, z.center.lng]}
              radius={z.radius}
              pathOptions={{ color: getZoneColor(z.type), fillColor: getZoneColor(z.type), fillOpacity: z.dynamicOpacity * 0.4, opacity: z.dynamicOpacity }}
            />
          ))}

          {activeSosList.map(sos => (
            <Marker key={sos.id} position={[sos.lat, sos.lng]} icon={pulseIconRed}>
              <Popup>
                <strong>{sos.type}</strong><br/>
                Time: {new Date(sos.createdAt).toLocaleTimeString()}<br/>
                Status: {sos.status}<br/>
                Assigned: {sos.responderId || "Unassigned"}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

function LiveSos() {
  const [sosList, setSosList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetSos, setTargetSos] = useState(null);
  const [responders, setResponders] = useState([]);

  useEffect(() => {
    const sosRef = ref(rtdb, 'sos');
    const uS = onValue(sosRef, snap => {
      const data = snap.val();
      const arr = [];
      if (data) {
        Object.keys(data).forEach(k => {
          if (data[k].status === 'searching') {
            arr.push({ id: k, ...data[k] });
          }
        });
      }
      arr.sort((a,b) => b.createdAt - a.createdAt);
      setSosList(arr);
    });
    return () => uS();
  }, []);

  const openAssignModal = (sos) => {
    setTargetSos(sos);
    
    // Fetch responders and calculate Haversine
    onSnapshot(query(collection(db, 'responders'), where('available', '==', true)), snap => {
      const list = [];
      snap.forEach(d => {
        const r = { id: d.id, ...d.data() };
        if (r.lat && r.lng) {
          r.distance = getDistance(sos.lat, sos.lng, r.lat, r.lng);
          list.push(r);
        } else if (r.currentLocation) {
          r.distance = getDistance(sos.lat, sos.lng, r.currentLocation.latitude, r.currentLocation.longitude);
          list.push(r);
        }
      });
      list.sort((a,b) => a.distance - b.distance);
      setResponders(list);
    });

    setModalOpen(true);
  };

  const handleAssign = async (responder) => {
    // Update RTDB status
    await update(ref(rtdb, `sos/${targetSos.id}`), {
      status: 'routed',
      responderId: responder.id
    });
    
    // Write Assignment ticket to Firestore
    await setDoc(doc(db, 'assignments', targetSos.id), {
      sosId: targetSos.id,
      responderId: responder.id,
      responderName: responder.name,
      assignedAt: Date.now()
    });

    setModalOpen(false);
    setTargetSos(null);
  };

  return (
    <div style={{ padding: 32 }}>
      <h2>Live SOS Needs Assignment</h2>
      
      <table style={{ width: '100%', marginTop: 24, borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
            <th style={{ padding: 12 }}>Time</th>
            <th style={{ padding: 12 }}>Type</th>
            <th style={{ padding: 12 }}>Location</th>
            <th style={{ padding: 12 }}>Status</th>
            <th style={{ padding: 12 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {sosList.map(sos => (
            <tr key={sos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: 12 }}>{new Date(sos.createdAt).toLocaleTimeString()}</td>
              <td style={{ padding: 12, fontWeight: 600 }}>{sos.type}</td>
              <td style={{ padding: 12 }}>{sos.lat.toFixed(4)}, {sos.lng.toFixed(4)}</td>
              <td style={{ padding: 12, color: 'var(--primary-red)' }}>{sos.status}</td>
              <td style={{ padding: 12 }}>
                <button onClick={() => openAssignModal(sos)} style={{ background: 'var(--primary-red)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>
                  Assign
                </button>
              </td>
            </tr>
          ))}
          {sosList.length === 0 && (
            <tr><td colSpan="5" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No pending SOS.</td></tr>
          )}
        </tbody>
      </table>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16, width: 500, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3>Assign Unit for {targetSos?.type}</h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
              {responders.map((r, idx) => (
                <div key={r.id} style={{ background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: idx===0 ? '1px solid var(--accent-blue)' : 'none' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.role} • {r.distance.toFixed(2)} km away</div>
                  </div>
                  <button onClick={() => handleAssign(r)} style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: 6, cursor: 'pointer' }}>
                    Select
                  </button>
                </div>
              ))}
              {responders.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No available responders with location.</p>}
            </div>
          </div>
        </div>
      )}
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
      <h2>Responder Network</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20, marginTop: 24 }}>
        {list.map(r => (
          <div key={r.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: 20, borderRadius: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{r.name || 'Unknown Unit'}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 4 }}>{r.role}</span>
              <span style={{ fontSize: 11, background: r.available ? 'var(--accent-green)' : 'var(--text-muted)', color: r.available?'white':'#000', padding: '4px 8px', borderRadius: 4 }}>
                {r.available ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const loc = useLocation();

  const getLinkStyle = (path) => ({
    display: 'block',
    padding: '12px 16px',
    borderRadius: 8,
    color: loc.pathname === path ? 'white' : 'var(--text-muted)',
    background: loc.pathname === path ? 'var(--primary-red)' : 'transparent',
    textDecoration: 'none',
    fontWeight: 600,
    marginBottom: 8
  });

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-color)' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: '#0d0d14', borderRight: '1px solid var(--border-color)', padding: 24 }}>
        <h2 style={{ color: 'white', marginBottom: 40, letterSpacing:-0.5 }}>ReliefMesh</h2>
        
        <Link to="/admin" style={getLinkStyle('/admin')}>Overview</Link>
        <Link to="/admin/live-sos" style={getLinkStyle('/admin/live-sos')}>Live SOS</Link>
        <Link to="/admin/responders" style={getLinkStyle('/admin/responders')}>Responders</Link>
        
        <Link to="/map" style={{ ...getLinkStyle(''), marginTop: 40, border: '1px solid var(--border-color)' }}>Exit to Map</Link>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/live-sos" element={<LiveSos />} />
          <Route path="/responders" element={<Responders />} />
        </Routes>
      </div>
    </div>
  );
}
