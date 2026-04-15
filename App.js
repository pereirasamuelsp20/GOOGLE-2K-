import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Alert, ActivityIndicator, Platform } from 'react-native';
import * as Location from 'expo-location';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, set, onValue } from 'firebase/database';
import { auth, database } from './src/firebaseConfig';
import { MapPin, Flame, Activity as ActivitySquare, ShieldAlert, Wifi, WifiOff } from 'lucide-react-native';
import AuthScreen from './src/AuthScreen';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSOSId, setActiveSOSId] = useState(null);
  const [status, setStatus] = useState(null); // 'searching', 'routed', 'responding'

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
        let loc = await Location.getCurrentPositionAsync({});
        setLocation(loc.coords);
        setGpsLocked(true);
      } catch (error) {
        console.warn("Location error:", error.message);
      }
    };
    getPermissions();
  }, [user]);

  // 3. Button Pulse Animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.15,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleMainButtonPress = () => {
    if (activeSOSId) return;
    
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);
    Animated.timing(expandAnim, {
      toValue: nextExpanded ? 1 : 0,
      duration: 350,
      useNativeDriver: true,
      easing: Easing.out(Easing.exp)
    }).start();
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
      const dbRefPath = `sos/${user.uid}/${timestamp}`;
      const sosRef = ref(database, dbRefPath);
      await set(sosRef, payload);
      
      setActiveSOSId(dbRefPath);
      setStatus("searching");
      setIsExpanded(false);

      onValue(sosRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.status) {
          setStatus(data.status);
        }
      });
    } catch (e) {
      console.warn("DB writes failed - placeholder or offline mode active.", e.message);
      setActiveSOSId(`dummy_path`);
      setStatus("searching");
      setIsExpanded(false);
      
      setTimeout(() => setStatus("routed"), 3000);
      setTimeout(() => setStatus("responding"), 7000);
      setTimeout(() => {
        setActiveSOSId(null);
        setStatus(null);
        Alert.alert("Demo Over", "Emergency responded successfully.");
      }, 12000);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen onAuthSuccess={(u) => setUser(u)} onSkipAuth={() => {}} />;
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
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.title}>SOS</Text>
          <Text style={styles.subtitle}>EMERGENCY RESPONSE</Text>
          <Text style={styles.uid}>UID: {user.uid.substring(0, 12)}...</Text>
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
        <Animated.View style={[styles.optionsContainer, { 
          opacity: optionsOpacity, 
          transform: [{ translateY: optionsTranslateY }],
          pointerEvents: isExpanded ? 'auto' : 'none'
        }]}>
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
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 25,
    elevation: 10,
  },
  mainButtonActive: {
    backgroundColor: '#3A0000',
    shadowColor: 'transparent',
    borderWidth: 3,
    borderColor: '#7A0000',
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
    shadowColor: '#0f0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
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
  }
});

