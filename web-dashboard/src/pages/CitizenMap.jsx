import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Polyline, Marker, useMapEvents } from 'react-leaflet';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, limit, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ORS_API_KEY } from '../config';
import { Navigation, AlertTriangle, Shield, Flame, Activity as ActivitySquare, ChevronRight, Target } from 'lucide-react';
import L from 'leaflet';

// Create a custom pulsing blue dot icon
const createPulseIcon = () => {
  return L.divIcon({
    className: 'pulse-icon-container',
    html: '<div class="pulse-dot-blue"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const pulseIcon = createPulseIcon();

// Custom hook to detect map clicks for routing
function MapInteractionHandler({ routingMode, onMapClick }) {
  useMapEvents({
    click(e) {
      if (routingMode) {
        onMapClick(e.latlng);
      }
    }
  });
  return null;
}

export default function CitizenMap() {
  const [userLoc, setUserLoc] = useState([19.0760, 72.8777]); // Default Mumbai
  const [zones, setZones] = useState([]);
  const [reports, setReports] = useState([]);
  
  // States
  const [isFeedOpen, setIsFeedOpen] = useState(false);
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Debris');
  const [showSosOptions, setShowSosOptions] = useState(false);
  const [activeSosStatus, setActiveSosStatus] = useState(null);
  const [activeSosId, setActiveSosId] = useState(null);
  const [routingMode, setRoutingMode] = useState(false);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);

  const mapRef = useRef();
  
  // Geolocation
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        setUserLoc([pos.coords.latitude, pos.coords.longitude]);
      },
      err => console.warn(err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Zones Listener (Firestore)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'zones'), snap => {
      const z = [];
      const now = Date.now();
      snap.forEach(doc => {
        const d = doc.data();
        if(!d.center || !d.updatedAt) return;
        
        let timeDiff = 0;
        if (d.updatedAt.toMillis) {
           timeDiff = now - d.updatedAt.toMillis();
        } else if (typeof d.updatedAt === 'number') {
           timeDiff = now - d.updatedAt;
        }

        const maxAge = 4 * 60 * 60 * 1000;
        if (timeDiff > maxAge) return; // Hide older than 4 hours

        const calcOpacity = Math.max(0, 1 - (timeDiff / maxAge));
        z.push({ id: doc.id, ...d, dynamicOpacity: calcOpacity });
      });
      setZones(z);
    });
    return () => unsub();
  }, []);

  // Reports Listener (Firestore)
  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(30));
    const unsub = onSnapshot(q, snap => {
      const r = [];
      snap.forEach(doc => r.push({ id: doc.id, ...doc.data() }));
      setReports(r);
    });
    return () => unsub();
  }, []);

  const handleLocateMe = () => {
    if (mapRef.current && userLoc) {
      mapRef.current.flyTo(userLoc, 15, { duration: 1.5 });
    }
  };

  const handleReportSubmit = async () => {
    await addDoc(collection(db, 'zones'), {
      type: 'blocked',
      center: { lat: userLoc[0], lng: userLoc[1] },
      radius: 100,
      confidence: 0.2,
      reason: reportReason,
      updatedAt: serverTimestamp()
    });
    setIsReportSheetOpen(false);
    // Real implementation would use a toast library here
    alert("Road reported — thank you");
  };

  const calculateRoute = async (destLatLng) => {
    setRoutingMode(false);
    
    // Prepare avoid polygons (danger + blocked)
    const avoidPolygons = zones.filter(z => z.type === 'danger' || z.type === 'blocked').map(z => {
      // Rough approximation of circle to polygon (bounding box or simple diamond for ORS)
      // OpenRouteService avoid_polygons expects an array of polygons, each polygon is array of [lng, lat]
      const latOffset = (z.radius / 111320);
      const lngOffset = (z.radius / (40075000 * Math.cos(z.center.lat * Math.PI / 180) / 360));
      return [
        [z.center.lng - lngOffset, z.center.lat - latOffset],
        [z.center.lng + lngOffset, z.center.lat - latOffset],
        [z.center.lng + lngOffset, z.center.lat + latOffset],
        [z.center.lng - lngOffset, z.center.lat + latOffset],
        [z.center.lng - lngOffset, z.center.lat - latOffset] // close loop
      ];
    });

    const body = {
      coordinates: [
        [userLoc[1], userLoc[0]], // [lng, lat]
        [destLatLng.lng, destLatLng.lat]
      ]
    };

    if (avoidPolygons.length > 0) {
      body.options = { avoid_polygons: { type: "MultiPolygon", coordinates: [avoidPolygons] } };
    }

    try {
      const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: {
          'Authorization': ORS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]); // Leaflet uses [lat, lng]
        setRoutePolyline(coords);
        
        const summary = data.features[0].properties.summary;
        setRouteInfo({ distance: (summary.distance / 1000).toFixed(1) + ' km', duration: Math.ceil(summary.duration / 60) + ' min' });
      } else {
        alert("Could not find a safe route.");
      }
    } catch(e) {
      alert("Routing failed: " + e.message);
    }
  };

  const sendSOS = async (type) => {
    setShowSosOptions(false);
    const ts = Date.now().toString();
    const uid = auth.currentUser?.uid || 'anon';
    
    const payload = {
      uid,
      type,
      lat: userLoc[0],
      lng: userLoc[1],
      status: 'searching',
      message: '',
      timestamp: Date.now()
    };
    
    await setDoc(doc(db, 'sos', ts), payload);
    setActiveSosId(ts);
    setActiveSosStatus('searching');
    
    // Live Strip Listener
    onSnapshot(doc(db, 'sos', ts), snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.status) {
          setActiveSosStatus(data.status);
          if (data.status === 'cancelled') {
             setActiveSosStatus(null);
             setActiveSosId(null);
          }
        }
      }
    });
  };

  const cancelSOS = async () => {
    if (activeSosId) {
      await setDoc(doc(db, 'sos', activeSosId), { status: 'cancelled' }, { merge: true });
      setActiveSosStatus(null);
      setActiveSosId(null);
      alert('SOS Cancelled');
    }
  };

  const getZoneColor = (type) => {
    if(type === 'danger') return '#dc2626';
    if(type === 'blocked') return '#f97316';
    if(type === 'safe') return '#22c55e';
    return '#3b82f6';
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
      
      {/* Map Layer */}
      <MapContainer 
        center={userLoc} 
        zoom={13} 
        ref={mapRef}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        <MapInteractionHandler routingMode={routingMode} onMapClick={calculateRoute} />

        <Marker position={userLoc} icon={pulseIcon} />

        {zones.map((z, i) => (
          <Circle 
            key={z.id || i}
            center={[z.center.lat, z.center.lng]}
            radius={z.radius}
            pathOptions={{ color: getZoneColor(z.type), fillColor: getZoneColor(z.type), fillOpacity: z.dynamicOpacity * 0.4, opacity: z.dynamicOpacity }}
          />
        ))}

        {routePolyline && (
          <Polyline positions={routePolyline} pathOptions={{ color: '#3b82f6', weight: 5 }} />
        )}
      </MapContainer>

      {/* Overlays / UI */}
      
      {/* Live Feed Sidebar */}
      <div className={`live-feed-panel ${isFeedOpen ? 'open' : ''}`}>
        <button className="feed-toggle" onClick={() => setIsFeedOpen(!isFeedOpen)}>
          <ChevronRight size={20} style={{ transform: isFeedOpen ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
        </button>
        <div style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16 }}>Live Community Feed</h3>
          {reports.map(r => (
            <div key={r.id} style={{ padding: 12, borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
              <strong>{r.category || 'Update'}</strong>
              <p style={{ color: 'var(--text-muted)' }}>{r.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)' }}>{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleTimeString() : 'Recent'}</span>
                {r.upvotes > 3 && <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Verified ✓</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Buttons */}
      <button className="fab-report" onClick={() => setIsReportSheetOpen(true)}>
        <AlertTriangle size={20} />
      </button>

      <button className="fab-locate" onClick={handleLocateMe}>
        <Target size={20} />
      </button>

      <button className="btn-get-route" onClick={() => { setRoutingMode(true); alert("Tap your destination on the map"); }}>
        <Navigation size={18} /> GET SAFE ROUTE
      </button>

      {routeInfo && (
        <div className="route-info-strip">
          Safe Route: {routeInfo.distance} • {routeInfo.duration}
          <button style={{ marginLeft: 16, background: 'none', border: 'none', color: '#fff' }} onClick={() => {setRouteInfo(null); setRoutePolyline(null);}}>✕</button>
        </div>
      )}

      {/* SOS System */}
      <div className={`sos-arc-container ${showSosOptions ? 'open' : ''}`}>
        <button className="sos-option fire" onClick={() => sendSOS('Fire')}><Flame size={20}/></button>
        <button className="sos-option medical" onClick={() => sendSOS('Medical')}><ActivitySquare size={20}/></button>
        <button className="sos-option security" onClick={() => sendSOS('Security')}><Shield size={20}/></button>
        
        <button className="fab-sos-main" onClick={() => setShowSosOptions(!showSosOptions)}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>SOS</span>
        </button>
      </div>

      {activeSosStatus && (
        <div className="sos-status-strip" style={{ position: 'absolute', bottom: 120, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: '90%', maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className={`status-node ${activeSosStatus === 'searching' || activeSosStatus === 'routed' || activeSosStatus === 'responding' ? 'active' : ''}`}>Searching</div>
            <div className="status-line" style={{ flex: 1, height: 2, background: 'var(--border-color)', margin: '0 8px' }} />
            <div className={`status-node ${activeSosStatus === 'routed' || activeSosStatus === 'responding' ? 'active' : ''}`}>Routed</div>
            <div className="status-line" style={{ flex: 1, height: 2, background: 'var(--border-color)', margin: '0 8px' }} />
            <div className={`status-node ${activeSosStatus === 'responding' ? 'active' : ''}`}>Respond</div>
          </div>
          
          <button 
            onClick={cancelSOS}
            style={{
              marginTop: 16, width: '100%', padding: 12, background: 'rgba(220,38,38,0.2)', border: '1px solid var(--primary-red)',
              color: 'var(--primary-red)', borderRadius: 8, fontWeight: 700, cursor: 'pointer'
            }}
          >
            CANCEL SOS
          </button>
        </div>
      )}

      {/* Bottom Sheet Report */}
      {isReportSheetOpen && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} onClick={() => setIsReportSheetOpen(false)} />
          <div className="bottom-sheet">
            <h3 style={{ marginBottom: 16 }}>Report Hazard</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              {['Flood', 'Debris', 'Fire', 'Accident', 'Other'].map(r => (
                <button 
                  key={r}
                  onClick={() => setReportReason(r)}
                  style={{ 
                    background: reportReason === r ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${reportReason === r ? 'var(--primary-red)' : 'var(--border-color)'}`,
                    color: reportReason === r ? 'var(--primary-red)' : 'white',
                    padding: '8px 16px', borderRadius: 20, fontWeight: 600, cursor: 'pointer'
                  }}>
                  {r}
                </button>
              ))}
            </div>
            <button className="btn-primary" onClick={handleReportSubmit}>Submit to Mesh</button>
          </div>
        </>
      )}

    </div>
  );
}
