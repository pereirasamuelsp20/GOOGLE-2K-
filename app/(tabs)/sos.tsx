import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import React, { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import HamburgerMenu from "../../components/HamburgerMenu";

export default function SOS() {
  const [popup, setPopup] = useState(false);
  const [message, setMessage] = useState("");

  const triggerCall = (type: string, number: string) => {
    setMessage(`CONNECTING: ${type.toUpperCase()}`);
    setPopup(true);

    setTimeout(() => {
      Linking.openURL(`tel:${number}`);
    }, 800);
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>Crisis Center</Text>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emergencyHead}>
          <Text style={styles.headTitle}>RAPID RESPONSE</Text>
          <Text style={styles.headSub}>SELECT SERVICE FOR IMMEDIATE DISPATCH</Text>
        </View>

        {/* THREE MASSIVE EMERGENCY BUTTONS */}
        <View style={styles.buttonStack}>
          <TouchableOpacity
            onPress={() => triggerCall("Fire Department", "101")}
            style={[styles.massiveBtn, { backgroundColor: '#C8102E' }]}
            activeOpacity={0.7}
          >
            <Ionicons name="flame" size={48} color="white" />
            <Text style={styles.massiveBtnText}>FIRE [101]</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => triggerCall("Ambulance", "102")}
            style={[styles.massiveBtn, { backgroundColor: '#0056D2' }]}
            activeOpacity={0.7}
          >
            <Ionicons name="medkit" size={48} color="white" />
            <Text style={styles.massiveBtnText}>AMBULANCE [102]</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => triggerCall("Police / Security", "100")}
            style={[styles.massiveBtn, { backgroundColor: '#1e293b' }]}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-half" size={48} color="white" />
            <Text style={styles.massiveBtnText}>SECURITY [100]</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.warningBox}>
          <Ionicons name="alert-circle" size={20} color="#9CA3AF" />
          <Text style={styles.warningText}>
            DIRECT LINE TO DISPATCH. USE ONLY IN LIFE-THREATENING SITUATIONS.
          </Text>
        </View>
      </ScrollView>

      {/* CUSTOM POPUP */}
      <Modal visible={popup} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.tacticalPopup}>
            <Ionicons name="cellular" size={40} color="#fff" style={{ marginBottom: 15 }} />
            <Text style={styles.popupText}>{message}</Text>
            <TouchableOpacity
              onPress={() => setPopup(false)}
              style={styles.abortBtn}
            >
              <Text style={styles.abortText}>CANCEL TRANSMISSION</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  content: {
    padding: 20,
    alignItems: "center",
  },
  emergencyHead: {
    width: '100%',
    marginBottom: 30,
    marginTop: 10,
  },
  headTitle: {
    color: 'white',
    fontSize: 32,
    fontWeight: '900',
  },
  headSub: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  buttonStack: {
    width: '100%',
    gap: 15,
  },
  massiveBtn: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  massiveBtnText: {
    color: 'white',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 10,
  },
  warningBox: {
    marginTop: 30,
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 100,
  },
  warningText: {
    flex: 1,
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  tacticalPopup: {
    backgroundColor: "#09090b",
    padding: 40,
    width: "85%",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8102E',
  },
  popupText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: '900',
    textAlign: "center",
    letterSpacing: 1,
  },
  abortBtn: {
    marginTop: 30,
    backgroundColor: "#1e293b",
    paddingVertical: 18,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: 4,
  },
  abortText: {
    color: "white",
    fontWeight: "900",
  },
});