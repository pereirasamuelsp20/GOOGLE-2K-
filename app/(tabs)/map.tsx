import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import HamburgerMenu from '../../components/HamburgerMenu';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>Crisis Center</Text>
        <View style={{ flex: 1 }} />
      </View>

      {/* MAP SEARCH & FILTERS (PLACEHOLDER) */}
      <View style={styles.mapControls}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#4B5563" />
          <TextInput
            placeholder="SEARCH PPL / LOCATIONS..."
            placeholderTextColor="#4B5563"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterGrid}>
          <TouchableOpacity style={styles.filterChip}>
            <Ionicons name="car-outline" size={16} color="white" />
            <Text style={styles.chipText}>BLOCKED ROADS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Ionicons name="home-outline" size={16} color="white" />
            <Text style={styles.chipText}>RELIEF CAMPS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* PLACEHOLDER MAP VIEW */}
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map" size={120} color="#1e293b" />
        <Text style={styles.placeholderText}>TACTICAL MAP MODULE</Text>
        <Text style={styles.placeholderSub}>INTEGRATION PENDING: GPS SIGNAL OPTIMIZATION</Text>

        <View style={styles.resourceTag}>
          <Text style={styles.resourceText}>LIVE RESOURCE TRACKING: ACTIVE</Text>
        </View>
      </View>

      {/* FOOTER LEGEND */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#C8102E' }]} />
          <Text style={styles.legendText}>ACTIVE HAZARD</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#0056D2' }]} />
          <Text style={styles.legendText}>SAFE ZONE</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000",
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTitle: {
    color: "#C8102E",
    fontSize: 24,
    fontWeight: "900",
    fontFamily: "System",
    fontStyle: 'italic',
    marginLeft: 15,
  },
  mapControls: {
    padding: 15,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontWeight: '700',
    color: '#000',
  },
  filterGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#09090b',
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 6,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 20,
  },
  placeholderSub: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 8,
  },
  resourceTag: {
    marginTop: 30,
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 4,
  },
  resourceText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  legend: {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'center',
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    marginBottom: 80, // Space for nav
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
});
