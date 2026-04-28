import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions } from 'react-native';
import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { firestore, database as rtdb } from './firebaseConfig';
import { Activity, Users, AlertTriangle, Shield, Truck, MapPin, FileText } from 'lucide-react-native';
import { WebView } from 'react-native-webview';

const API_BASE_LAN = 'http://10.61.78.188:4000/api';

export default function AdminOverviewScreen() {
  const [metrics, setMetrics] = useState({
    activeSos: 0, teamsReady: 0, teamsDispatched: 0, pendingVolunteers: 0,
    issuesReported: 0, respondersOnline: 0, roadBlockages: 0, totalReports: 0
  });
  const [recentSos, setRecentSos] = useState([]);
  const mapRef = useRef(null);

  useEffect(() => {
    // Teams — auto-seed if empty
    const uT = onSnapshot(collection(firestore, 'teams'), snap => {
      let ready = 0;
      let dispatched = 0;
      let total = 0;
      snap.forEach(d => {
        total++;
        if (d.data().status === 'ready') ready++;
        if (d.data().status === 'dispatched') dispatched++;
      });
      setMetrics(m => ({ ...m, teamsReady: ready, teamsDispatched: dispatched }));

      // Auto-seed 3 default teams if none exist
      if (total === 0) {
        const defaultTeams = [
          { id: 'team_alpha', name: 'Team Alpha', priority: 1, vehicle: '🚑', status: 'ready', members: [
            { role: 'Doctor', name: 'Dr. Arjun Mehta', email: 'team1.doctor@reliefmesh.com' },
            { role: 'Nurse', name: 'Priya Sharma', email: 'team1.nurse@reliefmesh.com' },
            { role: 'Paramedic', name: 'Rahul Verma', email: 'team1.paramedic@reliefmesh.com' },
            { role: 'Driver', name: 'Sunil Patil', email: 'team1.driver@reliefmesh.com' },
          ]},
          { id: 'team_bravo', name: 'Team Bravo', priority: 2, vehicle: '🚑', status: 'ready', members: [
            { role: 'Doctor', name: 'Dr. Kavita Iyer', email: 'team2.doctor@reliefmesh.com' },
            { role: 'Nurse', name: 'Anita Desai', email: 'team2.nurse@reliefmesh.com' },
            { role: 'Paramedic', name: 'Vikram Singh', email: 'team2.paramedic@reliefmesh.com' },
            { role: 'Driver', name: 'Manoj Kulkarni', email: 'team2.driver@reliefmesh.com' },
          ]},
          { id: 'team_charlie', name: 'Team Charlie', priority: 3, vehicle: '🚑', status: 'ready', members: [
            { role: 'Doctor', name: 'Dr. Neha Joshi', email: 'team3.doctor@reliefmesh.com' },
            { role: 'Nurse', name: 'Deepika Rao', email: 'team3.nurse@reliefmesh.com' },
            { role: 'Paramedic', name: 'Amit Thakur', email: 'team3.paramedic@reliefmesh.com' },
            { role: 'Driver', name: 'Rajesh Gupta', email: 'team3.driver@reliefmesh.com' },
          ]},
        ];
        defaultTeams.forEach(team => {
          setDoc(doc(firestore, 'teams', team.id), {
            name: team.name, priority: team.priority, vehicle: team.vehicle,
            status: team.status, members: team.members, dispatchedSosId: null, createdAt: Date.now(),
          }, { merge: true }).catch(e => console.warn('Team seed failed:', e.message));
        });
      }
    });

    // Volunteer requests
    const uV = onSnapshot(query(collection(firestore, 'volunteerRequests'), where('status', '==', 'pending')), snap => {
      setMetrics(m => ({ ...m, pendingVolunteers: snap.size }));
    });

    // Responders
    const uR = onSnapshot(query(collection(firestore, 'responders'), where('available', '==', true)), snap => {
      setMetrics(m => ({ ...m, respondersOnline: snap.size }));
    });

    // BUG 7: SOS (RTDB) — include 'responding' in active count
    const sosRef = ref(rtdb, 'sos');
    const uS = onValue(sosRef, snap => {
      const data = snap.val();
      let active = 0;
      const recent = [];
      if (data) {
        Object.keys(data).forEach(k => {
          const s = data[k];
          if (s.status === 'searching' || s.status === 'routed' || s.status === 'responding') {
            active++;
            recent.push({ id: k, ...s });
          }
        });
      }
      recent.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRecentSos(recent.slice(0, 5));
      setMetrics(m => ({ ...m, activeSos: active }));

      // BUG 7: Push SOS data to live map
      if (mapRef.current) {
        mapRef.current.postMessage(JSON.stringify({ type: 'UPDATE_SOS', sosList: recent }));
      }
    });

    // Zones (Road blockages)
    const uZ = onSnapshot(query(collection(firestore, 'zones'), where('type', '==', 'blocked')), snap => {
      setMetrics(m => ({ ...m, roadBlockages: snap.size }));
    });

    // BUG 7: Total reports count
    const fetchReportCount = async () => {
      try {
        const res = await fetch(`${API_BASE_LAN}/reports`);
        if (res.ok) {
          const data = await res.json();
          setMetrics(m => ({ ...m, totalReports: Array.isArray(data) ? data.length : 0 }));
        }
      } catch (e) { /* non-critical */ }
    };
    fetchReportCount();

    return () => { uT(); uV(); uR(); uS(); uZ(); };
  }, []);

  const metricCards = [
    { label: 'Active SOS', value: metrics.activeSos, color: '#dc2626', icon: Activity },
    { label: 'Teams Ready', value: metrics.teamsReady, color: '#22c55e', icon: Truck },
    { label: 'Dispatched', value: metrics.teamsDispatched, color: '#f59e0b', icon: Truck },
    { label: 'Volunteers', value: metrics.pendingVolunteers, color: '#f59e0b', icon: Users },
    { label: 'Responders', value: metrics.respondersOnline, color: '#3b82f6', icon: Shield },
    { label: 'Blockages', value: metrics.roadBlockages, color: '#f97316', icon: AlertTriangle },
    { label: 'Reports', value: metrics.totalReports, color: '#8b5cf6', icon: FileText },
  ];

  // BUG 7: Overview map HTML
  const overviewMapHTML = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0}html,body,#map{width:100%;height:100%;background:#0D0D0D}
.leaflet-control-attribution,.leaflet-control-zoom{display:none!important}</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{center:[19.076,72.8777],zoom:12,zoomControl:false,attributionControl:false});
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
var markers={};
var COLORS={Fire:'#dc2626',Medical:'#22c55e',Security:'#3b82f6',General:'#f59e0b'};
document.addEventListener('message',function(e){handleMsg(e.data)});
window.addEventListener('message',function(e){handleMsg(e.data)});
function handleMsg(raw){
  try{
    var data=JSON.parse(raw);
    if(data.type==='UPDATE_SOS'){
      var incoming={};
      (data.sosList||[]).forEach(function(s){
        incoming[s.id]=true;
        var c=COLORS[s.type]||'#f59e0b';
        if(markers[s.id]){
          markers[s.id].setLatLng([s.lat,s.lng]);
        }else{
          var pulse=L.circle([s.lat,s.lng],{radius:300,color:c,fillColor:c,fillOpacity:0.2,weight:1}).addTo(map);
          var dot=L.circleMarker([s.lat,s.lng],{radius:8,color:'#fff',fillColor:c,fillOpacity:1,weight:2}).addTo(map);
          dot.bindPopup('<b style="color:'+c+'">'+s.type+' SOS</b><br>'+s.status);
          markers[s.id]={pulse:pulse,dot:dot};
        }
      });
      Object.keys(markers).forEach(function(id){
        if(!incoming[id]){
          map.removeLayer(markers[id].pulse);
          map.removeLayer(markers[id].dot);
          delete markers[id];
        }
      });
    }
  }catch(e){}
}
</script>
</body></html>`;

  const SOS_ICONS = { Fire: '🔥', Medical: '🏥', Security: '🛡', General: '⚠' };
  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const mins = Math.floor((Date.now() - ts) / 60000);
    return mins < 60 ? `${mins}m ago` : `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>System Overview</Text>
      <Text style={styles.subtitle}>Real-time operational status of ReliefMesh</Text>

      {/* BUG 7: Live Operations Map */}
      <View style={styles.mapContainer}>
        <View style={styles.mapHeader}>
          <MapPin color="#dc2626" size={14} />
          <Text style={styles.mapHeaderTitle}>OPERATIONS MAP</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <WebView
          ref={mapRef}
          source={{ html: overviewMapHTML }}
          style={styles.map}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          androidLayerType="hardware"
        />
      </View>

      {/* Metrics Grid */}
      <View style={styles.grid}>
        {metricCards.map((c, i) => (
          <View key={i} style={[styles.card, { borderColor: `${c.color}33` }]}>
            <View style={styles.cardHeader}>
              <c.icon color={c.color} size={24} />
              <View style={[styles.glow, { backgroundColor: c.color }]} />
            </View>
            <Text style={[styles.value, { color: c.color }]}>{c.value}</Text>
            <Text style={styles.label}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* BUG 7: Recent Active SOS Feed */}
      {recentSos.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Activity color="#dc2626" size={14} />
            <Text style={styles.sectionTitle}>RECENT ACTIVE SOS</Text>
          </View>
          {recentSos.map(sos => (
            <View key={sos.id} style={styles.sosFeedItem}>
              <Text style={{ fontSize: 18 }}>{SOS_ICONS[sos.type] || '⚠'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{sos.type} Emergency</Text>
                <Text style={{ color: '#666', fontSize: 11 }}>
                  {sos.lat?.toFixed(3)}, {sos.lng?.toFixed(3)} · {sos.displayName || 'Anonymous'}
                </Text>
              </View>
              <View>
                <Text style={{ color: '#888', fontSize: 10, textAlign: 'right' }}>{formatTime(sos.timestamp)}</Text>
                <Text style={{ color: sos.status === 'responding' ? '#22c55e' : '#f59e0b', fontSize: 10, fontWeight: '700', textAlign: 'right', marginTop: 2 }}>
                  {sos.status?.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { padding: 24, paddingTop: 40, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  mapContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderWidth: 1, borderColor: '#222',
    marginBottom: 24, overflow: 'hidden',
  },
  mapHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#222',
  },
  mapHeaderTitle: {
    color: '#dc2626', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, flex: 1,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(34,197,94,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e',
  },
  liveText: {
    color: '#22c55e', fontSize: 9, fontWeight: '800', letterSpacing: 1,
  },
  map: { height: 220, backgroundColor: '#0D0D0D' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  card: {
    width: '30%', backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14, padding: 16, borderWidth: 1,
    position: 'relative', overflow: 'hidden',
  },
  cardHeader: { marginBottom: 12 },
  value: { fontSize: 28, fontWeight: '900', marginBottom: 2 },
  label: { fontSize: 10, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  glow: {
    position: 'absolute', top: -30, left: -30,
    width: 80, height: 80, borderRadius: 40, opacity: 0.05,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  sectionTitle: {
    color: '#888', fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
  },
  sosFeedItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#1a1a1a', marginBottom: 8,
  },
});
