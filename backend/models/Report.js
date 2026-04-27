const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  calamityType: {
    type: String,
    required: true,
    enum: [
      'Earthquakes',
      'Landslides',
      'Power Outages',
      'Fire',
      'Road Blocked',
      'Flash Floods',
      'Car Accident',
      'Building Collapse',
      'Chemical Leaks'
    ]
  },
  locationAddress: {
    type: String,
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  reportedBy: {
    type: String,
    default: 'anonymous'
  },
  status: {
    type: String,
    enum: ['Reported', 'Resolved'],
    default: 'Reported'
  }
}, {
  timestamps: true // auto createdAt + updatedAt
});

module.exports = mongoose.model('Report', reportSchema);
