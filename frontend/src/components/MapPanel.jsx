import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup } from 'react-leaflet';
import { collection, onSnapshot } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { db, rtdb } from '../firebase';

export default function MapPanel() {
  const [sosList, setSosList] = useState([]);
  const [reports, setReports] = useState([]);

  // SOS via RTDB for instant sync with mobile app
  useEffect(() => {
    const unsub = onValue(ref(rtdb, 'sos'), snap => {
      const raw = snap.val();
      const data = [];
      if (raw) {
        Object.keys(raw).forEach(k => {
          const s = raw[k];
          if ((s.status === 'searching' || s.status === 'routed') && s.lat && s.lng) {
            data.push({ id: k, ...s });
          }
        });
      }
      setSosList(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reports'), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.lat && d.lng) data.push({ id: doc.id, ...d });
      });
      setReports(data);
    });
    return () => unsub();
  }, []);

  const getWeightColor = (type) => {
    if (type === 'Medical') return 'rgba(0, 191, 255, 0.8)';
    if (type === 'Fire') return 'rgba(255, 0, 0, 0.8)';
    if (type === 'Security') return 'rgba(255, 165, 0, 0.8)';
    return 'rgba(255, 0, 0, 0.5)';
  };

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#0A0A0A' }}>
      <MapContainer center={[19.0760, 72.8777]} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        
        {sosList.map(sos => (
          <Circle 
            key={sos.id} 
            center={[sos.lat, sos.lng]} 
            radius={200 + (sos.type === 'Medical' ? 100 : 0)}
            pathOptions={{ 
              color: getWeightColor(sos.type), 
              fillColor: getWeightColor(sos.type), 
              fillOpacity: 0.5 
            }}
          >
            <Popup>{sos.type} Emergency</Popup>
          </Circle>
        ))}

        {reports.map(rep => (
          <CircleMarker 
            key={rep.id} 
            center={[rep.lat, rep.lng]}
            radius={8}
            pathOptions={{ color: '#fff', fillColor: '#3b82f6', fillOpacity: 0.8, weight: 2 }}
          >
            <Popup>{rep.title || 'Report'}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
