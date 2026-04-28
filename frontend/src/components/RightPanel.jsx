import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { db, rtdb } from '../firebase';
import { AlertCircle, Activity, Crosshair, Users } from 'lucide-react';

export default function RightPanel({ onAssignClick }) {
  const [activeSosCount, setActiveSosCount] = useState(0);
  const [unassignedResponders, setUnassignedResponders] = useState(0);
  const [criticalZones, setCriticalZones] = useState(0);
  const [recentSos, setRecentSos] = useState([]);

  useEffect(() => {
    // 1 & 4. SOS data via RTDB for instant sync with mobile app
    const uS = onValue(ref(rtdb, 'sos'), snap => {
      const data = snap.val();
      let active = 0;
      const recent = [];
      if (data) {
        Object.keys(data).forEach(k => {
          const s = data[k];
          if (s.status === 'searching' || s.status === 'routed') {
            active++;
          }
          if (s.status === 'searching') {
            recent.push({ id: k, ...s });
          }
        });
      }
      setActiveSosCount(active);
      recent.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRecentSos(recent.slice(0, 10));
    });

    // 2. Unassigned Responders (Firestore — no RTDB equivalent)
    const q2 = query(collection(db, 'responders'), where('available', '==', true));
    const u2 = onSnapshot(q2, snap => setUnassignedResponders(snap.size));

    // 3. Critical Zones (Firestore)
    const q3 = query(collection(db, 'zones'), where('confidence', '>=', 0.5));
    const u3 = onSnapshot(q3, snap => setCriticalZones(snap.size));

    return () => {
      uS(); u2(); u3();
    };
  }, []);

  return (
    <>
      <div className="counters-grid">
        <div className="counter-card glass-panel" style={{ color: 'var(--primary-red)' }}>
          <Activity size={24} style={{ marginBottom: 8 }} />
          <div className="counter-value">{activeSosCount}</div>
          <div className="counter-label">Active SOS</div>
        </div>
        <div className="counter-card glass-panel" style={{ color: 'var(--primary-blue)' }}>
          <Users size={24} style={{ marginBottom: 8 }} />
          <div className="counter-value">{unassignedResponders}</div>
          <div className="counter-label">Available</div>
        </div>
        <div className="counter-card glass-panel" style={{ color: 'var(--primary-orange)' }}>
          <Crosshair size={24} style={{ marginBottom: 8 }} />
          <div className="counter-value">{criticalZones}</div>
          <div className="counter-label">Crit Zones</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 className="section-title">
          <AlertCircle size={16} /> UNACKNOWLEDGED ALERTS
        </h3>
        
        <div className="sos-list">
          {recentSos.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 20, fontSize: 12 }}>
              No active alerts.
            </div>
          )}
          {recentSos.map(sos => (
            <div key={sos.id} className={`sos-card theme-${sos.type?.toLowerCase() || 'security'}`}>
              <div className="sos-header">
                <div className="sos-type">
                  {sos.type?.toUpperCase() || 'UNKNOWN'}
                </div>
                <div className="sos-time">
                  {new Date(sos.timestamp).toLocaleTimeString()}
                </div>
              </div>
              
              <div className="sos-info-grid">
                <div className="info-row">
                  <span>Location</span>
                  <span>{sos.lat?.toFixed(4)}, {sos.lng?.toFixed(4)}</span>
                </div>
                <div className="info-row">
                  <span>Status</span>
                  <span style={{ color: 'var(--primary-red)', fontWeight: 600 }}>{sos.status?.toUpperCase()}</span>
                </div>
              </div>

              <button className="btn-assign" onClick={() => onAssignClick(sos)}>
                ASSIGN RESPONDER
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
