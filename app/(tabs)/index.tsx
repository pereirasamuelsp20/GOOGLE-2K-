import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import HamburgerMenu from "../../components/HamburgerMenu";

/* ---------------- INDUSTRIAL DUMMY DATA ---------------- */

const INITIAL_REPORTS = [
  {
    id: "RPT-2024-001",
    category: "flood",
    title: "MAIN STREET RIVER BREACH",
    description: "The West River has breached its banks at the Main Street Bridge. Water levels are rising rapidly. Residents in Zone A are ordered to move to higher ground immediately.",
    gps: "0.8km away",
    timestamp: "2 MINS AGO",
    status: "CRITICAL • FLASH FLOOD",
    verified: true,
    image: "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&q=80&w=1000",
  },
  {
    id: "RPT-2024-002",
    category: "fire",
    title: "STRUCTURE FIRE: INDUSTRIAL DIV",
    description: "Active structure fire reported at the chemical storage facility. All personnel must evacuate within a 500m radius. Emergency services on scene.",
    gps: "1.2km away",
    timestamp: "8 MINS AGO",
    status: "URGENT • HAZMAT",
    verified: false,
    image: "https://images.unsplash.com/photo-1516641396056-0ce60a85d49f?auto=format&fit=crop&q=80&w=1000",
  },
];

export default function Index() {
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // New Report Form State
  const [newType, setNewType] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleReportSubmit = () => {
    if (!newType || !newDesc) return;

    const newReport: any = {
      id: `USR-${Date.now().toString().slice(-4)}`,
      category: "user",
      title: newType.toUpperCase(),
      description: newDesc,
      gps: newLocation || "LOCATION PENDING",
      timestamp: "JUST NOW",
      status: "UNVERIFIED • USER REPORT",
      verified: false,
    };

    setReports([newReport, ...reports]);
    setReportModalVisible(false);
    setNewType("");
    setNewLocation("");
    setNewDesc("");
  };

  const renderIncidentCard = ({ item }: any) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <View style={styles.tagRow}>
            {/* VERIFICATION BADGE */}
            <View style={[
              styles.verifyBadge,
              { backgroundColor: item.verified ? '#059669' : '#D97706' }
            ]}>
              <Ionicons
                name={item.verified ? "shield-checkmark" : "warning"}
                size={12}
                color="white"
              />
              <Text style={styles.verifyText}>
                {item.verified ? "VERIFIED" : "UNVERIFIED"}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={styles.distanceText}>{item.gps}</Text>
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardTime}>{item.timestamp}</Text>
          </View>

          {item.image && (
            <Image source={{ uri: item.image }} style={styles.cardImage} />
          )}

          <Text style={styles.cardDesc}>{item.description}</Text>

          <View style={styles.actionGrid}>
            <TouchableOpacity style={[styles.actionBtn, styles.safeBtn]}>
              <Text style={styles.actionBtnText}>I AM SAFE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.helpBtn]}>
              <Text style={styles.actionBtnText}>HELP NEEDED</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>Crisis Center</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.reportBtnTop}
          onPress={() => setReportModalVisible(true)}
        >
          <Ionicons name="add-circle" size={24} color="#C8102E" />
        </TouchableOpacity>
      </View>

      {/* FILTERS BAR */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.chip, styles.chipActive]}>
            <Ionicons name="navigate" size={16} color="white" style={{ marginRight: 6 }} />
            <Text style={styles.chipTextActive}>NEAR ME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip}>
            <Text style={styles.chipText}>CRITICAL ONLY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
            <Text style={styles.chipText}>VERIFIED</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={reports}
        renderItem={renderIncidentCard}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: 150 }}
        style={styles.list}
      />

      {/* REPORT MODAL */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>REPORT INCIDENT</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.inputLabel}>INCIDENT TYPE</Text>
              <TextInput
                style={styles.input}
                placeholder="E.G. FIRE, FLOOD, SECURITY..."
                placeholderTextColor="#4B5563"
                value={newType}
                onChangeText={setNewType}
              />

              <Text style={styles.inputLabel}>LOCATION / LANDMARK</Text>
              <TextInput
                style={styles.input}
                placeholder="ENTER GPS OR STREET NAME..."
                placeholderTextColor="#4B5563"
                value={newLocation}
                onChangeText={setNewLocation}
              />

              <Text style={styles.inputLabel}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="DESCRIBE THE SITUATION..."
                placeholderTextColor="#4B5563"
                multiline
                numberOfLines={4}
                value={newDesc}
                onChangeText={setNewDesc}
              />

              <View style={styles.disclaimer}>
                <Ionicons name="alert-circle" size={16} color="#9CA3AF" />
                <Text style={styles.disclaimerText}>
                  FALSE REPORTING IS A PUNISHABLE OFFENSE. YOUR LOCATION WILL BE LOGGED.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleReportSubmit}
              >
                <Text style={styles.submitBtnText}>SUBMIT FOR VERIFICATION</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
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
  reportBtnTop: {
    padding: 4,
  },
  filterBar: {
    backgroundColor: "#000",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginRight: 10,
    backgroundColor: '#0f0f0f',
  },
  chipActive: {
    backgroundColor: "#C8102E",
    borderColor: "#C8102E",
  },
  chipText: {
    color: "#9CA3AF",
    fontWeight: "800",
    fontSize: 11,
  },
  chipTextActive: {
    color: "white",
    fontWeight: "900",
    fontSize: 11,
  },
  list: {
    paddingHorizontal: 12,
    marginTop: 12,
  },
  card: {
    backgroundColor: "#09090b",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardInfo: {
    padding: 16,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  verifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 6,
  },
  verifyText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
  },
  distanceText: {
    color: '#C8102E',
    fontWeight: '900',
    fontSize: 12,
  },
  titleRow: {
    marginBottom: 12,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  cardTime: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  cardImage: {
    width: '100%',
    height: 180,
    borderRadius: 4,
    marginVertical: 12,
  },
  cardDesc: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 20,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  safeBtn: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  helpBtn: {
    backgroundColor: '#C8102E',
    borderColor: '#ef4444',
  },
  actionBtnText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 13,
  },
  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#000',
    height: '85%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    color: '#C8102E',
    fontSize: 20,
    fontWeight: '900',
  },
  modalForm: {
    padding: 20,
  },
  inputLabel: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 4,
    padding: 15,
    color: 'white',
    fontWeight: '700',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  disclaimer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    padding: 12,
    marginTop: 20,
    borderRadius: 4,
    gap: 10,
  },
  disclaimerText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
  },
  submitBtn: {
    backgroundColor: '#C8102E',
    paddingVertical: 18,
    borderRadius: 4,
    marginTop: 30,
    alignItems: 'center',
    marginBottom: 40,
  },
  submitBtnText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 14,
  },
});