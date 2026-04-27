const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const reportsRouter = require('./routes/reports');
const locationsRouter = require('./routes/importantLocations');

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sos_reports';

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/reports', reportsRouter);
app.use('/api/locations', locationsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── Production: serve the built frontend ──
// After running `npm run build` in the frontend folder, the compiled
// static files live in ../frontend/dist.  In production the Express
// server serves them so you only need a single process.
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// For any non-API route, send back index.html (SPA client-side routing)
app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Connect to MongoDB then start server
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB:', MONGO_URI);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
      console.log(`📱 Mobile devices: connect to http://<your-ip>:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
