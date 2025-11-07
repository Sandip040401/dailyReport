// models/Expense.js
import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  expenseName: {
    type: String,
    required: true
  },
  expenseAmount: {
    type: Number,
    required: true,
    min: 0
  },
  expenseDate: {
    type: Date,
    required: true
  },
  expenseCategory: {
    type: String,
    enum: ['OFFICE', 'STAFF', 'UTILITIES', 'MAINTENANCE', 'OTHER'],
    required: true
  },
  remarks: String,
  weekNumber: Number,
  weekYear: Number,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model('Expense', expenseSchema);
