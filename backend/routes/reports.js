const express = require('express');
const router = express.Router();
const Report = require('../models/Report');

// POST /api/reports — Create a new report
router.post('/', async (req, res) => {
  try {
    const { calamityType, locationAddress, latitude, longitude, details, reportedBy } = req.body;

    console.log('[POST /api/reports] Body received:', JSON.stringify({ calamityType, locationAddress, latitude, longitude, reportedBy }));

    // Validate required fields
    if (!calamityType || !locationAddress || latitude == null || longitude == null) {
      const missing = [];
      if (!calamityType) missing.push('calamityType');
      if (!locationAddress) missing.push('locationAddress');
      if (latitude == null) missing.push('latitude');
      if (longitude == null) missing.push('longitude');
      console.warn('[POST /api/reports] Missing fields:', missing.join(', '));
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`
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
    // By default, exclude resolved reports unless ?includeResolved=true
    if (req.query.includeResolved !== 'true') {
      filter.status = { $ne: 'Resolved' };
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
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['Reported', 'Resolved'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "Reported" or "Resolved"' });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (err) {
    console.error('PATCH /api/reports/:id/status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/admin/cleanup — Clear all stuck reports (admin only)
router.post('/admin/cleanup', async (req, res) => {
  try {
    // Resolve all active reports
    const result = await Report.updateMany(
      { status: 'Reported' },
      { status: 'Resolved' }
    );
    console.log(`[Cleanup] Resolved ${result.modifiedCount} reports`);
    res.json({
      message: 'Cleanup complete',
      resolvedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('POST /api/reports/admin/cleanup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reports/admin/clear-roadblocks — Remove all Road Blocked reports
router.delete('/admin/clear-roadblocks', async (req, res) => {
  try {
    const result = await Report.updateMany(
      { calamityType: 'Road Blocked', status: 'Reported' },
      { status: 'Resolved' }
    );
    console.log(`[Cleanup] Resolved ${result.modifiedCount} road blocked reports`);
    res.json({
      message: 'Road blocks cleared',
      resolvedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('DELETE /api/reports/admin/clear-roadblocks error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
