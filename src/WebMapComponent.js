import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { firestore } from './firebaseConfig';

const createPulseIcon = () => {
  return L.divIcon({
    className: 'pulse-icon-container',
    html: '<div style="width:14px; height:14px; background-color:#3b82f6; border-radius:50%; border:2px solid white; box-shadow: 0 0 10px #3b82f6;"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
};

export default function WebMapComponent({ userLoc }) {
  const [zones, setZones] = useState([]);
  const [sosList, setSosList] = useState([]);

  useEffect(() => {
    // Zones Listener
    const unsub = onSnapshot(collection(firestore, 'zones'), snap => {
      const z = [];
      const now = Date.now();
      snap.forEach(doc => {
        const d = doc.data();
        if(!d.center) return;
        z.push({ id: doc.id, ...d });
      });
      setZones(z);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // SOS Listener
    const q = query(collection(firestore, 'sos'), where('status', 'in', ['searching', 'routed', 'responding']));
    const unsub = onSnapshot(q, snap => {
      const data = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.lat && d.lng) data.push({ id: doc.id, ...d });
      });
      setSosList(data);
    });
    return () => unsub();
  }, []);

  const getWeightColor = (type) => {
    if (type === 'Medical') return 'rgba(0, 191, 255, 0.8)';
    if (type === 'Fire') return 'rgba(255, 0, 0, 0.8)';
    if (type === 'Security') return 'rgba(255, 165, 0, 0.8)';
    return 'rgba(255, 0, 0, 0.5)';
  };

  const getZoneColor = (type) => {
    if(type === 'danger') return '#dc2626';
    if(type === 'blocked') return '#f97316';
    if(type === 'safe') return '#22c55e';
    return '#3b82f6';
  };

  const center = userLoc ? [userLoc.latitude, userLoc.longitude] : [19.0760, 72.8777]; // Default Mumbai

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ height: '100%', width: '100%', backgroundColor: '#0f0f0f' }} 
        zoomControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        
        {userLoc && (
          <Marker position={[userLoc.latitude, userLoc.longitude]} icon={createPulseIcon()} />
        )}

        {sosList.map(sos => (
          <Circle 
            key={sos.id} 
            center={[sos.lat, sos.lng]} 
            radius={sos.type === 'Medical' ? 300 : 200}
            pathOptions={{ 
              color: getWeightColor(sos.type), 
              fillColor: getWeightColor(sos.type), 
              fillOpacity: 0.5 
            }}
          >
            <Popup>{sos.type} Emergency</Popup>
          </Circle>
        ))}

        {zones.map((z, i) => (
          <Circle 
            key={z.id || i}
            center={[z.center.lat, z.center.lng]}
            radius={z.radius || 100}
            pathOptions={{ color: getZoneColor(z.type), fillColor: getZoneColor(z.type), fillOpacity: 0.4 }}
          >
            <Popup>{z.reason || 'Reported Zone'}</Popup>
          </Circle>
        ))}
      </MapContainer>
    </div>
  );
}
