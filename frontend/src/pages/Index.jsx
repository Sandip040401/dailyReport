// src/pages/Index.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import WeeklySummary from '../components/WeeklySummary';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { getIsoWeekBoundsFromDate } from '../utils/weekRange';
import { dashboardAPI, expenseAPI } from '../lib/api'; // Add expenseAPI

const toISO = (d) => d.toISOString().slice(0, 10);

export default function Index() {
  const [pickedDate, setPickedDate] = useState(new Date());
  const { weekStart, weekEnd } = useMemo(
    () => getIsoWeekBoundsFromDate(pickedDate),
    [pickedDate]
  );
  const [weeklyData, setWeeklyData] = useState(null);
  const [expenses, setExpenses] = useState([]); // NEW: Store expenses
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);

useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch both payments and expenses
      const [paymentsRes, expensesRes] = await Promise.all([
        dashboardAPI.getRangeSummary(weekStart, weekEnd),
        expenseAPI.getExpenses({ startDate: weekStart, endDate: weekEnd })
      ]);

      if (!cancelled) {
        if (paymentsRes?.success) {
          // Filter and sort payments for current week only
          const filteredData = {
            ...paymentsRes,
            parties: paymentsRes.parties?.map(party => ({
              ...party,
              payments: party.payments
                ?.filter(payment => {
                  // Filter: only payments within the week range
                  if (!payment.date) return false;
                  
                  // Handle multi-date format (e.g., "2025-11-10 - 2025-11-12")
                  const dates = payment.date.split(/\s*[-–]\s*(?=\d{4})/);
                  const paymentDate = new Date(dates[0]);
                  const weekStartDate = new Date(weekStart);
                  const weekEndDate = new Date(weekEnd);
                  
                  return paymentDate >= weekStartDate && paymentDate <= weekEndDate;
                })
                .sort((a, b) => {
                  // Sort by date ascending
                  const dateA = new Date(a.date?.split(/\s*[-–]\s*/)[0] || 0);
                  const dateB = new Date(b.date?.split(/\s*[-–]\s*/)[0] || 0);
                  return dateA - dateB;
                })
            }))
            .filter(party => party.payments && party.payments.length > 0) // Remove parties with no payments
          };
          
          setWeeklyData(filteredData);
        } else {
          setWeeklyData({ parties: [] });
        }
        
        // Set expenses data (already filtered by API)
        setExpenses(expensesRes?.data || []);
      }
    } catch (e) {
      if (!cancelled) {
        console.error('Data fetch error', e);
        setError('Failed to load data');
        setWeeklyData({ parties: [] });
        setExpenses([]);
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [weekStart, weekEnd]);

  const jumpByDays = (days) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + days);
    setPickedDate(next);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Title */}
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 truncate">Payment Manager</h1>
                <p className="text-sm text-gray-600">
                  {format(weekStart, 'dd MMM yyyy')} — {format(weekEnd, 'dd MMM yyyy')} (Mon–Sun)
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-start md:justify-end gap-3">
              <button
                onClick={() => jumpByDays(-7)}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                ← Previous Week
              </button>
              <button
                onClick={() => setPickedDate(new Date())}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium shadow-md transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => jumpByDays(7)}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Next Week →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Loading data...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 text-center">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        ) : (
          <WeeklySummary data={weeklyData} expenses={expenses} /> 
        )}
      </div>
    </div>
  );
}
