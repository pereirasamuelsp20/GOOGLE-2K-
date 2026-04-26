import React, { useEffect, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

/* ── Config ──────────────────────────────────────────────────────────── */
const RESP_CFG = {
  ambulance: { color: '#FF3D3D', label: 'AMB-07', icon: '🚑', latOff:  0.021, lngOff:  0.027 },
  police:    { color: '#00C8FF', label: 'POL-14', icon: '🚔', latOff: -0.011, lngOff:  0.033 },
  fire:      { color: '#FF8C00', label: 'FBR-03', icon: '🚒', latOff:  0.007, lngOff: -0.026 },
};
const STEP_M    = 320;   // metres per 8s tick
const SPEED_MS  = 40 / 3.6; // 40 km/h fallback

/* ── Helpers ─────────────────────────────────────────────────────────── */
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = d => d * Math.PI / 180;
  const a = Math.sin(r(lat2-lat1)/2)**2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2-lng1)/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function moveToward(pos, target, stepM) {
  const dist = haversineM(pos.lat, pos.lng, target[0], target[1]);
  if (dist <= stepM) return { lat: target[0], lng: target[1] };
  const ratio = stepM / dist;
  return {
    lat: pos.lat + (target[0] - pos.lat) * ratio,
    lng: pos.lng + (target[1] - pos.lng) * ratio,
  };
}

function routeHitsBlockade(polyline, b) {
  return polyline.some(([lat, lng]) =>
    haversineM(lat, lng, b.lat, b.lng) < (b.radius ?? 150)
  );
}

function avoidWaypoint(b, fromLat, fromLng, toLat, toLng) {
  // Perpendicular offset from blockade centre
  const latDir = toLat > fromLat ? 1 : -1;
  const lngDir = toLng > fromLng ? 1 : -1;
  const offsetDeg = ((b.radius ?? 150) + 120) / 111320;
  return [b.lng + latDir * offsetDeg, b.lat - lngDir * offsetDeg]; // [lng, lat]
}

/* OSRM — returns { duration(s), distance(m), polyline([[lat,lng],...]) } */
async function fetchOSRM(coords) {
  const path = coords.map(c => `${c[0]},${c[1]}`).join(';'); // [lng,lat] pairs
  const url  = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`;
  const res  = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('OSRM_FAIL');
  return {
    duration: data.routes[0].duration,
    distance: data.routes[0].distance,
    polyline: data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]),
  };
}

function fmtEta(sec) {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function fmtDist(m) {
  if (m == null) return '—';
  return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/* ═════════════════════════════════════════════════════════════════════════
   EtaTracker — SOS flow, OSRM routing, blockade-aware
   Props: sosType, userLoc, blockades, onDismiss, onRespPosChange, onRouteChange
═════════════════════════════════════════════════════════════════════════ */
export default function EtaTracker({ sosType, userLoc, blockades = [], onDismiss, onRespPosChange, onRouteChange }) {
  const cfg = RESP_CFG[sosType] ?? RESP_CFG.ambulance;

  const [respPos,     setRespPos]     = useState(null);
  const [etaSec,      setEtaSec]      = useState(null);
  const [distM,       setDistM]       = useState(null);
  const [source,      setSource]      = useState(null);
  const [blockadeHit, setBlockadeHit] = useState(0);
  const [arrived,     setArrived]     = useState(false);
  const [lastRef,     setLastRef]     = useState(null);

  const timerRef   = useRef(null);
  const arrivedRef = useRef(false);
  const respRef    = useRef(null);

  /* Firestore dispatch */
  useEffect(() => {
    const ts  = Date.now().toString();
    const uid = auth.currentUser?.uid ?? 'anon';
    setDoc(doc(db, 'dispatches', ts), {
      uid, type: sosType, lat: userLoc[0], lng: userLoc[1],
      status: 'dispatched', timestamp: Date.now(),
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Seed responder position */
  useEffect(() => {
    const init = { lat: userLoc[0] + cfg.latOff, lng: userLoc[1] + cfg.lngOff };
    respRef.current = init;
    setRespPos(init);
    onRespPosChange?.(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Fetch route via OSRM → blockade avoidance → Haversine fallback */
  const fetchRoute = async (rPos) => {
    const toLng = userLoc[1], toLat = userLoc[0];
    const fromLng = rPos.lng, fromLat = rPos.lat;

    try {
      // 1. Try straight OSRM
      const result = await fetchOSRM([[fromLng, fromLat], [toLng, toLat]]);

      // 2. Check blockade intersections
      const hits = blockades.filter(b => routeHitsBlockade(result.polyline, b));
      setBlockadeHit(hits.length);

      if (hits.length > 0) {
        // 3. Try with avoid waypoints
        const waypts = hits.map(b => avoidWaypoint(b, fromLat, fromLng, toLat, toLng));
        try {
          const avoided = await fetchOSRM([[fromLng, fromLat], ...waypts, [toLng, toLat]]);
          onRouteChange?.(avoided.polyline);
          setEtaSec(avoided.duration); setDistM(avoided.distance);
          setSource('OSRM+AV'); setLastRef(new Date()); return;
        } catch (_) { /* fall to penalty */ }

        // 4. Haversine + 5 min penalty per blockade
        const dist   = haversineM(fromLat, fromLng, toLat, toLng);
        const etaSec = (dist / SPEED_MS) + hits.length * 300;
        onRouteChange?.([[fromLat, fromLng], [toLat, toLng]]);
        setEtaSec(etaSec); setDistM(dist);
        setSource('HVRSN'); setLastRef(new Date()); return;
      }

      // No blockades — use OSRM result directly
      onRouteChange?.(result.polyline);
      setEtaSec(result.duration); setDistM(result.distance);
      setSource('OSRM'); setLastRef(new Date());

    } catch (_) {
      // Full Haversine fallback
      const dist   = haversineM(fromLat, fromLng, toLat, toLng);
      const hits   = blockades.filter(b => {
        const midLat = (fromLat + toLat) / 2, midLng = (fromLng + toLng) / 2;
        return haversineM(midLat, midLng, b.lat, b.lng) < (b.radius ?? 150);
      });
      const etaSec = (dist / SPEED_MS) + hits.length * 300;
      onRouteChange?.([[fromLat, fromLng], [toLat, toLng]]);
      setEtaSec(etaSec); setDistM(dist);
      setSource('HVRSN'); setLastRef(new Date());
      setBlockadeHit(hits.length);
    }
  };

  /* 8-second movement simulation */
  useEffect(() => {
    if (!respPos) return;
    fetchRoute(respPos);

    timerRef.current = setInterval(() => {
      if (arrivedRef.current) return;
      const cur = respRef.current;
      if (!cur) return;

      const dist = haversineM(cur.lat, cur.lng, userLoc[0], userLoc[1]);
      if (dist <= 80) {
        arrivedRef.current = true;
        clearInterval(timerRef.current);
        setArrived(true); setEtaSec(0); setDistM(0);
        onRespPosChange?.(null); onRouteChange?.(null);
        setTimeout(() => onDismiss?.(), 5000);
        return;
      }
      const next = moveToward(cur, userLoc, STEP_M);
      respRef.current = next;
      setRespPos(next);
      onRespPosChange?.(next);
      fetchRoute(next);
    }, 8000);

    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!respPos]);

  const etaMin = etaSec != null && etaSec > 0 ? Math.ceil(etaSec / 60) : null;

  return (
    <div className="eta-card" style={{ '--ec': cfg.color }}>

      <div className="eta-card-header">
        <span className="eta-card-icon">{cfg.icon}</span>
        <div className="eta-card-header-text">
          <div className="eta-card-title">UNIT DISPATCHED</div>
          <div className="eta-card-sub">{cfg.label}</div>
        </div>
        {blockadeHit > 0 && (
          <div className="eta-blockade-badge">⚠ {blockadeHit} BLOCK</div>
        )}
        <button className="eta-card-close" onClick={onDismiss} id="eta-card-close-btn">✕</button>
      </div>

      {arrived ? (
        <div className="eta-card-arrived">
          <div className="eta-card-arrived-icon">{cfg.icon}</div>
          <div className="eta-card-arrived-title">UNIT ON SCENE</div>
          <div className="eta-card-arrived-sub">{cfg.label} has arrived · Closing in 5s…</div>
        </div>
      ) : (
        <div className="eta-card-body">
          <div className="eta-card-number-col">
            <div className="eta-card-tiny">ETA</div>
            <div className="eta-card-big">{etaMin ?? '—'}</div>
            <div className="eta-card-unit">MIN</div>
            <div className="eta-card-precise">{fmtEta(etaSec)}</div>
          </div>
          <div className="eta-card-divider" />
          <div className="eta-card-stats">
            <div className="eta-card-stat">
              <span className="eta-cs-val">{fmtDist(distM)}</span>
              <span className="eta-cs-key">DISTANCE</span>
            </div>
            <div className="eta-card-stat">
              <span className="eta-cs-val" style={{
                color: source === 'OSRM'    ? '#00FF8C'
                     : source === 'OSRM+AV' ? '#FFD600'
                     : '#FF8C00'
              }}>{source ?? '—'}</span>
              <span className="eta-cs-key">SOURCE</span>
            </div>
          </div>
        </div>
      )}

      <div className="eta-card-footer">
        <span className="eta-card-dot" />
        <span className="eta-card-footer-text">
          OSRM · 8s refresh{lastRef && ` · ${lastRef.toLocaleTimeString('en-IN', { hour12: false })}`}
        </span>
      </div>
    </div>
  );
}
