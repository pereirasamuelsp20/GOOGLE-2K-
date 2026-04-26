import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap } from 'react-leaflet';
import { collection, onSnapshot } from 'firebase/firestore';
import L from 'leaflet';
import { db } from '../firebase';
import EtaTracker from './EtaTracker';
import MarkerPanel from '../components/MarkerPanel';

/* ── Config ───────────────────────────────────────────────────────────── */
const PLACE_CFG = {
  hospital:     { icon: '🏥', color: '#FF3D3D' },
  police:       { icon: '🚔', color: '#00C8FF' },
  fire_station: { icon: '🚒', color: '#FF8C00' },
};
const SOS_TYPES = [
  { key: 'ambulance', icon: '🚑', label: 'Ambulance',    color: '#FF3D3D' },
  { key: 'police',    icon: '🚔', label: 'Police',       color: '#00C8FF' },
  { key: 'fire',      icon: '🚒', label: 'Fire Brigade', color: '#FF8C00' },
];

/* ── OSRM helpers ───────────────────────────────────────────────────────── */
function buildInstruction(step) {
  const { type, modifier } = step.maneuver;
  const name = step.name || 'the road';
  const dir  = modifier ? modifier.replace('-', ' ') : '';
  switch (type) {
    case 'depart':   return `Head ${dir} on ${name}`;
    case 'turn':     return `Turn ${dir} onto ${name}`;
    case 'new name': return `Continue onto ${name}`;
    case 'merge':    return `Merge ${dir} onto ${name}`;
    case 'ramp':     return `Take the ramp ${dir || 'ahead'}`;
    case 'fork':     return `Keep ${dir} at the fork`;
    case 'arrive':   return `Arrive at destination`;
    case 'roundabout': return `Enter roundabout`;
    default:         return name ? `Continue on ${name}` : 'Continue';
  }
}

function maneuverArrow(modifier) {
  switch (modifier) {
    case 'left':        return '↰';
    case 'right':       return '↱';
    case 'slight left': return '↖';
    case 'slight right':return '↗';
    case 'sharp left':  return '◁';
    case 'sharp right': return '▷';
    case 'uturn':       return '↩';
    default:            return '↑';
  }
}

function fmtStepDist(m) {
  return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

async function fetchOSRM(coords) {
  const path = coords.map(c => `${c[0]},${c[1]}`).join(';');
  const url  = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=true`;
  const res  = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('OSRM_FAIL');
  const rawSteps = data.routes[0].legs[0]?.steps ?? [];
  const steps = rawSteps.map(s => ({
    instruction: buildInstruction(s),
    arrow:       maneuverArrow(s.maneuver?.modifier),
    distance:    s.distance,
    duration:    s.duration,
    type:        s.maneuver?.type,
  })).filter(s => s.type !== 'arrive' || rawSteps.length === 1);
  return {
    duration: data.routes[0].duration,
    distance: data.routes[0].distance,
    polyline: data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]),
    steps,
  };
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = d => d * Math.PI / 180;
  const a = Math.sin(r(lat2-lat1)/2)**2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2-lng1)/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function fmtDist(m) {
  return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/* ── Leaflet icons ───────────────────────────────────────────────────── */
function makePlaceIcon(type, active = false) {
  const c = PLACE_CFG[type] ?? { icon: '📍', color: '#fff' };
  return L.divIcon({
    className: '',
    html: `<div class="cmap-place-marker${active ? ' active' : ''}" style="--mc:${c.color}">${c.icon}</div>`,
    iconSize: [38, 38], iconAnchor: [19, 19],
  });
}
function makeDestIcon(type) {
  const c = PLACE_CFG[type] ?? { icon: '📍', color: '#fff' };
  return L.divIcon({
    className: '',
    html: `<div class="cmap-dest-marker" style="--mc:${c.color}">
      <div class="cmap-dest-pulse"></div>
      <span>${c.icon}</span>
    </div>`,
    iconSize: [52, 52], iconAnchor: [26, 26],
  });
}
function makeUserIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div class="cmap-user-marker">
        <div class="cmap-user-ring cmap-user-ring--outer"></div>
        <div class="cmap-user-ring cmap-user-ring--mid"></div>
        <div class="cmap-user-core"></div>
        <div class="cmap-user-label">YOU</div>
      </div>`,
    iconSize: [60, 72], iconAnchor: [30, 36],
  });
}
function makeRespIcon(icon, color) {
  return L.divIcon({
    className: '',
    html: `<div class="eta-leaf-icon" style="--ic:${color}">${icon}</div>`,
    iconSize: [40, 40], iconAnchor: [20, 20],
  });
}
const userIcon = makeUserIcon();

/* ── Overpass ────────────────────────────────────────────────────────── */
async function fetchNearby(lat, lng) {
  const q = `[out:json][timeout:20];(
    node["amenity"~"hospital|police|fire_station"](around:5000,${lat},${lng});
    way["amenity"~"hospital|police|fire_station"](around:5000,${lat},${lng});
  );out center qt 60;`;
  const res  = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', body: 'data=' + encodeURIComponent(q),
  });
  const data = await res.json();
  return data.elements.map(el => ({
    id: el.id, lat: el.lat ?? el.center?.lat, lng: el.lon ?? el.center?.lon,
    type: el.tags?.amenity, name: el.tags?.name || el.tags?.['name:en'] || null,
  })).filter(p => p.lat && p.lng && PLACE_CFG[p.type]);
}

/* ── FollowUser: re-centers map whenever GPS updates by >30m ──────── */
function FollowUser({ loc, follow }) {
  const map = useMap();
  const prevLoc = useRef(null);

  useEffect(() => {
    if (!loc || !follow) return;
    if (prevLoc.current) {
      const [plat, plng] = prevLoc.current;
      const dist = Math.abs(plat - loc[0]) * 111320 + Math.abs(plng - loc[1]) * 85000;
      if (dist < 30) return; // skip tiny jitter
    }
    map.panTo(loc, { animate: true, duration: 0.6 });
    prevLoc.current = loc;
  }, [loc, follow, map]);

  return null;
}

/* ── RecenterBtn: snaps map to user location on tap ─────────────── */
function RecenterBtn({ onClick }) {
  return (
    <button
      id="recenter-btn"
      className="cmap-recenter-btn"
      onClick={onClick}
      title="Re-center on my location"
    >
      ⊕
    </button>
  );
}

/* Auto-fit bounds to route polyline */
function FitRoute({ polyline }) {
  const map = useMap();
  useEffect(() => {
    if (!polyline || polyline.length < 2) return;
    const bounds = L.latLngBounds(polyline);
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16, animate: true, duration: 0.8 });
  }, [polyline, map]);
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════
   CITIZENMAP
═══════════════════════════════════════════════════════════════════════ */
export default function CitizenMap() {
  const [userLoc,       setUserLoc]       = useState(null);
  const [places,        setPlaces]        = useState([]);
  const [blockades,     setBlockades]     = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  /* SOS */
  const [sosPicker, setSosPicker] = useState(false);
  const [activeSos, setActiveSos] = useState(null);
  const [respPos,   setRespPos]   = useState(null);
  const [sosRoute,  setSosRoute]  = useState(null);

  /* Navigate-to-place */
  const [selectedPlace,  setSelectedPlace]  = useState(null);
  const [navMode,        setNavMode]        = useState(null);
  const [navLoading,     setNavLoading]     = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [following,      setFollowing]      = useState(true); // map follows user GPS

  const fetchedAtRef = useRef(null);

  /* GPS — extended timeout for mobile first-fix */
  useEffect(() => {
    if (!navigator.geolocation) { setUserLoc([19.076, 72.8777]); return; }
    const fb = setTimeout(() => setUserLoc(p => p ?? [19.076, 72.8777]), 12000);
    const id = navigator.geolocation.watchPosition(
      pos => { clearTimeout(fb); setUserLoc([pos.coords.latitude, pos.coords.longitude]); },
      ()  => { clearTimeout(fb); setUserLoc([19.076, 72.8777]); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => { clearTimeout(fb); navigator.geolocation.clearWatch(id); };
  }, []);

  /* Overpass */
  useEffect(() => {
    if (!userLoc) return;
    const prev = fetchedAtRef.current;
    if (prev && haversineM(prev[0], prev[1], userLoc[0], userLoc[1]) < 800) return;
    fetchedAtRef.current = userLoc;
    setLoadingPlaces(true);
    fetchNearby(userLoc[0], userLoc[1])
      .then(setPlaces).catch(console.error)
      .finally(() => setLoadingPlaces(false));
  }, [userLoc]);

  /* Firestore blockades */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'blockades'), snap => {
      const bs = [];
      snap.forEach(d => { const data = d.data(); if (data.lat && data.lng) bs.push({ id: d.id, ...data }); });
      setBlockades(bs);
    });
    return unsub;
  }, []);

  /* ── Navigate: fetch OSRM, close panel, enter nav mode ────────────── */
  const handleRoute = async (place) => {
    if (!userLoc || navLoading) return;
    setNavLoading(true);
    setSelectedPlace(null);
    setCurrentStepIdx(0);
    try {
      const result = await fetchOSRM([[userLoc[1], userLoc[0]], [place.lng, place.lat]]);
      setNavMode({
        place,
        polyline: result.polyline,
        etaMin:  Math.ceil(result.duration / 60),
        distM:   result.distance,
        source:  'OSRM',
        steps:   result.steps ?? [],
      });
    } catch (_) {
      const dist = haversineM(userLoc[0], userLoc[1], place.lat, place.lng);
      setNavMode({
        place,
        polyline: [[userLoc[0], userLoc[1]], [place.lat, place.lng]],
        etaMin:  Math.ceil(dist / (40/3.6) / 60),
        distM:   dist,
        source:  'HVRSN',
        steps:   [{ arrow: '↑', instruction: 'Head toward destination', distance: dist }],
      });
    }
    setNavLoading(false);
  };

  /* Advance step when user gets within 30m of next step start */
  useEffect(() => {
    if (!navMode?.steps?.length || !userLoc) return;
    const nextIdx = currentStepIdx + 1;
    if (nextIdx >= navMode.steps.length) return;
    // Rough check: if remaining distance < sum of upcoming step distances, advance
    const stepsDone = navMode.steps.slice(0, nextIdx).reduce((s, st) => s + st.distance, 0);
    const totalDone = haversineM(userLoc[0], userLoc[1], navMode.place.lat, navMode.place.lng);
    if (totalDone < navMode.distM - stepsDone + 30) setCurrentStepIdx(nextIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoc]);

  const stopNavigation = () => setNavMode(null);

  const activeSosCfg = SOS_TYPES.find(s => s.key === activeSos);
  const respIcon     = activeSosCfg ? makeRespIcon(activeSosCfg.icon, activeSosCfg.color) : null;

  return (
    <div style={{ position: 'relative', height: '100dvh', width: '100vw', background: '#070b0f', overflow: 'hidden' }}>

      {/* ── MAP ─────────────────────────────────────────────────────── */}
      {userLoc && (
        <MapContainer center={userLoc} zoom={14}
          zoomControl={false} attributionControl={false}
          style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd" maxZoom={19}
          />

          <FollowUser loc={userLoc} follow={following && !navMode} />

          {/* Auto-fit when nav mode activates */}
          {navMode && <FitRoute polyline={navMode.polyline} />}

          {/* User */}
          <Marker position={userLoc} icon={userIcon} />

          {/* Blockades */}
          {blockades.map(b => (
            <Circle key={b.id} center={[b.lat, b.lng]} radius={b.radius ?? 150}
              pathOptions={{ color: '#FF0000', fillColor: '#FF0000', fillOpacity: 0.25, weight: 2 }} />
          ))}

          {/* Place markers — dim when in nav mode */}
          {places.map(p => (
            <Marker key={p.id} position={[p.lat, p.lng]}
              icon={makePlaceIcon(p.type, navMode?.place?.id === p.id)}
              eventHandlers={{ click: () => {
                if (navMode) return; // ignore taps while navigating
                setSelectedPlace(p);
              }}}
            />
          ))}

          {/* SOS responder */}
          {respPos && respIcon && <Marker position={[respPos.lat, respPos.lng]} icon={respIcon} />}

          {/* SOS route */}
          {sosRoute && (
            <Polyline positions={sosRoute}
              pathOptions={{ color: activeSosCfg?.color ?? '#FF3D3D', weight: 5, opacity: 0.85 }} />
          )}

          {/* ── Navigation route — Google Maps style ──────────────── */}
          {navMode?.polyline && (
            <>
              {/* White shadow/border underneath */}
              <Polyline positions={navMode.polyline}
                pathOptions={{ color: '#ffffff', weight: 12, opacity: 0.2, lineCap: 'round', lineJoin: 'round' }} />
              {/* Main vivid route line */}
              <Polyline positions={navMode.polyline}
                pathOptions={{ color: '#0096FF', weight: 8, opacity: 1, lineCap: 'round', lineJoin: 'round' }} />
            </>
          )}

          {/* Destination pin */}
          {navMode?.place && (
            <Marker
              position={[navMode.place.lat, navMode.place.lng]}
              icon={makeDestIcon(navMode.place.type)}
            />
          )}
        </MapContainer>
      )}

      {/* ── LOADING BADGE ────────────────────────────────────────── */}
      {loadingPlaces && (
        <div className="cmap-loading-badge">
          <span className="cmap-loading-dot" />Fetching nearby services…
        </div>
      )}
      {navLoading && (
        <div className="cmap-loading-badge">
          <span className="cmap-loading-dot" />Calculating route…
        </div>
      )}

      {/* ── RECENTER BUTTON ──────────────────────────────────────── */}
      {!navMode && (
        <button
          id="recenter-btn"
          className={`cmap-recenter-btn${following ? ' active' : ''}`}
          onClick={() => { setFollowing(true); }}
          title="Re-center on my location"
        >
          ◎
        </button>
      )}

      {/* ── LEGEND (hide during nav mode) ────────────────────────── */}
      {!navMode && (
        <div className="cmap-legend">
          {Object.entries(PLACE_CFG).map(([k, c]) => (
            <div key={k} className="cmap-legend-row">
              <span style={{ fontSize: 13 }}>{c.icon}</span>
              <span className="cmap-legend-label">
                {{ hospital: 'Hospital', police: 'Police', fire_station: 'Fire Stn' }[k]}
              </span>
            </div>
          ))}
          {blockades.length > 0 && (
            <div className="cmap-legend-row">
              <span className="cmap-blockade-dot" />
              <span className="cmap-legend-label">Blockade</span>
            </div>
          )}
        </div>
      )}

      {/* ── SOS FAB (hide during active SOS) ─────────────────────── */}
      {!activeSos && (
        <button id="sos-fab-btn" className="cmap-sos-fab"
          onClick={() => setSosPicker(true)}>
          <span className="cmap-sos-fab-text">SOS</span>
        </button>
      )}

      {/* ── SOS PICKER ───────────────────────────────────────────── */}
      {sosPicker && (
        <>
          <div className="mp-backdrop" onClick={() => setSosPicker(false)} />
          <div className="cmap-sos-sheet">
            <div className="mp-handle-row" onClick={() => setSosPicker(false)}>
              <div className="mp-handle-bar" />
            </div>
            <div className="cmap-sos-sheet-title">REQUEST HELP</div>
            <div className="cmap-sos-sheet-sub">Select the type of emergency response needed</div>
            <div className="cmap-sos-types">
              {SOS_TYPES.map(s => (
                <button key={s.key} id={`sos-type-${s.key}`}
                  className="cmap-sos-type-btn" style={{ '--sc': s.color }}
                  onClick={() => { setSosPicker(false); setActiveSos(s.key); }}>
                  <span className="cmap-sos-type-icon">{s.icon}</span>
                  <span className="cmap-sos-type-label">{s.label.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── ETA TRACKER (SOS flow) ───────────────────────────────── */}
      {activeSos && userLoc && (
        <EtaTracker
          sosType={activeSos}
          userLoc={userLoc}
          blockades={blockades}
          onDismiss={() => { setActiveSos(null); setRespPos(null); setSosRoute(null); }}
          onRespPosChange={setRespPos}
          onRouteChange={setSosRoute}
        />
      )}

      {/* ── MARKER PANEL (place info + route trigger) ────────────── */}
      {selectedPlace && !navMode && (
        <MarkerPanel
          place={selectedPlace}
          userLoc={userLoc}
          onClose={() => setSelectedPlace(null)}
          onRoute={handleRoute}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════
          NAVIGATION STRIP — shown while routing to a place
      ══════════════════════════════════════════════════════════════ */}
      {navMode && (() => {
        const step = navMode.steps?.[currentStepIdx];
        return (
          <div className="nav-strip">
            {/* ── TOP: current turn instruction ── */}
            {step && (
              <div className="nav-instruction-bar">
                <div className="nav-arrow">{step.arrow}</div>
                <div className="nav-instruction-text">
                  <div className="nav-instruction-main">{step.instruction}</div>
                  <div className="nav-instruction-dist">{fmtStepDist(step.distance)}</div>
                </div>
                {navMode.steps.length > 1 && currentStepIdx + 1 < navMode.steps.length && (
                  <div className="nav-next-hint">
                    <span style={{ opacity: 0.4, fontSize: 10 }}>THEN</span>
                    <span className="nav-next-arrow">{navMode.steps[currentStepIdx + 1].arrow}</span>
                  </div>
                )}
              </div>
            )}
            {/* ── BOTTOM: ETA + stop ── */}
            <div className="nav-strip-bottom">
              <div className="nav-strip-left">
                <div className="nav-strip-eta">{navMode.etaMin}</div>
                <div className="nav-strip-unit">MIN</div>
              </div>
              <div className="nav-strip-mid">
                <div className="nav-strip-name">{navMode.place.name || PLACE_CFG[navMode.place.type]?.label}</div>
                <div className="nav-strip-meta">
                  {fmtDist(navMode.distM)}
                  <span className="nav-strip-src" style={{
                    color: navMode.source === 'OSRM' ? '#00FF8C' : '#FFD600'
                  }}> · {navMode.source}</span>
                </div>
              </div>
              <button className="nav-strip-stop" id="nav-stop-btn" onClick={stopNavigation}>
                ✕<span>END</span>
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
