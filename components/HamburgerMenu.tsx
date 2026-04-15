import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.8;

export default function HamburgerMenu() {
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const translateX = useSharedValue(-SIDEBAR_WIDTH);

  const openMenu = () => {
    setVisible(true);
    translateX.value = withTiming(0, { duration: 300 });
  };

  const closeMenu = () => {
    translateX.value = withTiming(-SIDEBAR_WIDTH, { duration: 250 }, () => {
      runOnJS(setVisible)(false);
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const navigateTo = (path: string) => {
    closeMenu();
    setTimeout(() => {
      router.push(path as any);
    }, 300);
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      <TouchableOpacity onPress={openMenu} style={styles.menuButton}>
        <Ionicons name="menu" size={32} color="#C8102E" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <View style={styles.modalContainer}>
          <Pressable style={styles.backdrop} onPress={closeMenu} />

          <Animated.View style={[styles.sidebar, animatedStyle]}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>CRISIS CENTER</Text>
                <Text style={styles.subtitle}>OFFICIAL RESPONSE UTILITY</Text>
              </View>
              <TouchableOpacity onPress={closeMenu}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.statusBox}>
              <Ionicons name="shield-checkmark" size={18} color="#C8102E" />
              <Text style={styles.statusText}>AUTHENTICATED SESSION</Text>
            </View>

            <View style={styles.menuItems}>
              <MenuItem
                icon="radio"
                label="INCIDENT FEED"
                onPress={() => navigateTo('/')}
                active={isActive('/')}
              />
              <MenuItem
                icon="shield-checkmark"
                label="EMERGENCY PROTOCOLS"
                onPress={() => navigateTo('/sos')}
                active={isActive('/sos')}
              />
              <MenuItem
                icon="chatbubbles"
                label="COMMS HUB"
                onPress={() => navigateTo('/messages')}
                active={isActive('/messages')}
              />

              <View style={styles.divider} />

              <MenuItem
                icon="map"
                label="AREA MAP (OFFLINE)"
                disabled
              />
              <MenuItem
                icon="settings"
                label="DEVICE CONFIG"
                disabled
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.version}>APP VERSION 2.0.1 (STABLE)</Text>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function MenuItem({ icon, label, onPress, active, disabled }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.menuItem,
        active && styles.activeMenuItem,
        disabled && { opacity: 0.3 }
      ]}
    >
      <Ionicons
        name={icon}
        size={24}
        color={active ? '#fff' : '#4B5563'}
        style={styles.menuIcon}
      />
      <Text style={[
        styles.menuLabel,
        active && styles.activeMenuLabel,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    padding: 4,
  },
  modalContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: '#000', // TRUE BLACK SIDEBAR
    paddingTop: 60,
    paddingHorizontal: 20,
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    color: '#C8102E',
    fontSize: 26,
    fontWeight: '900',
    fontFamily: 'System',
    fontStyle: 'italic',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090b',
    padding: 12,
    borderRadius: 4,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 8,
  },
  menuItems: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 4,
  },
  activeMenuItem: {
    backgroundColor: '#C8102E',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  menuIcon: {
    marginRight: 15,
  },
  menuLabel: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '800',
  },
  activeMenuLabel: {
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 20,
  },
  footer: {
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 20,
  },
  version: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
});
