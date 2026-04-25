import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from './firebaseConfig';

// Mumbai coordinates - hardcoded default
const MUMBAI_LAT = 19.0760;
const MUMBAI_LNG = 72.8777;

export default function NativeMapComponent({ userLoc }) {
  const webViewRef = useRef(null);
  const [sosList, setSosList] = useState([]);
  const [zones, setZones] = useState([]);

  useEffect(() => {
    try {
      const q = query(collection(firestore, 'sos'), where('status', 'in', ['searching', 'routed', 'responding']));
      const unsub = onSnapshot(q, (snap) => {
        const data = [];
        snap.forEach((d) => { const v = d.data(); if (v.lat && v.lng) data.push({ id: d.id, ...v }); });
        setSosList(data);
      });
      return () => unsub();
    } catch (e) { console.warn('SOS listener error:', e.message); }
  }, []);

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

  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'UPDATE_DATA', sosList, zones,
        userLoc: userLoc ? { lat: userLoc.latitude, lng: userLoc.longitude } : null,
      }));
    }
  }, [sosList, zones, userLoc]);

  const mapHTML = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e;font-family:-apple-system,system-ui,sans-serif}
#map{width:100%;height:100%}
.leaflet-control-attribution{display:none!important}
.leaflet-control-zoom{border:none!important;margin:12px!important}
.leaflet-control-zoom a{background:rgba(26,26,46,0.9)!important;color:#aaa!important;border:1px solid #333!important;width:36px!important;height:36px!important;line-height:36px!important;font-size:18px!important;border-radius:8px!important;margin-bottom:4px!important}
.leaflet-control-zoom a:hover{background:rgba(40,40,70,0.95)!important;color:#fff!important}
.user-dot{width:14px;height:14px;background:#3b82f6;border-radius:50%;border:2.5px solid #fff;box-shadow:0 0 12px #3b82f6,0 0 24px rgba(59,130,246,0.4)}
.user-ring{position:absolute;width:44px;height:44px;top:-15px;left:-15px;border-radius:50%;border:2px solid rgba(59,130,246,0.3);animation:ring 2s ease-in-out infinite}
@keyframes ring{0%,100%{transform:scale(.7);opacity:.7}50%{transform:scale(1.4);opacity:0}}
.search-box{position:absolute;top:12px;left:12px;right:12px;z-index:1000;display:flex;gap:8px}
.search-box input{flex:1;background:rgba(26,26,46,0.92);border:1px solid #333;color:#fff;padding:10px 14px;border-radius:10px;font-size:14px;outline:none;backdrop-filter:blur(8px)}
.search-box input::placeholder{color:#666}
.search-box input:focus{border-color:#3b82f6;box-shadow:0 0 8px rgba(59,130,246,0.2)}
.search-box button{background:#dc2626;color:#fff;border:none;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer}
.info-bar{position:absolute;bottom:12px;left:12px;right:12px;z-index:1000;background:rgba(26,26,46,0.92);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center}
.info-bar .label{color:#888;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase}
.info-bar .value{color:#fff;font-size:13px;font-weight:700;margin-top:2px}
.leaflet-popup-content-wrapper{background:rgba(26,26,46,0.95)!important;color:#fff!important;border:1px solid rgba(255,255,255,0.1)!important;border-radius:10px!important;box-shadow:0 4px 20px rgba(0,0,0,0.5)!important}
.leaflet-popup-tip{background:rgba(26,26,46,0.95)!important;border:1px solid rgba(255,255,255,0.1)!important}
.leaflet-popup-content{margin:10px 14px!important;font-size:13px!important;line-height:1.4!important}
.popup-type{font-weight:800;font-size:14px;margin-bottom:4px}
.popup-status{color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px}
.landmark-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.2)}
.search-pin{width:10px;height:10px;background:#dc2626;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #dc2626}
</style>
</head><body>
<div class="search-box">
  <input id="searchInput" type="text" placeholder="Search locations..."/>
  <button onclick="doSearch()">Go</button>
</div>
<div id="map"></div>
<div class="info-bar">
  <div><div class="label">Location</div><div class="value" id="locLabel">Mumbai, India</div></div>
  <div style="text-align:right"><div class="label">Zoom</div><div class="value" id="zoomLabel">13</div></div>
</div>
<script>
var MUMBAI=[${MUMBAI_LAT},${MUMBAI_LNG}];
var map=L.map('map',{center:MUMBAI,zoom:13,zoomControl:true,attributionControl:false});

var osmTile=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19});
osmTile.addTo(map);

// Mumbai landmarks — clean dot markers, no emojis
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
  if(data.userLoc){
    if(userMarker){userMarker.setLatLng([data.userLoc.lat,data.userLoc.lng])}
    else{userMarker=L.marker([data.userLoc.lat,data.userLoc.lng],{icon:createUserIcon()}).addTo(map);map.setView([data.userLoc.lat,data.userLoc.lng],14)}
  }
  sosMarkers.forEach(function(m){map.removeLayer(m)});sosMarkers=[];
  if(data.sosList){
    data.sosList.forEach(function(s){
      var c=getSOSColor(s.type);
      var m=L.circle([s.lat,s.lng],{radius:s.type==='Medical'?300:200,color:c,fillColor:c,fillOpacity:0.35,weight:2}).addTo(map);
      var statusText=(s.status||'active').toUpperCase();
      m.bindPopup('<div class="popup-type" style="color:'+c+'">'+s.type+' Emergency</div><div class="popup-status">Status: '+statusText+'</div>');
      sosMarkers.push(m);
      var pulse=L.circleMarker([s.lat,s.lng],{radius:8,color:c,fillColor:c,fillOpacity:0.8,weight:0}).addTo(map);
      sosMarkers.push(pulse);
    });
  }
  zoneCircles.forEach(function(c){map.removeLayer(c)});zoneCircles=[];
  if(data.zones){
    data.zones.forEach(function(z){
      if(!z.center)return;var c=getZoneColor(z.type);
      var circle=L.circle([z.center.lat,z.center.lng],{radius:z.radius||100,color:c,fillColor:c,fillOpacity:0.25,weight:1.5}).addTo(map);
      circle.bindPopup('<div class="popup-type" style="color:'+c+'">'+(z.type||'Zone').toUpperCase()+'</div><div class="popup-status">'+(z.reason||'Reported Zone')+'</div>');
      zoneCircles.push(circle);
    });
  }
}

function doSearch(){
  var q=document.getElementById('searchInput').value;if(!q)return;
  fetch('https://nominatim.openstreetmap.org/search?format=json&q='+encodeURIComponent(q+' Mumbai India')+'&limit=1')
  .then(function(r){return r.json()}).then(function(d){
    if(d&&d.length>0){
      var lat=parseFloat(d[0].lat),lon=parseFloat(d[0].lon);
      map.setView([lat,lon],16);
      L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<div class="search-pin"></div>',iconSize:[10,10],iconAnchor:[5,5]})}).addTo(map)
       .bindPopup('<div class="popup-type">'+d[0].display_name.split(',')[0]+'</div>').openPopup();
      document.getElementById('locLabel').textContent=d[0].display_name.split(',').slice(0,2).join(', ');
    }
  }).catch(function(){});
}
document.getElementById('searchInput').addEventListener('keypress',function(e){if(e.key==='Enter')doSearch()});

document.addEventListener('message',function(e){try{var d=JSON.parse(e.data);if(d.type==='UPDATE_DATA')updateMap(d)}catch(err){}});
window.addEventListener('message',function(e){try{var d=JSON.parse(e.data);if(d.type==='UPDATE_DATA')updateMap(d)}catch(err){}});
</script>
</body></html>`;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHTML }}
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
        onMessage={() => {}}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        allowsInlineMediaPlayback={true}
        mixedContentMode="always"
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
