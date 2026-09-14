// src/pages/Index.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import WeeklySummary from '../components/WeeklySummary';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { getIsoWeekBoundsFromDate } from '../utils/weekRange';
import { dashboardAPI, expenseAPI } from '../lib/api';
import Loader from '../components/Loader';

const toLocalYMD = (d) => {
  if (!d) return '';
  const dateObj = new Date(d);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Index() {
  const [pickedDate, setPickedDate] = useState(new Date());
  const { weekStart, weekEnd } = useMemo(
    () => getIsoWeekBoundsFromDate(pickedDate),
    [pickedDate]
  );
  const [weeklyData, setWeeklyData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [bankTotals, setBankTotals] = useState({ greenBankTotal: 0, redBankTotal: 0 });

  // Extract fetch logic into reusable function
  const fetchWeekData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const startStr = toLocalYMD(weekStart);
      const endStr = toLocalYMD(weekEnd);

      const [paymentsRes, expensesRes] = await Promise.all([
        dashboardAPI.getRangeSummary(startStr, endStr),
        expenseAPI.getExpenses({ startDate: startStr, endDate: endStr })
      ]);

      if (paymentsRes?.success) {
        const filteredData = {
          ...paymentsRes,
          parties: paymentsRes.parties
            ?.map(party => {
              // Filter payments by date - compare year, month, day only (ignore time)
              const filteredPayments = party.payments
                ?.filter(payment => {
                  if (!payment.date) return false;
                  
                  // Extract date string (handle range format)
                  const dates = payment.date.split(/\s*[-–]\s*(?=\d{4})/);
                  const dateStr = dates[0];
                  
                  // Extract date components without timezone shift
                  const [py, pm, pd] = dateStr.split('-').map(Number);
                  const paymentDay = py * 10000 + (pm - 1) * 100 + pd;
                  
                  const startDay = weekStart.getFullYear() * 10000 + 
                                  weekStart.getMonth() * 100 + 
                                  weekStart.getDate();
                  const endDay = weekEnd.getFullYear() * 10000 + 
                                weekEnd.getMonth() * 100 + 
                                weekEnd.getDate();
                  
                  return paymentDay >= startDay && paymentDay <= endDay;
                })
                // Deduplicate by date - keep entry with highest payment amount
                .reduce((acc, payment) => {
                  const existingIdx = acc.findIndex(p => p.date === payment.date);
                  
                  if (existingIdx === -1) {
                    acc.push(payment);
                  } else if (payment.paymentAmount > acc[existingIdx].paymentAmount) {
                    // Replace with higher amount (actual payment vs zero placeholder)
                    acc[existingIdx] = payment;
                  }
                  
                  return acc;
                }, [])
                // Sort by date
                .sort((a, b) => {
                  const dateA = new Date(a.date?.split(/\s*[-–]\s*/)[0]);
                  const dateB = new Date(b.date?.split(/\s*[-–]\s*/)[0]);
                  return dateA - dateB;
                });

              return {
                ...party,
                payments: filteredPayments
              };
            })
            .filter(party => party.payments && party.payments.length > 0)
        };
        
        setWeeklyData(filteredData);
      } else {
        setWeeklyData({ parties: [] });
      }
      
      setExpenses(expensesRes?.data || []);
      setRefreshKey(prev => prev + 1);
    } catch (e) {
      console.error('Data fetch error', e);
      setError('Failed to load data');
      setWeeklyData({ parties: [] });
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and week change
  useEffect(() => {
    fetchWeekData();
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
            <div className="flex items-center justify-start md:justify-end gap-2.5 flex-wrap">
              {/* Total Bank Badges (Green & Red) */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 rounded-lg shadow-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-700">Bank (Green):</span>
                  <span className="text-sm font-bold text-emerald-800">
                    ₹{(bankTotals.greenBankTotal || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-300 rounded-lg shadow-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-xs font-semibold text-red-700">Bank (Red):</span>
                  <span className="text-sm font-bold text-red-800">
                    ₹{(bankTotals.redBankTotal || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

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
          <Loader/>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 text-center">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        ) : (
          <WeeklySummary 
            key={refreshKey}
            data={weeklyData} 
            expenses={expenses}
            onDataUpdate={fetchWeekData}
            onBankTotalsChange={setBankTotals}
          /> 
        )}
      </div>
    </div>
  );
}
