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
import { SOSConfirmWidget } from './SOSConfirmWidget';
import { FIREBASE_CONFIG } from '../src/firebaseConfig';

// --- Firebase init guard (safe for headless context) ---
function getFirebaseApp() {
  try {
    if (getApps().length === 0) {
      return initializeApp(FIREBASE_CONFIG);
    }
    return getApps()[0];
  } catch (e) {
    console.warn('Firebase init failed in widget handler:', e.message);
    return null;
  }
}

// --- Safe widget update wrapper ---
async function safeWidgetUpdate(widgetName, renderFn) {
  try {
    await requestWidgetUpdate({
      widgetName,
      renderWidget: renderFn,
    });
  } catch (e) {
    console.warn(`Widget update failed for ${widgetName}:`, e.message);
  }
}

// --- Core SOS sender ---
async function sendWidgetSOS(type) {
  const app = getFirebaseApp();
  if (!app) {
    console.warn('Firebase not available — cannot send widget SOS');
    return null;
  }

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
    uid: 'widget_anonymous',
    source: 'widget',
  };

  try {
    await setDoc(doc(db, 'sos', sosId), payload);
  } catch (e) {
    console.warn('Widget SOS DB write failed:', e.message);
  }

  // Update widget UI to active state
  await safeWidgetUpdate('SOSWidget', () => (
    <SOSWidget sosActive={true} activeType={type.toLowerCase()} />
  ));

  return sosId;
}

// --- Render idle state ---
async function renderIdleWidget(widgetName) {
  await safeWidgetUpdate(widgetName, () => (
    <SOSWidget sosActive={false} activeType={null} />
  ));
}

// --- Show confirm overlay ---
async function showConfirmWidget(widgetName, sosType) {
  await safeWidgetUpdate(widgetName, () => (
    <SOSConfirmWidget pendingType={sosType.toLowerCase()} />
  ));
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

    // --- Confirm handlers from SOSConfirmWidget ---
    case 'CONFIRM_SOS_FIRE':
      await sendWidgetSOS('Fire');
      break;

    case 'CONFIRM_SOS_MEDICAL':
      await sendWidgetSOS('Medical');
      break;

    case 'CONFIRM_SOS_SECURITY':
      await sendWidgetSOS('Security');
      break;

    case 'CANCEL_SOS':
      await renderIdleWidget(widgetName || 'SOSWidget');
      break;

    // --- Tapping active banner opens the app ---
    case 'OPEN_APP':
      // No-op: Android handles this via the click intent automatically
      break;

    default:
      break;
  }
}
