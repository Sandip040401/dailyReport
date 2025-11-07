// controllers/expenseController.js
import Expense from '../models/Expense.js';
import { getWeekNumber } from '../utils/dateUtils.js';

export const createExpense = async (req, res) => {
  try {
    const { expenseName, expenseAmount, expenseDate, expenseCategory, remarks } = req.body;

    const date = new Date(expenseDate);
    const { week, year } = getWeekNumber(date);

    const expense = new Expense({
      expenseName,
      expenseAmount,
      expenseDate: date,
      expenseCategory,
      remarks,
      weekNumber: week,
      weekYear: year,
      createdBy: req.user?._id
    });

    await expense.save();

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: expense
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getExpenses = async (req, res) => {
  try {
    const { startDate, endDate, weekNumber, expenseCategory } = req.query;
    const filter = {};

    if (weekNumber) filter.weekNumber = parseInt(weekNumber);
    if (expenseCategory) filter.expenseCategory = expenseCategory;

    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(filter).sort({ expenseDate: -1 });

    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const expense = await Expense.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Expense updated successfully',
      data: expense
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findByIdAndDelete(id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
