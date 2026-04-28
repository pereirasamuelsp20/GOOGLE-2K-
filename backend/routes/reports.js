const express = require('express');
const router = express.Router();
const Report = require('../models/Report');

// POST /api/reports — Create a new report
router.post('/', async (req, res) => {
  try {
    const { calamityType, locationAddress, latitude, longitude, details, reportedBy } = req.body;

    // Validate required fields
    if (!calamityType || !locationAddress || latitude == null || longitude == null) {
      return res.status(400).json({
        error: 'Missing required fields: calamityType, locationAddress, latitude, longitude'
      });
    }

    const report = new Report({
      calamityType,
      locationAddress,
      latitude,
      longitude,
      details: details || '',
      reportedBy: reportedBy || 'anonymous'
    });

    const saved = await report.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('POST /api/reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports — List all reports (optionally filter by userId)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.userId) {
      filter.reportedBy = req.query.userId;
    }
    const reports = await Report.find(filter).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    console.error('GET /api/reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/:id — Get a single report
router.get('/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (err) {
    console.error('GET /api/reports/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/reports/:id/status — Update report status
// BUG 5: Only admins can toggle status to 'Resolved'
// TODO: Replace x-user-role header check with proper Firebase token verification in production
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['Reported', 'Resolved'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "Reported" or "Resolved"' });
    }

    // Server-side role enforcement: only admins can resolve reports
    const userRole = req.headers['x-user-role'] || req.body.userRole;
    if (status === 'Resolved' && userRole !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can resolve reports' });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!report) return res.status(404).json({ error: 'Report not found' });
    console.log(`[Reports] Status updated: ${req.params.id} → ${status}`);
    res.json(report);
  } catch (err) {
    console.error('PATCH /api/reports/:id/status error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
