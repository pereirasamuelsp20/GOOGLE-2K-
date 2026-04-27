const express = require('express');
const router = express.Router();

// ── Important Locations — Mumbai Emergency Infrastructure ──
// Comprehensive real-world coordinates for Mumbai emergency services.
// 60+ locations covering hospitals, fire stations, police stations, and shelters.
const IMPORTANT_LOCATIONS = [
  // ════════════════════════════════════════════════════════════
  // ─── HOSPITALS (15 locations — major government & private) ──
  // ════════════════════════════════════════════════════════════
  { id: 'h1',  name: 'KEM Hospital',                  type: 'hospital', lat: 19.0027, lng: 72.8422, address: 'Acharya Donde Marg, Parel, Mumbai 400012',               phone: '022-24136051' },
  { id: 'h2',  name: 'Lilavati Hospital',              type: 'hospital', lat: 19.0509, lng: 72.8289, address: 'A-791, Bandra Reclamation, Bandra West, Mumbai 400050',   phone: '022-26751000' },
  { id: 'h3',  name: 'Sion Hospital',                  type: 'hospital', lat: 19.0404, lng: 72.8622, address: 'Dr. Babasaheb Ambedkar Road, Sion, Mumbai 400022',        phone: '022-24076381' },
  { id: 'h4',  name: 'JJ Hospital',                    type: 'hospital', lat: 18.9633, lng: 72.8340, address: 'J.J. Marg, Nagpada, Mumbai 400008',                       phone: '022-23735555' },
  { id: 'h5',  name: 'Hinduja Hospital',               type: 'hospital', lat: 19.0380, lng: 72.8440, address: 'Veer Savarkar Marg, Mahim, Mumbai 400016',                phone: '022-24452222' },
  { id: 'h6',  name: 'Nair Hospital',                  type: 'hospital', lat: 18.9886, lng: 72.8253, address: 'Dr. A.L. Nair Road, Mumbai Central, Mumbai 400008',       phone: '022-23027054' },
  { id: 'h7',  name: 'Jaslok Hospital',                type: 'hospital', lat: 18.9713, lng: 72.8078, address: '15, Dr. G Deshmukh Marg, Peddar Road, Mumbai 400026',     phone: '022-66573333' },
  { id: 'h8',  name: 'Breach Candy Hospital',          type: 'hospital', lat: 18.9721, lng: 72.8048, address: '60A, Bhulabhai Desai Road, Breach Candy, Mumbai 400026',  phone: '022-23667788' },
  { id: 'h9',  name: 'Kokilaben Dhirubhai Ambani Hospital', type: 'hospital', lat: 19.1308, lng: 72.8266, address: 'Rao Saheb Achutrao Patwardhan Marg, Four Bungalows, Andheri West, Mumbai 400053', phone: '022-30999999' },
  { id: 'h10', name: 'Holy Family Hospital',           type: 'hospital', lat: 19.0540, lng: 72.8400, address: 'St. Andrews Road, Bandra West, Mumbai 400050',            phone: '022-26442628' },
  { id: 'h11', name: 'Nanavati Super Speciality Hospital', type: 'hospital', lat: 19.0928, lng: 72.8407, address: 'S.V. Road, Vile Parle West, Mumbai 400056',          phone: '022-26267500' },
  { id: 'h12', name: 'Cooper Hospital',                type: 'hospital', lat: 19.1058, lng: 72.8371, address: 'NS Road No 7, JVPD Scheme, Juhu, Mumbai 400049',          phone: '022-26207254' },
  { id: 'h13', name: 'Hiranandani Hospital',           type: 'hospital', lat: 19.1168, lng: 72.9090, address: 'Hiranandani Gardens, Powai, Mumbai 400076',               phone: '022-25763500' },
  { id: 'h14', name: 'Wockhardt Hospital',             type: 'hospital', lat: 18.9963, lng: 72.8267, address: '1877, Dr Anandrao Nair Marg, Mumbai Central, Mumbai 400011', phone: '022-61784444' },
  { id: 'h15', name: 'Bombay Hospital',                type: 'hospital', lat: 18.9440, lng: 72.8275, address: '12, New Marine Lines, Mumbai 400020',                     phone: '022-22067676' },

  // ════════════════════════════════════════════════════════════
  // ─── FIRE STATIONS (15 locations — Mumbai Fire Brigade) ────
  // ════════════════════════════════════════════════════════════
  { id: 'f1',  name: 'Byculla Fire Station',           type: 'fire_station', lat: 18.9783, lng: 72.8333, address: 'Bapurao Jagtap Road, Byculla, Mumbai 400008',         phone: '101' },
  { id: 'f2',  name: 'Dadar Fire Station',             type: 'fire_station', lat: 19.0175, lng: 72.8437, address: 'Dr. B.A. Road, Dadar East, Mumbai 400014',            phone: '101' },
  { id: 'f3',  name: 'Bandra Fire Station',            type: 'fire_station', lat: 19.0544, lng: 72.8364, address: 'Swami Vivekanand Rd, Bandra West, Mumbai 400050',     phone: '101' },
  { id: 'f4',  name: 'Andheri Fire Station',           type: 'fire_station', lat: 19.1197, lng: 72.8464, address: 'SV Road, Irla Bridge, Andheri West, Mumbai 400058',   phone: '101' },
  { id: 'f5',  name: 'Borivali Fire Station',          type: 'fire_station', lat: 19.2283, lng: 72.8570, address: 'LT Road, Ashtavinayak Nagar, Borivali West, Mumbai 400091', phone: '101' },
  { id: 'f6',  name: 'Colaba Fire Station',            type: 'fire_station', lat: 18.9170, lng: 72.8265, address: 'Shahid Bhagat Singh Road, Colaba, Mumbai 400039',     phone: '101' },
  { id: 'f7',  name: 'Fort Fire Station (HQ)',         type: 'fire_station', lat: 18.9388, lng: 72.8352, address: '69, Bora Bazaar Street, Fort, Mumbai 400001',         phone: '022-22630592' },
  { id: 'f8',  name: 'Worli Fire Station',             type: 'fire_station', lat: 19.0125, lng: 72.8155, address: 'Dr Annie Besant Road, Worli, Mumbai 400018',          phone: '101' },
  { id: 'f9',  name: 'Parel Fire Station',             type: 'fire_station', lat: 19.0005, lng: 72.8402, address: 'Dr. E Moses Road, Parel, Mumbai 400012',              phone: '101' },
  { id: 'f10', name: 'Malad Fire Station',             type: 'fire_station', lat: 19.1863, lng: 72.8487, address: 'SV Road, Malad West, Mumbai 400064',                  phone: '101' },
  { id: 'f11', name: 'Goregaon Fire Station',          type: 'fire_station', lat: 19.1559, lng: 72.8491, address: 'SV Road, Goregaon West, Mumbai 400062',               phone: '101' },
  { id: 'f12', name: 'Wadala Fire Station',            type: 'fire_station', lat: 19.0178, lng: 72.8652, address: 'Antop Hill, Wadala, Mumbai 400037',                    phone: '101' },
  { id: 'f13', name: 'Mulund Fire Station',            type: 'fire_station', lat: 19.1726, lng: 72.9564, address: 'LBS Marg, Mulund West, Mumbai 400080',                phone: '101' },
  { id: 'f14', name: 'Ghatkopar Fire Station',         type: 'fire_station', lat: 19.0868, lng: 72.9081, address: 'LBS Road, Ghatkopar West, Mumbai 400086',             phone: '101' },
  { id: 'f15', name: 'Chembur Fire Station',           type: 'fire_station', lat: 19.0626, lng: 72.8969, address: 'Sion-Trombay Road, Chembur, Mumbai 400071',           phone: '101' },

  // ════════════════════════════════════════════════════════════
  // ─── POLICE STATIONS (15 locations — Mumbai Police) ────────
  // ════════════════════════════════════════════════════════════
  { id: 'p1',  name: 'Colaba Police Station',          type: 'police', lat: 18.9224, lng: 72.8310, address: 'Shahid Bhagat Singh Road, Colaba, Mumbai 400005',            phone: '022-22822029' },
  { id: 'p2',  name: 'Bandra Police Station',          type: 'police', lat: 19.0540, lng: 72.8373, address: 'Hill Road, Bandra West, Mumbai 400050',                     phone: '022-26422282' },
  { id: 'p3',  name: 'Andheri Police Station',         type: 'police', lat: 19.1186, lng: 72.8507, address: 'DN Nagar, Andheri West, Mumbai 400058',                     phone: '022-26302011' },
  { id: 'p4',  name: 'Kurla Police Station',           type: 'police', lat: 19.0724, lng: 72.8794, address: 'LBS Marg, Kurla West, Mumbai 400070',                       phone: '022-26501214' },
  { id: 'p5',  name: 'Dadar Police Station',           type: 'police', lat: 19.0150, lng: 72.8355, address: 'Senapati Bapat Marg, Dadar West, Mumbai 400028',            phone: '022-24308744' },
  { id: 'p6',  name: 'Marine Drive Police Station',    type: 'police', lat: 18.9432, lng: 72.8233, address: 'Netaji Subhash Chandra Bose Road, Marine Lines, Mumbai 400002', phone: '022-22621855' },
  { id: 'p7',  name: 'Juhu Police Station',            type: 'police', lat: 19.1030, lng: 72.8275, address: 'Juhu Tara Road, Juhu, Mumbai 400049',                       phone: '022-26186970' },
  { id: 'p8',  name: 'Powai Police Station',           type: 'police', lat: 19.1198, lng: 72.9055, address: 'Hiranandani Gardens, Powai, Mumbai 400076',                 phone: '022-25700045' },
  { id: 'p9',  name: 'Chembur Police Station',         type: 'police', lat: 19.0577, lng: 72.8980, address: 'RC Marg, Chembur, Mumbai 400071',                           phone: '022-25220076' },
  { id: 'p10', name: 'Borivali Police Station',        type: 'police', lat: 19.2290, lng: 72.8565, address: 'SV Road, Borivali West, Mumbai 400091',                     phone: '022-28902525' },
  { id: 'p11', name: 'Malad Police Station',           type: 'police', lat: 19.1870, lng: 72.8478, address: 'SV Road, Malad West, Mumbai 400064',                        phone: '022-28814949' },
  { id: 'p12', name: 'Goregaon Police Station',        type: 'police', lat: 19.1555, lng: 72.8500, address: 'SV Road, Goregaon West, Mumbai 400062',                     phone: '022-28741950' },
  { id: 'p13', name: 'Worli Police Station',           type: 'police', lat: 19.0100, lng: 72.8160, address: 'Dr Annie Besant Road, Worli, Mumbai 400018',                phone: '022-24930636' },
  { id: 'p14', name: 'Ghatkopar Police Station',       type: 'police', lat: 19.0860, lng: 72.9075, address: 'MG Road, Ghatkopar East, Mumbai 400077',                    phone: '022-25013614' },
  { id: 'p15', name: 'Mulund Police Station',          type: 'police', lat: 19.1720, lng: 72.9555, address: 'LBS Marg, Mulund West, Mumbai 400080',                      phone: '022-25630056' },

  // ════════════════════════════════════════════════════════════
  // ─── SHELTERS / RELIEF CENTRES (15 locations) ──────────────
  // BMC municipal schools, community halls, and designated relief centres
  // ════════════════════════════════════════════════════════════
  { id: 's1',  name: 'BMC School Shelter — Dharavi',         type: 'shelter', lat: 19.0438, lng: 72.8534, address: 'Municipal School, 60 Feet Road, Dharavi, Mumbai 400017',   phone: '1916' },
  { id: 's2',  name: 'BMC Community Hall — Kurla',           type: 'shelter', lat: 19.0726, lng: 72.8789, address: 'Nehru Nagar Community Hall, Kurla East, Mumbai 400024',    phone: '022-26505109' },
  { id: 's3',  name: 'BMC School Shelter — Chembur',         type: 'shelter', lat: 19.0626, lng: 72.8972, address: 'Municipal School, RCF Colony, Chembur, Mumbai 400071',     phone: '022-25284000' },
  { id: 's4',  name: 'BMC Relief Centre — Andheri East',     type: 'shelter', lat: 19.1136, lng: 72.8697, address: 'Welfare Centre, MIDC, Andheri East, Mumbai 400069',        phone: '022-26847000' },
  { id: 's5',  name: 'BMC School Shelter — Worli',           type: 'shelter', lat: 19.0127, lng: 72.8173, address: 'Municipal School, Dr. Annie Besant Rd, Worli, Mumbai 400018', phone: '022-24224000' },
  { id: 's6',  name: 'NDRF Staging Area — Colaba',           type: 'shelter', lat: 18.9270, lng: 72.8320, address: 'Navy Nagar, Colaba, Mumbai 400005',                        phone: '011-26107953' },
  { id: 's7',  name: 'BMC Disaster Shelter — Bandra East',   type: 'shelter', lat: 19.0590, lng: 72.8480, address: 'BMC Ward H-East Office, Bandra East, Mumbai 400051',       phone: '022-26559900' },
  { id: 's8',  name: 'BMC Relief Centre — Sion',             type: 'shelter', lat: 19.0410, lng: 72.8610, address: 'Municipal School, Sion Koliwada, Mumbai 400022',            phone: '1916' },
  { id: 's9',  name: 'BMC Community Hall — Borivali',        type: 'shelter', lat: 19.2300, lng: 72.8560, address: 'Shimpoli Community Hall, Borivali West, Mumbai 400092',     phone: '1916' },
  { id: 's10', name: 'BMC Relief Centre — Malad',            type: 'shelter', lat: 19.1880, lng: 72.8490, address: 'BMC Ward P-North Office, Malad West, Mumbai 400064',        phone: '022-28816060' },
  { id: 's11', name: 'BMC School Shelter — Goregaon',        type: 'shelter', lat: 19.1565, lng: 72.8495, address: 'Municipal School, SV Road, Goregaon West, Mumbai 400062',   phone: '1916' },
  { id: 's12', name: 'Azad Maidan Relief Camp',              type: 'shelter', lat: 18.9408, lng: 72.8330, address: 'Azad Maidan, CST Area, Fort, Mumbai 400001',                phone: '1916' },
  { id: 's13', name: 'BMC School Shelter — Mulund',          type: 'shelter', lat: 19.1730, lng: 72.9560, address: 'Municipal School, LBS Marg, Mulund West, Mumbai 400080',    phone: '1916' },
  { id: 's14', name: 'BMC Relief Centre — Ghatkopar',        type: 'shelter', lat: 19.0870, lng: 72.9085, address: 'BMC Ward N Office, Ghatkopar East, Mumbai 400077',          phone: '022-25006011' },
  { id: 's15', name: 'BMC Flood Shelter — Matunga',          type: 'shelter', lat: 19.0270, lng: 72.8530, address: 'Ruia College Ground, Matunga, Mumbai 400019',               phone: '1916' },

  // ═══ ADDITIONAL HOSPITALS ═══
  { id: 'h16', name: 'Tata Memorial Hospital',          type: 'hospital', lat: 19.0042, lng: 72.8432, address: 'Dr. E Borges Road, Parel, Mumbai 400012',              phone: '022-24177000' },
  { id: 'h17', name: 'Fortis Hospital Mulund',           type: 'hospital', lat: 19.1750, lng: 72.9510, address: 'Mulund Goregaon Link Rd, Mulund West, Mumbai 400078',  phone: '022-68578888' },
  { id: 'h18', name: 'SevenHills Hospital',              type: 'hospital', lat: 19.1440, lng: 72.8700, address: 'Marol Maroshi Road, Andheri East, Mumbai 400059',      phone: '022-67676767' },
  { id: 'h19', name: 'Saifee Hospital',                  type: 'hospital', lat: 18.9600, lng: 72.8170, address: '15/17, Maharshi Karve Marg, Charni Road, Mumbai 400004', phone: '022-67570111' },
  { id: 'h20', name: 'Global Hospital',                  type: 'hospital', lat: 19.0010, lng: 72.8380, address: '35, Dr E Moses Road, Parel, Mumbai 400012',            phone: '022-67670101' },
  { id: 'h21', name: 'Raheja Hospital',                  type: 'hospital', lat: 19.0371, lng: 72.8427, address: 'Western Express Highway, Mahim, Mumbai 400016',        phone: '022-66529999' },
  { id: 'h22', name: 'S L Raheja Hospital',              type: 'hospital', lat: 19.0371, lng: 72.8427, address: 'Raheja Rugnalaya Marg, Mahim West, Mumbai 400016',     phone: '022-66529999' },
  { id: 'h23', name: 'Masina Hospital',                  type: 'hospital', lat: 18.9960, lng: 72.8262, address: 'Sant Savta Marg, Byculla, Mumbai 400008',              phone: '022-23714000' },
  { id: 'h24', name: 'Criticare Hospital',               type: 'hospital', lat: 19.1190, lng: 72.8510, address: 'Plot 711, Andheri West, Mumbai 400058',                phone: '022-67919191' },
  { id: 'h25', name: 'Surya Hospital',                   type: 'hospital', lat: 19.0560, lng: 72.8310, address: 'Mangaldas Road, Santacruz West, Mumbai 400054',        phone: '022-26102924' },

  // ═══ ADDITIONAL FIRE STATIONS ═══
  { id: 'f16', name: 'Kandivali Fire Station',           type: 'fire_station', lat: 19.2040, lng: 72.8525, address: 'Mahavir Nagar, Kandivali West, Mumbai 400067',     phone: '101' },
  { id: 'f17', name: 'Vikhroli Fire Station',            type: 'fire_station', lat: 19.1100, lng: 72.9280, address: 'LBS Marg, Vikhroli West, Mumbai 400079',          phone: '101' },
  { id: 'f18', name: 'Sion Fire Station',                type: 'fire_station', lat: 19.0420, lng: 72.8630, address: 'Sion Road, Sion, Mumbai 400022',                  phone: '101' },
  { id: 'f19', name: 'Matunga Fire Station',             type: 'fire_station', lat: 19.0270, lng: 72.8500, address: 'Dr. Baba Saheb Ambedkar Rd, Matunga, Mumbai',     phone: '101' },
  { id: 'f20', name: 'Santacruz Fire Station',           type: 'fire_station', lat: 19.0830, lng: 72.8380, address: 'Linking Road, Santacruz West, Mumbai 400054',     phone: '101' },
  { id: 'f21', name: 'Jogeshwari Fire Station',          type: 'fire_station', lat: 19.1360, lng: 72.8490, address: 'SV Road, Jogeshwari West, Mumbai 400060',         phone: '101' },
  { id: 'f22', name: 'Kurla Fire Station',               type: 'fire_station', lat: 19.0700, lng: 72.8790, address: 'LBS Marg, Kurla West, Mumbai 400070',            phone: '101' },
  { id: 'f23', name: 'Powai Fire Station',               type: 'fire_station', lat: 19.1200, lng: 72.9050, address: 'Hiranandani Gardens, Powai, Mumbai 400076',      phone: '101' },

  // ═══ ADDITIONAL POLICE STATIONS ═══
  { id: 'p16', name: 'Santacruz Police Station',         type: 'police', lat: 19.0820, lng: 72.8390, address: 'Linking Road, Santacruz West, Mumbai 400054',            phone: '022-26492351' },
  { id: 'p17', name: 'Vikhroli Police Station',          type: 'police', lat: 19.1110, lng: 72.9270, address: 'LBS Marg, Vikhroli West, Mumbai 400079',                phone: '022-25783014' },
  { id: 'p18', name: 'Kandivali Police Station',         type: 'police', lat: 19.2050, lng: 72.8520, address: 'Mahavir Nagar, Kandivali West, Mumbai 400067',           phone: '022-28073900' },
  { id: 'p19', name: 'Jogeshwari Police Station',        type: 'police', lat: 19.1365, lng: 72.8495, address: 'SV Road, Jogeshwari West, Mumbai 400060',               phone: '022-26781241' },
  { id: 'p20', name: 'Wadala Police Station',            type: 'police', lat: 19.0180, lng: 72.8650, address: 'Antop Hill, Wadala East, Mumbai 400037',                 phone: '022-24161010' },
  { id: 'p21', name: 'Sion Police Station',              type: 'police', lat: 19.0400, lng: 72.8620, address: 'Sion Main Road, Sion, Mumbai 400022',                    phone: '022-24076111' },
  { id: 'p22', name: 'Matunga Police Station',           type: 'police', lat: 19.0260, lng: 72.8520, address: 'Matunga Road, Matunga, Mumbai 400019',                   phone: '022-24143476' },
  { id: 'p23', name: 'Dharavi Police Station',           type: 'police', lat: 19.0440, lng: 72.8540, address: '60 Feet Road, Dharavi, Mumbai 400017',                   phone: '022-24048013' },

  // ═══ ADDITIONAL SHELTERS ═══
  { id: 's16', name: 'BMC Relief Centre — Kandivali',    type: 'shelter', lat: 19.2060, lng: 72.8530, address: 'BMC Ward R-South, Kandivali West, Mumbai 400067',       phone: '1916' },
  { id: 's17', name: 'BMC School Shelter — Vikhroli',    type: 'shelter', lat: 19.1105, lng: 72.9275, address: 'Municipal School, Vikhroli East, Mumbai 400083',        phone: '1916' },
  { id: 's18', name: 'Jogeshwari Community Hall',        type: 'shelter', lat: 19.1355, lng: 72.8485, address: 'Community Hall, Jogeshwari West, Mumbai 400060',        phone: '1916' },
  { id: 's19', name: 'BMC School Shelter — Santacruz',   type: 'shelter', lat: 19.0825, lng: 72.8395, address: 'Municipal School, Santacruz West, Mumbai 400054',      phone: '1916' },
  { id: 's20', name: 'Oval Maidan Relief Camp',          type: 'shelter', lat: 18.9330, lng: 72.8290, address: 'Oval Maidan, Churchgate, Mumbai 400020',                phone: '1916' },
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
