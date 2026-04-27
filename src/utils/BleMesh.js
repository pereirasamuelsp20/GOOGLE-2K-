import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Gracefully import native BLE modules — they may not be linked
let BleManager = null;
let bleManager = null;
let BackgroundFetch = null;
let BLEAdvertiser = null;

try {
  const blePlx = require('react-native-ble-plx');
  BleManager = blePlx.BleManager;
  bleManager = new BleManager();
} catch (e) {
  console.warn('react-native-ble-plx not available:', e.message);
}

try {
  BLEAdvertiser = require('react-native-ble-advertiser').default;
} catch (e) {
  console.warn('react-native-ble-advertiser not available:', e.message);
}

try {
  BackgroundFetch = require('react-native-background-fetch').default;
} catch (e) {
  console.warn('react-native-background-fetch not available:', e.message);
}

const MESH_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

export async function requestBlePermissions() {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);

    return (
      granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.BLUETOOTH_ADVERTISE'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (err) {
    console.warn('BLE permissions error:', err);
    return false;
  }
}

export async function startBleMeshBackground() {
  if (Platform.OS !== 'android') {
    console.log('Full BLE mesh only available on Android');
    return;
  }

  if (!bleManager && !BLEAdvertiser) {
    console.log('BLE native modules not available — mesh disabled');
    return;
  }

  const hasPermissions = await requestBlePermissions();
  if (!hasPermissions) {
    console.log("BLE Permissions not granted — mesh disabled");
    return;
  }

  // 1. Start Advertising (Peripheral)
  if (BLEAdvertiser) {
    try {
      const deviceCode = await AsyncStorage.getItem('deviceCode') || 'UNKNOWN';
      const shortCode = deviceCode.substring(0, 8);
      BLEAdvertiser.setCompanyId(0x00E0);
      
      const codeHex = shortCode.split('').map(c => c.charCodeAt(0)).slice(0, 8);
      
      await BLEAdvertiser.broadcast(MESH_SERVICE_UUID, codeHex, {
        advertiseMode: BLEAdvertiser.ADVERTISE_MODE_BALANCED,
        txPowerLevel: BLEAdvertiser.ADVERTISE_TX_POWER_MEDIUM,
        connectable: true,
        includeDeviceName: false,
        includeTxPowerLevel: false
      });
      console.log("BLE Advertiser Started for Mesh");
    } catch (e) {
      console.warn("BLE Advertiser error:", e.message);
    }
  }

  // 2. Start Scanning (Central)
  if (bleManager) {
    try {
      bleManager.startDeviceScan([MESH_SERVICE_UUID], null, async (error, device) => {
        if (error) {
          console.warn("BLE Scan Error:", error.message);
          return;
        }

        if (device && device.id) {
          const recentlyConnectedStr = await AsyncStorage.getItem('mesh_recent_peers') || '[]';
          const recentPeers = JSON.parse(recentlyConnectedStr);
          
          if (!recentPeers.includes(device.id)) {
            recentPeers.push(device.id);
            if (recentPeers.length > 20) recentPeers.shift();
            await AsyncStorage.setItem('mesh_recent_peers', JSON.stringify(recentPeers));
            syncWithPeer(device);
          }
        }
      });
    } catch (e) {
      console.warn("BLE Scanner start error:", e.message);
    }
  }

  // 3. Register Background Task
  if (BackgroundFetch) {
    try {
      BackgroundFetch.configure({
        minimumFetchInterval: 15,
        stopOnTerminate: false,
        enableHeadless: true,
        startOnBoot: true,
      }, async (taskId) => {
        console.log("[BackgroundFetch] Mesh Keep-alive taskId: ", taskId);
        BackgroundFetch.finish(taskId);
      }, (error) => {
        console.log("[BackgroundFetch] FAILED to setup: ", error);
      });
    } catch (e) {
      console.warn("BackgroundFetch setup error:", e.message);
    }
  }
}

async function syncWithPeer(device) {
  try {
    const connectedDevice = await device.connect();
    await connectedDevice.discoverAllServicesAndCharacteristics();
    console.log("Connected to Mesh Peer:", device.id);
    await connectedDevice.cancelConnection();
  } catch (e) {
    console.log("Mesh Peer Sync Failed:", e.message);
  }
}

export async function addPacketToRelayQueue(packet) {
  try {
    if (packet.hopCount >= 5) return;
    
    packet.hopCount = (packet.hopCount || 0) + 1;
    
    const queueStr = await AsyncStorage.getItem('mesh_relay_queue') || '[]';
    const queue = JSON.parse(queueStr);
    queue.push(packet);
    
    await AsyncStorage.setItem('mesh_relay_queue', JSON.stringify(queue));
  } catch (e) {
    console.error("Relay queue save error", e);
  }
}
