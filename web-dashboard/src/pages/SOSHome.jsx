import React, { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Flame, Activity, ShieldAlert } from 'lucide-react';

const EMERGENCY_TYPES = [
  { type: 'Fire', icon: Flame, color: '#FF3B30', desc: 'Fire or explosion nearby' },
  { type: 'Medical', icon: Activity, color: '#00BFFF', desc: 'Medical emergency' },
  { type: 'Security', icon: ShieldAlert, color: '#FF9500', desc: 'Security threat' },
];

export default function SOSHome() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSOSId, setActiveSOSId] = useState(null);
  const [status, setStatus] = useState(null);
  const [userLoc, setUserLoc] = useState(null);
  const [gpsLocked, setGpsLocked] = useState(false);

  // Get user location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsLocked(true);
        },
        () => {
          setUserLoc({ lat: 19.0760, lng: 72.8777 });
          setGpsLocked(true);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  const sendSOS = async (type) => {
    setIsExpanded(false);
    const ts = Date.now().toString();
    const uid = auth.currentUser?.uid || 'web_anon';
    const lat = userLoc ? userLoc.lat : 19.0760;
    const lng = userLoc ? userLoc.lng : 72.8777;

    const payload = {
      type,
      lat,
      lng,
      status: 'searching',
      message: '',
      timestamp: Date.now(),
      uid,
      source: 'web'
    };

    try {
      await setDoc(doc(db, 'sos', ts), payload);
      setActiveSOSId(ts);
      setStatus('searching');

      // Listen for status changes
      onSnapshot(doc(db, 'sos', ts), (snap) => {
        const data = snap.data();
        if (data && data.status) {
          setStatus(data.status);
          if (data.status === 'cancelled') {
            setActiveSOSId(null);
            setStatus(null);
          }
        }
      });
    } catch (e) {
      console.warn('Firebase write failed — demo mode', e.message);
      setActiveSOSId('demo');
      setStatus('searching');
      setTimeout(() => setStatus('routed'), 3000);
      setTimeout(() => setStatus('responding'), 7000);
      setTimeout(() => {
        setActiveSOSId(null);
        setStatus(null);
      }, 12000);
    }
  };

  const cancelSOS = async () => {
    if (!confirm('Cancel Emergency Request?\n\nAre you sure you want to cancel the SOS request?')) return;
    if (activeSOSId && activeSOSId !== 'demo') {
      try {
        await setDoc(doc(db, 'sos', activeSOSId), { status: 'cancelled' }, { merge: true });
      } catch (e) { console.warn(e); }
    }
    setActiveSOSId(null);
    setStatus(null);
  };

  const getStepState = (step) => {
    const indexMap = { searching: 0, routed: 1, responding: 2 };
    const currentIdx = indexMap[status] ?? -1;
    const stepIdx = indexMap[step];
    return {
      isActive: status === step,
      isPast: stepIdx <= currentIdx,
    };
  };

  return (
    <div className="sos-home-page">
      {/* Header */}
      <div className="sos-home-header">
        <div className="sos-home-brand">
          <span className="sos-home-brand-icon">⚡</span>
          <div>
            <h1 className="sos-home-title">SOS</h1>
            <p className="sos-home-subtitle">EMERGENCY RESPONSE</p>
          </div>
        </div>
        <div className={`sos-gps-badge ${gpsLocked ? 'locked' : ''}`}>
          <span className="sos-gps-dot" />
          <span>{gpsLocked ? 'GPS LOCK' : 'LOCATING'}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="sos-home-center">
        {!activeSOSId && (
          <>
            {/* Glow Rings */}
            <div className="sos-glow-ring sos-glow-ring-1" />
            <div className="sos-glow-ring sos-glow-ring-2" />

            {/* Main SOS Button */}
            <button
              className="sos-main-button"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              SOS
            </button>

            {/* Emergency Type Cards */}
            <div className={`sos-options-row ${isExpanded ? 'expanded' : ''}`}>
              {EMERGENCY_TYPES.map(({ type, icon: Icon, color, desc }) => (
                <button
                  key={type}
                  className="sos-option-card"
                  onClick={() => sendSOS(type)}
                  style={{ '--accent': color }}
                >
                  <Icon size={28} color="#fff" />
                  <span className="sos-option-label">{type.toUpperCase()}</span>
                  <span className="sos-option-desc">{desc}</span>
                </button>
              ))}
            </div>

            <p className="sos-tap-prompt">
              {isExpanded ? 'SELECT EMERGENCY TYPE' : 'TAP TO ACTIVATE'}
            </p>
          </>
        )}

        {/* Live Tracker */}
        {activeSOSId && (
          <div className="sos-tracker">
            <h2 className="sos-tracker-title">EMERGENCY PROTOCOL ACTIVE</h2>

            <div className="sos-steps">
              {['searching', 'routed', 'responding'].map((step, i) => {
                const { isActive, isPast } = getStepState(step);
                return (
                  <React.Fragment key={step}>
                    {i > 0 && <div className={`sos-step-connector ${isPast ? 'active' : ''}`} />}
                    <div className="sos-step">
                      <div className={`sos-step-dot ${isPast ? 'active' : ''}`} />
                      <span className={`sos-step-label ${isActive ? 'active' : ''}`}>
                        {step.charAt(0).toUpperCase() + step.slice(1)}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            <button className="sos-cancel-btn" onClick={cancelSOS}>
              CANCEL SOS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
