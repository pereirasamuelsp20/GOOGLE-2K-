import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from './firebaseConfig';
import { ORS_API_KEY } from './orsConfig';

// BUG 3: Haversine distance for throttling location updates
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Mumbai coordinates - hardcoded default
const MUMBAI_LAT = 19.0760;
const MUMBAI_LNG = 72.8777;

// API base — must match ReportIssueScreen
const LAN_IP = '10.61.78.188';
const API_BASE = `http://${LAN_IP}:4000/api`;

export default function NativeMapComponent({ userLoc, dispatchData, userRole }) {
  const webViewRef = useRef(null);
  const [sosList, setSosList] = useState([]);
  const [zones, setZones] = useState([]);
  const [reports, setReports] = useState([]);
  const [importantLocations, setImportantLocations] = useState([]);
  const [webViewReady, setWebViewReady] = useState(false);

  // Firebase SOS listener — with BloomFilter error recovery
  useEffect(() => {
    let unsub = null;
    let retryTimeout = null;

    const startListener = (useIndividualQueries = false) => {
      try {
        if (useIndividualQueries) {
          // Fallback: listen to each status separately to avoid 'in' operator BloomFilter issues
          console.log('[MeshMap] Using individual status queries (BloomFilter fallback)');
          const statuses = ['searching', 'routed', 'responding'];
          const unsubList = [];
          const buckets = {};
          statuses.forEach(status => {
            const q = query(collection(firestore, 'sos'), where('status', '==', status));
            const u = onSnapshot(q, (snap) => {
              const items = [];
              snap.forEach((d) => { const v = d.data(); if (v.lat && v.lng) items.push({ id: d.id, ...v }); });
              buckets[status] = items;
              // Merge all buckets
              const merged = [];
              Object.values(buckets).forEach(arr => merged.push(...arr));
              setSosList(merged);
            }, (err) => {
              console.warn('[MeshMap] Individual SOS listener error (' + status + '):', err.message);
            });
            unsubList.push(u);
          });
          unsub = () => unsubList.forEach(u => u());
        } else {
          const q = query(collection(firestore, 'sos'), where('status', 'in', ['searching', 'routed', 'responding']));
          unsub = onSnapshot(q, (snap) => {
            const data = [];
            snap.forEach((d) => { const v = d.data(); if (v.lat && v.lng) data.push({ id: d.id, ...v }); });
            setSosList(data);
          }, (err) => {
            console.warn('[MeshMap] SOS listener error (BloomFilter?), retrying with fallback:', err.message);
            if (unsub) { unsub(); unsub = null; }
            // Retry with individual queries after 1s
            retryTimeout = setTimeout(() => startListener(true), 1000);
          });
        }
      } catch (e) {
        console.warn('[MeshMap] SOS listener setup error:', e.message);
        // Last resort: retry with individual queries
        retryTimeout = setTimeout(() => startListener(true), 2000);
      }
    };

    startListener(false);

    return () => {
      if (unsub) unsub();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  // Firebase zones listener
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(firestore, 'zones'), (snap) => {
        const z = [];
        snap.forEach((d) => { const v = d.data(); if (v.center) z.push({ id: d.id, ...v }); });
        setZones(z);
      });
      return () => unsub();
    } catch (e) { console.warn('Zones listener error:', e.message); }
  }, []);

  // Fetch reports from backend API + poll every 15s
  const fetchReports = async () => {
    try {
      const res = await fetch(`${API_BASE}/reports`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setReports(data);
    } catch (err) {
      console.warn('[MeshMap] Reports fetch error:', err.message);
    }
  };

  useEffect(() => {
    fetchReports(); // initial fetch
    const interval = setInterval(fetchReports, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, []);

  // Fetch important locations from backend API — with retry
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const fetchLocations = async () => {
      try {
        console.log('[MeshMap] Fetching locations from:', `${API_BASE}/locations`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${API_BASE}/locations`, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          console.warn('[MeshMap] Locations response not OK:', res.status);
          return;
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          console.log(`[MeshMap] Loaded ${data.length} important locations`);
          setImportantLocations(data);
        }
      } catch (err) {
        console.warn('[MeshMap] Locations fetch error:', err.message);
        // Retry after 2s, up to maxRetries
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`[MeshMap] Retrying locations fetch (${retryCount}/${maxRetries})...`);
          setTimeout(fetchLocations, 2000);
        }
      }
    };
    fetchLocations();
  }, []);

  // Build the payload to send to the WebView
  const buildPayload = useCallback(() => {
    return JSON.stringify({
      type: 'UPDATE_DATA', sosList, zones, reports, importantLocations,
      userLoc: userLoc ? { lat: userLoc.latitude, lng: userLoc.longitude } : null,
      orsKey: ORS_API_KEY,
      dispatch: dispatchData || null,
      userRole: userRole || 'Citizen',
    });
  }, [sosList, zones, userLoc, reports, importantLocations, dispatchData, userRole]);

  // Debounce data pushes to WebView (300ms) to prevent flooding on rapid state changes
  const debounceTimerRef = useRef(null);
  const lastLocRef = useRef(null); // track last sent location for throttling

  // Track whether non-location data changed so we can always push it
  const lastNonLocPayloadRef = useRef(null);

  useEffect(() => {
    if (!webViewReady || !webViewRef.current) return;

    // Check if non-location data actually changed (SOS, dispatch, reports, etc.)
    const nonLocFingerprint = JSON.stringify({ sosList, zones, reports, importantLocations, dispatchData, userRole });
    const nonLocChanged = nonLocFingerprint !== lastNonLocPayloadRef.current;

    // Throttle LOCATION-ONLY updates — only push if moved > 10 meters
    // But always allow pushes when other data (SOS, dispatch, reports) changed
    if (!nonLocChanged && userLoc) {
      const prev = lastLocRef.current;
      if (prev) {
        const dist = haversineMeters(prev.latitude, prev.longitude, userLoc.latitude, userLoc.longitude);
        if (dist < 10) return; // Skip if ONLY location changed and it's < 10m
      }
    }

    // Update tracking refs
    if (userLoc) lastLocRef.current = userLoc;
    if (nonLocChanged) lastNonLocPayloadRef.current = nonLocFingerprint;

    // Debounce: batch rapid state changes into a single postMessage
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (webViewRef.current) {
        webViewRef.current.postMessage(buildPayload());
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [webViewReady, buildPayload]);

  // Handle messages FROM the WebView (including the READY handshake)
  const rerouteInProgress = useRef(false);
  const handleWebViewMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'WEBVIEW_READY') {
        console.log('[MeshMap] WebView signalled READY');
        setWebViewReady(true);
      }
      // Admin: resolve a report from the map popup
      if (msg.type === 'RESOLVE_REPORT' && msg.reportId) {
        console.log('[MeshMap] Admin resolving report:', msg.reportId);
        fetch(`${API_BASE}/reports/${msg.reportId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Resolved' }),
        }).then(res => {
          if (res.ok) {
            console.log('[MeshMap] Report resolved successfully');
            // Re-fetch reports to update the map in real time
            fetchReports();
          } else {
            console.warn('[MeshMap] Failed to resolve report:', res.status);
          }
        }).catch(e => console.warn('[MeshMap] Resolve error:', e.message));
      }
      if (msg.type === 'REROUTE_NEEDED' && dispatchData && !rerouteInProgress.current) {
        rerouteInProgress.current = true;
        console.log('[MeshMap] Rerouting around blockage at', msg.blockageLat, msg.blockageLng);
        const userLatLng = userLoc ? [userLoc.longitude, userLoc.latitude] : [MUMBAI_LNG, MUMBAI_LAT];
        const vehicleLat = dispatchData.vehiclePos?.lat || dispatchData.facilityLat;
        const vehicleLng = dispatchData.vehiclePos?.lng || dispatchData.facilityLng;
        const delta = 0.002;
        const avoidBox = [[msg.blockageLng-delta, msg.blockageLat-delta],[msg.blockageLng+delta, msg.blockageLat-delta],[msg.blockageLng+delta, msg.blockageLat+delta],[msg.blockageLng-delta, msg.blockageLat+delta],[msg.blockageLng-delta, msg.blockageLat-delta]];
        fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
          method: 'POST',
          headers: { 'Authorization': ORS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinates: [[vehicleLng, vehicleLat], userLatLng], options: { avoid_polygons: { type: 'MultiPolygon', coordinates: [[avoidBox]] } } }),
        }).then(r => r.json()).then(data => {
          if (data.features && data.features.length > 0) {
            const newRoute = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
            const summary = data.features[0].properties.summary;
            console.log('[MeshMap] Rerouted successfully, new ETA:', Math.ceil(summary.duration / 60), 'min');
            if (webViewRef.current) {
              webViewRef.current.postMessage(JSON.stringify({
                type: 'UPDATE_DATA',
                dispatch: { ...dispatchData, route: newRoute, eta: Math.ceil(summary.duration / 60) + ' min' },
                sosList: [], zones: [], reports: [], importantLocations: [],
              }));
            }
          }
          setTimeout(() => { rerouteInProgress.current = false; }, 10000);
        }).catch(e => {
          console.warn('[MeshMap] Reroute failed:', e.message);
          rerouteInProgress.current = false;
        });
      }
    } catch (_) { }
  }, [dispatchData, userLoc]);

  const mapHTML = useMemo(() => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e;font-family:-apple-system,system-ui,sans-serif}
#map{position:absolute;top:0;left:0;right:0;bottom:0;z-index:1}
#loadStatus{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;color:#888;font-size:13px;text-align:center;pointer-events:none}
#loadStatus.error{color:#dc2626}
#loadStatus.hidden{display:none}
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.css"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.css"/>
<script>
// Async CDN loader with fallback
var _cdnList=[
  ['https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'],
  ['https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js','https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js']
];
var _loadIdx=0;
function _loadNext(){
  if(_loadIdx>=_cdnList.length){initMapIfReady();return;}
  var urls=_cdnList[_loadIdx];
  var s=document.createElement('script');
  s.src=urls[0];
  s.onload=function(){_loadIdx++;_loadNext();};
  s.onerror=function(){
    var s2=document.createElement('script');
    s2.src=urls[1];
    s2.onload=function(){_loadIdx++;_loadNext();};
    s2.onerror=function(){
      var ls=document.getElementById('loadStatus');
      if(ls){ls.className='error';ls.textContent='Failed to load map library. Check internet.';}
    };
    document.head.appendChild(s2);
  };
  document.head.appendChild(s);
}
// Start loading immediately
var ls0=document.getElementById('loadStatus');
if(ls0)ls0.textContent='Downloading map library...';
_loadNext();
</script>
<style>
.leaflet-control-attribution{display:none!important}
.leaflet-tile-pane{will-change:transform}

/* ── Zoom controls: bottom-right, custom dark theme ── */
.leaflet-control-zoom{border:none!important;position:absolute!important;bottom:24px!important;right:16px!important;z-index:1001!important;margin:0!important}
.leaflet-control-zoom a{
  display:block!important;background:#1C1F26!important;color:#FFFFFF!important;
  border:1px solid rgba(255,255,255,0.15)!important;
  width:36px!important;height:36px!important;line-height:36px!important;
  font-size:18px!important;border-radius:8px!important;margin-bottom:4px!important;
  text-align:center!important;text-decoration:none!important;
  transition:background 0.15s!important;
}
.leaflet-control-zoom a:hover{background:#2C2F38!important}

/* ── Existing preserved styles ── */
.user-dot{width:14px;height:14px;background:#3b82f6;border-radius:50%;border:2.5px solid #fff;box-shadow:0 0 12px #3b82f6,0 0 24px rgba(59,130,246,0.4)}
.user-ring{position:absolute;width:44px;height:44px;top:-15px;left:-15px;border-radius:50%;border:2px solid rgba(59,130,246,0.3);animation:ring 2s ease-in-out infinite}
@keyframes ring{0%,100%{transform:scale(.7);opacity:.7}50%{transform:scale(1.4);opacity:0}}
.search-box{position:absolute;top:16px;left:12px;right:12px;z-index:1000;display:flex;gap:8px}
.search-box input{flex:1;background:rgba(26,26,46,0.92);border:1px solid #333;color:#fff;padding:10px 14px;border-radius:10px;font-size:14px;outline:none;backdrop-filter:blur(8px)}
.search-box input::placeholder{color:#666}
.search-box input:focus{border-color:#3b82f6;box-shadow:0 0 8px rgba(59,130,246,0.2)}
.search-box button{background:#dc2626;color:#fff;border:none;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer}
.info-bar{position:absolute;bottom:12px;left:12px;right:72px;z-index:1000;background:rgba(26,26,46,0.92);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center}
.info-bar .label{color:#888;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase}
.info-bar .value{color:#fff;font-size:13px;font-weight:700;margin-top:2px}

/* ── Popup styles (dark theme) ── */
.leaflet-popup-content-wrapper{background:rgba(22,22,36,0.97)!important;color:#fff!important;border:1px solid rgba(255,255,255,0.12)!important;border-radius:12px!important;box-shadow:0 8px 32px rgba(0,0,0,0.6)!important;padding:0!important}
.leaflet-popup-tip{background:rgba(22,22,36,0.97)!important;border:1px solid rgba(255,255,255,0.12)!important}
.leaflet-popup-content{margin:0!important;padding:14px 16px!important;font-size:13px!important;line-height:1.5!important}
.leaflet-popup-close-button{color:#888!important;font-size:18px!important;top:8px!important;right:10px!important}
.popup-type{font-weight:800;font-size:14px;margin-bottom:6px;display:flex;align-items:center;gap:6px}
.popup-status{color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px}
.popup-addr{color:#bbb;font-size:12px;margin:6px 0;line-height:1.4}
.popup-details{color:#888;font-size:12px;margin:6px 0;padding:8px 10px;background:rgba(255,255,255,0.04);border-radius:6px;border-left:2px solid #333}
.popup-time{color:#666;font-size:11px;display:flex;align-items:center;gap:4px;margin-top:6px}
.popup-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase}
.popup-badge.reported{background:rgba(245,158,11,0.2);color:#F59E0B;border:1px solid rgba(245,158,11,0.3)}
.popup-badge.resolved{background:rgba(34,197,94,0.2);color:#22C55E;border:1px solid rgba(34,197,94,0.3)}

/* ── Existing preserved markers ── */
.landmark-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.2)}
.search-pin{width:10px;height:10px;background:#dc2626;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #dc2626}

/* ── Marker cluster override ── */
.marker-cluster{background:none!important}
.marker-cluster div{
  width:36px!important;height:36px!important;margin-left:0!important;margin-top:0!important;
  background:#CC0000!important;color:#fff!important;border-radius:50%!important;
  font-size:13px!important;font-weight:700!important;
  display:flex!important;align-items:center!important;justify-content:center!important;
  border:2px solid rgba(255,255,255,0.4)!important;
  box-shadow:0 2px 12px rgba(204,0,0,0.5)!important;
}
.marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{background:none!important}
.marker-cluster-small div,.marker-cluster-medium div,.marker-cluster-large div{
  background:#CC0000!important;
}

/* ── Location markers ── */
.loc-icon{cursor:pointer}

/* ── Filter bar ── */
.filter-bar{position:absolute;top:58px;left:12px;right:12px;z-index:1000;display:flex;gap:5px;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch}
.filter-chip{padding:5px 8px;border-radius:16px;font-size:10px;font-weight:700;border:1px solid rgba(255,255,255,0.15);background:rgba(26,26,46,0.85);color:#888;cursor:pointer;backdrop-filter:blur(8px);display:flex;align-items:center;gap:3px;flex-shrink:0}
.filter-chip.active{color:var(--c);border-color:var(--c);background:rgba(26,26,46,0.95)}

/* ── ETA bar ── */
.eta-bar{position:absolute;bottom:12px;left:12px;right:68px;z-index:1000;background:rgba(26,26,46,0.94);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:10px 14px;display:none;justify-content:space-between;align-items:center}
.eta-bar.show{display:flex}
.eta-item{text-align:center}
.eta-item .val{color:#fff;font-size:15px;font-weight:800}
.eta-item .lbl{color:#888;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.eta-close{background:none;border:none;color:#888;font-size:16px;cursor:pointer;padding:4px}

/* ── Route polyline ── */
.route-line{stroke:#3b82f6;stroke-width:4}

/* ── Dispatch vehicle marker ── */
.vehicle-icon{font-size:28px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));animation:vehiclePulse 1.5s ease-in-out infinite}
@keyframes vehiclePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}

/* ── Dispatch ETA overlay ── */
.dispatch-bar{position:absolute;top:90px;left:12px;right:12px;z-index:1001;background:rgba(26,26,46,0.94);backdrop-filter:blur(12px);border:1px solid rgba(59,130,246,0.3);border-radius:12px;padding:10px 14px;display:none;align-items:center;justify-content:space-between;gap:8px}
.dispatch-bar.show{display:flex}
.dispatch-bar .d-icon{font-size:22px}
.dispatch-bar .d-info{flex:1}
.dispatch-bar .d-name{color:#fff;font-size:13px;font-weight:700}
.dispatch-bar .d-eta{color:#3b82f6;font-size:18px;font-weight:800}
.dispatch-bar .d-label{color:#888;font-size:9px;text-transform:uppercase;letter-spacing:1px}

/* ── Facility origin pulse ── */
.facility-pulse{animation:fPulse 1.5s ease-in-out infinite}
@keyframes fPulse{0%,100%{stroke-opacity:1;stroke-width:3}50%{stroke-opacity:0.4;stroke-width:6}}
</style>
</head><body>
<div class="search-box">
  <input id="searchInput" type="text" placeholder="Search locations..."/>
  <button onclick="doSearch()">Go</button>
</div>
<div class="filter-bar" id="filterBar">
  <div class="filter-chip active" data-type="hospital" style="--c:#22C55E" onclick="toggleFilter(this)">🏥 Hospitals</div>
  <div class="filter-chip active" data-type="fire_station" style="--c:#EF4444" onclick="toggleFilter(this)">🚒 Fire</div>
  <div class="filter-chip active" data-type="police" style="--c:#3B82F6" onclick="toggleFilter(this)">🚔 Police</div>
  <div class="filter-chip active" data-type="shelter" style="--c:#F59E0B" onclick="toggleFilter(this)">🏠 Shelters</div>
</div>
<div id="loadStatus">Loading map engine...</div>
<div id="map"></div>
<div class="eta-bar" id="etaBar">
  <div class="eta-item"><div class="val" id="etaDrive">--</div><div class="lbl">🚗 Drive</div></div>
  <div class="eta-item"><div class="val" id="etaWalk">--</div><div class="lbl">🚶 Walk</div></div>
  <div class="eta-item"><div class="val" id="etaDist">--</div><div class="lbl">📏 Dist</div></div>
  <button class="eta-close" onclick="clearRoute()">✕</button>
</div>
<div class="dispatch-bar" id="dispatchBar">
  <div class="d-icon" id="dispatchIcon">🚑</div>
  <div class="d-info"><div class="d-name" id="dispatchName">Dispatched</div><div class="d-label">ETA</div></div>
  <div class="d-eta" id="dispatchEta">--</div>
</div>
<div class="info-bar" id="infoBar">
  <div><div class="label">Location</div><div class="value" id="locLabel">Mumbai, India</div></div>
  <div style="text-align:right"><div class="label">Zoom</div><div class="value" id="zoomLabel">13</div></div>
</div>
<script>
var _mapReady=false;
function initMapIfReady(){
var ls=document.getElementById('loadStatus');
if(typeof L==='undefined'){
  if(ls)ls.textContent='Waiting for map library...';
  setTimeout(initMapIfReady,500);
  return;
}
if(ls)ls.textContent='Initializing map...';
try{
var MUMBAI=[${MUMBAI_LAT},${MUMBAI_LNG}];
var mapDiv=document.getElementById('map');
if(!mapDiv){if(ls){ls.className='error';ls.textContent='Map container not found';}return;}
var map=L.map(mapDiv,{center:MUMBAI,zoom:13,zoomControl:false,attributionControl:false,preferCanvas:true});

// Add zoom control at bottom-right
L.control.zoom({position:'bottomright'}).addTo(map);

// Use standard OpenStreetMap tiles for colorful map
var tileLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,crossOrigin:true});
tileLayer.on('tileerror',function(){
  if(!tileLayer._triedFallback){
    tileLayer._triedFallback=true;
    tileLayer.setUrl('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png');
  }
});
tileLayer.addTo(map);

// Force map to recalculate size after a tick (Android WebView timing fix)
setTimeout(function(){map.invalidateSize();if(ls)ls.className='hidden';_mapReady=true;},300);

// Mumbai landmarks — preserved from original
var landmarks=[
  {name:'Gateway of India',lat:18.9220,lng:72.8347},
  {name:'CST Station',lat:18.9398,lng:72.8355},
  {name:'Bandra-Worli Sea Link',lat:19.0380,lng:72.8162},
  {name:'Marine Drive',lat:18.9432,lng:72.8235},
  {name:'Mumbai Airport',lat:19.0896,lng:72.8656},
  {name:'Haji Ali',lat:18.9827,lng:72.8089},
  {name:'Juhu Beach',lat:19.0988,lng:72.8267},
  {name:'Siddhivinayak Temple',lat:19.0169,lng:72.8306}
];

landmarks.forEach(function(lm){
  L.marker([lm.lat,lm.lng],{icon:L.divIcon({
    className:'',html:'<div class="landmark-dot"></div>',
    iconSize:[8,8],iconAnchor:[4,4]
  })}).addTo(map).bindPopup('<div class="popup-type">'+lm.name+'</div><div class="popup-status">Mumbai Landmark</div>');
});

map.on('zoomend',function(){document.getElementById('zoomLabel').textContent=map.getZoom()});

var userMarker=null,sosMarkers=[],zoneCircles=[];

// ── Report marker cluster group ──
var reportCluster=L.markerClusterGroup({
  maxClusterRadius:50,
  spiderfyOnMaxZoom:true,
  showCoverageOnHover:false,
  zoomToBoundsOnClick:true,
  iconCreateFunction:function(cluster){
    var count=cluster.getChildCount();
    return L.divIcon({
      html:'<div>'+count+'</div>',
      className:'marker-cluster',
      iconSize:[36,36]
    });
  }
});
map.addLayer(reportCluster);

// Track existing report IDs to only add delta
var knownReportIds={};

// ── Issue type → colour mapping ──
function getReportColor(type){
  var colors={
    'Road Blocked':'#E65100',
    'Power Outages':'#D4A017',
    'Fire':'#CC0000',
    'Car Accident':'#0F8060',
    'Water Logging':'#1A6FC4',
    'Gas Leak':'#6B8C00',
    'Street Light Out':'#8E8E00',
    'Pothole':'#7B4F2E'
  };
  return colors[type]||'#CC0000';
}

// ── Issue type → icon character ──
function getReportIconChar(type){
  var icons={
    'Road Blocked':'🚧','Power Outages':'⚡','Fire':'🔥',
    'Car Accident':'🚗','Water Logging':'🌊','Gas Leak':'☣',
    'Street Light Out':'💡','Pothole':'🕳'
  };
  return icons[type]||'⚠';
}

// ── Create custom SVG circle marker icon (28px, 2px white stroke) ──
function createReportIcon(type){
  var color=getReportColor(type);
  var icon=getReportIconChar(type);
  var svg='<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">'
    +'<circle cx="14" cy="14" r="12" fill="'+color+'" stroke="#ffffff" stroke-width="2"/>'
    +'<text x="14" y="15" text-anchor="middle" dominant-baseline="central" font-size="11">'+icon+'</text>'
    +'</svg>';
  return L.divIcon({
    className:'',
    html:svg,
    iconSize:[28,28],
    iconAnchor:[14,14],
    popupAnchor:[0,-16]
  });
}

// ── Format timestamp ──
function formatDate(dateStr){
  if(!dateStr)return'Unknown';
  var d=new Date(dateStr);
  var day=String(d.getDate()).padStart(2,'0');
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var mon=months[d.getMonth()];
  var year=d.getFullYear();
  var hh=String(d.getHours()).padStart(2,'0');
  var mm=String(d.getMinutes()).padStart(2,'0');
  return day+' '+mon+' '+year+', '+hh+':'+mm;
}

// ── Build popup HTML for a report ──
var currentUserRole='Citizen';
function buildReportPopup(r){
  var color=getReportColor(r.calamityType);
  var icon=getReportIconChar(r.calamityType);
  var badgeClass=r.status==='Resolved'?'resolved':'reported';

  var html='<div class="popup-type" style="color:'+color+'">'+icon+' '+r.calamityType+'</div>';
  html+='<div class="popup-addr">'+(r.locationAddress||'Unknown location')+'</div>';
  if(r.details){
    html+='<div class="popup-details">'+r.details+'</div>';
  }
  html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">';
  html+='<div class="popup-time">🕐 '+formatDate(r.createdAt)+'</div>';
  html+='<span class="popup-badge '+badgeClass+'">'+(r.status||'Reported')+'</span>';
  html+='</div>';
  // Admin: add Mark Resolved button
  if(currentUserRole==='Admin'&&r.status!=='Resolved'){
    var rid=r._id||r.id;
    html+='<button onclick="resolveReport(\''+rid+'\')" style="width:100%;margin-top:10px;padding:8px 0;border-radius:8px;border:none;background:#22c55e;color:#fff;font-weight:700;font-size:12px;cursor:pointer;letter-spacing:0.5px">✓ Mark Resolved</button>';
  }
  return html;
}
function resolveReport(id){
  try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'RESOLVE_REPORT',reportId:id}));}catch(e){}
}

// ── Update report markers (delta only) ──
function updateReports(reportsList){
  if(!reportsList||!Array.isArray(reportsList))return;

  // Build set of incoming IDs
  var incomingIds={};
  reportsList.forEach(function(r){
    var id=r._id||r.id;
    if(!id)return;
    incomingIds[id]=true;

    // Skip if already rendered
    if(knownReportIds[id])return;

    // Create marker and add to cluster
    var marker=L.marker([r.latitude,r.longitude],{icon:createReportIcon(r.calamityType)});
    marker.bindPopup(buildReportPopup(r),{maxWidth:260,closeButton:true});
    marker._reportId=id;
    reportCluster.addLayer(marker);
    knownReportIds[id]=marker;
  });

  // Remove markers no longer in the data
  Object.keys(knownReportIds).forEach(function(id){
    if(!incomingIds[id]){
      reportCluster.removeLayer(knownReportIds[id]);
      delete knownReportIds[id];
    }
  });
}

function createUserIcon(){
  return L.divIcon({className:'',html:'<div style="position:relative"><div class="user-ring"></div><div class="user-dot"></div></div>',iconSize:[14,14],iconAnchor:[7,7]});
}

function getSOSColor(t){
  if(t==='Medical')return'#00bfff';if(t==='Fire')return'#ff3b30';
  if(t==='Security')return'#ff9500';return'#ff3b30';
}
function getZoneColor(t){
  if(t==='danger')return'#dc2626';if(t==='blocked')return'#f97316';
  if(t==='safe')return'#22c55e';return'#3b82f6';
}

function updateMap(data){
  // Track user role for admin features
  if(data.userRole) currentUserRole=data.userRole;
  if(data.userLoc){
    if(userMarker){userMarker.setLatLng([data.userLoc.lat,data.userLoc.lng])}
    else{userMarker=L.marker([data.userLoc.lat,data.userLoc.lng],{icon:createUserIcon()}).addTo(map);map.setView([data.userLoc.lat,data.userLoc.lng],14)}
  }
  // BUG 3: Use delta-only SOS updates instead of recreating all markers
  if(data.sosList) updateSosDelta(data.sosList);
  zoneCircles.forEach(function(c){map.removeLayer(c)});zoneCircles=[];
  if(data.zones){
    data.zones.forEach(function(z){
      if(!z.center)return;var c=getZoneColor(z.type);
      var circle=L.circle([z.center.lat,z.center.lng],{radius:z.radius||100,color:c,fillColor:c,fillOpacity:0.25,weight:1.5}).addTo(map);
      circle.bindPopup('<div class="popup-type" style="color:'+c+'">'+(z.type||'Zone').toUpperCase()+'</div><div class="popup-status">'+(z.reason||'Reported Zone')+'</div>');
      zoneCircles.push(circle);
    });
  }
  // Update report markers — force full refresh when admin resolves
  if(data.reports){
    // Clear and rebuild all report markers for fresh popup content
    Object.keys(knownReportIds).forEach(function(id){
      reportCluster.removeLayer(knownReportIds[id]);
    });
    knownReportIds={};
    updateReports(data.reports);
    updateBlockageZones(data.reports);
  }
  // Update important locations
  if(data.importantLocations){
    allLocations=data.importantLocations;
    renderLocations();
  }
  // Store ORS key
  if(data.orsKey) orsKey=data.orsKey;
}

// BUG 3: Delta-only SOS marker updates (cache like reports)
var knownSosIds={};
function updateSosDelta(sosList){
  if(!sosList||!Array.isArray(sosList))return;
  var incomingIds={};
  sosList.forEach(function(s){
    var id=s.id||s.uid;
    if(!id)return;
    incomingIds[id]=true;
    var c=getSOSColor(s.type);
    if(knownSosIds[id]){
      // Update position if changed
      knownSosIds[id].circle.setLatLng([s.lat,s.lng]);
      knownSosIds[id].pulse.setLatLng([s.lat,s.lng]);
      return;
    }
    // Create new markers
    var circle=L.circle([s.lat,s.lng],{radius:s.type==='Medical'?300:200,color:c,fillColor:c,fillOpacity:0.35,weight:2}).addTo(map);
    var statusText=(s.status||'active').toUpperCase();
    circle.bindPopup('<div class="popup-type" style="color:'+c+'">'+s.type+' Emergency</div><div class="popup-status">Status: '+statusText+'</div>');
    var pulse=L.circleMarker([s.lat,s.lng],{radius:8,color:c,fillColor:c,fillOpacity:0.8,weight:0}).addTo(map);
    knownSosIds[id]={circle:circle,pulse:pulse};
  });
  // Remove stale
  Object.keys(knownSosIds).forEach(function(id){
    if(!incomingIds[id]){
      map.removeLayer(knownSosIds[id].circle);
      map.removeLayer(knownSosIds[id].pulse);
      delete knownSosIds[id];
    }
  });
}

// ── Road Blockage zones ──
var blockageCircles=[];
function updateBlockageZones(reportsList){
  blockageCircles.forEach(function(c){map.removeLayer(c)});
  blockageCircles=[];
  if(!reportsList)return;
  reportsList.forEach(function(r){
    if(r.calamityType!=='Road Blocked'||r.status==='Resolved')return;
    var c=L.circle([r.latitude,r.longitude],{radius:150,color:'#E65100',fillColor:'#E65100',fillOpacity:0.2,weight:2,dashArray:'6,4'}).addTo(map);
    c.bindPopup('<div class="popup-type" style="color:#E65100">🚧 Road Blocked</div><div class="popup-addr">'+(r.locationAddress||'')+'</div><div class="popup-details">'+(r.details||'No details')+'</div>');
    blockageCircles.push(c);
  });
}

// ── Check if blockages intersect dispatch route ──
function checkBlockageOnRoute(d,reportsList){
  if(!d||!d.route||!reportsList)return false;
  var blockages=reportsList.filter(function(r){return r.calamityType==='Road Blocked'&&r.status!=='Resolved'});
  for(var i=0;i<blockages.length;i++){
    var bLat=blockages[i].latitude,bLng=blockages[i].longitude;
    for(var j=0;j<d.route.length;j++){
      var rLat=d.route[j][0],rLng=d.route[j][1];
      var dist=Math.sqrt(Math.pow(bLat-rLat,2)+Math.pow(bLng-rLng,2))*111000;
      if(dist<200){
        try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'REROUTE_NEEDED',blockageLat:bLat,blockageLng:bLng}));}catch(e){}
        return true;
      }
    }
  }
  return false;
}

var lastReportsList=[];
var origUpdateMap=updateMap;
updateMap=function(data){
  origUpdateMap(data);
  if(data.reports)lastReportsList=data.reports;
  if(data.dispatch)checkBlockageOnRoute(data.dispatch,lastReportsList);
}

// ── Important Locations ──
var allLocations=[];
var locMarkers=[];
var activeFilters={hospital:true,fire_station:true,police:true,shelter:true};
var orsKey='';
var routeLine=null;

var LOC_COLORS={hospital:'#22C55E',fire_station:'#EF4444',police:'#3B82F6',shelter:'#F59E0B'};
var LOC_ICONS={hospital:'🏥',fire_station:'🚒',police:'🚔',shelter:'🏠'};
var LOC_LABELS={hospital:'Hospital',fire_station:'Fire Station',police:'Police Station',shelter:'Shelter'};

function createLocIcon(type){
  var c=LOC_COLORS[type]||'#888';
  var ic=LOC_ICONS[type]||'📍';
  return L.divIcon({className:'loc-icon',html:'<svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="'+c+'" stroke="#fff" stroke-width="2" opacity="0.9"/><text x="15" y="16" text-anchor="middle" dominant-baseline="central" font-size="13">'+ic+'</text></svg>',iconSize:[30,30],iconAnchor:[15,15],popupAnchor:[0,-17]});
}

function renderLocations(){
  locMarkers.forEach(function(m){map.removeLayer(m)});
  locMarkers=[];
  allLocations.forEach(function(loc){
    if(!activeFilters[loc.type])return;
    var m=L.marker([loc.lat,loc.lng],{icon:createLocIcon(loc.type)}).addTo(map);
    var html='<div class="popup-type" style="color:'+LOC_COLORS[loc.type]+'">'+LOC_ICONS[loc.type]+' '+loc.name+'</div>';
    html+='<div class="popup-status">'+LOC_LABELS[loc.type]+'</div>';
    html+='<div class="popup-addr">'+(loc.address||'')+'</div>';
    if(loc.phone) html+='<div style="color:#999;font-size:12px;margin:4px 0">📞 '+loc.phone+'</div>';
    html+='<div style="margin-top:8px"><button onclick="navigateTo('+loc.lat+','+loc.lng+')" style="width:100%;padding:8px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);color:#3b82f6;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">🧭 Navigate Here</button></div>';
    m.bindPopup(html,{maxWidth:240});
    locMarkers.push(m);
  });
}

function toggleFilter(el){
  var type=el.getAttribute('data-type');
  activeFilters[type]=!activeFilters[type];
  if(activeFilters[type]) el.classList.add('active');
  else el.classList.remove('active');
  renderLocations();
}

// ── ORS Routing + ETA ──
function navigateTo(lat,lng){
  if(!orsKey){console.warn('No ORS key');return;}
  map.closePopup();
  var body={coordinates:[[userMarker?userMarker.getLatLng().lng:${MUMBAI_LNG},userMarker?userMarker.getLatLng().lat:${MUMBAI_LAT}],[lng,lat]]};
  fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson',{
    method:'POST',headers:{'Authorization':orsKey,'Content-Type':'application/json'},body:JSON.stringify(body)
  }).then(function(r){return r.json()}).then(function(data){
    if(!data.features||!data.features.length){console.warn('No route');return;}
    var coords=data.features[0].geometry.coordinates.map(function(c){return[c[1],c[0]]});
    if(routeLine) map.removeLayer(routeLine);
    routeLine=L.polyline(coords,{color:'#3b82f6',weight:5,opacity:0.85}).addTo(map);
    map.fitBounds(routeLine.getBounds(),{padding:[40,40]});
    var s=data.features[0].properties.summary;
    var distKm=(s.distance/1000).toFixed(1);
    var driveMin=Math.ceil(s.duration/60);
    var walkMin=Math.ceil((s.distance/1000)/5*60);
    document.getElementById('etaDrive').textContent=driveMin+' min';
    document.getElementById('etaWalk').textContent=walkMin+' min';
    document.getElementById('etaDist').textContent=distKm+' km';
    document.getElementById('etaBar').classList.add('show');
    document.getElementById('infoBar').style.display='none';
  }).catch(function(e){console.warn('Route error:',e.message)});
}

function clearRoute(){
  if(routeLine){map.removeLayer(routeLine);routeLine=null;}
  document.getElementById('etaBar').classList.remove('show');
  document.getElementById('infoBar').style.display='';
}

// ── Dispatch vehicle rendering ──
var dispatchMarker=null;
var dispatchRoute=null;
var facilityPulse=null;

function updateDispatch(d){
  if(!d){
    // Clear dispatch
    if(dispatchMarker){map.removeLayer(dispatchMarker);dispatchMarker=null;}
    if(dispatchRoute){map.removeLayer(dispatchRoute);dispatchRoute=null;}
    if(facilityPulse){map.removeLayer(facilityPulse);facilityPulse=null;}
    document.getElementById('dispatchBar').classList.remove('show');
    return;
  }
  // Highlight the originating facility with a pulse ring
  if(d.facilityLat&&d.facilityLng&&!facilityPulse){
    facilityPulse=L.circleMarker([d.facilityLat,d.facilityLng],{radius:18,color:'#3b82f6',fillColor:'#3b82f6',fillOpacity:0.25,weight:3,className:'facility-pulse'}).addTo(map);
    facilityPulse.bindPopup('<div class="popup-type" style="color:#3b82f6">🚨 '+d.facilityName+'</div><div class="popup-status">VEHICLE DISPATCHED</div>');
  }
  // Draw route polyline
  if(d.route&&d.route.length>1){
    if(dispatchRoute) map.removeLayer(dispatchRoute);
    dispatchRoute=L.polyline(d.route,{color:'#3b82f6',weight:4,opacity:0.6,dashArray:'10,8'}).addTo(map);
  }
  // Vehicle marker
  if(d.vehiclePos){
    var icon=L.divIcon({className:'',html:'<div class="vehicle-icon">'+(d.vehicleIcon||'🚑')+'</div>',iconSize:[32,32],iconAnchor:[16,16]});
    if(dispatchMarker){
      dispatchMarker.setLatLng([d.vehiclePos.lat,d.vehiclePos.lng]);
      dispatchMarker.setIcon(icon);
    } else {
      dispatchMarker=L.marker([d.vehiclePos.lat,d.vehiclePos.lng],{icon:icon,zIndexOffset:2000}).addTo(map);
    }
    // Pan to show both user and vehicle
    if(userMarker){
      var bounds=L.latLngBounds([dispatchMarker.getLatLng(),userMarker.getLatLng()]);
      map.fitBounds(bounds,{padding:[60,60],maxZoom:15});
    }
  }
  // ETA overlay
  if(d.facilityName){
    document.getElementById('dispatchIcon').textContent=d.vehicleIcon||'🚑';
    document.getElementById('dispatchName').textContent=d.facilityName+' dispatched';
    document.getElementById('dispatchEta').textContent=d.eta||'--';
    document.getElementById('dispatchBar').classList.add('show');
  }
}

function doSearch(){
  var q=document.getElementById('searchInput').value;if(!q)return;
  fetch('https://nominatim.openstreetmap.org/search?format=json&q='+encodeURIComponent(q+' Mumbai India')+'&limit=1',{
    headers:{'User-Agent':'ReliefMeshApp/1.0','Accept':'application/json'}
  })
  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()})
  .then(function(txt){try{return JSON.parse(txt)}catch(e){console.warn('Non-JSON response:',txt.substring(0,100));return null}})
  .then(function(d){
    if(d&&d.length>0){
      var lat=parseFloat(d[0].lat),lon=parseFloat(d[0].lon);
      map.setView([lat,lon],16);
      L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<div class="search-pin"></div>',iconSize:[10,10],iconAnchor:[5,5]})}).addTo(map)
       .bindPopup('<div class="popup-type">'+d[0].display_name.split(',')[0]+'</div>').openPopup();
      document.getElementById('locLabel').textContent=d[0].display_name.split(',').slice(0,2).join(', ');
    }
  }).catch(function(e){console.warn('Search error:',e.message)});
}
document.getElementById('searchInput').addEventListener('keypress',function(e){if(e.key==='Enter')doSearch()});

document.addEventListener('message',function(e){try{var d=JSON.parse(e.data);if(d.type==='UPDATE_DATA'){updateMap(d);updateDispatch(d.dispatch)}}catch(err){}});
window.addEventListener('message',function(e){try{var d=JSON.parse(e.data);if(d.type==='UPDATE_DATA'){updateMap(d);updateDispatch(d.dispatch)}}catch(err){}});

// ── Signal React Native that the WebView JS is ready ──
// This closes the race condition: RN won't postMessage until we confirm.
try{
  if(window.ReactNativeWebView){
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'WEBVIEW_READY'}));
  }
} catch(e){}
}catch(err){
  var ls=document.getElementById('loadStatus');
  if(ls){ls.className='error';ls.textContent='Map error: '+err.message;}
}
} // end initMapIfReady

// Start map initialization - wait for Leaflet to be available
// (initMapIfReady is called by _loadNext after all scripts are loaded)
// Hard timeout: if map not ready in 10s, show diagnostic
setTimeout(function(){
  if(!_mapReady){
    var ls=document.getElementById('loadStatus');
    if(ls && ls.className!=='hidden'){
      ls.className='error';
      ls.textContent='Map timed out. Leaflet: '+(typeof L!=='undefined')+'. Retry: refresh app.';
    }
  }
},10000);
</script>
</body></html>`, []);  // Memoize — HTML only uses module-level constants, never needs to change

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={Platform.OS === 'android'
          ? { uri: 'file:///android_asset/meshMap.html' }
          : { html: mapHTML }
        }
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading Map...</Text>
          </View>
        )}
        renderError={(errorDomain, errorCode, errorDesc) => (
          <View style={styles.loadingContainer}>
            <Text style={{ color: '#dc2626', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Map Load Error</Text>
            <Text style={{ color: '#888', fontSize: 12, textAlign: 'center' }}>{errorDesc || 'Check your internet connection'}</Text>
          </View>
        )}
        onError={(syntheticEvent) => {
          console.warn('[MeshMap] WebView error:', syntheticEvent.nativeEvent.description);
        }}
        onHttpError={(syntheticEvent) => {
          console.warn('[MeshMap] WebView HTTP error:', syntheticEvent.nativeEvent.statusCode);
        }}
        onMessage={handleWebViewMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        allowsInlineMediaPlayback={true}
        mixedContentMode="always"
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        allowsBackForwardNavigationGestures={false}
        mediaPlaybackRequiresUserAction={false}
        allowsLinkPreview={false}
        /* 'software' is most reliable for map rendering on Android physical devices */
        androidLayerType="software"
        androidHardwareAccelerationDisabled={false}
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        setSupportMultipleWindows={false}
        thirdPartyCookiesEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  webview: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  loadingText: { color: '#666', marginTop: 12, fontSize: 13, letterSpacing: 1 },
});
