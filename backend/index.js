const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const reportsRouter = require('./routes/reports');
const locationsRouter = require('./routes/importantLocations');

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sos_reports';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/reports', reportsRouter);
app.use('/api/locations', locationsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Connect to MongoDB then start server
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB:', MONGO_URI);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
      console.log(`📱 Mobile devices: connect to http://<your-mac-ip>:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
