import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, Polyline, Marker, Popup, useMapEvents } from 'react-leaflet';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, limit, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ORS_API_KEY } from '../config';
import { Navigation, AlertTriangle, Shield, Flame, Activity as ActivitySquare, ChevronRight, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import FALLBACK_LOCATIONS from '../data/importantLocations';
import { API_BASE } from '../apiConfig';

// SOS → facility type mapping
const SOS_FACILITY_MAP = { Fire: 'fire_station', Medical: 'hospital', Security: 'police' };
const VEHICLE_ICONS_MAP = { Fire: '🚒', Medical: '🚑', Security: '🚔' };

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


// Colour mapping by calamity type (shared with Mesh Map)
const REPORT_COLORS = {
  'Fire': '#CC0000',
  'Flash Floods': '#E8670A',
  'Power Outages': '#D4A017',
  'Earthquakes': '#1A6FC4',
  'Landslides': '#7B4F2E',
  'Building Collapse': '#6A3DA8',
  'Road Blocked': '#444444',
  'Car Accident': '#0F8060',
  'Chemical Leaks': '#6B8C00',
};

const REPORT_ICONS = {
  'Fire': '🔥', 'Flash Floods': '🌊', 'Power Outages': '⚡',
  'Earthquakes': '🌍', 'Landslides': '🏔', 'Building Collapse': '🏗',
  'Road Blocked': '🚧', 'Car Accident': '🚗', 'Chemical Leaks': '☣',
};

// Custom 28px SVG circle pin icon per calamity type
function createReportMarkerIcon(type) {
  const color = REPORT_COLORS[type] || '#CC0000';
  const icon = REPORT_ICONS[type] || '⚠';
  return L.divIcon({
    className: '',
    html: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="12" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <text x="14" y="15" text-anchor="middle" dominant-baseline="central" font-size="11">${icon}</text>
    </svg>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

// ── Important Location marker icons ──
const LOCATION_COLORS = {
  hospital: '#22C55E',
  fire_station: '#EF4444',
  police: '#3B82F6',
  shelter: '#F59E0B',
};

const LOCATION_ICONS = {
  hospital: '🏥',
  fire_station: '🚒',
  police: '🚔',
  shelter: '🏠',
};

const LOCATION_LABELS = {
  hospital: 'Hospitals',
  fire_station: 'Fire Stations',
  police: 'Police',
  shelter: 'Shelters',
};

function createLocationMarkerIcon(type) {
  const color = LOCATION_COLORS[type] || '#888';
  const icon = LOCATION_ICONS[type] || '📍';
  return L.divIcon({
    className: '',
    html: `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="#ffffff" stroke-width="2.5" opacity="0.9"/>
      <text x="16" y="17" text-anchor="middle" dominant-baseline="central" font-size="14">${icon}</text>
    </svg>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

function formatReportDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Fetch reports from shared backend API
const fetchApiReports = async () => {
  const res = await fetch(`${API_BASE}/reports`);
  if (!res.ok) throw new Error('Failed to fetch reports');
  return res.json();
};

const fetchLocations = async () => {
  try {
    const res = await fetch(`${API_BASE}/locations`);
    if (!res.ok) throw new Error('Failed to fetch locations');
    return res.json();
  } catch (e) {
    console.warn('[CitizenMap] API unavailable, using fallback locations:', e.message);
    return FALLBACK_LOCATIONS;
  }
};

export default function CitizenMap() {
  const [userLoc, setUserLoc] = useState([19.0760, 72.8777]); // Default Mumbai
  const [zones, setZones] = useState([]);
  const [firestoreReports, setFirestoreReports] = useState([]);

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

  // ── Important Locations state ──
  const [locationFilters, setLocationFilters] = useState({
    hospital: true, fire_station: true, police: true, shelter: true,
  });

  // ── Dispatch simulation state ──
  const [dispatchData, setDispatchData] = useState(null);
  const dispatchTimersRef = useRef([]);
  const vehicleIntervalRef = useRef(null);

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
        if (!d.center || !d.updatedAt) return;

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

  // Reports Listener (Firestore — community feed)
  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(30));
    const unsub = onSnapshot(q, snap => {
      const r = [];
      snap.forEach(doc => r.push({ id: doc.id, ...doc.data() }));
      setFirestoreReports(r);
    });
    return () => unsub();
  }, []);

  // Reports from backend API — shared React Query cache with ReportIssue page
  const { data: apiReports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchApiReports,
    refetchInterval: 30000, // poll every 30s
    refetchOnWindowFocus: true,
  });

  // Important Locations from backend API
  const { data: importantLocations = FALLBACK_LOCATIONS } = useQuery({
    queryKey: ['importantLocations'],
    queryFn: fetchLocations,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialData: FALLBACK_LOCATIONS,
    retry: 1,
  });

  // Filtered locations based on toggle state
  const filteredLocations = importantLocations.filter(l => locationFilters[l.type]);

  const toggleLocationFilter = (type) => {
    setLocationFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

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

  const clearRoute = useCallback(() => {
    setRouteInfo(null);
    setRoutePolyline(null);
  }, []);

  const calculateRoute = async (destLatLng) => {
    setRoutingMode(false);

    // Prepare avoid polygons (danger + blocked)
    const avoidPolygons = zones.filter(z => z.type === 'danger' || z.type === 'blocked').map(z => {
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
        const distKm = (summary.distance / 1000).toFixed(1);
        const drivingMin = Math.ceil(summary.duration / 60);
        const walkingMin = Math.ceil((summary.distance / 1000) / 5 * 60); // 5 km/h walking

        setRouteInfo({
          distance: distKm + ' km',
          drivingEta: drivingMin + ' min',
          walkingEta: walkingMin + ' min',
        });
      } else {
        alert("Could not find a safe route.");
      }
    } catch (e) {
      alert("Routing failed: " + e.message);
    }
  };

  // Navigate to a specific location (used by Important Location popup)
  const navigateToLocation = useCallback((lat, lng) => {
    calculateRoute({ lat, lng });
  }, [userLoc, zones]);

  // Navigate to nearest hospital
  const navigateToNearestHospital = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/locations/nearest?lat=${userLoc[0]}&lng=${userLoc[1]}&type=hospital`);
      if (!res.ok) throw new Error('Failed');
      const nearest = await res.json();
      if (nearest && nearest.lat && nearest.lng) {
        // Fly to it, then route
        if (mapRef.current) {
          mapRef.current.flyTo([nearest.lat, nearest.lng], 15, { duration: 1 });
        }
        setTimeout(() => {
          calculateRoute({ lat: nearest.lat, lng: nearest.lng });
        }, 1200);
      }
    } catch (e) {
      alert('Could not find nearest hospital: ' + e.message);
    }
  }, [userLoc, zones]);

  const sendSOS = async (type) => {
    setShowSosOptions(false);
    const ts = Date.now().toString();
    const uid = auth.currentUser?.uid || 'anon';

    const payload = {
      uid, type,
      lat: userLoc[0], lng: userLoc[1],
      status: 'searching',
      message: '', timestamp: Date.now()
    };

    try {
      await setDoc(doc(db, 'sos', ts), payload);
    } catch (e) { console.warn('SOS write failed:', e.message); }
    setActiveSosId(ts);
    setActiveSosStatus('searching');

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

    // Start dispatch simulation
    startWebDispatch(type, ts);
  };

  const clearWebDispatch = useCallback(() => {
    dispatchTimersRef.current.forEach(t => clearTimeout(t));
    dispatchTimersRef.current = [];
    if (vehicleIntervalRef.current) { clearInterval(vehicleIntervalRef.current); vehicleIntervalRef.current = null; }
    setDispatchData(null);
  }, []);

  const startWebDispatch = useCallback(async (sosType, sosId) => {
    const facilityType = SOS_FACILITY_MAP[sosType] || 'police';
    const vehicleIcon = VEHICLE_ICONS_MAP[sosType] || '🚔';

    let facility;
    try {
      const res = await fetch(`${API_BASE}/locations/nearest?lat=${userLoc[0]}&lng=${userLoc[1]}&type=${facilityType}`);
      if (res.ok) facility = await res.json();
    } catch (e) {}
    if (!facility) facility = { name: 'Emergency HQ', lat: userLoc[0] + 0.015, lng: userLoc[1] + 0.012 };

    let routeCoords = [];
    let totalDuration = 600;
    try {
      const body = { coordinates: [[facility.lng, facility.lat], [userLoc[1], userLoc[0]]] };
      const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: { 'Authorization': ORS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        routeCoords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
        totalDuration = data.features[0].properties.summary.duration;
      }
    } catch (e) {}
    if (!routeCoords.length) routeCoords = [[facility.lat, facility.lng], userLoc];

    const routedDelay = Math.floor(Math.random() * 20000) + 10000;
    const t1 = setTimeout(async () => {
      try { await setDoc(doc(db, 'sos', sosId), { status: 'routed' }, { merge: true }); } catch (e) {}
      setActiveSosStatus('routed');
      setDispatchData({
        route: routeCoords, vehiclePos: routeCoords[0],
        facilityName: facility.name, vehicleIcon,
        eta: Math.ceil(totalDuration / 60) + ' min', progress: 0,
      });

      const respondDelay = Math.floor(Math.random() * 30000) + 30000;
      const t2 = setTimeout(async () => {
        try { await setDoc(doc(db, 'sos', sosId), { status: 'responding' }, { merge: true }); } catch (e) {}
        setActiveSosStatus('responding');

        const trafficMultiplier = 1 + (Math.random() * 0.1 + 0.1);
        const adjustedDuration = totalDuration * trafficMultiplier;
        const startTime = Date.now();
        vehicleIntervalRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          const progress = Math.min(elapsed / adjustedDuration, 1);
          const idx = Math.min(Math.floor(progress * (routeCoords.length - 1)), routeCoords.length - 1);
          const remainingSec = Math.max(0, adjustedDuration - elapsed);
          const etaMin = Math.ceil(remainingSec / 60);
          setDispatchData(prev => prev ? {
            ...prev, vehiclePos: routeCoords[idx],
            eta: etaMin > 0 ? etaMin + ' min' : 'Arriving',
            progress,
          } : null);
          if (progress >= 1) {
            clearInterval(vehicleIntervalRef.current);
            vehicleIntervalRef.current = null;
            setTimeout(() => {
              alert(`🚨 ${facility.name} responder has arrived!`);
              try { setDoc(doc(db, 'sos', sosId), { status: 'arrived' }, { merge: true }); } catch (e) {}
              setActiveSosId(null); setActiveSosStatus(null); clearWebDispatch();
            }, 2000);
          }
        }, 15000);
      }, respondDelay);
      dispatchTimersRef.current.push(t2);
    }, routedDelay);
    dispatchTimersRef.current.push(t1);
  }, [userLoc]);

  const cancelSOS = async () => {
    if (activeSosId) {
      await setDoc(doc(db, 'sos', activeSosId), { status: 'cancelled' }, { merge: true });
      setActiveSosStatus(null);
      setActiveSosId(null);
      clearWebDispatch();
      alert('SOS Cancelled');
    }
  };

  const getZoneColor = (type) => {
    if (type === 'danger') return '#dc2626';
    if (type === 'blocked') return '#f97316';
    if (type === 'safe') return '#22c55e';
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

        {/* Report markers from shared backend API */}
        {apiReports.map((r) => (
          <Marker
            key={r._id}
            position={[r.latitude, r.longitude]}
            icon={createReportMarkerIcon(r.calamityType)}
          >
            <Popup>
              <div style={{ color: '#fff', minWidth: 200 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: REPORT_COLORS[r.calamityType] || '#CC0000', marginBottom: 6 }}>
                  {REPORT_ICONS[r.calamityType] || '⚠'} {r.calamityType}
                </div>
                <div style={{ color: '#bbb', fontSize: 12, marginBottom: 6, lineHeight: 1.4 }}>{r.locationAddress}</div>
                {r.details && (
                  <div style={{ color: '#888', fontSize: 12, padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, borderLeft: '2px solid #333', marginBottom: 6 }}>
                    {r.details}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ color: '#666', fontSize: 11 }}>🕐 {formatReportDate(r.createdAt)}</span>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                    background: r.status === 'Resolved' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)',
                    color: r.status === 'Resolved' ? '#22C55E' : '#F59E0B',
                    border: r.status === 'Resolved' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(245,158,11,0.3)',
                  }}>{r.status || 'Reported'}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Important Location markers */}
        {filteredLocations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.lat, loc.lng]}
            icon={createLocationMarkerIcon(loc.type)}
          >
            <Popup>
              <div style={{ color: '#fff', minWidth: 220 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: LOCATION_COLORS[loc.type], marginBottom: 4 }}>
                  {LOCATION_ICONS[loc.type]} {loc.name}
                </div>
                <div style={{ color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  {LOCATION_LABELS[loc.type]}
                </div>
                <div style={{ color: '#bbb', fontSize: 12, lineHeight: 1.4, marginBottom: 4 }}>{loc.address}</div>
                {loc.phone && (
                  <div style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>
                    📞 {loc.phone}
                  </div>
                )}
                <button
                  className="popup-navigate-btn"
                  onClick={() => navigateToLocation(loc.lat, loc.lng)}
                >
                  🧭 Navigate Here
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {routePolyline && (
          <Polyline positions={routePolyline} pathOptions={{ color: '#3b82f6', weight: 5 }} />
        )}

        {/* Dispatch route + vehicle marker */}
        {dispatchData && dispatchData.route && (
          <Polyline positions={dispatchData.route} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.5, dashArray: '10 8' }} />
        )}
        {dispatchData && dispatchData.vehiclePos && (
          <Marker
            position={dispatchData.vehiclePos}
            icon={L.divIcon({
              className: '',
              html: `<div style="font-size:28px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));animation:vehiclePulse 1.5s ease-in-out infinite">${dispatchData.vehicleIcon || '🚑'}</div>`,
              iconSize: [32, 32], iconAnchor: [16, 16],
            })}
          />
        )}
      </MapContainer>

      {/* Overlays / UI */}

      {/* ── ETA Card (replaces route-info-strip) ── */}
      {routeInfo && (
        <div className="eta-card">
          <div className="eta-metric">
            <span className="icon">🚗</span>
            <span className="value">{routeInfo.drivingEta}</span>
            <span className="label">Driving</span>
          </div>
          <div className="eta-divider" />
          <div className="eta-metric">
            <span className="icon">🚶</span>
            <span className="value">{routeInfo.walkingEta}</span>
            <span className="label">Walking</span>
          </div>
          <div className="eta-divider" />
          <div className="eta-metric">
            <span className="icon">📏</span>
            <span className="value">{routeInfo.distance}</span>
            <span className="label">Distance</span>
          </div>
          <button className="eta-close" onClick={clearRoute}>✕</button>
        </div>
      )}

      {/* ── Dispatch ETA Card ── */}
      {dispatchData && (
        <div className="eta-card" style={{ top: routeInfo ? 80 : 20, borderColor: 'rgba(59,130,246,0.3)' }}>
          <div className="eta-metric">
            <span className="icon" style={{ fontSize: 24 }}>{dispatchData.vehicleIcon}</span>
            <span className="value" style={{ fontSize: 14 }}>{dispatchData.facilityName}</span>
            <span className="label">Dispatched</span>
          </div>
          <div className="eta-divider" />
          <div className="eta-metric">
            <span className="icon">⏱</span>
            <span className="value" style={{ color: '#3b82f6' }}>{dispatchData.eta}</span>
            <span className="label">ETA</span>
          </div>
        </div>
      )}

      {/* ── Important Locations Filter Panel ── */}
      <div className="location-filter-panel">
        {Object.entries(LOCATION_LABELS).map(([type, label]) => (
          <button
            key={type}
            className={`location-filter-chip ${locationFilters[type] ? 'active' : ''}`}
            style={{ '--chip-color': LOCATION_COLORS[type] }}
            onClick={() => toggleLocationFilter(type)}
          >
            <span className="chip-icon">{LOCATION_ICONS[type]}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Live Feed Sidebar */}
      <div className={`live-feed-panel ${isFeedOpen ? 'open' : ''}`}>
        <button className="feed-toggle" onClick={() => setIsFeedOpen(!isFeedOpen)}>
          <ChevronRight size={20} style={{ transform: isFeedOpen ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
        </button>
        <div style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16 }}>Live Community Feed</h3>
          {firestoreReports.map(r => (
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

      {/* Nearest Hospital FAB */}
      <button className="fab-nearest" onClick={navigateToNearestHospital} title="Nearest Hospital">
        🏥
      </button>

      <button className="btn-get-route" onClick={() => { setRoutingMode(true); alert("Tap your destination on the map"); }}>
        <Navigation size={18} /> GET SAFE ROUTE
      </button>

      {/* SOS System */}
      <div className={`sos-arc-container ${showSosOptions ? 'open' : ''}`}>
        <button className="sos-option fire" onClick={() => sendSOS('Fire')}><Flame size={20} /></button>
        <button className="sos-option medical" onClick={() => sendSOS('Medical')}><ActivitySquare size={20} /></button>
        <button className="sos-option security" onClick={() => sendSOS('Security')}><Shield size={20} /></button>

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
