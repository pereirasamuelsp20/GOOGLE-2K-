import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import { auth, firestore } from './firebaseConfig';
import { collection, query, where, doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { CheckCircle, Clock, XCircle, ChevronRight } from 'lucide-react-native';

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
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    const q = query(collection(firestore, 'volunteerRequests'), where('uid', '==', currentUser.uid));
    const unsub = onSnapshot(q, async (snap) => {
      if (!snap.empty) {
        const reqData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setCurrentRequest(reqData);
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

  const handleRequest = async (roleId) => {
    if (!currentUser || submitting) return;
    Alert.alert('Request Role', `Submit a request to join as ${roleId}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', onPress: async () => {
        setSubmitting(true);
        try {
          let displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Volunteer';
          try {
            const uDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
            if (uDoc.exists() && uDoc.data().displayName) displayName = uDoc.data().displayName;
          } catch(e) {}
          await setDoc(doc(collection(firestore, 'volunteerRequests')), {
            uid: currentUser.uid, displayName, email: currentUser.email || 'Unknown',
            requestedRole: roleId, status: 'pending', timestamp: serverTimestamp(),
          });
          Alert.alert('Submitted', 'Your role request has been sent to admin.');
        } catch(e) { Alert.alert('Error', 'Could not submit request.'); }
        setSubmitting(false);
      }},
    ]);
  };

  if (loading) return <View style={s.container}><ActivityIndicator size="large" color="#dc2626" style={{marginTop:80}} /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{paddingBottom:60}}>
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
                {currentRequest.status==='pending'?'Request Pending':currentRequest.status==='accepted'?'Request Accepted':'Request Rejected'}
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
        </View>
      )}

      {(!currentRequest || currentRequest.status==='rejected') && (
        <View style={{gap:14}}>
          {ROLES.map(role => {
            const Icon = role.icon;
            return (
              <TouchableOpacity key={role.id} style={s.roleCard} onPress={()=>handleRequest(role.id)} disabled={submitting}>
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
  container:{flex:1,backgroundColor:'#0A0A0A',paddingHorizontal:20,paddingTop:30},
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
});
