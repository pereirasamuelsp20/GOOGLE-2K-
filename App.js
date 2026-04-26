import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Alert, ActivityIndicator, Platform, Linking, NativeModules } from 'react-native';
import * as Location from 'expo-location';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, firestore } from './src/firebaseConfig';
import { MapPin, Flame, Activity as ActivitySquare, ShieldAlert, Wifi, WifiOff, Menu, Map as MapIcon, User, X, AlertTriangle } from 'lucide-react-native';
import AuthScreen from './src/AuthScreen';
import ReportIssueScreen from './src/ReportIssueScreen';
import { ORS_API_KEY } from './src/orsConfig';

// API base for backend calls
const LAN_IP = '192.168.29.99';
const API_BASE = `http://${LAN_IP}:4000/api`;

// SOS type → facility type mapping
const SOS_FACILITY_MAP = {
  'Fire': 'fire_station',
  'Medical': 'hospital',
  'Security': 'police',
  'General': 'police',
};

// SOS type → vehicle emoji
const VEHICLE_ICONS = {
  'Fire': '🚒',
  'Medical': '🚑',
  'Security': '🚔',
  'General': '🚔',
};

// Widget imports — only available on native platforms after prebuild
let requestWidgetUpdate = null;
let SOSWidgetComponent = null;
try {
  if (Platform.OS === 'android') {
    const androidWidget = require('react-native-android-widget');
    requestWidgetUpdate = androidWidget.requestWidgetUpdate;
    SOSWidgetComponent = require('./widgets/SOSWidget').SOSWidget;
  }
} catch (_) {
  // Widget module not available (e.g. running in Expo Go or web)
}

let WebMapComponent = null;
if (Platform.OS === 'web') {
  WebMapComponent = require('./src/WebMapComponent').default;
}

let NativeMapComponent = null;
if (Platform.OS !== 'web') {
  NativeMapComponent = require('./src/NativeMapComponent').default;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSOSId, setActiveSOSId] = useState(null);
  const [status, setStatus] = useState(null); // 'searching', 'routed', 'responding'

  const [currentScreen, setCurrentScreen] = useState('Home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Dispatch simulation state
  const [dispatchData, setDispatchData] = useState(null);
  const dispatchTimersRef = useRef([]);
  const vehicleIntervalRef = useRef(null);

  const glowAnim = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;

  // 1. Listen for Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 1b. Force widget refresh on app launch (Android)
  useEffect(() => {
    if (Platform.OS === 'android' && requestWidgetUpdate && SOSWidgetComponent) {
      try {
        requestWidgetUpdate({
          widgetName: 'SOSWidget',
          renderWidget: () => {
            const Widget = SOSWidgetComponent;
            return <Widget sosActive={false} activeType={null} />;
          },
        });
      } catch (e) {
        console.warn('Initial widget update failed:', e.message);
      }
    }
  }, []);

  // 2. Fetch Location when user is authenticated
  useEffect(() => {
    if (!user) return;

    const getPermissions = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission to access location was denied');
          return;
        }
        let loc;
        try {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 5000 });
        } catch (e) {
          console.warn("Current position failed, falling back to last known:", e.message);
          loc = await Location.getLastKnownPositionAsync({});
        }

        if (!loc) {
          console.warn('Could not retrieve any location data. Using default location (Mumbai).');
          loc = { coords: { latitude: 19.0760, longitude: 72.8777 } }; // Default to Mumbai
        }

        setLocation(loc.coords);
        setGpsLocked(true);

        // Write GPS state to iOS shared UserDefaults for WidgetKit
        if (Platform.OS === 'ios' && NativeModules.SharedDefaults) {
          try {
            const sharedState = JSON.stringify({
              gpsLocked: true,
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              uid: user?.uid ?? 'anonymous',
              lastUpdated: Date.now(),
            });
            await NativeModules.SharedDefaults.setItem('widgetState', sharedState);
          } catch (e) {
            console.warn('Failed to write shared state for iOS widget:', e.message);
          }
        }
      } catch (error) {
        console.warn("Location error:", error.message);
        // Ensure the app still loads even if everything fails
        setLocation({ latitude: 19.0760, longitude: 72.8777 });
        setGpsLocked(true);
      }
    };
    getPermissions();
  }, [user]);

  // 2b. Deep link handler for widget taps (reliefmesh://sos?type=general|fire|medical|security)
  // Handles BOTH authenticated and unauthenticated (widget) launches
  useEffect(() => {
    const handleURL = async (url) => {
      if (!url) return;
      const match = url.match(/reliefmesh:\/\/sos\?type=(\w+)/);
      if (match) {
        const type = match[1];
        const sosType = type.charAt(0).toUpperCase() + type.slice(1);

        // If user is already authed, send directly
        if (user) {
          setCurrentScreen('Home');
          await sendSOS(sosType);
          return;
        }

        // Widget tap without login — bypass auth entirely with synthetic anonymous user
        // (signInAnonymously requires Firebase console setup, so we skip it)
        const widgetUid = `widget_${Date.now()}`;
        setUser({ uid: widgetUid, isAnonymous: true });
        setCurrentScreen('Home');

        // Get location if possible
        let loc = null;
        try {
          let { status: permStatus } = await Location.requestForegroundPermissionsAsync();
          if (permStatus === 'granted') {
            try {
              loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 5000 });
            } catch (e) {
              console.warn("Widget SOS current position failed, fallback:", e.message);
              loc = await Location.getLastKnownPositionAsync({});
            }
            if (!loc) {
              console.warn("Widget SOS could not retrieve location. Using default.");
              loc = { coords: { latitude: 19.0760, longitude: 72.8777 } };
            }
            
            setLocation(loc.coords);
            setGpsLocked(true);
          }
        } catch (e) {
          console.warn('Location unavailable for widget SOS:', e.message);
        }

        // Send the SOS immediately
        await sendSOSDirect(sosType, widgetUid, loc ? loc.coords : null);
      }
    };

    // Handle cold start (app was closed)
    Linking.getInitialURL().then(handleURL);

    // Handle warm start (app was backgrounded)
    const subscription = Linking.addEventListener('url', ({ url }) => handleURL(url));
    return () => subscription.remove();
  }, [user]);

  // 3. Button Pulse Animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.15,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    ).start();
  }, []);

  // ── Dispatch Simulation ──
  const clearDispatch = useCallback(() => {
    dispatchTimersRef.current.forEach(t => clearTimeout(t));
    dispatchTimersRef.current = [];
    if (vehicleIntervalRef.current) {
      clearInterval(vehicleIntervalRef.current);
      vehicleIntervalRef.current = null;
    }
    setDispatchData(null);
  }, []);

  const startDispatchSimulation = useCallback(async (sosType, sosId, userLat, userLng) => {
    const facilityType = SOS_FACILITY_MAP[sosType] || 'police';
    const vehicleIcon = VEHICLE_ICONS[sosType] || '🚔';

    // 1. Fetch nearest facility
    let facility;
    try {
      const res = await fetch(`${API_BASE}/locations/nearest?lat=${userLat}&lng=${userLng}&type=${facilityType}`);
      if (res.ok) facility = await res.json();
    } catch (e) { console.warn('Facility fetch failed:', e.message); }

    if (!facility) {
      // Fallback: use a default offset position
      facility = { name: 'Emergency HQ', lat: userLat + 0.015, lng: userLng + 0.012, type: facilityType };
    }

    // 2. Fetch ORS route from facility → user
    let routeCoords = [];
    let totalDistance = 0;
    let totalDuration = 0;
    try {
      const body = { coordinates: [[facility.lng, facility.lat], [userLng, userLat]] };
      const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: { 'Authorization': ORS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        routeCoords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]); // [lat,lng]
        const summary = data.features[0].properties.summary;
        totalDistance = summary.distance;
        totalDuration = summary.duration;
      }
    } catch (e) { console.warn('ORS route failed:', e.message); }

    if (routeCoords.length === 0) {
      // Fallback: straight line
      routeCoords = [[facility.lat, facility.lng], [userLat, userLng]];
      totalDistance = 3000;
      totalDuration = 600;
    }

    // 3. Schedule "routed" after random 10-30s
    const routedDelay = Math.floor(Math.random() * 20000) + 10000;
    const t1 = setTimeout(async () => {
      // Update Firestore
      if (sosId !== 'dummy_path') {
        try { await setDoc(doc(firestore, 'sos', sosId), { status: 'routed' }, { merge: true }); } catch (e) {}
      }
      setStatus('routed');

      // Show vehicle at facility (start of route)
      setDispatchData({
        route: routeCoords,
        vehiclePos: { lat: routeCoords[0][0], lng: routeCoords[0][1] },
        facilityName: facility.name,
        facilityType: facility.type,
        vehicleIcon,
        eta: Math.ceil(totalDuration / 60) + ' min',
        progress: 0,
      });

      // Auto-switch to Map to show the dispatch
      setCurrentScreen('Map');

      // 4. Schedule "responding" after random 30-60s
      const respondDelay = Math.floor(Math.random() * 30000) + 30000;
      const t2 = setTimeout(async () => {
        if (sosId !== 'dummy_path') {
          try { await setDoc(doc(firestore, 'sos', sosId), { status: 'responding' }, { merge: true }); } catch (e) {}
        }
        setStatus('responding');

        // 5. Start vehicle movement every 15s
        // 5. Start vehicle movement every 15s — synced to ORS duration
        // Vehicle takes totalDuration seconds to traverse the route.
        // Add 10-20% buffer for realistic "traffic" delay.
        const trafficMultiplier = 1 + (Math.random() * 0.1 + 0.1); // 1.1x to 1.2x
        const adjustedDuration = totalDuration * trafficMultiplier;
        const startTime = Date.now();

        vehicleIntervalRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000; // seconds since responding
          const progress = Math.min(elapsed / adjustedDuration, 1);
          const idx = Math.min(Math.floor(progress * (routeCoords.length - 1)), routeCoords.length - 1);
          const remainingSec = Math.max(0, adjustedDuration - elapsed);
          const etaMin = Math.ceil(remainingSec / 60);

          setDispatchData(prev => prev ? {
            ...prev,
            vehiclePos: { lat: routeCoords[idx][0], lng: routeCoords[idx][1] },
            eta: etaMin > 0 ? etaMin + ' min' : 'Arriving',
            progress,
          } : null);

          // Vehicle arrived
          if (progress >= 1) {
            clearInterval(vehicleIntervalRef.current);
            vehicleIntervalRef.current = null;
            setTimeout(() => {
              Alert.alert('🚨 Help Arrived', `${facility.name} responder has reached your location.`);
              if (sosId !== 'dummy_path') {
                try { setDoc(doc(firestore, 'sos', sosId), { status: 'arrived' }, { merge: true }); } catch (e) {}
              }
              setActiveSOSId(null);
              setStatus(null);
              clearDispatch();
            }, 2000);
          }
        }, 15000);
      }, respondDelay);
      dispatchTimersRef.current.push(t2);
    }, routedDelay);
    dispatchTimersRef.current.push(t1);
  }, [clearDispatch]);

  const handleMainButtonPress = () => {
    if (activeSOSId) return;
    
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);
    Animated.timing(expandAnim, {
      toValue: nextExpanded ? 1 : 0,
      duration: 350,
      useNativeDriver: Platform.OS !== 'web',
      easing: Easing.out(Easing.exp)
    }).start();
  };

  // Direct SOS sender — works without requiring `user` state (for widget deep links)
  const sendSOSDirect = async (type, uid, coords) => {
    const timestamp = Date.now();
    const lat = coords ? coords.latitude : 0;
    const lng = coords ? coords.longitude : 0;

    const payload = {
      type,
      lat,
      lng,
      status: "searching",
      message: type === 'General' ? '[Widget SOS - No Login]' : '',
      timestamp,
      uid: uid || 'anonymous',
      source: 'widget',
    };

    try {
      const sosId = timestamp.toString();
      const sosRef = doc(firestore, 'sos', sosId);
      await setDoc(sosRef, payload);
      
      setActiveSOSId(sosId);
      setStatus("searching");
      setIsExpanded(false);

      onSnapshot(sosRef, (snapshot) => {
        const data = snapshot.data();
        if (data && data.status) {
          setStatus(data.status);
        }
      });

      // Start dispatch simulation
      startDispatchSimulation(type, sosId, lat, lng);
    } catch (e) {
      console.warn("Widget SOS DB write failed — using demo mode.", e.message);
      setActiveSOSId('dummy_path');
      setStatus("searching");
      setIsExpanded(false);
      
      startDispatchSimulation(type, 'dummy_path', lat, lng);
    }
  };

  const sendSOS = async (type) => {
    if (!user) return;
    
    const timestamp = Date.now();
    const lat = location ? location.latitude : 0;
    const lng = location ? location.longitude : 0;
    
    const payload = {
      type,
      lat,
      lng,
      status: "searching",
      message: "",
      timestamp,
      uid: user.uid
    };

    try {
      const sosId = timestamp.toString();
      const sosRef = doc(firestore, 'sos', sosId);
      await setDoc(sosRef, payload);
      
      setActiveSOSId(sosId);
      setStatus("searching");
      setIsExpanded(false);

      // Write SOS active state to iOS shared UserDefaults for WidgetKit
      if (Platform.OS === 'ios' && NativeModules.SharedDefaults) {
        try {
          const sharedState = JSON.stringify({
            gpsLocked: gpsLocked,
            lat: lat,
            lng: lng,
            uid: user?.uid ?? 'anonymous',
            lastUpdated: Date.now(),
            sosActive: true,
            activeType: type.toLowerCase(),
            status: 'searching',
          });
          await NativeModules.SharedDefaults.setItem('widgetState', sharedState);
        } catch (e) {
          console.warn('Failed to write SOS state for iOS widget:', e.message);
        }
      }

      onSnapshot(sosRef, async (snapshot) => {
        const data = snapshot.data();
        if (data && data.status) {
          setStatus(data.status);

          // Write updated status to iOS shared UserDefaults
          if (Platform.OS === 'ios' && NativeModules.SharedDefaults) {
            try {
              const sharedState = JSON.stringify({
                gpsLocked: gpsLocked,
                lat: location ? location.latitude : 0,
                lng: location ? location.longitude : 0,
                uid: user?.uid ?? 'anonymous',
                lastUpdated: Date.now(),
                sosActive: data.status !== 'cancelled',
                activeType: type.toLowerCase(),
                status: data.status,
              });
              await NativeModules.SharedDefaults.setItem('widgetState', sharedState);
            } catch (e) {
              console.warn('Failed to update widget state:', e.message);
            }
          }

          // Push update to Android home screen widget
          if (Platform.OS === 'android' && requestWidgetUpdate && SOSWidgetComponent) {
            try {
              await requestWidgetUpdate({
                widgetName: 'SOSWidget',
                renderWidget: () => {
                  const Widget = SOSWidgetComponent;
                  return (
                    <Widget
                      sosActive={data.status !== 'cancelled'}
                      activeType={type.toLowerCase()}
                      gpsStatus={gpsLocked ? 'locked' : 'searching'}
                    />
                  );
                },
              });
            } catch (e) {
              console.warn('Widget update failed:', e.message);
            }
          }

          // Reload iOS WidgetKit timeline
          if (Platform.OS === 'ios' && NativeModules.WidgetKitBridge) {
            try {
              NativeModules.WidgetKitBridge.reloadAllTimelines();
            } catch (e) {
              console.warn('WidgetKit reload failed:', e.message);
            }
          }
        }
      });

      // Start dispatch simulation
      startDispatchSimulation(type, sosId, lat, lng);
    } catch (e) {
      console.warn("DB writes failed - placeholder or offline mode active.", e.message);
      setActiveSOSId(`dummy_path`);
      setStatus("searching");
      setIsExpanded(false);
      
      startDispatchSimulation(type, 'dummy_path', lat, lng);
    }
  };

  const cancelSOS = () => {
    Alert.alert(
      "Cancel Emergency Request?",
      "Are you sure you want to cancel the SOS request? This action cannot be undone.",
      [
        { text: "No, keep active", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive", 
          onPress: async () => {
             if (activeSOSId !== 'dummy_path') {
               try {
                 await setDoc(doc(firestore, 'sos', activeSOSId), { status: 'cancelled' }, { merge: true });
               } catch (e) { console.log(e); }
             }
             setActiveSOSId(null);
             setStatus(null);
             clearDispatch();

             // Write SOS cancelled state to iOS shared UserDefaults
             if (Platform.OS === 'ios' && NativeModules.SharedDefaults) {
               try {
                 const sharedState = JSON.stringify({
                   gpsLocked: gpsLocked,
                   lat: location ? location.latitude : 0,
                   lng: location ? location.longitude : 0,
                   uid: user?.uid ?? 'anonymous',
                   lastUpdated: Date.now(),
                   sosActive: false,
                   activeType: null,
                   status: null,
                 });
                 await NativeModules.SharedDefaults.setItem('widgetState', sharedState);
               } catch (e) {
                 console.warn('Failed to clear widget SOS state:', e.message);
               }
             }

             // Revert Android widget to idle state
             if (Platform.OS === 'android' && requestWidgetUpdate && SOSWidgetComponent) {
               try {
                 await requestWidgetUpdate({
                   widgetName: 'SOSWidget',
                   renderWidget: () => {
                     const Widget = SOSWidgetComponent;
                     return <Widget gpsStatus={gpsLocked ? 'locked' : 'searching'} sosActive={false} />;
                   },
                 });
               } catch (e) {
                 console.warn('Widget reset failed:', e.message);
               }
             }

             // Reload iOS WidgetKit timeline
             if (Platform.OS === 'ios' && NativeModules.WidgetKitBridge) {
               try {
                 NativeModules.WidgetKitBridge.reloadAllTimelines();
               } catch (e) {
                 console.warn('WidgetKit reload failed:', e.message);
               }
             }
          } 
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen 
      onAuthSuccess={(u, isNew) => {
        setUser(u);
        if (isNew) {
          setTimeout(() => Alert.alert("Welcome to ReliefMesh!", "We're glad you joined the network."), 500);
        }
      }} 
      onSkipAuth={() => setUser({ uid: 'sys_anonymous', isAnonymous: true })} 
    />;
  }

  const optionsTranslateY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0]
  });
  const optionsOpacity = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={{ ...styles.headerContainer, zIndex: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => setIsMenuOpen(true)}>
            <Menu color="#fff" size={28} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>SOS</Text>
            <Text style={styles.subtitle}>EMERGENCY RESPONSE</Text>
            <Text style={styles.uid}>UID: {user.uid.substring(0, 12)}...</Text>
          </View>
        </View>
        <View style={styles.gpsContainer}>
          <MapPin color={gpsLocked ? "#0f0" : "#555"} size={14} />
          <Text style={[styles.gpsText, { color: gpsLocked ? "#0f0" : "#555" }]}>
            {gpsLocked ? "GPS LOCK" : "LOCATING"}
          </Text>
          {gpsLocked ? <Wifi color="#0f0" size={14} /> : <WifiOff color="#555" size={14} />}
        </View>
      </View>

      {/* Main Content Area */}
      {currentScreen === 'Home' && (
        <>
          <View style={styles.centerArea}>
            <Animated.View style={[styles.glowRing1, { transform: [{ scale: glowAnim }] }]} />
            <Animated.View style={[styles.glowRing2, { transform: [{ scale: glowAnim }] }]} />
            
            <TouchableOpacity 
              activeOpacity={0.85}
              onPress={handleMainButtonPress}
              style={[styles.mainButton, activeSOSId && styles.mainButtonActive]}
              disabled={!!activeSOSId} 
            >
              <Text style={[styles.mainButtonText, activeSOSId && styles.mainButtonTextActive]}>
                SOS
              </Text>
            </TouchableOpacity>
          </View>

          {/* Expanded Emergency Options */}
          {(!activeSOSId) && (
            <Animated.View 
              {...Platform.select({ web: {}, default: { pointerEvents: isExpanded ? 'auto' : 'none' } })}
              style={[styles.optionsContainer, { 
                opacity: optionsOpacity, 
                transform: [{ translateY: optionsTranslateY }],
                ...(Platform.OS === 'web' ? { pointerEvents: isExpanded ? 'auto' : 'none' } : {})
              }]}
            >
              <TouchableOpacity style={styles.optionButton} onPress={() => sendSOS('Fire')}>
                <Flame color="#fff" size={28} />
                <Text style={styles.optionText}>FIRE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionButton} onPress={() => sendSOS('Medical')}>
                <ActivitySquare color="#fff" size={28} />
                <Text style={styles.optionText}>MEDICAL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionButton} onPress={() => sendSOS('Security')}>
                <ShieldAlert color="#fff" size={28} />
                <Text style={styles.optionText}>SECURITY</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {!activeSOSId && (
            <Text style={styles.tapPrompt}>
              {isExpanded ? "SELECT EMERGENCY TYPE" : "TAP TO ACTIVATE"}
            </Text>
          )}

          {/* Live Tracker when Triggered */}
          {activeSOSId && (
            <View style={styles.trackerContainer}>
              <Text style={styles.trackerTitle}>EMERGENCY PROTOCOL ACTIVE</Text>
              <View style={styles.stepsContainer}>
                <Step indicator="Searching" currentStatus={status} />
                <View style={styles.stepConnector} />
                <Step indicator="Routed" currentStatus={status} />
                <View style={styles.stepConnector} />
                <Step indicator="Responding" currentStatus={status} />
              </View>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelSOS}>
                <Text style={styles.cancelButtonText}>CANCEL SOS</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {currentScreen === 'Map' && (
        <View style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
          {Platform.OS === 'web' && WebMapComponent ? (
            <WebMapComponent userLoc={location} />
          ) : NativeMapComponent ? (
            <NativeMapComponent userLoc={location} dispatchData={dispatchData} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 30 }}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 12 }}>Citizen Map</Text>
              <Text style={{ color: '#888', textAlign: 'center', paddingHorizontal: 40 }}>
                Map component is loading...
              </Text>
            </View>
          )}
        </View>
      )}

      {currentScreen === 'Profile' && (
        <View style={{ flex: 1, padding: 20, marginTop: 30 }}>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -1 }}>Profile</Text>
          
          <View style={{ marginTop: 30, backgroundColor: '#131313', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#222' }}>
             <Text style={{ color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 }}>USER IDENTIFIER</Text>
             <Text style={{ color: '#fff', fontSize: 16 }}>{user.uid}</Text>
             
             <Text style={{ color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginTop: 24, marginBottom: 8 }}>ACCOUNT TYPE</Text>
             <Text style={{ color: '#fff', fontSize: 16 }}>{user.isAnonymous ? 'Anonymous Citizen' : 'Registered Member'}</Text>
          </View>

          <TouchableOpacity style={{ marginTop: 40, backgroundColor: 'rgba(255, 59, 48, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.3)', padding: 16, borderRadius: 10, alignItems: 'center' }} onPress={() => auth.signOut()}>
             <Text style={{ color: '#FF3B30', fontWeight: '800', letterSpacing: 1 }}>SIGN OUT securely</Text>
          </TouchableOpacity>
        </View>
      )}

      {currentScreen === 'Report' && (
        <ReportIssueScreen />
      )}

      {/* Drawer Overlay */}
      {isMenuOpen && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999, elevation: 999 }]}>
          <TouchableOpacity 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} 
            activeOpacity={1} 
            onPress={() => setIsMenuOpen(false)} 
          />
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 280, backgroundColor: '#0f0f0f', borderRightWidth: 1, borderRightColor: '#222', padding: 24, paddingTop: 60 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>ReliefMesh</Text>
              <TouchableOpacity onPress={() => setIsMenuOpen(false)}>
                <X color="#aaa" size={24} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => { setCurrentScreen('Home'); setIsMenuOpen(false); }}>
              <Flame color={currentScreen === 'Home' ? '#FF3B30' : '#888'} size={24} />
              <Text style={{ color: currentScreen === 'Home' ? '#fff' : '#aaa', fontSize: 16, fontWeight: '700' }}>SOS Core</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => { setCurrentScreen('Map'); setIsMenuOpen(false); }}>
              <MapIcon color={currentScreen === 'Map' ? '#FF3B30' : '#888'} size={24} />
              <Text style={{ color: currentScreen === 'Map' ? '#fff' : '#aaa', fontSize: 16, fontWeight: '700' }}>Mesh Map</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => { setCurrentScreen('Profile'); setIsMenuOpen(false); }}>
              <User color={currentScreen === 'Profile' ? '#FF3B30' : '#888'} size={24} />
              <Text style={{ color: currentScreen === 'Profile' ? '#fff' : '#aaa', fontSize: 16, fontWeight: '700' }}>My Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => { setCurrentScreen('Report'); setIsMenuOpen(false); }}>
              <AlertTriangle color={currentScreen === 'Report' ? '#FF3B30' : '#888'} size={24} />
              <Text style={{ color: currentScreen === 'Report' ? '#fff' : '#aaa', fontSize: 16, fontWeight: '700' }}>Report an Issue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const Step = ({ indicator, currentStatus }) => {
  const isActive = currentStatus === indicator.toLowerCase();
  const indexMap = { 'searching': 0, 'routed': 1, 'responding': 2 };
  
  const currentIdx = indexMap[currentStatus?.toLowerCase()] ?? -1;
  const stepIdx = indexMap[indicator.toLowerCase()];
  
  const isPast = stepIdx <= currentIdx;

  return (
    <View style={styles.stepBox}>
      <View style={[styles.stepDot, isPast && styles.stepDotActive]} />
      <Text style={[styles.stepText, isActive && styles.stepTextActive]}>{indicator}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    padding: 30,
    paddingTop: 80,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    color: '#888',
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 4,
    fontWeight: '600'
  },
  uid: {
    color: '#333',
    fontSize: 10,
    marginTop: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1
  },
  gpsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6
  },
  gpsText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginHorizontal: 2,
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowRing1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.1)',
  },
  glowRing2: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.15)',
  },
  mainButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 0px 25px rgba(255,59,48,0.8)' },
      default: {
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 25,
        elevation: 10,
      }
    }),
  },
  mainButtonActive: {
    backgroundColor: '#3A0000',
    borderWidth: 3,
    borderColor: '#7A0000',
    ...Platform.select({
      web: { boxShadow: 'none' },
      default: { shadowColor: 'transparent' }
    }),
  },
  mainButtonText: {
    color: '#FFF',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 3,
  },
  mainButtonTextActive: {
    color: '#6A0000',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginBottom: 40,
  },
  optionButton: {
    width: '31%',
    aspectRatio: 0.9,
    borderRadius: 12,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    color: '#AAA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  tapPrompt: {
    color: '#666',
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 4,
    marginBottom: 40,
    fontWeight: '600'
  },
  trackerContainer: {
    backgroundColor: '#131313',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#331111',
    marginBottom: 40,
  },
  trackerTitle: {
    color: '#FF3B30',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 28,
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBox: {
    alignItems: 'center',
    gap: 10,
    zIndex: 2,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#222',
    borderWidth: 2,
    borderColor: '#111'
  },
  stepDotActive: {
    backgroundColor: '#0f0',
    borderColor: '#0f0',
    ...Platform.select({
      web: { boxShadow: '0px 0px 10px rgba(0,255,0,0.8)' },
      default: {
        shadowColor: '#0f0',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 5,
      }
    }),
  },
  stepText: {
    color: '#444',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  stepTextActive: {
    color: '#fff',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#222',
    marginHorizontal: -15,
    marginTop: -25, // center between dots minus text height
    zIndex: 1,
  },
  cancelButton: {
    marginTop: 32,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4A0000',
    backgroundColor: 'rgba(74, 0, 0, 0.3)',
  },
  cancelButtonText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  }
});

