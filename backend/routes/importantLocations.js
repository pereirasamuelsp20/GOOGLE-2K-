const express = require('express');
const router = express.Router();

// ── Important Locations — Mumbai Emergency Infrastructure ──
// Real-world verified coordinates for Mumbai emergency services.
const IMPORTANT_LOCATIONS = [
  // ─── Hospitals (verified coordinates) ───
  { id: 'h1', name: 'KEM Hospital', type: 'hospital', lat: 19.0027, lng: 72.8422, address: 'Acharya Donde Marg, Parel, Mumbai 400012', phone: '022-24136051' },
  { id: 'h2', name: 'Lilavati Hospital', type: 'hospital', lat: 19.0509, lng: 72.8289, address: 'A-791, Bandra Reclamation, Bandra West, Mumbai 400050', phone: '022-26751000' },
  { id: 'h3', name: 'Sion Hospital', type: 'hospital', lat: 19.0404, lng: 72.8622, address: 'Dr. Babasaheb Ambedkar Road, Sion, Mumbai 400022', phone: '022-24076381' },
  { id: 'h4', name: 'JJ Hospital', type: 'hospital', lat: 18.9633, lng: 72.8340, address: 'J.J. Marg, Nagpada, Mumbai 400008', phone: '022-23735555' },
  { id: 'h5', name: 'Hinduja Hospital', type: 'hospital', lat: 19.0380, lng: 72.8440, address: 'Veer Savarkar Marg, Mahim, Mumbai 400016', phone: '022-24452222' },

  // ─── Fire Stations (verified coordinates) ───
  { id: 'f1', name: 'Byculla Fire Station', type: 'fire_station', lat: 18.9783, lng: 72.8333, address: 'Bapurao Jagtap Road, Byculla, Mumbai 400008', phone: '101' },
  { id: 'f2', name: 'Dadar Fire Station', type: 'fire_station', lat: 19.0175, lng: 72.8437, address: 'Dr. B.A. Road, Dadar East, Mumbai 400014', phone: '101' },
  { id: 'f3', name: 'Bandra Fire Station', type: 'fire_station', lat: 19.0544, lng: 72.8364, address: 'Swami Vivekanand Rd, Bandra Reclamation, Mumbai 400050', phone: '101' },
  { id: 'f4', name: 'Andheri Fire Station', type: 'fire_station', lat: 19.1197, lng: 72.8464, address: 'SV Road, Irla Bridge, Andheri West, Mumbai 400058', phone: '101' },
  { id: 'f5', name: 'Borivali Fire Station', type: 'fire_station', lat: 19.2283, lng: 72.8570, address: 'LT Road, Ashtavinayak Nagar, Borivali West, Mumbai 400091', phone: '101' },

  // ─── Police Stations (verified coordinates) ───
  { id: 'p1', name: 'Colaba Police Station', type: 'police', lat: 18.9224, lng: 72.8310, address: 'Shahid Bhagat Singh Road, Colaba, Mumbai 400005', phone: '022-22822029' },
  { id: 'p2', name: 'Bandra Police Station', type: 'police', lat: 19.0540, lng: 72.8373, address: 'Hill Road, Bandra West, Mumbai 400050', phone: '022-26422282' },
  { id: 'p3', name: 'Andheri Police Station', type: 'police', lat: 19.1186, lng: 72.8507, address: 'DN Nagar, Andheri West, Mumbai 400058', phone: '022-26302011' },
  { id: 'p4', name: 'Kurla Police Station', type: 'police', lat: 19.0724, lng: 72.8794, address: 'LBS Marg, Kurla West, Mumbai 400070', phone: '022-26501214' },
  { id: 'p5', name: 'Dadar Police Station', type: 'police', lat: 19.0150, lng: 72.8355, address: 'Senapati Bapat Marg, Dadar West, Mumbai 400028', phone: '022-24308744' },

  // ─── Shelters / BMC Relief Centres (municipal schools & community halls) ───
  { id: 's1', name: 'BMC School Shelter — Dharavi', type: 'shelter', lat: 19.0438, lng: 72.8534, address: 'Municipal School, 60 Feet Road, Dharavi, Mumbai 400017', phone: '1916' },
  { id: 's2', name: 'BMC Community Hall — Kurla', type: 'shelter', lat: 19.0726, lng: 72.8789, address: 'Nehru Nagar Community Hall, Kurla East, Mumbai 400024', phone: '022-26505109' },
  { id: 's3', name: 'BMC School Shelter — Chembur', type: 'shelter', lat: 19.0626, lng: 72.8972, address: 'Municipal School, RCF Colony, Chembur, Mumbai 400071', phone: '022-25284000' },
  { id: 's4', name: 'BMC Relief Centre — Andheri', type: 'shelter', lat: 19.1136, lng: 72.8697, address: 'Welfare Centre, MIDC, Andheri East, Mumbai 400069', phone: '022-26847000' },
  { id: 's5', name: 'BMC School Shelter — Worli', type: 'shelter', lat: 19.0127, lng: 72.8173, address: 'Municipal School, Dr. Annie Besant Rd, Worli, Mumbai 400018', phone: '022-24224000' },
];

// Haversine distance in km
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/locations — return all (optionally filter by ?type=hospital)
router.get('/', (req, res) => {
  const { type } = req.query;
  let results = IMPORTANT_LOCATIONS;
  if (type) {
    results = results.filter(l => l.type === type);
  }
  res.json(results);
});

// GET /api/locations/nearest — find nearest of a given type
// Query params: lat, lng, type (optional)
router.get('/nearest', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const { type } = req.query;

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng query parameters are required' });
  }

  let candidates = IMPORTANT_LOCATIONS;
  if (type) {
    candidates = candidates.filter(l => l.type === type);
  }

  if (candidates.length === 0) {
    return res.status(404).json({ error: 'No locations found for the given type' });
  }

  let nearest = null;
  let minDist = Infinity;
  candidates.forEach(l => {
    const d = haversine(lat, lng, l.lat, l.lng);
    if (d < minDist) {
      minDist = d;
      nearest = { ...l, distance_km: Math.round(d * 100) / 100 };
    }
  });

  res.json(nearest);
});

module.exports = router;
