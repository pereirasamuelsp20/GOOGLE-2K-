import React, { useState } from 'react';
import MapPanel from './components/MapPanel';
import RightPanel from './components/RightPanel';
import AdminPanel from './components/AdminPanel';
import { Shield } from 'lucide-react';

export default function Dashboard() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [assigningSos, setAssigningSos] = useState(null);

  // assigningSos holds the SOS object if a modal is open

  return (
    <div className="dashboard-container">
      <div className="map-section">
        <MapPanel />
      </div>

      <div className="right-panel">
        <div className="header">
          <div className="brand-title">SOS COMMAND</div>
          <button className="admin-toggle" onClick={() => setIsAdminOpen(true)}>
            <Shield size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} />
            ADMIN
          </button>
        </div>

        <RightPanel onAssignClick={(sos) => setAssigningSos(sos)} />
      </div>

      {isAdminOpen && (
        <AdminPanel
          onClose={() => setIsAdminOpen(false)}
        />
      )}

      {assigningSos && (
        <div className="modal-overlay" onClick={() => setAssigningSos(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Assign Responder: {assigningSos.type}</h2>
              <button className="btn-close" onClick={() => setAssigningSos(null)}>✕</button>
            </div>
            <p style={{ color: 'var(--text-muted)' }}>
              SOS #{assigningSos.id}
            </p>
            {/* The same Responder management logic could be rendered here, but pre-filtered for assigningSos */}
            <AdminPanel isModalMode={true} targetSos={assigningSos} onClose={() => setAssigningSos(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
