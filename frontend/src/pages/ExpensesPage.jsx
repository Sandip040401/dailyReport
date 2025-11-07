// src/pages/ExpensesPage.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, Filter, Calendar, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { expenseAPI } from '../lib/api';

// ============================================================================
// DATE-ONLY UTILITIES (No timezone conversions)
// ============================================================================
const pad2 = (n) => String(n).padStart(2, '0');

const fromYMD = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const dayOfWeek1to7 = (ymd) => {
  const d = fromYMD(ymd);
  const dow0 = d.getDay();
  return dow0 === 0 ? 7 : dow0;
};

// Get Monday of the week for any given date
const getWeekStart = (date) => {
  const ymd = typeof date === 'string' ? date : toYMD(date);
  const d = fromYMD(ymd);
  const dow = dayOfWeek1to7(ymd);
  d.setDate(d.getDate() - (dow - 1));
  return toYMD(d);
};

// Get Sunday (6 days after Monday)
const getWeekEnd = (mondayYmd) => {
  const d = fromYMD(mondayYmd);
  d.setDate(d.getDate() + 6);
  return toYMD(d);
};

// Format week range for display
const formatWeekRange = (startYmd, endYmd) => {
  const start = fromYMD(startYmd);
  const end = fromYMD(endYmd);
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  return `${start.toLocaleDateString('en-IN', opts)} - ${end.toLocaleDateString('en-IN', opts)}`;
};

// Format single date for display
const formatDate = (dateStr) => {
  const d = fromYMD(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Generate all 7 days (Monday to Sunday)
const generateWeekDays = (mondayYmd) => {
  const dates = [];
  const start = fromYMD(mondayYmd);
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(toYMD(date));
  }
  return dates;
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Selected week state (defaults to current week - Monday to Sunday)
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getWeekStart(new Date()));
  const selectedWeekEnd = getWeekEnd(selectedWeekStart);

  const [formData, setFormData] = useState({
    expenseName: '',
    expenseAmount: '',
    expenseDate: toYMD(new Date()),
    expenseCategory: 'OFFICE',
    remarks: ''
  });

  useEffect(() => {
    fetchExpenses();
  }, [selectedWeekStart, filterCategory]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        startDate: selectedWeekStart,
        endDate: selectedWeekEnd
      };
      if (filterCategory) params.expenseCategory = filterCategory;

      const response = await expenseAPI.getExpenses(params);
      setExpenses(response.data);
      setError('');
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.expenseName || !formData.expenseAmount) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate expense date is within selected week (date-only comparison)
    const expenseDate = formData.expenseDate;
    if (expenseDate < selectedWeekStart || expenseDate > selectedWeekEnd) {
      setError(`Expense date must be between ${formatDate(selectedWeekStart)} and ${formatDate(selectedWeekEnd)}`);
      return;
    }

    try {
      if (editingId) {
        await expenseAPI.updateExpense(editingId, formData);
      } else {
        await expenseAPI.createExpense(formData);
      }
      fetchExpenses();
      setShowModal(false);
      setEditingId(null);
      resetForm();
      setError('');
    } catch (error) {
      console.error('Error saving expense:', error);
      setError(error.message || 'Failed to save expense');
    }
  };

  const resetForm = () => {
    setFormData({
      expenseName: '',
      expenseAmount: '',
      expenseDate: selectedWeekStart, // Default to Monday
      expenseCategory: 'OFFICE',
      remarks: ''
    });
  };

  const handleEdit = (expense) => {
    setEditingId(expense._id);
    setFormData({
      expenseName: expense.expenseName,
      expenseAmount: expense.expenseAmount,
      expenseDate: expense.expenseDate.split('T')[0],
      expenseCategory: expense.expenseCategory,
      remarks: expense.remarks
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await expenseAPI.deleteExpense(id);
        fetchExpenses();
        setError('');
      } catch (error) {
        console.error('Error deleting expense:', error);
        setError('Failed to delete expense');
      }
    }
  };

  const goToPreviousWeek = () => {
    const d = fromYMD(selectedWeekStart);
    d.setDate(d.getDate() - 7);
    setSelectedWeekStart(toYMD(d));
  };

  const goToNextWeek = () => {
    const d = fromYMD(selectedWeekStart);
    d.setDate(d.getDate() + 7);
    setSelectedWeekStart(toYMD(d));
  };

  const goToCurrentWeek = () => {
    setSelectedWeekStart(getWeekStart(new Date()));
  };

  const isCurrentWeek = selectedWeekStart === getWeekStart(new Date());

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.expenseAmount, 0);

  // Calculate category-wise breakdown
  const categoryBreakdown = expenses.reduce((acc, expense) => {
    acc[expense.expenseCategory] = (acc[expense.expenseCategory] || 0) + expense.expenseAmount;
    return acc;
  }, {});

  // Group expenses by date
  const expensesByDate = expenses.reduce((acc, expense) => {
    const date = expense.expenseDate.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(expense);
    return acc;
  }, {});

  const categoryColors = {
    OFFICE: 'bg-blue-50 text-blue-700 border-blue-200',
    STAFF: 'bg-purple-50 text-purple-700 border-purple-200',
    UTILITIES: 'bg-orange-50 text-orange-700 border-orange-200',
    MAINTENANCE: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    OTHER: 'bg-gray-50 text-gray-700 border-gray-200'
  };

  const allDates = generateWeekDays(selectedWeekStart);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-black">Office Expenses</h1>
              <p className="text-sm text-gray-600">Track weekly expenses (Monday to Sunday)</p>
            </div>
            <button
              onClick={() => {
                setEditingId(null);
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium shadow-md"
            >
              <Plus className="w-5 h-5" />
              <span>Add Expense</span>
            </button>
          </div>

          {/* Week Range Selector */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-bold text-purple-700 mb-2 uppercase tracking-wider">
                  Selected Week Range (7 Days)
                </p>
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-purple-600" />
                  <span className="text-2xl font-bold text-gray-900">
                    {formatWeekRange(selectedWeekStart, selectedWeekEnd)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={goToPreviousWeek}
                  className="p-3 bg-white hover:bg-purple-50 border-2 border-purple-300 rounded-lg transition-all shadow-sm hover:shadow-md"
                  title="Previous week"
                >
                  <ChevronLeft className="w-5 h-5 text-purple-600" />
                </button>
                {!isCurrentWeek && (
                  <button
                    onClick={goToCurrentWeek}
                    className="px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
                  >
                    Current Week
                  </button>
                )}
                <button
                  onClick={goToNextWeek}
                  className="p-3 bg-white hover:bg-purple-50 border-2 border-purple-300 rounded-lg transition-all shadow-sm hover:shadow-md"
                  title="Next week"
                >
                  <ChevronRight className="w-5 h-5 text-purple-600" />
                </button>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-purple-200">
              <p className="text-sm text-purple-600 font-medium">
                📌 All expenses will be recorded for this 7-day period (Monday to Sunday). Expense dates are limited to this week.
              </p>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded text-black text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Categories</option>
              <option value="OFFICE">Office</option>
              <option value="STAFF">Staff</option>
              <option value="UTILITIES">Utilities</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">✕</button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Total Expenses */}
          <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-red-700 font-medium">Total Expenses (7 Days)</p>
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-4xl font-bold text-red-600">₹{totalExpenses.toLocaleString()}</p>
            <p className="text-xs text-red-600 mt-1">{expenses.length} transactions</p>
          </div>

          {/* Category Breakdown - Top 2 */}
          {Object.entries(categoryBreakdown)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 2)
            .map(([category, amount]) => (
              <div key={category} className="bg-white border border-gray-200 rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-2 font-medium">{category}</p>
                <p className="text-3xl font-bold text-black">₹{amount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
            ))}
        </div>

        {/* Day-wise Expense Groups */}
        <div className="space-y-4">
          {loading ? (
            <div className="p-8 text-center bg-white border border-gray-200 rounded-lg">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto"></div>
            </div>
          ) : (
            allDates.map(date => {
              const dayExpenses = expensesByDate[date] || [];
              const dayTotal = dayExpenses.reduce((sum, exp) => sum + exp.expenseAmount, 0);
              const dateObj = fromYMD(date);

              return (
                <div key={date} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {/* Date Header */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-black">
                          {dateObj.getDate()}
                        </div>
                        <div className="text-xs text-gray-600 uppercase">
                          {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-black">
                          {dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        </div>
                        <div className="text-xs text-gray-600">
                          {dayExpenses.length} expense{dayExpenses.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">
                        ₹{dayTotal.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">Day Total</div>
                    </div>
                  </div>

                  {/* Expenses for this day */}
                  {dayExpenses.length === 0 ? (
                    <div className="px-6 py-4 text-center text-gray-500 text-sm">
                      No expenses recorded
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {dayExpenses.map(expense => (
                        <div key={expense._id} className="px-6 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium border ${categoryColors[expense.expenseCategory]}`}>
                                {expense.expenseCategory}
                              </span>
                              <span className="text-sm font-medium text-black">{expense.expenseName}</span>
                            </div>
                            {expense.remarks && (
                              <div className="text-xs text-gray-600 mt-1 ml-0">{expense.remarks}</div>
                            )}
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="text-base font-bold text-red-600">
                              ₹{expense.expenseAmount.toLocaleString()}
                            </span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEdit(expense)}
                                className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(expense._id)}
                                className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {expenses.length === 0 && !loading && (
          <div className="p-8 text-center bg-white border border-gray-200 rounded-lg">
            <TrendingDown className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              No expenses recorded for this week
            </p>
            <button
              onClick={() => {
                setEditingId(null);
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Expense</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-300 shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-black">
                {editingId ? 'Edit Expense' : 'Add Expense'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError('');
                }}
                className="text-gray-600 hover:text-black text-2xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <strong>Selected Week:</strong> {formatWeekRange(selectedWeekStart, selectedWeekEnd)}
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Expense Name *</label>
                <input
                  type="text"
                  name="expenseName"
                  value={formData.expenseName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Office Supplies, Internet Bill"
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">Amount *</label>
                  <input
                    type="number"
                    name="expenseAmount"
                    value={formData.expenseAmount}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Date * <span className="text-xs text-gray-500">(Monday to Sunday)</span>
                  </label>
                  <input
                    type="date"
                    name="expenseDate"
                    value={formData.expenseDate}
                    onChange={handleInputChange}
                    required
                    min={selectedWeekStart}
                    max={selectedWeekEnd}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Category *</label>
                <select
                  name="expenseCategory"
                  value={formData.expenseCategory}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:border-emerald-500"
                >
                  <option value="OFFICE">Office</option>
                  <option value="STAFF">Staff</option>
                  <option value="UTILITIES">Utilities</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Remarks</label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Additional notes about this expense..."
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium"
                >
                  {editingId ? 'Update Expense' : 'Create Expense'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-black rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
