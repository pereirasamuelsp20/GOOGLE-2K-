import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Platform
} from 'react-native';
import { WebView } from 'react-native-webview';
import { AlertTriangle, ChevronDown, MapPin, Clock, Send } from 'lucide-react-native';

// Use the Mac's LAN IP so physical devices can reach the backend.
// For Android emulator use 10.0.2.2, for iOS simulator use localhost.
// For physical devices (Android or iOS), use the Mac's actual network IP.
const getApiBase = () => {
  // Physical device detection: __DEV__ is true in dev builds,
  // but we need the LAN IP regardless on physical devices.
  // Expo Dev server IP is a reliable indicator of the LAN.
  const LAN_IP = '10.61.78.188'; // Your Mac's local IP — update if it changes
  return `http://${LAN_IP}:4000/api`;
};

const API_BASE = getApiBase();

// Nominatim requires a User-Agent header per their usage policy.
// Requests without it get an HTML error page instead of JSON.
const NOMINATIM_HEADERS = {
  'User-Agent': 'ReliefMeshApp/1.0 (contact@reliefmesh.dev)',
  'Accept': 'application/json',
};

const ISSUE_OPTIONS = [
  { value: 'Road Blocked', icon: '🚧' },
  { value: 'Power Outages', icon: '⚡' },
  { value: 'Fire', icon: '🔥' },
  { value: 'Car Accident', icon: '🚗' },
  { value: 'Water Logging', icon: '🌊' },
  { value: 'Gas Leak', icon: '☣' },
  { value: 'Street Light Out', icon: '💡' },
  { value: 'Pothole', icon: '🕳' },
];

const ROAD_BLOCKED_SUBTYPES = [
  { value: 'Debris', icon: '🪨' },
  { value: 'Water Logged', icon: '💧' },
  { value: 'Fallen Tree', icon: '🌳' },
  { value: 'Accident Wreckage', icon: '🚗' },
  { value: 'Construction', icon: '🏗' },
];

const getIssueIcon = (type) => {
  const found = ISSUE_OPTIONS.find(c => c.value === type);
  return found ? found.icon : '⚠';
};

export default function ReportIssueScreen() {
  const webViewRef = useRef(null);
  const debounceRef = useRef(null);

  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(19.0760);
  const [lng, setLng] = useState(72.8777);
  const [pinPlaced, setPinPlaced] = useState(false);
  const [resolvedLocation, setResolvedLocation] = useState('');
  const [calamityType, setCalamityType] = useState('');
  const [blockageSubType, setBlockageSubType] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'reports'

  // Fetch reports on mount
  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      console.log('[Reports] Fetching from:', `${API_BASE}/reports`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${API_BASE}/reports`, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        console.warn('[Reports] Server error:', res.status, text.substring(0, 200));
        return;
      }

      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('[Reports] Request timed out — is the backend running?');
      } else {
        console.warn('[Reports] Fetch failed:', err.message);
      }
    } finally {
      setLoadingReports(false);
    }
  };

  // Forward geocode: address → lat/lng
  const geocodeAddress = useCallback((query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!query || query.length < 3) return;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
          { headers: NOMINATIM_HEADERS }
        );

        // Check if we got a valid response before parsing
        if (!res.ok) {
          const raw = await res.text();
          console.warn('[Geocode] Non-OK response:', res.status, raw.substring(0, 200));
          return null;
        }

        // Safely parse JSON — Nominatim may return HTML on rate-limit/error
        const raw = await res.text();
        let data;
        try {
          data = JSON.parse(raw);
        } catch (parseErr) {
          console.warn('[Geocode] Non-JSON response:', raw.substring(0, 200));
          return null;
        }

        if (data && data.length > 0) {
          const rLat = parseFloat(data[0].lat);
          const rLng = parseFloat(data[0].lon);
          setLat(rLat);
          setLng(rLng);
          setPinPlaced(true);
          extractCityState(data[0].display_name);
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'SET_PIN', lat: rLat, lng: rLng
          }));
        }
      } catch (err) {
        console.warn('[Geocode] Network error:', err.message);
      }
    }, 400);
  }, []);

  // Reverse geocode: lat/lng → address
  const reverseGeocode = async (latitude, longitude) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        { headers: NOMINATIM_HEADERS }
      );

      // Check for non-OK status (rate limit, server error, etc.)
      if (!res.ok) {
        const raw = await res.text();
        console.warn('[ReverseGeocode] Non-OK response:', res.status, raw.substring(0, 200));
        return null;
      }

      // Safely parse — don't blindly call .json() on potentially non-JSON response
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch (parseErr) {
        console.warn('[ReverseGeocode] Non-JSON response body:', raw.substring(0, 200));
        return null;
      }

      if (data && data.display_name) {
        setAddress(data.display_name);
        extractCityState(data.display_name);
      }
    } catch (err) {
      console.warn('[ReverseGeocode] Network error:', err.message);
    }
  };

  const extractCityState = (displayName) => {
    const parts = displayName.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      const city = parts[parts.length - 4] || parts[0];
      const state = parts[parts.length - 3] || parts[1];
      setResolvedLocation(`${city.toUpperCase()}, ${state.toUpperCase()}`);
    } else if (parts.length >= 2) {
      setResolvedLocation(`${parts[0].toUpperCase()}, ${parts[1].toUpperCase()}`);
    } else {
      setResolvedLocation(displayName.toUpperCase());
    }
  };

  const handleAddressChange = (val) => {
    setAddress(val);
    geocodeAddress(val);
  };

  // Handle messages from WebView (map tap)
  const onWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MAP_TAP') {
        setLat(data.lat);
        setLng(data.lng);
        setPinPlaced(true);
        reverseGeocode(data.lat, data.lng);
      }
    } catch (e) {}
  };

  const handleSubmit = async () => {
    if (!calamityType) {
      Alert.alert('Missing Info', 'Please select an issue type.');
      return;
    }
    if (!address || !pinPlaced) {
      Alert.alert('Missing Info', 'Please enter or tap a location on the map.');
      return;
    }

    setSubmitting(true);
    const fullDetails = (calamityType === 'Road Blocked' && blockageSubType)
      ? `[${blockageSubType}] ${details}`.trim()
      : details;
    const payload = {
      calamityType,
      locationAddress: address,
      latitude: lat,
      longitude: lng,
      details: fullDetails,
      reportedBy: 'mobile_user'
    };

    console.log('[Submit] Sending to:', `${API_BASE}/reports`);
    console.log('[Submit] Payload:', JSON.stringify(payload));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${API_BASE}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Read the response body once as text, then parse
      const responseText = await res.text();
      console.log('[Submit] Response status:', res.status, 'body:', responseText.substring(0, 300));

      if (!res.ok) {
        let errorMsg = `Server returned ${res.status}`;
        try {
          const errBody = JSON.parse(responseText);
          errorMsg = errBody.error || errorMsg;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      let saved;
      try {
        saved = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error('Server returned invalid JSON');
      }

      Alert.alert('Report Submitted', `${calamityType} report has been filed successfully.`);
      setAddress('');
      setCalamityType('');
      setBlockageSubType('');
      setDetails('');
      setPinPlaced(false);
      setResolvedLocation('');
      setReports(prev => [saved, ...prev]);
    } catch (err) {
      if (err.name === 'AbortError') {
        Alert.alert('Connection Timeout', 'Could not reach the server. Make sure the backend is running and your device is on the same WiFi network as the server.');
      } else {
        Alert.alert('Submission Failed', `${err.message}\n\nMake sure the backend server is running at ${API_BASE.replace('/api', '')}`);
      }
      console.warn('[Submit] Error:', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Reported' ? 'Resolved' : 'Reported';
    try {
      await fetch(`${API_BASE}/reports/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setReports(prev => prev.map(r => r._id === id ? { ...r, status: newStatus } : r));
    } catch (err) {
      console.warn('Status update failed:', err.message);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${mins}`;
  };

  // Map HTML for WebView
  const mapHTML = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#0D0D0D}
#map{width:100%;height:100%}
.leaflet-control-attribution{display:none!important}
.leaflet-control-zoom{display:none!important}
</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{center:[${lat},${lng}],zoom:12,zoomControl:false,attributionControl:false});
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

var pinIcon=L.divIcon({
  className:'',
  html:'<svg width="30" height="42" viewBox="0 0 30 42"><path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.716 23.284 0 15 0z" fill="#CC0000"/><circle cx="15" cy="14" r="6" fill="#0D0D0D"/><circle cx="15" cy="14" r="3" fill="#CC0000"/></svg>',
  iconSize:[30,42],iconAnchor:[15,42]
});

var marker=null;

map.on('click',function(e){
  if(marker) map.removeLayer(marker);
  marker=L.marker([e.latlng.lat,e.latlng.lng],{icon:pinIcon}).addTo(map);
  map.flyTo([e.latlng.lat,e.latlng.lng],14,{duration:0.5});
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'MAP_TAP',lat:e.latlng.lat,lng:e.latlng.lng}));
});

function setPin(lat,lng){
  if(marker) map.removeLayer(marker);
  marker=L.marker([lat,lng],{icon:pinIcon}).addTo(map);
  map.flyTo([lat,lng],14,{duration:0.5});
}

document.addEventListener('message',function(e){
  try{var d=JSON.parse(e.data);if(d.type==='SET_PIN')setPin(d.lat,d.lng);}catch(err){}
});
window.addEventListener('message',function(e){
  try{var d=JSON.parse(e.data);if(d.type==='SET_PIN')setPin(d.lat,d.lng);}catch(err){}
});
</script>
</body></html>`;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <AlertTriangle color="#CC0000" size={24} />
        <Text style={styles.headerTitle}>REPORT ISSUE</Text>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'form' && styles.tabActive]}
          onPress={() => setActiveTab('form')}
        >
          <Text style={[styles.tabText, activeTab === 'form' && styles.tabTextActive]}>New Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.tabActive]}
          onPress={() => { setActiveTab('reports'); fetchReports(); }}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
            Reports ({reports.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'form' ? (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {/* Map */}
          <Text style={styles.sectionTitle}>ENTER YOUR LOCATION</Text>
          <View style={styles.mapContainer}>
            <WebView
              ref={webViewRef}
              source={{ html: mapHTML }}
              style={{ flex: 1 }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              onMessage={onWebViewMessage}
              scrollEnabled={false}
            />
          </View>

          {resolvedLocation ? (
            <Text style={styles.resolvedLocation}>{resolvedLocation}</Text>
          ) : null}

          {/* Address Input */}
          <View style={styles.addressWrap}>
            <MapPin color="#666" size={16} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.addressInput}
              placeholder="Enter address or tap on map…"
              placeholderTextColor="#555"
              value={address}
              onChangeText={handleAddressChange}
            />
          </View>

          {/* Issue Type */}
          <Text style={[styles.sectionTitle, { color: '#CC0000' }]}>ISSUE TYPE</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            onPress={() => setDropdownOpen(!dropdownOpen)}
          >
            <Text style={{ color: calamityType ? '#fff' : '#777', fontSize: 14 }}>
              {calamityType
                ? `${getIssueIcon(calamityType)} ${calamityType}`
                : 'SELECT ISSUE TYPE'}
            </Text>
            <ChevronDown color="#666" size={16} />
          </TouchableOpacity>

          {dropdownOpen && (
            <View style={styles.dropdownList}>
              {ISSUE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.dropdownItem,
                    calamityType === opt.value && styles.dropdownItemActive
                  ]}
                  onPress={() => { setCalamityType(opt.value); setBlockageSubType(''); setDropdownOpen(false); }}
                >
                  <Text style={{ fontSize: 18, marginRight: 10 }}>{opt.icon}</Text>
                  <Text style={[
                    styles.dropdownItemText,
                    calamityType === opt.value && { color: '#CC0000' }
                  ]}>{opt.value}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Road Blocked Sub-type */}
          {calamityType === 'Road Blocked' && (
            <View style={{ marginTop: 8, marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { fontSize: 11, color: '#888' }]}>BLOCKAGE TYPE</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ROAD_BLOCKED_SUBTYPES.map((sub) => (
                  <TouchableOpacity
                    key={sub.value}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                      borderWidth: 1,
                      borderColor: blockageSubType === sub.value ? '#CC0000' : '#333',
                      backgroundColor: blockageSubType === sub.value ? 'rgba(204,0,0,0.15)' : '#1A1A1A',
                    }}
                    onPress={() => setBlockageSubType(sub.value)}
                  >
                    <Text style={{ color: blockageSubType === sub.value ? '#FF4444' : '#AAA', fontSize: 13, fontWeight: '600' }}>
                      {sub.icon} {sub.value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Additional Details */}
          <Text style={styles.sectionTitle}>ADDITIONAL DETAILS</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Describe the situation (optional)…"
            placeholderTextColor="#555"
            value={details}
            onChangeText={setDetails}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Send color="#fff" size={18} />
            <Text style={styles.submitBtnText}>
              {submitting ? 'SUBMITTING…' : 'SUBMIT REPORT'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        /* Reports List Tab */
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {loadingReports ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#CC0000" />
              <Text style={{ color: '#555', marginTop: 12 }}>Loading reports…</Text>
            </View>
          ) : reports.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 40 }}>📋</Text>
              <Text style={{ color: '#555', marginTop: 12 }}>No reports yet.</Text>
            </View>
          ) : (
            reports.map((r) => (
              <View key={r._id} style={styles.reportCard}>
                <View style={styles.reportCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 20 }}>{getIssueIcon(r.calamityType)}</Text>
                    <Text style={styles.reportTypeLabel}>{r.calamityType}</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.statusBadge,
                      r.status === 'Resolved' ? styles.statusResolved : styles.statusReported
                    ]}
                    onPress={() => toggleStatus(r._id, r.status)}
                  >
                    <Text style={[
                      styles.statusBadgeText,
                      { color: r.status === 'Resolved' ? '#22C55E' : '#F59E0B' }
                    ]}>{r.status}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                  <MapPin color="#CC0000" size={14} style={{ marginTop: 2 }} />
                  <Text style={styles.reportAddress} numberOfLines={2}>{r.locationAddress}</Text>
                </View>

                <Text style={styles.reportCoords}>
                  {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                </Text>

                {r.details ? <Text style={styles.reportDetails}>{r.details}</Text> : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Clock color="#444" size={12} />
                  <Text style={styles.reportTime}>{formatDate(r.createdAt)}</Text>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#CC0000',
    letterSpacing: 2,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#CC0000',
  },
  tabText: {
    color: '#777',
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#fff',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#FFFFFF',
    marginBottom: 10,
    marginTop: 8,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 8,
  },
  resolvedLocation: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingVertical: 4,
  },
  addressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  addressInput: {
    flex: 1,
    height: 44,
    color: '#FFFFFF',
    fontSize: 14,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 4,
  },
  dropdownList: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(204, 0, 0, 0.1)',
  },
  dropdownItemText: {
    color: '#CCC',
    fontSize: 14,
  },
  textarea: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 100,
    marginBottom: 20,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#CC0000',
    borderRadius: 12,
    height: 52,
    ...Platform.select({
      ios: {
        shadowColor: '#CC0000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  // Report cards
  reportCard: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  reportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reportTypeLabel: {
    fontWeight: '700',
    fontSize: 15,
    color: '#FFFFFF',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusReported: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusResolved: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  reportAddress: {
    color: '#AAA',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  reportCoords: {
    fontSize: 11,
    color: '#555',
    marginBottom: 8,
    paddingLeft: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  reportDetails: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
    lineHeight: 18,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#2A2A2A',
  },
  reportTime: {
    fontSize: 11,
    color: '#555',
  },
});
