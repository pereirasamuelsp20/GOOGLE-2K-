import React from 'react';

const TYPE_CFG = {
  hospital:     { label: 'Hospital',     icon: '🏥', color: '#FF3D3D' },
  police:       { label: 'Police',       icon: '🚔', color: '#00C8FF' },
  fire_station: { label: 'Fire Station', icon: '🚒', color: '#FF8C00' },
};

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = d => d * Math.PI / 180;
  const a = Math.sin(r(lat2-lat1)/2)**2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2-lng1)/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function fmtDist(m) {
  return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/* ═════════════════════════════════════════════════════════════════════════
   MarkerPanel — in-app route only, no external navigation
   Props: place, userLoc, etaInfo, onClose, onRoute, onClearRoute
═════════════════════════════════════════════════════════════════════════ */
export default function MarkerPanel({ place, userLoc, etaInfo, onClose, onRoute, onClearRoute }) {
  if (!place) return null;

  const cfg  = TYPE_CFG[place.type] ?? { label: place.type, icon: '📍', color: '#fff' };
  const dist = userLoc
    ? haversineM(userLoc[0], userLoc[1], place.lat, place.lng)
    : null;

  const hasRoute = !!etaInfo;

  return (
    <>
      <div className="mp-backdrop" onClick={onClose} />
      <div className="mp-panel">

        <div className="mp-handle-row" onClick={onClose}>
          <div className="mp-handle-bar" />
        </div>

        <div className="mp-type-badge" style={{ '--tc': cfg.color }}>
          <span className="mp-type-icon">{cfg.icon}</span>
          <span className="mp-type-label">{cfg.label.toUpperCase()}</span>
        </div>

        <div className="mp-name">{place.name || cfg.label}</div>

        {dist != null && (
          <div className="mp-dist-row">
            <span className="mp-dist-val">{fmtDist(dist)}</span>
            <span className="mp-dist-key">FROM YOUR LOCATION</span>
          </div>
        )}

        <div className="mp-coords">
          {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
        </div>

        {/* Live ETA strip — shown once route is fetched */}
        {hasRoute && (
          <div className="mp-eta-strip" style={{ '--tc': cfg.color }}>
            <span className="mp-eta-big">
              {etaInfo.etaMin != null ? etaInfo.etaMin : '—'}
            </span>
            <div className="mp-eta-info">
              <span className="mp-eta-label">MIN DRIVE</span>
              <span className="mp-eta-dist">{fmtDist(etaInfo.distM)}</span>
              <span className="mp-eta-src" style={{
                color: etaInfo.source === 'OSRM' ? '#00FF8C' : '#FFD600'
              }}>{etaInfo.source}</span>
            </div>
          </div>
        )}

        {/* Route button */}
        {!hasRoute ? (
          <button
            id={`mp-route-${place.id}`}
            className="mp-navigate-btn"
            style={{ '--tc': cfg.color }}
            onClick={() => onRoute(place)}
          >
            <span>🗺</span> SHOW ROUTE
          </button>
        ) : (
          <button
            id={`mp-clear-route-${place.id}`}
            className="mp-navigate-btn"
            style={{ '--tc': '#00FF8C' }}
            onClick={onClearRoute}
          >
            <span>✕</span> CLEAR ROUTE
          </button>
        )}

        <button className="mp-close-btn" onClick={onClose}>CLOSE</button>
      </div>
    </>
  );
}
