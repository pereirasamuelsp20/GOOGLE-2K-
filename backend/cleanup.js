#!/usr/bin/env node
/**
 * One-time cleanup script — clears all stuck SOS marks and roadblocks
 * from Firebase (RTDB + Firestore) and MongoDB.
 *
 * Usage:  node cleanup.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sos_reports';

// Firebase RTDB REST API (no SDK needed)
const RTDB_BASE = 'https://rapid-crisis-response-94158-default-rtdb.asia-southeast1.firebasedatabase.app';

// Firebase Firestore REST API
const FIRESTORE_PROJECT = 'rapid-crisis-response-94158';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

async function cleanupMongoDB() {
  console.log('\n── MongoDB Cleanup ──');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const Report = require('./models/Report');

  // Resolve all active reports
  const allResolved = await Report.updateMany(
    { status: 'Reported' },
    { status: 'Resolved' }
  );
  console.log(`   Resolved ${allResolved.modifiedCount} active reports`);

  // Specifically log road blocked
  const roadBlocked = await Report.countDocuments({ calamityType: 'Road Blocked' });
  console.log(`   Total Road Blocked reports (now resolved): ${roadBlocked}`);

  await mongoose.disconnect();
  console.log('✅ MongoDB cleanup done');
}

async function cleanupRTDB() {
  console.log('\n── Firebase RTDB Cleanup ──');
  try {
    // First, read all SOS entries
    const readRes = await fetch(`${RTDB_BASE}/sos.json`);
    const data = await readRes.json();

    if (!data) {
      console.log('   No SOS entries found in RTDB');
      return;
    }

    const keys = Object.keys(data);
    console.log(`   Found ${keys.length} total SOS entries`);

    // Count active ones
    const active = keys.filter(k =>
      data[k].status === 'searching' ||
      data[k].status === 'routed' ||
      data[k].status === 'responding'
    );
    console.log(`   Active (stuck): ${active.length}`);

    // Delete entire SOS node (nuclear option — clears all)
    const delRes = await fetch(`${RTDB_BASE}/sos.json`, { method: 'DELETE' });
    if (delRes.ok) {
      console.log('✅ Deleted all SOS entries from RTDB');
    } else {
      console.warn('⚠️  RTDB delete returned:', delRes.status);
      // Try setting each active one to cancelled instead
      for (const key of active) {
        await fetch(`${RTDB_BASE}/sos/${key}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        });
      }
      console.log(`   Cancelled ${active.length} active SOS entries individually`);
    }
  } catch (e) {
    console.warn('⚠️  RTDB cleanup failed:', e.message);
    console.log('   You may need to clear SOS manually from the Firebase Console');
  }
}

async function cleanupFirestore() {
  console.log('\n── Firebase Firestore Cleanup ──');
  try {
    // List all SOS documents
    const sosRes = await fetch(`${FIRESTORE_BASE}/sos?pageSize=200`);
    if (sosRes.ok) {
      const sosData = await sosRes.json();
      const docs = sosData.documents || [];
      console.log(`   Found ${docs.length} SOS documents in Firestore`);

      // Delete each one
      for (const doc of docs) {
        const docPath = doc.name; // full resource path
        const delRes = await fetch(`https://firestore.googleapis.com/v1/${docPath}`, { method: 'DELETE' });
        if (!delRes.ok) {
          console.warn(`   ⚠️  Failed to delete ${docPath}: ${delRes.status}`);
        }
      }
      if (docs.length > 0) console.log(`✅ Deleted ${docs.length} SOS documents from Firestore`);
      else console.log('   No SOS documents to delete');
    } else {
      console.warn('   Could not read Firestore SOS:', sosRes.status);
    }

    // List and delete zone documents (type: blocked)
    const zonesRes = await fetch(`${FIRESTORE_BASE}/zones?pageSize=200`);
    if (zonesRes.ok) {
      const zonesData = await zonesRes.json();
      const docs = zonesData.documents || [];
      console.log(`   Found ${docs.length} zone documents in Firestore`);

      // Delete blocked zones
      let deletedZones = 0;
      for (const doc of docs) {
        const fields = doc.fields || {};
        const zoneType = fields.type?.stringValue;
        if (zoneType === 'blocked') {
          const docPath = doc.name;
          await fetch(`https://firestore.googleapis.com/v1/${docPath}`, { method: 'DELETE' });
          deletedZones++;
        }
      }
      console.log(`✅ Deleted ${deletedZones} blocked zone documents from Firestore`);
    } else {
      console.warn('   Could not read Firestore zones:', zonesRes.status);
    }
  } catch (e) {
    console.warn('⚠️  Firestore cleanup failed:', e.message);
    console.log('   Firestore REST API may require authentication.');
    console.log('   Use the web admin dashboard cleanup button instead.');
  }
}

async function main() {
  console.log('🧹 ReliefMesh Cleanup Script');
  console.log('============================');

  await cleanupMongoDB();
  await cleanupRTDB();
  await cleanupFirestore();

  console.log('\n🎉 Cleanup complete!\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
