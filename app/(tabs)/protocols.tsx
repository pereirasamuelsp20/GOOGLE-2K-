import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import HamburgerMenu from '../../components/HamburgerMenu';

const PROTOCOLS = [
  {
    id: 'fire',
    title: 'FIRE EMERGENCY',
    icon: 'flame',
    color: '#C8102E',
    dos: ['Evacuate immediately via stairs.', 'Stay low to avoid smoke inhalation.', 'Touch doors with back of hand before opening.'],
    donts: ['Do not use elevators.', 'Do not stop to collect personal items.', 'Do not return to building after exiting.']
  },
  {
    id: 'medical',
    title: 'MEDICAL EMERGENCY',
    icon: 'medkit',
    color: '#0056D2',
    dos: ['Call 102 immediately.', 'Check for pulse and breathing.', 'Apply pressure to bleeding wounds.'],
    donts: ['Do not move the injured person unless in danger.', 'Do not offer food or water to unconscious patients.', 'Do not leave the patient unattended.']
  },
  {
    id: 'security',
    title: 'SECURITY THREAT',
    icon: 'shield-alert',
    color: '#1e293b',
    dos: ['Move to a secure safe zone.', 'Call 100 or notify local authority.', 'Stay silent and disable device audio.'],
    donts: ['Do not confront the threat.', 'Do not use elevators or clear glass rooms.', 'Do not share location on social media.']
  },
  {
    id: 'general',
    title: 'GENERAL GUIDELINES',
    icon: 'information-circle',
    color: '#4B5563',
    dos: ['Memorize emergency helpline numbers.', 'Maintain an emergency first-aid kit.', 'Assign a primary emergency contact.'],
    donts: ['Do not panic.', 'Do not ignore official broadcast alerts.', 'Do not spread unverified rumors.']
  }
];

export default function ProtocolsScreen() {
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>Crisis Center</Text>
        <View style={{ flex: 1 }} />
      </View>

      <View style={styles.contentTitle}>
        <Text style={styles.mainTitle}>EMERGENCY GUIDES</Text>
        <Text style={styles.subTitle}>OFFICIAL DO'S & DON'TS FOR DISASTER RESPONSE</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {PROTOCOLS.map((protocol) => (
          <View key={protocol.id} style={styles.card}>
            <View style={[styles.cardHeader, { backgroundColor: protocol.color }]}>
              <Ionicons name={protocol.icon as any} size={24} color="white" />
              <Text style={styles.cardTitle}>{protocol.title}</Text>
            </View>

            <View style={styles.cardSection}>
              <Text style={[styles.sectionHeading, { color: '#059669' }]}>DO'S</Text>
              {protocol.dos.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <Ionicons name="add-circle" size={14} color="#059669" />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={styles.cardSection}>
              <Text style={[styles.sectionHeading, { color: '#C8102E' }]}>DON'TS</Text>
              {protocol.donts.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <Ionicons name="close-circle" size={14} color="#C8102E" />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>
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
  contentTitle: {
    padding: 20,
  },
  mainTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: '900',
  },
  subTitle: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 15,
  },
  card: {
    backgroundColor: '#09090b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 12,
  },
  cardSection: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 10,
    letterSpacing: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  listText: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
});
