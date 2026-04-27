import localforage from 'localforage';

export const MESH_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const MESH_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

/**
 * Note: Web Bluetooth API only supports the Central role (scanning and connecting).
 * It cannot advertise as a Peripheral. True mesh requires both advertising and scanning.
 * This implementation acts as a Central to connect to existing ReliefMesh nodes (e.g. Android devices)
 * and uses an IndexedDB relay queue for the PWA.
 */

export async function isBleSupported() {
  return navigator.bluetooth && await navigator.bluetooth.getAvailability();
}

export async function scanAndConnectMesh() {
  if (!navigator.bluetooth) {
    throw new Error("BLE mesh requires Chrome on Android or desktop");
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [MESH_SERVICE_UUID] }]
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(MESH_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(MESH_CHARACTERISTIC_UUID);

    // Listen for incoming mesh packets
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', handleIncomingMeshPacket);

    return characteristic;
  } catch (error) {
    console.error("BLE Connection failed", error);
    throw error;
  }
}

export async function sendMeshPacket(characteristic, payloadObj) {
  const encoder = new TextEncoder();
  const jsonStr = JSON.stringify(payloadObj);
  const data = encoder.encode(jsonStr);
  
  // Chunking into 512-byte packets
  const CHUNK_SIZE = 512;
  const totalChunks = Math.ceil(data.byteLength / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    
    // Add header: [seq (1 byte), total (1 byte), ...chunkData]
    const packet = new Uint8Array(chunk.byteLength + 2);
    packet[0] = i;
    packet[1] = totalChunks;
    packet.set(chunk, 2);

    await characteristic.writeValue(packet);
  }
}

async function handleIncomingMeshPacket(event) {
  const value = event.target.value;
  // In a real implementation, you'd buffer chunks and reassemble.
  // We'll mock the reassembly assuming the payload is small or already reassembled for prototype.
  
  try {
    const decoder = new TextDecoder();
    // Assuming full message for simple prototype
    const messageStr = decoder.decode(value);
    const packet = JSON.parse(messageStr);

    await processReceivedMeshPacket(packet);
  } catch (e) {
    console.error("Failed to parse mesh packet", e);
  }
}

export async function processReceivedMeshPacket(packet) {
  // Check if we are the recipient
  const myDeviceCode = await localforage.getItem('deviceCode');
  
  if (packet.recipientDeviceCode === myDeviceCode) {
    // It's for me! Dispatch an event to the app
    const event = new CustomEvent('mesh-message-received', { detail: packet });
    window.dispatchEvent(event);
  } else {
    // Relay queue logic
    if (packet.hopCount && packet.hopCount >= 5) {
      console.log("Mesh packet max hops reached, dropping.");
      return;
    }

    packet.hopCount = (packet.hopCount || 0) + 1;
    
    // Save to relay queue
    const queue = await localforage.getItem('mesh_relay_queue') || [];
    queue.push(packet);
    await localforage.setItem('mesh_relay_queue', queue);

    // If online, flush immediately
    if (navigator.onLine) {
      flushRelayQueue();
    }
  }
}

export async function flushRelayQueue() {
  const queue = await localforage.getItem('mesh_relay_queue');
  if (!queue || queue.length === 0) return;

  console.log("Flushing mesh relay queue to Firestore...");
  // In a real app, this would iterate and write to Firestore.
  // We will dispatch a CustomEvent so the main app can handle the Firestore logic.
  
  const event = new CustomEvent('mesh-flush-queue', { detail: queue });
  window.dispatchEvent(event);

  await localforage.setItem('mesh_relay_queue', []);
}

// Network Monitor
export function startNetworkMonitor(onStatusChange) {
  const checkNetwork = async () => {
    if (!navigator.onLine) {
      onStatusChange('offline');
      return;
    }
    try {
      // Ping google favicon with cache buster
      await fetch(`https://www.google.com/favicon.ico?_=${new Date().getTime()}`, {
        mode: 'no-cors',
        cache: 'no-store'
      });
      onStatusChange('online');
    } catch (e) {
      onStatusChange('offline');
    }
  };

  window.addEventListener('online', checkNetwork);
  window.addEventListener('offline', checkNetwork);
  
  // Periodic ping every 10 seconds
  const interval = setInterval(checkNetwork, 10000);
  checkNetwork();

  return () => {
    window.removeEventListener('online', checkNetwork);
    window.removeEventListener('offline', checkNetwork);
    clearInterval(interval);
  };
}
