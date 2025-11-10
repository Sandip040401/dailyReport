// models/MultiDayPayment.js
import mongoose from 'mongoose';

const paymentEntrySchema = new mongoose.Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    paymentAmount: { type: Number, required: true, min: 0 },
    pwt: { type: Number, default: 0 },
    cash: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
    due: { type: Number, default: 0 },
    tda: { type: Number, default: 0 },
    bankColorStatus: { type: String, enum: ['red', 'green']}, // NEW - only for bank
  },
  { _id: false }
);

const multiDayPaymentSchema = new mongoose.Schema(
  {
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
    },

    weekNumber: { type: Number, required: true },
    weekYear: { type: Number, required: true },
    weekStartDate: { type: Date, required: true },
    weekEndDate: { type: Date, required: true },

    // RANGE-WISE payments (array of date ranges)
    paymentRanges: {
      type: [paymentEntrySchema],
      default: [],
      validate: {
        validator: function (ranges) {
          if (!this.weekStartDate || !this.weekEndDate) return false;

          // 1) each range within the week and start<=end
          for (const r of ranges) {
            if (!(r.startDate && r.endDate)) return false;
            if (r.startDate > r.endDate) return false;
            if (r.startDate < this.weekStartDate) return false;
            if (r.endDate > this.weekEndDate) return false;
          }

          // 2) no overlaps among ranges
          const sorted = [...ranges].sort(
            (a, b) => a.startDate.getTime() - b.startDate.getTime()
          );
          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            // overlap if curr.start <= prev.end
            if (curr.startDate.getTime() <= prev.endDate.getTime()) {
              return false;
            }
          }
          return true;
        },
        message:
          'Invalid payment ranges: must be within the week window and non-overlapping.',
      },
    },

    weeklyNP: {
      amount: { type: Number, default: 0 },
      name: { type: String, default: '' },
    },

    isApproved: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One document per party per week
multiDayPaymentSchema.index(
  { party: 1, weekNumber: 1, weekYear: 1 },
  { unique: true }
);

export default mongoose.model('MultiDayPayment', multiDayPaymentSchema);
