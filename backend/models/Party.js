// models/Party.js
import mongoose from 'mongoose';

const partySchema = new mongoose.Schema({
  partyName: {
    type: String,
  },
  partyCode: {
    type: String,
  },
  partyType: {
    type: String,
    enum: ['daily', 'multiday'],
    lowercase: true
  },
  totalCollection: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  weekStartDate: {
    type: Date,
  },
  isActive: {
    type: Boolean,
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model('Party', partySchema);
