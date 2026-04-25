import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

// EXPORTED — needed by headless widget handler and other contexts
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCdELBJUj_V0g5qIutoZYXahYD0p1_pdw4",
  authDomain: "rapid-crisis-response-94158.firebaseapp.com",
  databaseURL: "https://rapid-crisis-response-94158-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "rapid-crisis-response-94158",
  storageBucket: "rapid-crisis-response-94158.firebasestorage.app",
  messagingSenderId: "899786083796",
  appId: "1:899786083796:web:2b57ef2b7ce9c2db741a41"
};

// Initialize Firebase with guard for multi-context safety (headless widget, etc.)
const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];

// Initialize Auth with AsyncStorage persistence on native platforms
let auth;
if (Platform.OS !== 'web' && getApps().length <= 1) {
  try {
    const ReactNativeAsyncStorage = require('@react-native-async-storage/async-storage').default;
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
  } catch (e) {
    // Fallback if AsyncStorage is not available (e.g. headless widget context)
    auth = getAuth(app);
  }
} else {
  auth = getAuth(app);
}

const database = getDatabase(app);
const firestore = getFirestore(app);

export { app, auth, database, firestore };
