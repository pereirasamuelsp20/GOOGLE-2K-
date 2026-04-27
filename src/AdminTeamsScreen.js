import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { collection, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { firestore } from './firebaseConfig';
import { Shield, CheckCircle, AlertTriangle, Plus } from 'lucide-react-native';

const roleColors = { Doctor: '#dc2626', Nurse: '#3b82f6', Paramedic: '#22c55e', Driver: '#f59e0b' };

// Helper: if a member's "name" is actually an email, extract and capitalize the username part
const getMemberDisplayName = (member) => {
  const name = member?.name || '';
  if (!name) return member?.email ? member.email.split('@')[0] : 'Unknown';
  if (name.includes('@')) {
    const username = name.split('@')[0];
    return username.charAt(0).toUpperCase() + username.slice(1);
  }
  return name;
};

export default function AdminTeamsScreen() {
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'teams'), snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.priority || 99) - (b.priority || 99));
      setTeams(arr);
    });
    return () => unsub();
  }, []);

  const handleAddTeam = async () => {
    const num = teams.length + 1;
    const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
    const name = `Team ${names[num - 1] || num}`;
    try {
      await addDoc(collection(firestore, 'teams'), {
        name,
        priority: num,
        vehicle: '🚑',
        status: 'incomplete',
        members: [],
        dispatchedSosId: null,
        createdAt: Date.now(),
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to create team: ' + e.message);
    }
  };

  const handleResetTeam = async (teamId) => {
    try {
      await updateDoc(doc(firestore, 'teams', teamId), {
        status: 'ready',
        dispatchedSosId: null,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to reset: ' + e.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Team Management</Text>
          <Text style={styles.subtitle}>
            {teams.length} teams | {teams.filter(t => t.status === 'ready').length} ready for dispatch
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddTeam}>
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {teams.map(team => {
          const hasDoctor = team.members?.some(m => m.role === 'Doctor');
          const isComplete = team.members?.length >= 4 && hasDoctor;
          const statusColor = team.status === 'ready' ? '#22c55e' : team.status === 'dispatched' ? '#f59e0b' : '#888';

          return (
            <View key={team.id} style={[styles.card, team.status === 'dispatched' && { borderColor: 'rgba(245,158,11,0.3)' }]}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamMeta}>Priority {team.priority} | {team.vehicle || '🚑'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '18', borderColor: statusColor + '40' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{team.status}</Text>
                </View>
              </View>

              {team.status === 'dispatched' && team.dispatchedSosId && (
                <View style={styles.dispatchAlert}>
                  <AlertTriangle size={14} color="#f59e0b" />
                  <Text style={styles.dispatchAlertText}>
                    Dispatched to SOS #{team.dispatchedSosId?.substring(0, 10)}
                  </Text>
                </View>
              )}

              <View style={styles.membersContainer}>
                {['Doctor', 'Nurse', 'Paramedic', 'Driver'].map(role => {
                  const member = team.members?.find(m => m.role === role);
                  const rc = roleColors[role];
                  return (
                    <View key={role} style={[styles.memberRow, !member && styles.memberRowEmpty]}>
                      <View style={[styles.roleDot, { backgroundColor: member ? rc : '#333' }]} />
                      <Text style={[styles.roleLabel, { color: rc }]}>{role}</Text>
                      {member ? (
                        <Text style={styles.memberName}>{getMemberDisplayName(member)}</Text>
                      ) : (
                        <Text style={styles.memberVacant}>Vacant</Text>
                      )}
                      {role === 'Doctor' && !member && (
                        <Text style={styles.requiredLabel}>REQUIRED</Text>
                      )}
                    </View>
                  );
                })}
              </View>

              <View style={[styles.readinessContainer, isComplete && styles.readinessComplete]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} color={isComplete ? '#22c55e' : '#555'} />
                  <Text style={[styles.readinessText, { color: isComplete ? '#22c55e' : '#888' }]}>
                    {team.members?.length || 0}/4 Members {isComplete ? '— Ready' : '— Incomplete'}
                  </Text>
                </View>
                {team.status === 'dispatched' && (
                  <TouchableOpacity style={styles.resetBtn} onPress={() => handleResetTeam(team.id)}>
                    <Text style={styles.resetBtnText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  addBtn: {
    backgroundColor: '#dc2626',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    gap: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  teamName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  teamMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dispatchAlert: {
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderColor: 'rgba(245,158,11,0.2)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dispatchAlertText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
  },
  membersContainer: {
    gap: 8,
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
  },
  memberRowEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  roleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '700',
    width: 80,
  },
  memberName: {
    fontSize: 13,
    color: '#ccc',
    flex: 1,
  },
  memberVacant: {
    fontSize: 12,
    color: '#555',
    fontStyle: 'italic',
    flex: 1,
  },
  requiredLabel: {
    fontSize: 9,
    color: '#dc2626',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  readinessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  readinessComplete: {
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderColor: 'rgba(34,197,94,0.15)',
  },
  readinessText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resetBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: '#333',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  resetBtnText: {
    color: '#ccc',
    fontSize: 11,
    fontWeight: '600',
  }
});
