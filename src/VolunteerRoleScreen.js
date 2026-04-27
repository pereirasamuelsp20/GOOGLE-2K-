import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import * as Location from 'expo-location';
import { auth, firestore } from './firebaseConfig';
import { collection, query, where, doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { CheckCircle, Clock, XCircle, ChevronRight, ChevronLeft, MapPin } from 'lucide-react-native';

let Stethoscope = null, HeartPulse = null, Syringe = null, Truck = null;
try { Stethoscope = require('lucide-react-native').Stethoscope; } catch(e) {}
try { HeartPulse = require('lucide-react-native').HeartPulse; } catch(e) {}
try { Syringe = require('lucide-react-native').Syringe; } catch(e) {}
try { Truck = require('lucide-react-native').Truck; } catch(e) {}

const FallbackIcon = ({ color, size }) => (
  <View style={{ width: size, height: size, borderRadius: size/2, backgroundColor: color+'33', justifyContent:'center', alignItems:'center' }}>
    <Text style={{ color, fontWeight:'900', fontSize: size*0.5 }}>+</Text>
  </View>
);

const ROLES = [
  { id: 'Doctor', label: 'Doctor', icon: Stethoscope || FallbackIcon, color: '#dc2626',
    desc: 'Medical doctor — compulsory for every team. Lead clinical decisions.' },
  { id: 'Nurse', label: 'Nurse', icon: HeartPulse || FallbackIcon, color: '#3b82f6',
    desc: 'Registered nurse — provide critical care support and triage.' },
  { id: 'Paramedic', label: 'Paramedic', icon: Syringe || FallbackIcon, color: '#22c55e',
    desc: 'Emergency paramedic — first aid, stabilize patients, assist evacuation.' },
  { id: 'Driver', label: 'Driver', icon: Truck || FallbackIcon, color: '#f59e0b',
    desc: 'Vehicle operator — navigate crisis zones, ensure safe transport.' },
];

export default function VolunteerRoleScreen() {
  const [currentRequest, setCurrentRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assignedTeam, setAssignedTeam] = useState(null);

  // Form state
  const [selectedRole, setSelectedRole] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDOB, setFormDOB] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formExperience, setFormExperience] = useState('');
  const [fetchingAddress, setFetchingAddress] = useState(false);

  // Track if we already showed decline alert for current request
  const declineAlertShownRef = useRef(null);

  const currentUser = auth.currentUser;

  // Fetch current location and reverse geocode for address
  const fetchCurrentAddress = async () => {
    setFetchingAddress(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed to fetch your address.');
        setFetchingAddress(false);
        return;
      }
      let loc;
      try {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 5000 });
      } catch (e) {
        loc = await Location.getLastKnownPositionAsync({});
      }
      if (!loc) {
        setFormAddress('Could not determine location');
        setFetchingAddress(false);
        return;
      }
      // Reverse geocode
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geo) {
          const parts = [geo.street, geo.city, geo.region, geo.postalCode, geo.country].filter(Boolean);
          setFormAddress(parts.join(', '));
        } else {
          setFormAddress(`${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
        }
      } catch (e) {
        setFormAddress(`${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
      }
    } catch (e) {
      setFormAddress('Could not fetch address');
    }
    setFetchingAddress(false);
  };

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    const q = query(collection(firestore, 'volunteerRequests'), where('uid', '==', currentUser.uid));
    const unsub = onSnapshot(q, async (snap) => {
      if (!snap.empty) {
        const reqData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setCurrentRequest(reqData);

        // Show decline alert in real-time
        if (reqData.status === 'rejected' && declineAlertShownRef.current !== reqData.id) {
          declineAlertShownRef.current = reqData.id;
          setTimeout(() => {
            Alert.alert('Request DECLINED', 'Your role request has been declined by the admin. You may submit a new request.');
          }, 300);
        }

        if (reqData.status === 'accepted' && reqData.teamId) {
          try {
            const teamSnap = await getDoc(doc(firestore, 'teams', reqData.teamId));
            if (teamSnap.exists()) setAssignedTeam({ id: teamSnap.id, ...teamSnap.data() });
          } catch(e) {}
        }
      } else { setCurrentRequest(null); }
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  // Auto-fetch address when form opens
  useEffect(() => {
    if (selectedRole && !formAddress) {
      fetchCurrentAddress();
    }
  }, [selectedRole]);

  // Pre-fill name from user profile
  useEffect(() => {
    if (selectedRole && currentUser && !formName) {
      (async () => {
        try {
          const uDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
          if (uDoc.exists() && uDoc.data().displayName) {
            setFormName(uDoc.data().displayName);
          } else {
            setFormName(currentUser.displayName || currentUser.email?.split('@')[0] || '');
          }
        } catch(e) {
          setFormName(currentUser.displayName || currentUser.email?.split('@')[0] || '');
        }
      })();
    }
  }, [selectedRole]);

  const handleSubmit = async () => {
    if (!currentUser || submitting) return;
    if (!formName.trim()) { Alert.alert('Required', 'Please enter your full name.'); return; }
    if (!formDOB.trim()) { Alert.alert('Required', 'Please enter your date of birth.'); return; }
    if (!formAddress.trim()) { Alert.alert('Required', 'Please provide your current address.'); return; }
    if (!formExperience.trim()) { Alert.alert('Required', 'Please describe your experience.'); return; }

    setSubmitting(true);
    try {
      await setDoc(doc(collection(firestore, 'volunteerRequests')), {
        uid: currentUser.uid,
        displayName: formName.trim(),
        email: currentUser.email || 'Unknown',
        requestedRole: selectedRole,
        status: 'pending',
        fullName: formName.trim(),
        dateOfBirth: formDOB.trim(),
        address: formAddress.trim(),
        experience: formExperience.trim(),
        timestamp: serverTimestamp(),
      });
      Alert.alert('Submitted', 'Your role request has been sent to admin for review.');
      // Reset form
      setSelectedRole(null);
      setFormName('');
      setFormDOB('');
      setFormAddress('');
      setFormExperience('');
    } catch(e) {
      Alert.alert('Error', 'Could not submit request. Please try again.');
    }
    setSubmitting(false);
  };

  if (loading) return <View style={s.container}><ActivityIndicator size="large" color="#dc2626" style={{marginTop:80}} /></View>;

  // ── Form View ──
  if (selectedRole && (!currentRequest || currentRequest.status === 'rejected')) {
    const roleData = ROLES.find(r => r.id === selectedRole);
    const Icon = roleData?.icon || FallbackIcon;
    const color = roleData?.color || '#888';

    return (
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{paddingBottom:80, paddingHorizontal:20, paddingTop:30}}>
          {/* Back Button */}
          <TouchableOpacity style={s.backBtn} onPress={() => setSelectedRole(null)}>
            <ChevronLeft color="#aaa" size={20}/>
            <Text style={s.backText}>Back to Roles</Text>
          </TouchableOpacity>

          {/* Role Header */}
          <View style={[s.formRoleHeader, {borderColor: color+'30'}]}>
            <View style={[s.roleIconWrap, {backgroundColor: color+'18', borderColor: color+'30'}]}>
              <Icon color={color} size={28}/>
            </View>
            <View style={{flex:1}}>
              <Text style={s.formRoleTitle}>Apply as {roleData?.label}</Text>
              <Text style={s.formRoleDesc}>{roleData?.desc}</Text>
            </View>
          </View>

          {/* Form */}
          <View style={s.formSection}>
            <Text style={s.formLabel}>Full Name *</Text>
            <TextInput
              style={s.formInput}
              placeholder="Enter your full name"
              placeholderTextColor="#4a4a5a"
              value={formName}
              onChangeText={setFormName}
            />
          </View>

          <View style={s.formSection}>
            <Text style={s.formLabel}>Date of Birth *</Text>
            <TextInput
              style={s.formInput}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#4a4a5a"
              value={formDOB}
              onChangeText={setFormDOB}
              keyboardType="default"
            />
          </View>

          <View style={s.formSection}>
            <Text style={s.formLabel}>Current Address *</Text>
            <View style={s.addressRow}>
              <TextInput
                style={[s.formInput, {flex:1}]}
                placeholder="Your current address"
                placeholderTextColor="#4a4a5a"
                value={formAddress}
                onChangeText={setFormAddress}
                multiline
              />
              <TouchableOpacity style={s.locationBtn} onPress={fetchCurrentAddress} disabled={fetchingAddress}>
                {fetchingAddress ? (
                  <ActivityIndicator size="small" color="#dc2626"/>
                ) : (
                  <MapPin color="#dc2626" size={18}/>
                )}
              </TouchableOpacity>
            </View>
            <Text style={s.addressHint}>Tap the pin icon to auto-fetch your current location</Text>
          </View>

          <View style={s.formSection}>
            <Text style={s.formLabel}>Description of Experience *</Text>
            <TextInput
              style={[s.formInput, s.formTextArea]}
              placeholder="Describe your relevant experience, qualifications, and certifications..."
              placeholderTextColor="#4a4a5a"
              value={formExperience}
              onChangeText={setFormExperience}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[s.submitBtn, {backgroundColor: color}, submitting && {opacity:0.6}]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff"/>
            ) : (
              <Text style={s.submitText}>Submit Request</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Main View ──
  return (
    <ScrollView style={s.container} contentContainerStyle={{paddingBottom:60, paddingHorizontal:20, paddingTop:30}}>
      <Text style={s.title}>Select Your Role</Text>
      <Text style={s.subtitle}>Choose a specialization to join a response team.</Text>

      {currentRequest && (
        <View style={[s.statusCard,
          currentRequest.status==='accepted' && {backgroundColor:'rgba(34,197,94,0.06)',borderColor:'rgba(34,197,94,0.2)'},
          currentRequest.status==='rejected' && {backgroundColor:'rgba(239,68,68,0.06)',borderColor:'rgba(239,68,68,0.2)'},
          currentRequest.status==='pending' && {backgroundColor:'rgba(245,158,11,0.06)',borderColor:'rgba(245,158,11,0.2)'},
        ]}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
            {currentRequest.status==='pending' && <Clock color="#f59e0b" size={20}/>}
            {currentRequest.status==='accepted' && <CheckCircle color="#22c55e" size={20}/>}
            {currentRequest.status==='rejected' && <XCircle color="#ef4444" size={20}/>}
            <View style={{flex:1}}>
              <Text style={s.statusTitle}>
                {currentRequest.status==='pending'?'Request Pending':currentRequest.status==='accepted'?'Request Accepted':'Request Declined'}
              </Text>
              <Text style={s.statusSub}>Role: {currentRequest.requestedRole}
                {currentRequest.status==='accepted'&&assignedTeam?` — ${assignedTeam.name}`:''}
              </Text>
            </View>
          </View>
          {currentRequest.status==='accepted'&&assignedTeam&&(
            <View style={s.teamInfo}>
              <Text style={{color:'#fff',fontWeight:'700',fontSize:14}}>Team: {assignedTeam.name}</Text>
              <Text style={{color:'#888',fontSize:12,marginTop:2}}>Status: {assignedTeam.status} | Members: {assignedTeam.members?.length||0}/4</Text>
            </View>
          )}
          {currentRequest.status==='rejected' && (
            <Text style={{color:'#ef4444',fontSize:13,marginTop:10,fontWeight:'600'}}>
              Your request was declined. You may submit a new request below.
            </Text>
          )}
        </View>
      )}

      {(!currentRequest || currentRequest.status==='rejected') && (
        <View style={{gap:14}}>
          {ROLES.map(role => {
            const Icon = role.icon;
            return (
              <TouchableOpacity key={role.id} style={s.roleCard} onPress={() => setSelectedRole(role.id)} disabled={submitting}>
                <View style={[s.roleIconWrap,{backgroundColor:role.color+'18',borderColor:role.color+'30'}]}>
                  <Icon color={role.color} size={28}/>
                </View>
                <Text style={s.roleLabel}>{role.label}</Text>
                <Text style={s.roleDesc}>{role.desc}</Text>
                <View style={[s.roleAction,{borderColor:role.color+'40'}]}>
                  <Text style={[s.roleActionText,{color:role.color}]}>Request This Role</Text>
                  <ChevronRight color={role.color} size={14}/>
                </View>
                {role.id==='Doctor'&&<View style={s.reqBadge}><Text style={s.reqBadgeText}>REQUIRED</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#0A0A0A'},
  title:{color:'#fff',fontSize:28,fontWeight:'900',letterSpacing:-0.5,marginBottom:8},
  subtitle:{color:'#888',fontSize:14,lineHeight:20,marginBottom:24},
  statusCard:{padding:18,borderRadius:14,borderWidth:1,marginBottom:24},
  statusTitle:{color:'#fff',fontWeight:'700',fontSize:15},
  statusSub:{color:'#aaa',fontSize:13,marginTop:2},
  teamInfo:{marginTop:14,backgroundColor:'rgba(255,255,255,0.04)',padding:12,borderRadius:10},
  roleCard:{backgroundColor:'#131313',borderWidth:1,borderColor:'#222',borderRadius:16,padding:20,position:'relative'},
  roleIconWrap:{width:52,height:52,borderRadius:14,borderWidth:1,justifyContent:'center',alignItems:'center',marginBottom:14},
  roleLabel:{color:'#fff',fontSize:18,fontWeight:'800',letterSpacing:-0.3,marginBottom:6},
  roleDesc:{color:'#888',fontSize:13,lineHeight:19,marginBottom:16},
  roleAction:{flexDirection:'row',alignItems:'center',gap:4,alignSelf:'flex-start',borderWidth:1,borderRadius:8,paddingVertical:8,paddingHorizontal:14},
  roleActionText:{fontWeight:'700',fontSize:13},
  reqBadge:{position:'absolute',top:14,right:14,backgroundColor:'rgba(220,38,38,0.12)',borderWidth:1,borderColor:'rgba(220,38,38,0.3)',paddingHorizontal:8,paddingVertical:3,borderRadius:6},
  reqBadgeText:{color:'#dc2626',fontSize:9,fontWeight:'800',letterSpacing:1},

  // Form styles
  backBtn:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:24,paddingVertical:8},
  backText:{color:'#aaa',fontSize:14,fontWeight:'600'},
  formRoleHeader:{flexDirection:'row',alignItems:'center',gap:16,backgroundColor:'#131313',borderRadius:14,borderWidth:1,padding:16,marginBottom:28},
  formRoleTitle:{color:'#fff',fontSize:18,fontWeight:'800',marginBottom:4},
  formRoleDesc:{color:'#888',fontSize:12,lineHeight:17},
  formSection:{marginBottom:20},
  formLabel:{color:'#ccc',fontSize:13,fontWeight:'600',marginBottom:8,letterSpacing:0.3},
  formInput:{backgroundColor:'#131313',borderWidth:1,borderColor:'#2a2a3a',borderRadius:12,color:'#fff',paddingHorizontal:16,paddingVertical:14,fontSize:15},
  formTextArea:{minHeight:120,paddingTop:14},
  addressRow:{flexDirection:'row',alignItems:'flex-start',gap:10},
  locationBtn:{width:48,height:48,borderRadius:12,backgroundColor:'rgba(220,38,38,0.1)',borderWidth:1,borderColor:'rgba(220,38,38,0.25)',justifyContent:'center',alignItems:'center'},
  addressHint:{color:'#555',fontSize:11,marginTop:6,fontStyle:'italic'},
  submitBtn:{paddingVertical:16,borderRadius:14,alignItems:'center',justifyContent:'center',marginTop:12},
  submitText:{color:'#fff',fontSize:16,fontWeight:'800',letterSpacing:0.5},
});
