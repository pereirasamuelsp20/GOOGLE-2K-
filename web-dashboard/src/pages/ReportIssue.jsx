import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

const API_BASE = 'http://localhost:4000/api';

const CALAMITY_OPTIONS = [
  { value: 'Earthquakes', icon: '🌍', label: 'Earthquakes' },
  { value: 'Landslides', icon: '🏔', label: 'Landslides' },
  { value: 'Power Outages', icon: '⚡', label: 'Power Outages' },
  { value: 'Fire', icon: '🔥', label: 'Fire' },
  { value: 'Road Blocked', icon: '🚧', label: 'Road Blocked' },
  { value: 'Flash Floods', icon: '🌊', label: 'Flash Floods' },
  { value: 'Car Accident', icon: '🚗', label: 'Car Accident' },
  { value: 'Building Collapse', icon: '🏗', label: 'Building Collapse' },
  { value: 'Chemical Leaks', icon: '☣', label: 'Chemical Leaks' },
];

const getCalamityIcon = (type) => {
  const found = CALAMITY_OPTIONS.find(c => c.value === type);
  return found ? found.icon : '⚠';
};

// Custom red pin icon for the map
const redPinIcon = L.divIcon({
  className: 'red-pin-icon',
  html: `<svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.716 23.284 0 15 0z" fill="#CC0000"/>
    <circle cx="15" cy="14" r="6" fill="#0D0D0D"/>
    <circle cx="15" cy="14" r="3" fill="#CC0000"/>
  </svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -42]
});

// Small report marker icon
const reportMarkerIcon = L.divIcon({
  className: 'report-marker-icon',
  html: `<div style="width:12px;height:12px;background:#CC0000;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(204,0,0,0.6);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -10]
});

// Component to recenter map
function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 14, { duration: 0.8 });
    }
  }, [lat, lng, map]);
  return null;
}

// Component to handle map clicks
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// Fetch reports from API
const fetchReports = async () => {
  const res = await fetch(`${API_BASE}/reports`);
  if (!res.ok) throw new Error('Failed to fetch reports');
  return res.json();
};

// Submit a report
const submitReport = async (payload) => {
  const res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to submit report');
  return res.json();
};

// Update report status
const updateStatus = async ({ id, status }) => {
  const res = await fetch(`${API_BASE}/reports/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
};

export default function ReportIssue() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const debounceRef = useRef(null);

  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(19.0760);
  const [lng, setLng] = useState(72.8777);
  const [pinPlaced, setPinPlaced] = useState(false);
  const [resolvedLocation, setResolvedLocation] = useState('');
  const [calamityType, setCalamityType] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [details, setDetails] = useState('');
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch reports via React Query
  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
    refetchOnWindowFocus: true,
  });

  // Submit mutation
  const mutation = useMutation({
    mutationFn: submitReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setAddress('');
      setCalamityType('');
      setDetails('');
      setPinPlaced(false);
      setResolvedLocation('');
      showToast('Report submitted successfully!', 'success');
    },
    onError: (err) => {
      showToast(`Error: ${err.message}`, 'error');
    }
  });

  // Status toggle mutation
  const statusMutation = useMutation({
    mutationFn: updateStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Forward geocode: address → lat/lng
  const geocodeAddress = useCallback((query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!query || query.length < 3) return;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
        );
        const data = await res.json();
        if (data && data.length > 0) {
          const { lat: rLat, lon: rLng, display_name } = data[0];
          setLat(parseFloat(rLat));
          setLng(parseFloat(rLng));
          setPinPlaced(true);
          extractCityState(display_name);
        }
      } catch (err) {
        console.error('Geocoding error:', err);
      }
    }, 400);
  }, []);

  // Reverse geocode: lat/lng → address
  const reverseGeocode = async (latitude, longitude) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await res.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
        extractCityState(data.display_name);
      }
    } catch (err) {
      console.error('Reverse geocoding error:', err);
    }
  };

  const extractCityState = (displayName) => {
    const parts = displayName.split(',').map(p => p.trim());
    // Try to find city and state from the parts
    if (parts.length >= 3) {
      const city = parts[parts.length - 4] || parts[0];
      const state = parts[parts.length - 3] || parts[1];
      setResolvedLocation(`${city.toUpperCase()}, ${state.toUpperCase()}`);
    } else if (parts.length >= 2) {
      setResolvedLocation(`${parts[0].toUpperCase()}, ${parts[1].toUpperCase()}`);
    } else {
      setResolvedLocation(displayName.toUpperCase());
    }
  };

  const handleAddressChange = (e) => {
    const val = e.target.value;
    setAddress(val);
    geocodeAddress(val);
  };

  const handleMapClick = (clickLat, clickLng) => {
    setLat(clickLat);
    setLng(clickLng);
    setPinPlaced(true);
    reverseGeocode(clickLat, clickLng);
  };

  const handleSubmit = () => {
    if (!calamityType) {
      showToast('Please select a calamity type', 'error');
      return;
    }
    if (!address || !pinPlaced) {
      showToast('Please enter or tap a location on the map', 'error');
      return;
    }

    mutation.mutate({
      calamityType,
      locationAddress: address,
      latitude: lat,
      longitude: lng,
      details,
      reportedBy: 'anonymous'
    });
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${mins}`;
  };

  const selectedCalamity = CALAMITY_OPTIONS.find(c => c.value === calamityType);

  return (
    <div className="report-issue-page">
      {/* Toast */}
      {toast && (
        <div className={`ri-toast ri-toast-${toast.type}`}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="ri-content">
        {/* Left: Form */}
        <div className="ri-form-section">
          {/* Header */}
          <div className="ri-header">
            <button className="ri-back-btn" onClick={() => navigate(-1)} id="report-back-btn">
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <div className="ri-sos-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#CC0000"/>
                <text x="12" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">SOS</text>
              </svg>
              <span>SOS APP</span>
            </div>
          </div>

          <h1 className="ri-title">REPORT CALAMITY</h1>

          {/* Map Section */}
          <section className="ri-section">
            <h2 className="ri-section-title">ENTER YOUR LOCATION</h2>
            <div className="ri-map-container" id="report-map">
              <MapContainer
                center={[lat, lng]}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; OpenStreetMap &copy; CARTO'
                />
                <MapClickHandler onMapClick={handleMapClick} />
                <MapRecenter lat={pinPlaced ? lat : null} lng={pinPlaced ? lng : null} />

                {pinPlaced && (
                  <Marker position={[lat, lng]} icon={redPinIcon}>
                    <Popup>
                      <span style={{ color: '#000', fontWeight: 600 }}>
                        {resolvedLocation || 'Selected Location'}
                      </span>
                    </Popup>
                  </Marker>
                )}

                {/* Existing report markers */}
                {reports.map((r) => (
                  <Marker
                    key={r._id}
                    position={[r.latitude, r.longitude]}
                    icon={reportMarkerIcon}
                  >
                    <Popup>
                      <div style={{ color: '#000' }}>
                        <strong>{getCalamityIcon(r.calamityType)} {r.calamityType}</strong><br />
                        {r.locationAddress}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {resolvedLocation && (
              <div className="ri-resolved-location">{resolvedLocation}</div>
            )}

            <div className="ri-address-input-wrap">
              <svg className="ri-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                id="report-address-input"
                type="text"
                className="ri-address-input"
                placeholder="Enter address or tap on map…"
                value={address}
                onChange={handleAddressChange}
              />
            </div>
          </section>

          {/* Calamity Dropdown */}
          <section className="ri-section">
            <h2 className="ri-section-title ri-section-title-red">CALAMITY</h2>
            <div className="ri-dropdown-wrap" ref={dropdownRef}>
              <button
                className="ri-dropdown-trigger"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                id="calamity-dropdown"
              >
                <span>
                  {selectedCalamity
                    ? `${selectedCalamity.icon} ${selectedCalamity.label}`
                    : 'SELECT CALAMITY'}
                </span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {dropdownOpen && (
                <div className="ri-dropdown-list">
                  {CALAMITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`ri-dropdown-item ${calamityType === opt.value ? 'active' : ''}`}
                      onClick={() => {
                        setCalamityType(opt.value);
                        setDropdownOpen(false);
                      }}
                    >
                      <span className="ri-dropdown-item-icon">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Additional Details */}
          <section className="ri-section">
            <h2 className="ri-section-title">ADDITIONAL DETAILS</h2>
            <textarea
              id="report-details"
              className="ri-textarea"
              placeholder="Describe the situation (optional)…"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
            />
          </section>

          {/* Submit */}
          <button
            className="ri-submit-btn"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            id="submit-report-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="white" fillOpacity="0.2"/>
              <text x="12" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">SOS</text>
            </svg>
            <span>{mutation.isPending ? 'SUBMITTING…' : 'SUBMIT REPORT'}</span>
          </button>
        </div>

        {/* Right: Reports List */}
        <div className="ri-reports-section">
          <h2 className="ri-reports-title">
            REPORTED INCIDENTS
            <span className="ri-reports-count">{reports.length}</span>
          </h2>

          {reportsLoading ? (
            <div className="ri-loading">
              <div className="ri-spinner" />
              <span>Loading reports…</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="ri-empty">
              <span style={{ fontSize: 40 }}>📋</span>
              <p>No reports yet. Be the first to report a calamity.</p>
            </div>
          ) : (
            <div className="ri-reports-list">
              {reports.map((r) => (
                <div key={r._id} className="ri-report-card" id={`report-${r._id}`}>
                  <div className="ri-report-card-header">
                    <div className="ri-report-type">
                      <span className="ri-report-icon">{getCalamityIcon(r.calamityType)}</span>
                      <span className="ri-report-type-label">{r.calamityType}</span>
                    </div>
                    <button
                      className={`ri-status-badge ${r.status === 'Resolved' ? 'resolved' : 'reported'}`}
                      onClick={() =>
                        statusMutation.mutate({
                          id: r._id,
                          status: r.status === 'Reported' ? 'Resolved' : 'Reported'
                        })
                      }
                      title="Click to toggle status"
                    >
                      {r.status}
                    </button>
                  </div>

                  <div className="ri-report-address">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span>{r.locationAddress}</span>
                  </div>

                  <div className="ri-report-coords">
                    {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                  </div>

                  {r.details && (
                    <p className="ri-report-details">{r.details}</p>
                  )}

                  <div className="ri-report-time">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>{formatDate(r.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="ri-bottom-nav">
        <a href="/dashboard" className="ri-bottom-nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>Home</span>
        </a>
        <a href="/report-issue" className="ri-bottom-nav-item active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>
          </svg>
          <span>Report</span>
        </a>
        <a href="/map" className="ri-bottom-nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <span>Activity</span>
        </a>
        <a href="#" className="ri-bottom-nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span>Account</span>
        </a>
      </nav>
    </div>
  );
}
