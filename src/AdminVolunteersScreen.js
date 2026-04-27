import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { collection, onSnapshot, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore as db } from './firebaseConfig';
import { CheckCircle, XCircle, User, ChevronDown, ChevronUp } from 'lucide-react-native';

const ROLE_ORDER = ['Doctor', 'Nurse', 'Paramedic', 'Driver'];
const ROLE_COLORS = { Doctor: '#dc2626', Nurse: '#3b82f6', Paramedic: '#22c55e', Driver: '#f59e0b' };
const ROLE_EMOJIS = { Doctor: '🩺', Nurse: '💗', Paramedic: '🚑', Driver: '🚗' };

export default function AdminVolunteersScreen() {
  const [requests, setRequests] = useState([]);
  const [teams, setTeams] = useState([]);
  const [processing, setProcessing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'volunteerRequests'), snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setRequests(arr);
    });
    const unsub2 = onSnapshot(collection(db, 'teams'), snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => a.priority - b.priority);
      setTeams(arr);
    });
    return () => { unsub(); unsub2(); };
  }, []);

  const handleAccept = async (req) => {
    setProcessing(req.id);
    try {
      let targetTeam = null;
      for (const t of teams) {
        const hasRole = t.members?.some(m => m.role === req.requestedRole);
        if (!hasRole && (t.status === 'ready' || t.status === 'incomplete')) { targetTeam = t; break; }
      }
      if (!targetTeam) {
        Alert.alert('Error', `No team currently needs a ${req.requestedRole}.`);
        setProcessing(null); return;
      }
      // Resolve name — guard against email-as-name
      let resolvedName = req.fullName || req.displayName || '';
      if (!resolvedName || resolvedName.includes('@')) {
        resolvedName = req.email ? req.email.split('@')[0] : 'Unknown';
        resolvedName = resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1);
      }
      const newMember = { uid: req.uid, role: req.requestedRole, name: resolvedName, email: req.email };
      const updatedMembers = [...(targetTeam.members || []), newMember];
      const hasDoctor = updatedMembers.some(m => m.role === 'Doctor');
      const newStatus = updatedMembers.length >= 4 && hasDoctor ? 'ready' : 'incomplete';
      await updateDoc(doc(db, 'teams', targetTeam.id), { members: updatedMembers, status: newStatus });
      await updateDoc(doc(db, 'volunteerRequests', req.id), { status: 'accepted', teamId: targetTeam.id, reviewedAt: serverTimestamp() });
      await setDoc(doc(db, 'users', req.uid), { role: 'Responder', teamId: targetTeam.id, teamRole: req.requestedRole }, { merge: true });
      await setDoc(doc(db, 'responders', req.uid), { name: resolvedName, email: req.email, role: req.requestedRole, teamId: targetTeam.id, available: true }, { merge: true });
    } catch (e) { Alert.alert('Error', e.message); }
    setProcessing(null);
  };

  const handleReject = async (req) => {
    setProcessing(req.id);
    try {
      await updateDoc(doc(db, 'volunteerRequests', req.id), { status: 'rejected', reviewedAt: serverTimestamp() });
    } catch (e) { Alert.alert('Error', e.message); }
    setProcessing(null);
  };

  const pending = requests.filter(r => r.status === 'pending');
  const processed = requests.filter(r => r.status !== 'pending');

  // Group by role
  const groupedPending = {};
  ROLE_ORDER.forEach(role => { groupedPending[role] = pending.filter(r => r.requestedRole === role); });
  const groupedProcessed = {};
  ROLE_ORDER.forEach(role => { groupedProcessed[role] = processed.filter(r => r.requestedRole === role); });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Volunteer Requests</Text>
      <Text style={styles.subtitle}>{pending.length} pending · {processed.length} processed</Text>

      {/* Category summary cards */}
      <View style={styles.categoryRow}>
        {ROLE_ORDER.map(role => {
          const rc = ROLE_COLORS[role];
          const count = groupedPending[role]?.length || 0;
          return (
            <View key={role} style={[styles.categoryCard, {borderTopColor: rc}]}>
              <Text style={{fontSize:20, marginBottom:4}}>{ROLE_EMOJIS[role]}</Text>
              <Text style={[styles.categoryLabel, {color: rc}]}>{role}</Text>
              <Text style={styles.categoryCount}>{count}</Text>
              <Text style={styles.categoryHint}>pending</Text>
            </View>
          );
        })}
      </View>

      {/* Pending by category */}
      {pending.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No pending volunteer requests</Text>
        </View>
      )}

      {ROLE_ORDER.map(role => {
        const items = groupedPending[role];
        if (!items || items.length === 0) return null;
        const rc = ROLE_COLORS[role];
        return (
          <View key={role} style={{marginBottom:24}}>
            <View style={styles.catHeader}>
              <Text style={{fontSize:16}}>{ROLE_EMOJIS[role]}</Text>
              <Text style={[styles.catTitle, {color: rc}]}>{role}</Text>
              <View style={[styles.catBadge, {backgroundColor: rc+'18'}]}>
                <Text style={[styles.catBadgeText, {color: rc}]}>{items.length}</Text>
              </View>
            </View>
            {items.map(req => {
              const isExp = expandedId === req.id;
              return (
                <View key={req.id} style={[styles.card, {borderLeftWidth:4, borderLeftColor: rc}]}>
                  <TouchableOpacity style={styles.cardTop} onPress={() => setExpandedId(isExp ? null : req.id)}>
                    <View style={[styles.avatar, {backgroundColor: rc+'15'}]}>
                      <Text style={{color: rc, fontWeight:'800', fontSize:16}}>{(req.fullName || req.displayName || '?').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={styles.reqName}>{req.fullName || req.displayName}</Text>
                      <Text style={styles.reqEmail}>{req.email}</Text>
                    </View>
                    <View style={styles.pendingBadge}><Text style={styles.pendingText}>PENDING</Text></View>
                    {isExp ? <ChevronUp size={16} color="#888"/> : <ChevronDown size={16} color="#888"/>}
                  </TouchableOpacity>

                  {isExp && (
                    <View style={styles.detailsSection}>
                      {req.dateOfBirth && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>DATE OF BIRTH</Text>
                          <Text style={styles.detailValue}>{req.dateOfBirth}</Text>
                        </View>
                      )}
                      {req.address && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>ADDRESS</Text>
                          <Text style={styles.detailValue}>{req.address}</Text>
                        </View>
                      )}
                      {req.experience && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>EXPERIENCE</Text>
                          <View style={styles.experienceBox}>
                            <Text style={styles.experienceText}>{req.experience}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.actions}>
                    <TouchableOpacity style={[styles.btn, styles.btnAccept, processing === req.id && {opacity:0.5}]} onPress={() => handleAccept(req)} disabled={processing === req.id}>
                      <CheckCircle size={16} color="#fff" />
                      <Text style={styles.btnText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.btnReject, processing === req.id && {opacity:0.5}]} onPress={() => handleReject(req)} disabled={processing === req.id}>
                      <XCircle size={16} color="#ef4444" />
                      <Text style={[styles.btnText, {color:'#ef4444'}]}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}

      {/* History by category */}
      {processed.length > 0 && (
        <View style={{marginTop:8}}>
          <Text style={styles.historyTitle}>History</Text>
          {ROLE_ORDER.map(role => {
            const items = groupedProcessed[role];
            if (!items || items.length === 0) return null;
            const rc = ROLE_COLORS[role];
            return (
              <View key={role} style={{marginBottom:16}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:8}}>
                  <Text style={{fontSize:14}}>{ROLE_EMOJIS[role]}</Text>
                  <Text style={{fontSize:13,fontWeight:'700',color:rc}}>{role}</Text>
                </View>
                {items.slice(0,10).map(req => (
                  <View key={req.id} style={styles.historyCard}>
                    <View style={{flex:1}}>
                      <Text style={styles.historyName}>{req.fullName || req.displayName}</Text>
                    </View>
                    <View style={[styles.historyStatus,
                      req.status==='accepted'?{backgroundColor:'rgba(34,197,94,0.1)'}:{backgroundColor:'rgba(239,68,68,0.1)'}
                    ]}>
                      <Text style={[styles.historyStatusText,
                        req.status==='accepted'?{color:'#22c55e'}:{color:'#ef4444'}
                      ]}>{req.status}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0A0A0A' },
  content: { padding:24, paddingTop:40, paddingBottom:100 },
  title: { fontSize:28, fontWeight:'800', color:'#fff', marginBottom:6 },
  subtitle: { fontSize:14, color:'#888', marginBottom:24 },
  // Category summary
  categoryRow: { flexDirection:'row', gap:10, marginBottom:28 },
  categoryCard: { flex:1, backgroundColor:'rgba(255,255,255,0.03)', borderWidth:1, borderColor:'#222', borderTopWidth:3, borderRadius:12, padding:14, alignItems:'center' },
  categoryLabel: { fontSize:12, fontWeight:'700', marginBottom:4 },
  categoryCount: { fontSize:22, fontWeight:'900', color:'#fff' },
  categoryHint: { fontSize:10, color:'#666', marginTop:2 },
  // Category headers
  catHeader: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:12 },
  catTitle: { fontSize:16, fontWeight:'700' },
  catBadge: { paddingHorizontal:10, paddingVertical:2, borderRadius:10 },
  catBadgeText: { fontSize:11, fontWeight:'700' },
  // Cards
  emptyCard: { backgroundColor:'rgba(255,255,255,0.03)', borderRadius:16, padding:40, alignItems:'center', borderWidth:1, borderColor:'#222' },
  emptyText: { color:'#888', fontSize:16, fontWeight:'600' },
  card: { backgroundColor:'rgba(255,255,255,0.03)', borderRadius:14, padding:20, borderWidth:1, borderColor:'#222', marginBottom:12 },
  cardTop: { flexDirection:'row', alignItems:'center', gap:14 },
  avatar: { width:40, height:40, borderRadius:10, alignItems:'center', justifyContent:'center' },
  reqName: { fontWeight:'700', fontSize:15, color:'#fff' },
  reqEmail: { color:'#888', fontSize:12 },
  pendingBadge: { backgroundColor:'rgba(245,158,11,0.1)', paddingHorizontal:10, paddingVertical:3, borderRadius:8 },
  pendingText: { color:'#f59e0b', fontSize:10, fontWeight:'700' },
  // Details
  detailsSection: { backgroundColor:'rgba(255,255,255,0.02)', borderRadius:12, padding:16, marginTop:16, marginBottom:4, borderWidth:1, borderColor:'rgba(255,255,255,0.06)', gap:14 },
  detailRow: { gap:4 },
  detailLabel: { fontSize:10, color:'#666', fontWeight:'700', letterSpacing:0.5 },
  detailValue: { fontSize:14, color:'#ddd', fontWeight:'500' },
  experienceBox: { backgroundColor:'rgba(255,255,255,0.03)', borderRadius:8, padding:12, marginTop:4 },
  experienceText: { fontSize:13, color:'#bbb', lineHeight:20 },
  // Actions
  actions: { flexDirection:'row', gap:10, marginTop:16 },
  btn: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', padding:12, borderRadius:8, gap:8 },
  btnAccept: { backgroundColor:'#22c55e' },
  btnReject: { backgroundColor:'rgba(239,68,68,0.1)', borderWidth:1, borderColor:'rgba(239,68,68,0.2)' },
  btnText: { color:'#fff', fontWeight:'700', fontSize:14 },
  // History
  historyTitle: { color:'#888', fontSize:18, fontWeight:'700', marginBottom:16 },
  historyCard: { backgroundColor:'rgba(255,255,255,0.03)', borderRadius:10, padding:14, flexDirection:'row', alignItems:'center', borderWidth:1, borderColor:'#222', opacity:0.8, marginBottom:6 },
  historyName: { color:'#fff', fontWeight:'600', fontSize:13 },
  historyStatus: { paddingVertical:4, paddingHorizontal:10, borderRadius:12 },
  historyStatusText: { fontSize:11, fontWeight:'700', textTransform:'uppercase' },
});
