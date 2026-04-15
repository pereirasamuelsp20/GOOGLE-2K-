import { Ionicons } from "@expo/vector-icons";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { NavigationContainer } from "@react-navigation/native";
import { useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const Drawer = createDrawerNavigator();

/* ---------------- FEED SCREEN ---------------- */

function FeedScreen({ navigation }) {
  const [incidents, setIncidents] = useState([
    {
      id: "1",
      title: "Warehouse Fire",
      description: "Fire reported in industrial area",
      location: "Sector 4",
      time: "2m ago",
      status: "Verified",
    },
  ]);

  const [modalVisible, setModalVisible] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [newIncident, setNewIncident] = useState({
    title: "",
    description: "",
    location: "",
  });

  const [notifications, setNotifications] = useState([
    { id: "1", text: "New fire reported", read: false },
  ]);

  const handleSubmit = () => {
    const newItem = {
      id: Date.now().toString(),
      ...newIncident,
      time: "Just now",
      status: "Unverified",
    };

    setIncidents([newItem, ...incidents]);

    setNotifications([
      { id: Date.now().toString(), text: "New incident added", read: false },
      ...notifications,
    ]);

    setModalVisible(false);
    setNewIncident({ title: "", description: "", location: "" });
  };

  const markAllRead = () => {
    setNotifications([]);
    setShowNotifications(false);
  };

  const unread = notifications.length > 0;

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Ionicons name="menu" size={26} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerText}>Crisis Feed</Text>

        <TouchableOpacity onPress={() => setShowNotifications(!showNotifications)}>
          <View>
            <Ionicons name="notifications" size={24} color="white" />
            {unread && <View style={styles.badge} />}
          </View>
        </TouchableOpacity>
      </View>

      {/* NOTIFICATIONS PANEL */}
      {showNotifications && notifications.length > 0 && (
        <View style={styles.notificationBox}>
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markRead}>Mark all as read</Text>
          </TouchableOpacity>

          {notifications.map((n) => (
            <Text key={n.id} style={styles.notificationText}>
              {n.text}
            </Text>
          ))}
        </View>
      )}

      {/* INCIDENT LIST */}
      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.description}</Text>
            <Text style={styles.meta}>
              {item.location} • {item.time}
            </Text>
            <Text
              style={{
                color: item.status === "Verified" ? "#2ECC71" : "#F39C12",
                marginTop: 5,
              }}
            >
              {item.status}
            </Text>
          </View>
        )}
      />

      {/* FLOAT BUTTON */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={{ color: "white", fontWeight: "bold" }}>+ Report</Text>
      </TouchableOpacity>

      {/* MODAL */}
      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modal}>
          <TextInput
            placeholder="Incident Title"
            style={styles.input}
            value={newIncident.title}
            onChangeText={(text) =>
              setNewIncident({ ...newIncident, title: text })
            }
          />
          <TextInput
            placeholder="Description"
            style={styles.input}
            value={newIncident.description}
            onChangeText={(text) =>
              setNewIncident({ ...newIncident, description: text })
            }
          />
          <TextInput
            placeholder="Location"
            style={styles.input}
            value={newIncident.location}
            onChangeText={(text) =>
              setNewIncident({ ...newIncident, location: text })
            }
          />

          <TouchableOpacity style={styles.submit} onPress={handleSubmit}>
            <Text style={{ color: "white" }}>Submit</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <Text style={{ textAlign: "center", marginTop: 10 }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- OTHER SCREENS ---------------- */

const Screen = (name) => () => (
  <View style={styles.center}>
    <Text style={{ color: "white", fontSize: 18 }}>{name}</Text>
  </View>
);

/* ---------------- NAVIGATION ---------------- */

export default function App() {
  return (
    <NavigationContainer>
      <Drawer.Navigator screenOptions={{ headerShown: false }}>
        <Drawer.Screen name="Feed" component={FeedScreen} />
        <Drawer.Screen name="SOS" component={Screen("SOS Screen")} />
        <Drawer.Screen name="Maps" component={Screen("Maps Screen")} />
        <Drawer.Screen name="Messages" component={Screen("Messages Screen")} />
        <Drawer.Screen name="Guidelines" component={Screen("Guidelines")} />
        <Drawer.Screen name="Settings" component={Screen("Settings")} />
        <Drawer.Screen name="Profile" component={Screen("Profile")} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 15,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  headerText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },

  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 8,
    height: 8,
    backgroundColor: "red",
    borderRadius: 4,
  },

  notificationBox: {
    backgroundColor: "#1e293b",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },

  notificationText: {
    color: "white",
    marginTop: 5,
  },

  markRead: {
    color: "#3b82f6",
    fontWeight: "bold",
    marginBottom: 5,
  },

  card: {
    backgroundColor: "#1e293b",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },

  title: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },

  desc: {
    color: "#cbd5f5",
  },

  meta: {
    color: "gray",
    fontSize: 12,
  },

  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#3b82f6",
    padding: 15,
    borderRadius: 50,
  },

  modal: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
  },

  submit: {
    backgroundColor: "#3b82f6",
    padding: 15,
    alignItems: "center",
    borderRadius: 8,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
});