// widgets/widgetTaskHandler.js
// Headless JS handler — runs WITHOUT opening the app.
// Firebase must be initialized before use.
// This file handles all widget lifecycle and SOS dispatch.

import React from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import * as Location from 'expo-location';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { SOSWidget } from './SOSWidget';
import { FIREBASE_CONFIG } from '../src/firebaseConfig';

// --- Firebase init guard (safe for headless context) ---
function getFirebaseApp() {
  if (getApps().length === 0) {
    return initializeApp(FIREBASE_CONFIG);
  }
  return getApps()[0];
}

// --- Core SOS sender ---
async function sendWidgetSOS(type) {
  const app = getFirebaseApp();
  const db = getFirestore(app);

  // Get last known location (foreground permission already granted by main app)
  let lat = 0;
  let lng = 0;
  try {
    const loc = await Location.getLastKnownPositionAsync({});
    if (loc) {
      lat = loc.coords.latitude;
      lng = loc.coords.longitude;
    }
  } catch (_) {
    // Proceed without location — responders will see 0,0 and know GPS failed
  }

  const timestamp = Date.now();
  const sosId = `widget_${timestamp}`;

  const payload = {
    type,
    lat,
    lng,
    status: 'searching',
    message: '[Widget SOS]',
    timestamp,
    uid: 'widget_anonymous', // Replace with AsyncStorage uid lookup if auth is available
    source: 'widget',
  };

  await setDoc(doc(db, 'sos', sosId), payload);

  // Update widget UI to active state
  await requestWidgetUpdate({
    widgetName: 'SOSWidget',
    renderWidget: () => (
      <SOSWidget sosActive={true} activeType={type.toLowerCase()} />
    ),
  });

  return sosId;
}

// --- Render idle state ---
async function renderIdleWidget(widgetName) {
  await requestWidgetUpdate({
    widgetName,
    renderWidget: () => (
      <SOSWidget sosActive={false} />
    ),
  });
}

// --- Main handler — receives widget lifecycle events ---
export async function widgetTaskHandler(props) {
  const { widgetAction, widgetName } = props;

  switch (widgetAction) {
    // --- Widget lifecycle events ---
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      await renderIdleWidget(widgetName);
      break;
    }

    case 'WIDGET_DELETED':
      // Clean up if needed
      break;

    // --- Single tap: immediately send general SOS ---
    case 'TRIGGER_GENERAL_SOS':
      await sendWidgetSOS('General');
      break;

    // --- Tapping active banner opens the app ---
    case 'OPEN_APP':
      // No-op: Android handles this via the click intent automatically
      break;

    default:
      break;
  }
}
