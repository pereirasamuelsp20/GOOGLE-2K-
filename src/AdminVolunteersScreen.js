import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore as db } from './firebaseConfig';
import { CheckCircle, XCircle, User } from 'lucide-react-native';

export default function AdminVolunteersScreen() {
  const [requests, setRequests] = useState([]);
  const [teams, setTeams] = useState([]);
  const [processing, setProcessing] = useState(null);

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
        if (!hasRole && (t.status === 'ready' || t.status === 'incomplete')) {
          targetTeam = t;
          break;
        }
      }

      if (!targetTeam) {
        Alert.alert('Error', `No team currently needs a ${req.requestedRole}. Consider creating a new team.`);
        setProcessing(null);
        return;
      }

      const newMember = { uid: req.uid, role: req.requestedRole, name: req.displayName, email: req.email };
      const updatedMembers = [...(targetTeam.members || []), newMember];
      const hasDoctor = updatedMembers.some(m => m.role === 'Doctor');
      const newStatus = updatedMembers.length >= 4 && hasDoctor ? 'ready' : 'incomplete';

      await updateDoc(doc(db, 'teams', targetTeam.id), {
        members: updatedMembers,
        status: newStatus,
      });

      await updateDoc(doc(db, 'volunteerRequests', req.id), {
        status: 'accepted',
        teamId: targetTeam.id,
        reviewedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'users', req.uid), {
        role: 'Responder',
        teamId: targetTeam.id,
        teamRole: req.requestedRole,
      }, { merge: true });

      await setDoc(doc(db, 'responders', req.uid), {
        name: req.displayName,
        email: req.email,
        role: req.requestedRole,
        teamId: targetTeam.id,
        available: true,
      }, { merge: true });

    } catch (e) {
      Alert.alert('Error', 'Error accepting: ' + e.message);
    }
    setProcessing(null);
  };

  const handleReject = async (req) => {
    setProcessing(req.id);
    try {
      await updateDoc(doc(db, 'volunteerRequests', req.id), {
        status: 'rejected',
        reviewedAt: serverTimestamp(),
      });
    } catch (e) {
      Alert.alert('Error', 'Error rejecting: ' + e.message);
    }
    setProcessing(null);
  };

  const pending = requests.filter(r => r.status === 'pending');
  const processed = requests.filter(r => r.status !== 'pending');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Volunteer Requests</Text>
      <Text style={styles.subtitle}>Review and approve volunteer role applications</Text>

      {pending.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No pending volunteer requests</Text>
        </View>
      )}

      {pending.length > 0 && (
        <View style={styles.listContainer}>
          {pending.map(req => (
            <View key={req.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <User size={20} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqName}>{req.displayName}</Text>
                  <Text style={styles.reqEmail}>{req.email}</Text>
                </View>
                <View style={styles.roleBox}>
                  <Text style={styles.roleLabel}>REQUESTED ROLE</Text>
                  <Text style={styles.roleText}>{req.requestedRole}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity 
                  style={[styles.btn, styles.btnAccept, processing === req.id && { opacity: 0.5 }]} 
                  onPress={() => handleAccept(req)}
                  disabled={processing === req.id}
                >
                  <CheckCircle size={16} color="#fff" />
                  <Text style={styles.btnText}>Accept</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.btn, styles.btnReject, processing === req.id && { opacity: 0.5 }]} 
                  onPress={() => handleReject(req)}
                  disabled={processing === req.id}
                >
                  <XCircle size={16} color="#ef4444" />
                  <Text style={[styles.btnText, { color: '#ef4444' }]}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {processed.length > 0 && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>History</Text>
          {processed.slice(0, 20).map(req => (
            <View key={req.id} style={styles.historyCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyName}>
                  {req.displayName} <Text style={styles.historyRole}>({req.requestedRole})</Text>
                </Text>
              </View>
              <View style={[styles.historyStatus, 
                req.status === 'accepted' ? { backgroundColor: 'rgba(34,197,94,0.1)' } : 
                req.status === 'rejected' ? { backgroundColor: 'rgba(239,68,68,0.1)' } : 
                { backgroundColor: 'rgba(245,158,11,0.1)' }
              ]}>
                <Text style={[styles.historyStatusText,
                  req.status === 'accepted' ? { color: '#22c55e' } : 
                  req.status === 'rejected' ? { color: '#ef4444' } : 
                  { color: '#f59e0b' }
                ]}>
                  {req.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 32,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    gap: 16,
    marginBottom: 32,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqName: {
    fontWeight: '700',
    fontSize: 16,
    color: '#fff',
  },
  reqEmail: {
    color: '#888',
    fontSize: 13,
  },
  roleBox: {
    alignItems: 'center',
  },
  roleLabel: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
  },
  roleText: {
    fontWeight: '700',
    color: '#f59e0b',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  btnAccept: {
    backgroundColor: '#22c55e',
  },
  btnReject: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  historyContainer: {
    gap: 8,
  },
  historyTitle: {
    color: '#888',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  historyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
    opacity: 0.8,
  },
  historyName: {
    color: '#fff',
    fontWeight: '600',
  },
  historyRole: {
    color: '#888',
    fontSize: 13,
  },
  historyStatus: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  historyStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  }
});
