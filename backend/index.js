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

// API Routes
app.use('/api/reports', reportsRouter);
app.use('/api/locations', locationsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Root route
app.get('/', (_req, res) => {
  res.send('SOS Backend is running');
});

const LOCAL_MONGO = 'mongodb://127.0.0.1:27017/sos_reports';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB:', MONGO_URI.includes('mongodb+srv') ? 'Atlas (cloud)' : 'Local');
  } catch (err) {
    console.warn('⚠️ Primary MongoDB failed:', err.message);
    if (MONGO_URI !== LOCAL_MONGO) {
      console.log('🔄 Falling back to local MongoDB...');
      try {
        await mongoose.connect(LOCAL_MONGO);
        console.log('✅ Connected to local MongoDB fallback');
      } catch (err2) {
        console.error('❌ All MongoDB connections failed:', err2.message);
        process.exit(1);
      }
    } else {
      console.error('❌ MongoDB connection failed:', err.message);
      process.exit(1);
    }
  }
}

connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend server running on port ${PORT}`);
  });
});
