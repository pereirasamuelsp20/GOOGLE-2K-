const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Ensure we initialize without credentials config if deploying normally, 
// or with standard admin if available.
admin.initializeApp();

// Haversine Distance Formula (km)
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

exports.escalationCheck = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  const db = admin.firestore();
  const rtdb = admin.database();

  const now = Date.now();
  // 60 seconds ago cutoff
  const cutoff = now - 60000;

  // Query Realtime Database for all SOS entries
  const sosSnap = await rtdb.ref('sos').once('value');
  const sosData = sosSnap.val();

  if (!sosData) return null;

  // Filter for stale 'searching'
  const staleSosList = [];
  Object.keys(sosData).forEach(key => {
    const sos = sosData[key];
    if (sos.status === 'searching' && sos.createdAt < cutoff) {
      staleSosList.push({ id: key, ...sos });
    }
  });

  if (staleSosList.length === 0) {
    console.log("No stale SOS found.");
    return null;
  }

  // Fetch all available responders (could be large, ideally index or cache, but fine for Spark plan size)
  const respondersSnap = await db.collection('responders').where('available', '==', true).get();
  const responders = [];
  respondersSnap.forEach(doc => {
    const d = doc.data();
    if (d.lat && d.lng) {
      responders.push({ id: doc.id, lat: d.lat, lng: d.lng, ...d });
    } else if (d.currentLocation) {
      responders.push({ id: doc.id, lat: d.currentLocation.latitude, lng: d.currentLocation.longitude, ...d });
    }
  });

  // Process each stale SOS
  for (const sos of staleSosList) {
    let nearestResponder = null;
    let minDistance = Infinity;

    // Find nearest
    for (const r of responders) {
      const dist = getDistance(sos.lat, sos.lng, r.lat, r.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestResponder = r;
      }
    }

    // 5km threshold
    if (nearestResponder && minDistance <= 5) {
      // Write to assignments
      await db.collection('assignments').doc(sos.id).set({
        sosId: sos.id,
        responderId: nearestResponder.id,
        responderName: nearestResponder.name,
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        distanceKm: minDistance
      });

      // Update SOS status in RTDB
      await rtdb.ref(`sos/${sos.id}`).update({
        status: 'routed',
        responderId: nearestResponder.id
      });
      
      console.log(`SOS ${sos.id} successfully assigned to ${nearestResponder.id} via auto-escalation.`);
    } else {
      // No responder within 5km -> Escalate
      await db.collection('escalations').doc(sos.id).set({
        sosId: sos.id,
        lat: sos.lat,
        lng: sos.lng,
        type: sos.type,
        escalatedAt: admin.firestore.FieldValue.serverTimestamp(),
        reason: 'No responder within 5km'
      });

      // Update SOS status in RTDB
      await rtdb.ref(`sos/${sos.id}`).update({
        status: 'escalated'
      });
      
      console.log(`SOS ${sos.id} escalated to Admin channel (No responders < 5km).`);
    }
  }

  return null;
});

// Maintain the zone report logic
exports.onReportWritten = functions.firestore.document('reports/{reportId}').onWrite(async (change, context) => {
  if (!change.after.exists) return null;
  const data = change.after.data();
  const latField = data.lat || data.location?.latitude;
  const lngField = data.lng || data.location?.longitude;

  if (!latField || !lngField) return null;

  const db = admin.firestore();
  
  // Find a zone within 200m
  const zonesSnap = await db.collection('zones').get();
  let existingZone = null;

  zonesSnap.forEach(doc => {
    const z = doc.data();
    if (z.center) {
      const dist = getDistance(latField, lngField, z.center.lat, z.center.lng) * 1000;
      if (dist <= 200) {
        existingZone = { id: doc.id, ref: doc.ref, data: z };
      }
    }
  });

  if (existingZone) {
    const currentVotes = (existingZone.data.votes || 1) + 1;
    const confidence = Math.min(currentVotes / 5, 1.0);
    
    await existingZone.ref.update({
      votes: currentVotes,
      confidence,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } else {
    // create a new one
    await db.collection('zones').add({
      votes: 1,
      confidence: 0.2,
      center: { lat: latField, lng: lngField },
      radius: 200,
      type: 'blocked',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
});

// Purge old zones (older than 4h) physically to save space, even though frontend hides them
exports.cleanupStaleZones = functions.pubsub.schedule('every 30 minutes').onRun(async (context) => {
  const db = admin.firestore();
  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);

  const snapshot = await db.collection('zones').where('updatedAt', '<', cutoff).get();

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  if (snapshot.size > 0) {
    await batch.commit();
    console.log(`Deleted ${snapshot.size} stale zones from Firestore.`);
  }
  return null;
});
