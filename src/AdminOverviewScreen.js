import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { firestore, database as rtdb } from './firebaseConfig';
import { Activity, Users, AlertTriangle, Shield, Truck } from 'lucide-react-native';

export default function AdminOverviewScreen() {
  const [metrics, setMetrics] = useState({
    activeSos: 0, teamsReady: 0, pendingVolunteers: 0,
    issuesReported: 0, respondersOnline: 0, roadBlockages: 0
  });

  useEffect(() => {
    // Teams — auto-seed if empty
    const uT = onSnapshot(collection(firestore, 'teams'), snap => {
      let ready = 0;
      let total = 0;
      snap.forEach(d => { total++; if (d.data().status === 'ready') ready++; });
      setMetrics(m => ({ ...m, teamsReady: ready }));

      // Auto-seed 3 default teams if none exist
      if (total === 0) {
        const defaultTeams = [
          { id: 'team_alpha', name: 'Team Alpha', priority: 1, vehicle: '🚑', status: 'ready', members: [
            { role: 'Doctor', name: 'Dr. Arjun Mehta', email: 'team1.doctor@reliefmesh.com' },
            { role: 'Nurse', name: 'Priya Sharma', email: 'team1.nurse@reliefmesh.com' },
            { role: 'Paramedic', name: 'Rahul Verma', email: 'team1.paramedic@reliefmesh.com' },
            { role: 'Driver', name: 'Sunil Patil', email: 'team1.driver@reliefmesh.com' },
          ]},
          { id: 'team_bravo', name: 'Team Bravo', priority: 2, vehicle: '🚑', status: 'ready', members: [
            { role: 'Doctor', name: 'Dr. Kavita Iyer', email: 'team2.doctor@reliefmesh.com' },
            { role: 'Nurse', name: 'Anita Desai', email: 'team2.nurse@reliefmesh.com' },
            { role: 'Paramedic', name: 'Vikram Singh', email: 'team2.paramedic@reliefmesh.com' },
            { role: 'Driver', name: 'Manoj Kulkarni', email: 'team2.driver@reliefmesh.com' },
          ]},
          { id: 'team_charlie', name: 'Team Charlie', priority: 3, vehicle: '🚑', status: 'ready', members: [
            { role: 'Doctor', name: 'Dr. Neha Joshi', email: 'team3.doctor@reliefmesh.com' },
            { role: 'Nurse', name: 'Deepika Rao', email: 'team3.nurse@reliefmesh.com' },
            { role: 'Paramedic', name: 'Amit Thakur', email: 'team3.paramedic@reliefmesh.com' },
            { role: 'Driver', name: 'Rajesh Gupta', email: 'team3.driver@reliefmesh.com' },
          ]},
        ];
        defaultTeams.forEach(team => {
          setDoc(doc(firestore, 'teams', team.id), {
            name: team.name, priority: team.priority, vehicle: team.vehicle,
            status: team.status, members: team.members, dispatchedSosId: null, createdAt: Date.now(),
          }, { merge: true }).catch(e => console.warn('Team seed failed:', e.message));
        });
      }
    });

    // Volunteer requests
    const uV = onSnapshot(query(collection(firestore, 'volunteerRequests'), where('status', '==', 'pending')), snap => {
      setMetrics(m => ({ ...m, pendingVolunteers: snap.size }));
    });

    // Responders
    const uR = onSnapshot(query(collection(firestore, 'responders'), where('available', '==', true)), snap => {
      setMetrics(m => ({ ...m, respondersOnline: snap.size }));
    });

    // SOS (RTDB)
    const sosRef = ref(rtdb, 'sos');
    const uS = onValue(sosRef, snap => {
      const data = snap.val();
      let active = 0;
      if (data) {
        Object.keys(data).forEach(k => {
          if (data[k].status === 'searching' || data[k].status === 'routed') {
            active++;
          }
        });
      }
      setMetrics(m => ({ ...m, activeSos: active }));
    });

    // Zones (Road blockages)
    const uZ = onSnapshot(query(collection(firestore, 'zones'), where('type', '==', 'blocked')), snap => {
      setMetrics(m => ({ ...m, roadBlockages: snap.size }));
    });

    return () => { uT(); uV(); uR(); uS(); uZ(); };
  }, []);

  const metricCards = [
    { label: 'Active SOS', value: metrics.activeSos, color: '#dc2626', icon: Activity },
    { label: 'Teams Ready', value: metrics.teamsReady, color: '#22c55e', icon: Truck },
    { label: 'Pending Volunteers', value: metrics.pendingVolunteers, color: '#f59e0b', icon: Users },
    { label: 'Responders Online', value: metrics.respondersOnline, color: '#3b82f6', icon: Shield },
    { label: 'Road Blockages', value: metrics.roadBlockages, color: '#f97316', icon: AlertTriangle },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>System Overview</Text>
      <Text style={styles.subtitle}>Real-time operational status of ReliefMesh</Text>

      <View style={styles.grid}>
        {metricCards.map((c, i) => (
          <View key={i} style={[styles.card, { borderColor: `${c.color}33` }]}>
            <View style={styles.cardHeader}>
              <c.icon color={c.color} size={24} />
              <View style={[styles.glow, { backgroundColor: c.color }]} />
            </View>
            <Text style={[styles.value, { color: c.color }]}>{c.value}</Text>
            <Text style={styles.label}>{c.label}</Text>
          </View>
        ))}
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  card: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 16,
  },
  cardHeader: {
    marginBottom: 16,
  },
  value: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  glow: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.05,
  }
});
