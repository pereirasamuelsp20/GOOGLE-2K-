import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { ref, onValue, update } from 'firebase/database';
import { firestore, database as rtdb } from './firebaseConfig';
import { Radio } from 'lucide-react-native';

export default function AdminLiveSOSScreen() {
  const [sosList, setSosList] = useState([]);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    const uS = onValue(ref(rtdb, 'sos'), snap => {
      const data = snap.val();
      const arr = [];
      if (data) {
        Object.keys(data).forEach(k => {
          if (data[k].status === 'searching' || data[k].status === 'routed') {
            arr.push({ id: k, ...data[k] });
          }
        });
      }
      arr.sort((a, b) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0));
      setSosList(arr);
    });
    
    const uT = onSnapshot(query(collection(firestore, 'teams'), where('status', '==', 'ready')), snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => a.priority - b.priority);
      setTeams(arr);
    });
    
    return () => { uS(); uT(); };
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Live SOS Alerts</Text>
      <Text style={styles.subtitle}>
        {sosList.length} active alerts | {teams.length} teams ready
      </Text>

      {sosList.length === 0 && (
        <View style={styles.emptyCard}>
          <Radio color="#555" size={48} style={{ marginBottom: 16 }} />
          <Text style={{ color: '#888', fontSize: 16, fontWeight: '600' }}>No active SOS alerts</Text>
        </View>
      )}

      {sosList.map(sos => (
        <View key={sos.id} style={styles.sosCard}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.sosType}>{sos.type?.toUpperCase() || 'UNKNOWN'}</Text>
              <Text style={styles.sosStatus}>{sos.status?.toUpperCase()}</Text>
            </View>
            <Text style={styles.coords}>
              {sos.lat?.toFixed(4)}, {sos.lng?.toFixed(4)}
            </Text>
          </View>
          
          <View style={styles.dispatchContainer}>
            {teams.map(t => (
              <TouchableOpacity key={t.id} style={styles.dispatchBtn} onPress={() => handleDispatchTeam(sos, t)}>
                <Text style={styles.dispatchBtnText}>Dispatch {t.name}</Text>
              </TouchableOpacity>
            ))}
            {teams.length === 0 && (
              <Text style={{ color: '#888', fontSize: 13, fontStyle: 'italic' }}>No teams currently available.</Text>
            )}
          </View>
        </View>
      ))}
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
  sosCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sosType: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  sosStatus: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 12,
  },
  coords: {
    color: '#888',
    fontSize: 12,
  },
  dispatchContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dispatchBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dispatchBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  }
});
