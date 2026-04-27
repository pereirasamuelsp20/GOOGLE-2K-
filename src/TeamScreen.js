import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { auth, firestore } from './firebaseConfig';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Users, Shield, Radio, CheckCircle, AlertTriangle } from 'lucide-react-native';

export default function TeamScreen() {
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    const fetchTeam = async () => {
      try {
        // Get user profile to find teamId
        const uSnap = await getDoc(doc(firestore, 'users', currentUser.uid));
        if (!uSnap.exists() || !uSnap.data().teamId) {
          // Also check responders collection
          const rSnap = await getDoc(doc(firestore, 'responders', currentUser.uid));
          if (!rSnap.exists() || !rSnap.data().teamId) {
            setLoading(false);
            return;
          }
          setUserProfile(rSnap.data());
          // Listen to team
          const unsub = onSnapshot(doc(firestore, 'teams', rSnap.data().teamId), (snap) => {
            if (snap.exists()) setTeam({ id: snap.id, ...snap.data() });
            setLoading(false);
          });
          return () => unsub();
        }
        setUserProfile(uSnap.data());
        const unsub = onSnapshot(doc(firestore, 'teams', uSnap.data().teamId), (snap) => {
          if (snap.exists()) setTeam({ id: snap.id, ...snap.data() });
          setLoading(false);
        });
        return () => unsub();
      } catch (e) {
        setLoading(false);
      }
    };
    fetchTeam();
  }, [currentUser]);

  if (loading) {
    return <View style={s.container}><ActivityIndicator size="large" color="#dc2626" style={{marginTop:80}} /></View>;
  }

  if (!team) {
    return (
      <View style={s.container}>
        <View style={s.emptyState}>
          <Users color="#444" size={48} />
          <Text style={s.emptyTitle}>No Team Assigned</Text>
          <Text style={s.emptySub}>You haven't been assigned to a response team yet.</Text>
        </View>
      </View>
    );
  }

  const roleColors = { Doctor:'#dc2626', Nurse:'#3b82f6', Paramedic:'#22c55e', Driver:'#f59e0b' };
  const statusColor = team.status === 'ready' ? '#22c55e' : team.status === 'dispatched' ? '#f59e0b' : '#888';

  return (
    <ScrollView style={s.container} contentContainerStyle={{paddingBottom:60}}>
      <Text style={s.title}>My Team</Text>

      {/* Team Header Card */}
      <View style={s.teamCard}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <View>
            <Text style={s.teamName}>{team.name}</Text>
            <Text style={s.teamPriority}>Priority {team.priority} | Vehicle: {team.vehicle || '🚑'}</Text>
          </View>
          <View style={[s.statusBadge,{backgroundColor:statusColor+'18',borderColor:statusColor+'40'}]}>
            <Text style={[s.statusBadgeText,{color:statusColor}]}>{team.status?.toUpperCase()}</Text>
          </View>
        </View>

        {team.status === 'dispatched' && team.dispatchedSosId && (
          <View style={s.dispatchAlert}>
            <AlertTriangle color="#f59e0b" size={16} />
            <Text style={s.dispatchText}>Active Dispatch — SOS #{team.dispatchedSosId?.substring(0,8)}</Text>
          </View>
        )}
      </View>

      {/* Members */}
      <Text style={s.sectionTitle}>TEAM MEMBERS</Text>
      <View style={s.membersGrid}>
        {(team.members || []).map((m, i) => {
          const isMe = m.uid === currentUser?.uid;
          const rc = roleColors[m.role] || '#888';
          return (
            <View key={i} style={[s.memberCard, isMe && {borderColor:rc}]}>
              <View style={[s.memberAvatar,{backgroundColor:rc+'22'}]}>
                <Text style={[s.memberAvatarText,{color:rc}]}>{(m.name||'?').substring(0,2).toUpperCase()}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={s.memberName}>{m.name}{isMe ? ' (You)':''}</Text>
                <View style={[s.memberRoleBadge,{backgroundColor:rc+'18'}]}>
                  <Text style={[s.memberRoleText,{color:rc}]}>{m.role}</Text>
                </View>
              </View>
              {m.role === 'Doctor' && <Shield color="#dc2626" size={16} />}
            </View>
          );
        })}
      </View>

      {/* Readiness */}
      <Text style={s.sectionTitle}>READINESS CHECK</Text>
      <View style={s.readinessCard}>
        {['Doctor','Nurse','Paramedic','Driver'].map(role => {
          const filled = team.members?.some(m => m.role === role);
          return (
            <View key={role} style={s.readinessRow}>
              <CheckCircle color={filled?'#22c55e':'#333'} size={16} />
              <Text style={[s.readinessText,{color:filled?'#ccc':'#555'}]}>{role}</Text>
              <Text style={{color:filled?'#22c55e':'#555',fontSize:11,fontWeight:'700'}}>
                {filled?'FILLED':'EMPTY'}
              </Text>
            </View>
          );
        })}
        <View style={s.readinessDivider}/>
        <View style={s.readinessRow}>
          <Radio color={statusColor} size={16} />
          <Text style={[s.readinessText,{color:'#ccc',fontWeight:'700'}]}>Overall Status</Text>
          <Text style={{color:statusColor,fontSize:12,fontWeight:'800'}}>
            {team.members?.length>=4?'READY':'INCOMPLETE'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#0A0A0A',paddingHorizontal:20,paddingTop:30},
  title:{color:'#fff',fontSize:28,fontWeight:'900',letterSpacing:-0.5,marginBottom:20},
  emptyState:{alignItems:'center',marginTop:100,gap:12},
  emptyTitle:{color:'#ccc',fontSize:20,fontWeight:'700'},
  emptySub:{color:'#666',fontSize:14,textAlign:'center'},
  teamCard:{backgroundColor:'#131313',borderRadius:16,borderWidth:1,borderColor:'#222',padding:20,marginBottom:24},
  teamName:{color:'#fff',fontSize:22,fontWeight:'800'},
  teamPriority:{color:'#888',fontSize:13,marginTop:4},
  statusBadge:{paddingHorizontal:12,paddingVertical:5,borderRadius:8,borderWidth:1},
  statusBadgeText:{fontSize:10,fontWeight:'800',letterSpacing:1},
  dispatchAlert:{flexDirection:'row',alignItems:'center',gap:8,marginTop:16,backgroundColor:'rgba(245,158,11,0.06)',borderWidth:1,borderColor:'rgba(245,158,11,0.2)',padding:12,borderRadius:10},
  dispatchText:{color:'#f59e0b',fontSize:13,fontWeight:'600'},
  sectionTitle:{color:'#555',fontSize:11,fontWeight:'700',letterSpacing:2,marginBottom:12},
  membersGrid:{gap:10,marginBottom:24},
  memberCard:{backgroundColor:'#131313',borderRadius:14,borderWidth:1,borderColor:'#222',padding:16,flexDirection:'row',alignItems:'center',gap:14},
  memberAvatar:{width:42,height:42,borderRadius:12,justifyContent:'center',alignItems:'center'},
  memberAvatarText:{fontWeight:'900',fontSize:14},
  memberName:{color:'#fff',fontSize:15,fontWeight:'600',marginBottom:4},
  memberRoleBadge:{alignSelf:'flex-start',paddingHorizontal:8,paddingVertical:2,borderRadius:6},
  memberRoleText:{fontSize:10,fontWeight:'700'},
  readinessCard:{backgroundColor:'#131313',borderRadius:14,borderWidth:1,borderColor:'#222',padding:16},
  readinessRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8},
  readinessText:{flex:1,color:'#888',fontSize:14},
  readinessDivider:{height:1,backgroundColor:'#1a1a2e',marginVertical:6},
});
