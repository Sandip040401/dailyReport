// models/DailyPayment.js
import mongoose from 'mongoose';

const paymentEntrySchema = new mongoose.Schema({
  paymentDate: Date,
  paymentAmount: {
    type: Number,
    required: true,
    min: 0
  },
  pwt: {
    type: Number,
    default: 0
  },
  cash: {
    type: Number,
    default: 0
  },
  bank: {
    type: Number,
    default: 0
  },
  due: {
    type: Number,
    default: 0
  },
  tda: {
    type: Number,
    default: 0
  }
}, { _id: false });

const dailyPaymentSchema = new mongoose.Schema({
  party: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true
  },
  weekNumber: {
    type: Number,
    required: true
  },
  weekYear: {
    type: Number,
    required: true
  },
  weekStartDate: {
    type: Date,
    required: true
  },
  weekEndDate: {
    type: Date,
    required: true
  },
  // DATE-WISE payments object - Map with proper schema
  payments: {
    type: Map,
    of: paymentEntrySchema,
    default: {}
  },
  // Weekly NP data
  weeklyNP: {
    amount: {
      type: Number,
      default: 0
    },
    name: {
      type: String,
      default: ''
    }
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

dailyPaymentSchema.index({ party: 1, weekNumber: 1, weekYear: 1 }, { unique: true });

export default mongoose.model('DailyPayment', dailyPaymentSchema);
