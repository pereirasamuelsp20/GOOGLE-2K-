import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function TabLayout() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#000',
            borderTopWidth: 1,
            borderTopColor: '#1e293b',
            height: 70,
            paddingBottom: 10,
          },
          tabBarActiveTintColor: '#C8102E',
          tabBarInactiveTintColor: '#475569',
          tabBarLabelStyle: {
            fontFamily: 'System',
            fontWeight: '900',
            fontSize: 9, // Reduced slightly for 5 tabs
            textTransform: 'uppercase',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color }) => <Ionicons name="radio" size={20} color={color} />,
          }}
        />

        <Tabs.Screen
          name="map"
          options={{
            title: 'Map',
            tabBarIcon: ({ color }) => <Ionicons name="map" size={20} color={color} />,
          }}
        />

        <Tabs.Screen
          name="sos"
          options={{
            title: "SOS",
            tabBarIcon: ({ color }) => <Ionicons name="shield-checkmark" size={20} color={color} />,
          }}
        />

        <Tabs.Screen
          name="messages"
          options={{
            title: "Comms",
            tabBarIcon: ({ color }) => <Ionicons name="chatbubbles" size={20} color={color} />,
          }}
        />

        <Tabs.Screen
          name="protocols"
          options={{
            title: "Guides",
            tabBarIcon: ({ color }) => <Ionicons name="library" size={20} color={color} />,
          }}
        />
      </Tabs>

      {/* PERSISTENT GLOBAL SOS BUTTON */}
      <TouchableOpacity
        style={styles.sosFab}
        onPress={() => router.push('/sos')}
        activeOpacity={0.8}
      >
        <Ionicons name="warning" size={32} color="white" />
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sosFab: {
    position: 'absolute',
    bottom: 155,
    right: 20,
    backgroundColor: '#C8102E',
    width: 70,
    height: 70,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    zIndex: 1000,
  },
  sosText: {
    color: 'white',
    fontFamily: 'System',
    fontWeight: '900',
    fontSize: 12,
    marginTop: -2,
  }
});