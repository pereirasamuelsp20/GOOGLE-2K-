import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import * as geofire from 'geofire-common';

export default function AdminPanel({ isModalMode, targetSos, onClose }) {
  const [responders, setResponders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'responders'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));

      if (isModalMode && targetSos) {
        // Calculate scores
        const sosCenter = [targetSos.lat, targetSos.lng];
        
        list.forEach(r => {
          const rLat = r.lat || r.currentLocation?.latitude;
          const rLng = r.lng || r.currentLocation?.longitude;
          
          if (rLat && rLng && sosCenter[0] && sosCenter[1]) {
            const distanceKm = geofire.distanceBetween([rLat, rLng], sosCenter) || 0.001; // prevent div by zero
            r.distanceKm = distanceKm;
            
            let skillMatchWeight = 1;
            // Map types (Security->Security, Medical->Medical, Fire->Rescue)
            const typeRoleMap = {
              'Medical': 'Doctor',
              'Fire': 'Rescue',
              'Security': 'Guard'
            };
            if (r.role === typeRoleMap[targetSos.type] || r.role === targetSos.type) {
              skillMatchWeight = 2;
            } else if (r.skills && r.skills.includes(targetSos.type)) {
              skillMatchWeight = 2;
            }

            const availabilityBonus = r.available ? 1 : 0.3;
            
            r.score = (1 / distanceKm) * skillMatchWeight * availabilityBonus;
          } else {
            r.score = 0;
            r.distanceKm = Infinity;
          }
        });

        // Sort by score descending
        list.sort((a, b) => b.score - a.score);
      }

      setResponders(list);
    });
    return () => unsub();
  }, [isModalMode, targetSos]);

  const handleAssign = async (responder) => {
    if (!targetSos) return;
    setLoading(true);
    try {
      // 1. Create Assignment
      await setDoc(doc(db, 'assignments', targetSos.id), {
        sosId: targetSos.id,
        responderId: responder.id,
        timestamp: serverTimestamp(),
        status: 'assigned',
        type: targetSos.type,
        lat: targetSos.lat,
        lng: targetSos.lng,
        assignedBy: 'admin'
      });

      // 2. Update SOS Status
      await updateDoc(doc(db, 'sos', targetSos.id), {
        status: 'routed'
      });

      setLoading(false);
      onClose && onClose();
    } catch (e) {
      console.error(e);
      setLoading(false);
      alert("Error assigning: " + e.message);
    }
  };

  const content = (
    <div className="responder-list">
      {responders.map((r, index) => {
        const isTop = isModalMode && index === 0 && r.score > 0;
        return (
          <div key={r.id} className={`responder-card ${isTop ? 'top-recommendation' : ''}`}>
            <div className="responder-info">
              <div className="responder-name">
                {r.name || 'Unknown'} {isTop && <span style={{color: 'var(--primary-blue)', fontSize: 11, marginLeft: 8}}>★ TOP MATCH</span>}
              </div>
              <div className="responder-details">
                <span>{r.role}</span>
                <span style={{ color: r.available ? '#34C759' : '#FF3B30' }}>
                  {r.available ? 'AVAILABLE' : 'BUSY'}
                </span>
                {r.distanceKm !== undefined && r.distanceKm !== Infinity && (
                  <span>{r.distanceKm.toFixed(2)} km away</span>
                )}
              </div>
            </div>
            
            {isModalMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <div className="score-badge">Score: {r.score.toFixed(1)}</div>
                <button 
                  className="select-btn" 
                  onClick={() => handleAssign(r)}
                  disabled={loading}
                >
                  {loading ? '...' : 'ASSIGN'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (isModalMode) {
    return content;
  }

  // Standalone Admin Panel mode
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ width: 800 }}>
        <div className="modal-header">
          <h2 className="modal-title">Responder Management</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-grid">
          <div style={{ padding: 16 }}>
            <h3>All Responders ({responders.length})</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
              Overview of all registered field units.
            </p>
            {content}
          </div>
          <div style={{ padding: 16, borderLeft: '1px solid var(--glass-border)' }}>
            <h3>System Status</h3>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="counter-card glass-panel">
                <div className="counter-value">{responders.filter(r => r.available).length}</div>
                <div className="counter-label">Active Field Units</div>
              </div>
              <div className="counter-card glass-panel" style={{ color: 'var(--primary-red)' }}>
                <div className="counter-value">{responders.filter(r => !r.available).length}</div>
                <div className="counter-label">Currently Engaged</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
