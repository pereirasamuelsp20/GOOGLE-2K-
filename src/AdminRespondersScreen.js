import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import { firestore } from './firebaseConfig';
import { Shield } from 'lucide-react-native';

export default function AdminRespondersScreen() {
  const [list, setList] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'responders'), snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setList(arr);
    });
    return () => unsub();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Responder Network</Text>
      <Text style={styles.subtitle}>
        {list.length} total | {list.filter(r => r.available).length} online
      </Text>

      <View style={styles.grid}>
        {list.map(r => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.name}>{r.name || 'Unknown'}</Text>
            
            <View style={styles.badgesContainer}>
              <View style={styles.badgeBase}>
                <Text style={styles.badgeText}>{r.role || 'Responder'}</Text>
              </View>
              
              <View style={[styles.badgeBase, { backgroundColor: r.available ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)' }]}>
                <Text style={[styles.badgeText, { color: r.available ? '#22c55e' : '#888' }]}>
                  {r.available ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </View>
              
              {r.teamId && (
                <View style={[styles.badgeBase, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                  <Text style={[styles.badgeText, { color: '#60a5fa' }]}>
                    {r.teamId.replace('_', ' ')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ))}
        {list.length === 0 && (
          <View style={styles.emptyCard}>
            <Shield color="#555" size={48} style={{ marginBottom: 16 }} />
            <Text style={{ color: '#888', fontSize: 16, fontWeight: '600' }}>No responders found</Text>
          </View>
        )}
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
  grid: {
    gap: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeBase: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    color: '#ccc',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#222',
  }
});
