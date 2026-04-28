import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Dimensions } from 'react-native';
import { collection, onSnapshot, query, where, doc, updateDoc, getDocs } from 'firebase/firestore';
import { ref, onValue, update, remove } from 'firebase/database';
import { firestore, database as rtdb } from './firebaseConfig';
import { Radio, Truck, MapPin, Clock, Users } from 'lucide-react-native';
import { WebView } from 'react-native-webview';

const SOS_COLORS = { Fire: '#dc2626', Medical: '#22c55e', Security: '#3b82f6', General: '#f59e0b' };
const SOS_ICONS = { Fire: '🔥', Medical: '🏥', Security: '🛡', General: '⚠' };

export default function AdminLiveSOSScreen() {
  const [sosList, setSosList] = useState([]);
  const [teams, setTeams] = useState([]);
  const [dispatchedTeams, setDispatchedTeams] = useState([]);
  const miniMapRef = useRef(null);

  useEffect(() => {
    // BUG 7: Include 'responding' status in active SOS list
    const uS = onValue(ref(rtdb, 'sos'), snap => {
      const data = snap.val();
      const arr = [];
      if (data) {
        Object.keys(data).forEach(k => {
          if (data[k].status === 'searching' || data[k].status === 'routed' || data[k].status === 'responding') {
            arr.push({ id: k, ...data[k] });
          }
        });
      }
      arr.sort((a, b) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0));
      setSosList(arr);

      // Update mini-map with SOS markers
      if (miniMapRef.current) {
        miniMapRef.current.postMessage(JSON.stringify({ type: 'UPDATE_SOS', sosList: arr }));
      }
    });
    
    // Available teams
    const uT = onSnapshot(query(collection(firestore, 'teams'), where('status', '==', 'ready')), snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => a.priority - b.priority);
      setTeams(arr);
    });

    // BUG 7: Track dispatched teams for vehicle markers
    const uDT = onSnapshot(query(collection(firestore, 'teams'), where('status', '==', 'dispatched')), snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setDispatchedTeams(arr);
    });
    
    return () => { uS(); uT(); uDT(); };
  }, []);

  const handleDispatchTeam = async (sos, team) => {
    try {
      await update(ref(rtdb, `sos/${sos.id}`), { status: 'routed', teamId: team.id });
      await updateDoc(doc(firestore, 'teams', team.id), { status: 'dispatched', dispatchedSosId: sos.id });
      Alert.alert('Success', `Dispatched ${team.name} to SOS.`);
    } catch (e) {
      Alert.alert('Error', 'Dispatch failed: ' + e.message);
    }
  };

  const handleCancelSOS = (sos) => {
    Alert.alert(
      'Cancel SOS',
      `Cancel SOS #${sos.id.substring(0,10)}? This will reset the assigned team.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel', style: 'destructive',
          onPress: async () => {
            try {
              await update(ref(rtdb, `sos/${sos.id}`), { status: 'cancelled' });
              try { await remove(ref(rtdb, `dispatch/${sos.id}`)); } catch(e) {}
              if (sos.teamId) {
                try { await updateDoc(doc(firestore, 'teams', sos.teamId), { status: 'ready', dispatchedSosId: null }); } catch(e) {}
              }
              // Also find any team dispatched to this SOS
              try {
                const teamSnap = await getDocs(query(collection(firestore, 'teams'), where('dispatchedSosId', '==', sos.id)));
                teamSnap.forEach(async (d) => {
                  await updateDoc(doc(firestore, 'teams', d.id), { status: 'ready', dispatchedSosId: null });
                });
              } catch(e) {}
            } catch (e) {
              Alert.alert('Error', 'Cancel failed: ' + e.message);
            }
          }
        }
      ]
    );
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'searching': return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
      case 'routed': return { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' };
      case 'responding': return { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' };
      default: return { bg: 'rgba(136,136,136,0.12)', color: '#888' };
    }
  };

  const formatTime = (ts) => {
    if (!ts) return 'Unknown';
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  // BUG 7: Mini-map HTML showing active SOS markers + dispatched vehicles
  const miniMapHTML = `<!DOCTYPE html>
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
          var m=L.circleMarker([s.lat,s.lng],{radius:10,color:c,fillColor:c,fillOpacity:0.8,weight:2,color:'#fff'}).addTo(map);
          m.bindPopup('<b style="color:'+c+'">'+s.type+'</b><br>Status: '+(s.status||'active'));
          markers[s.id]=m;
        }
      });
      Object.keys(markers).forEach(function(id){
        if(!incoming[id]){map.removeLayer(markers[id]);delete markers[id];}
      });
      if(data.sosList&&data.sosList.length>0){
        var bounds=L.latLngBounds(data.sosList.map(function(s){return[s.lat,s.lng]}));
        map.fitBounds(bounds,{padding:[30,30],maxZoom:14});
      }
    }
  }catch(e){}
}
</script>
</body></html>`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Live SOS Alerts</Text>
      <Text style={styles.subtitle}>
        {sosList.length} active alerts | {teams.length} teams ready | {dispatchedTeams.length} dispatched
      </Text>

      {/* BUG 7: Live Mini-Map */}
      <View style={styles.miniMapContainer}>
        <View style={styles.miniMapHeader}>
          <MapPin color="#dc2626" size={14} />
          <Text style={styles.miniMapTitle}>LIVE MAP</Text>
        </View>
        <WebView
          ref={miniMapRef}
          source={{ html: miniMapHTML }}
          style={styles.miniMap}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          androidLayerType="hardware"
        />
      </View>

      {/* Dispatched Teams Tracker */}
      {dispatchedTeams.length > 0 && (
        <View style={styles.sectionHeader}>
          <Truck color="#f59e0b" size={16} />
          <Text style={styles.sectionTitle}>Dispatched Vehicles ({dispatchedTeams.length})</Text>
        </View>
      )}
      {dispatchedTeams.map(team => (
        <View key={team.id} style={[styles.sosCard, { borderLeftColor: '#f59e0b' }]}>
          <View style={styles.cardHeader}>
            <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '800' }}>
              {team.vehicle || '🚑'} {team.name}
            </Text>
            <Text style={{ color: '#888', fontSize: 11, fontWeight: '700' }}>
              SOS #{team.dispatchedSosId?.substring(0, 8)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {team.members?.map((m, i) => (
              <View key={i} style={{ backgroundColor: 'rgba(245,158,11,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '700' }}>{m.role}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Active SOS Alerts */}
      <View style={styles.sectionHeader}>
        <Radio color="#dc2626" size={16} />
        <Text style={styles.sectionTitle}>Active Alerts ({sosList.length})</Text>
      </View>

      {sosList.length === 0 && (
        <View style={styles.emptyCard}>
          <Radio color="#555" size={48} style={{ marginBottom: 16 }} />
          <Text style={{ color: '#888', fontSize: 16, fontWeight: '600' }}>No active SOS alerts</Text>
        </View>
      )}

      {sosList.map(sos => {
        const st = getStatusStyle(sos.status);
        return (
          <View key={sos.id} style={[styles.sosCard, { borderLeftColor: SOS_COLORS[sos.type] || '#dc2626' }]}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 22 }}>{SOS_ICONS[sos.type] || '⚠'}</Text>
                <View>
                  <Text style={styles.sosType}>{sos.type?.toUpperCase() || 'UNKNOWN'}</Text>
                  <Text style={styles.coords}>{sos.lat?.toFixed(4)}, {sos.lng?.toFixed(4)}</Text>
                </View>
              </View>
              <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                <Text style={[styles.statusPillText, { color: st.color }]}>
                  {sos.status?.toUpperCase()}
                </Text>
              </View>
            </View>
            
            {/* Meta info */}
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
              {sos.displayName && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Users color="#555" size={12} />
                  <Text style={{ color: '#888', fontSize: 12 }}>{sos.displayName}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Clock color="#555" size={12} />
                <Text style={{ color: '#888', fontSize: 12 }}>{formatTime(sos.timestamp)}</Text>
              </View>
            </View>

            {/* Dispatch buttons - only show for 'searching' SOS */}
            {sos.status === 'searching' && (
              <View style={styles.dispatchContainer}>
                {teams.map(t => (
                  <TouchableOpacity key={t.id} style={styles.dispatchBtn} onPress={() => handleDispatchTeam(sos, t)}>
                    <Text style={styles.dispatchBtnText}>{t.vehicle || '🚑'} {t.name}</Text>
                  </TouchableOpacity>
                ))}
                {teams.length === 0 && (
                  <Text style={{ color: '#888', fontSize: 13, fontStyle: 'italic' }}>No teams currently available.</Text>
                )}
              </View>
            )}

            {/* Show assigned team for routed/responding */}
            {(sos.status === 'routed' || sos.status === 'responding') && sos.teamId && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(59,130,246,0.06)', padding: 10, borderRadius: 8 }}>
                <Truck color="#3b82f6" size={14} />
                <Text style={{ color: '#3b82f6', fontSize: 13, fontWeight: '600', flex: 1 }}>
                  Team dispatched — {sos.status === 'responding' ? 'En route' : 'Route calculated'}
                </Text>
              </View>
            )}

            {/* Cancel SOS Button */}
            <TouchableOpacity
              style={{ marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)', backgroundColor: 'rgba(220,38,38,0.06)', alignItems: 'center' }}
              onPress={() => handleCancelSOS(sos)}
            >
              <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '700' }}>Cancel SOS</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { padding: 24, paddingTop: 40, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  miniMapContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderWidth: 1, borderColor: '#222',
    marginBottom: 24, overflow: 'hidden',
  },
  miniMapHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#222',
  },
  miniMapTitle: {
    color: '#dc2626', fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
  },
  miniMap: {
    height: 200, backgroundColor: '#0D0D0D',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 8,
  },
  sectionTitle: {
    color: '#aaa', fontSize: 13, fontWeight: '700', letterSpacing: 0.5,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, padding: 40, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, borderColor: '#222',
  },
  sosCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1a1a1a',
    borderLeftWidth: 4, marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  sosType: { color: '#fff', fontSize: 16, fontWeight: '800' },
  coords: { color: '#666', fontSize: 11, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  statusPillText: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
  },
  dispatchContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dispatchBtn: {
    backgroundColor: '#dc2626', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8,
  },
  dispatchBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
