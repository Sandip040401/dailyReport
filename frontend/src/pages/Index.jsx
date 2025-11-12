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

const toISO = (d) => d.toISOString().slice(0, 10);

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
  const [showCalendar, setShowCalendar] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // NEW: Force re-render key

  // Extract fetch logic into reusable function
// In the fetchWeekData function, right after Promise.all
const fetchWeekData = async () => {
  try {
    setLoading(true);
    setError(null);
    
    const [paymentsRes, expensesRes] = await Promise.all([
      dashboardAPI.getRangeSummary(weekStart, weekEnd),
      expenseAPI.getExpenses({ startDate: weekStart, endDate: weekEnd })
    ]);

    // ✅ LOG 1: Raw API Response
    console.log('═══ RAW API RESPONSE ═══');
    console.log('Week Range:', { weekStart, weekEnd });
    console.log('Total parties from API:', paymentsRes?.parties?.length);
    console.log('Raw parties data:', JSON.stringify(paymentsRes?.parties, null, 2));
    
    // Count total payments before filtering
    const totalPaymentsBefore = paymentsRes?.parties?.reduce(
      (sum, party) => sum + (party.payments?.length || 0), 
      0
    );
    console.log('Total payments BEFORE filtering:', totalPaymentsBefore);

    if (paymentsRes?.success) {
      const filteredData = {
        ...paymentsRes,
        parties: paymentsRes.parties?.map(party => {
          // ✅ LOG 2: Per-party processing
          console.log(`\n--- Processing Party: ${party.partyName} (${party.partyCode}) ---`);
          console.log('Original payments count:', party.payments?.length);
          console.log('Original payments:', party.payments?.map(p => ({
            date: p.date,
            amount: p.paymentAmount,
            type: p.type
          })));

          const filteredPayments = party.payments?.filter(payment => {
            if (!payment.date) {
              console.log('❌ Payment filtered: NO DATE', payment);
              return false;
            }

            const dates = payment.date.split(/\s*[-–]\s*(?=\d{4})/);
            const paymentDate = new Date(dates[0]);
            const weekStartDate = new Date(weekStart);
            const weekEndDate = new Date(weekEnd);

            // ✅ LOG 3: Date comparison for each payment
            const isInRange = paymentDate >= weekStartDate && paymentDate <= weekEndDate;
            console.log('Payment date check:', {
              paymentDate: paymentDate.toISOString(),
              weekStartDate: weekStartDate.toISOString(),
              weekEndDate: weekEndDate.toISOString(),
              isInRange,
              amount: payment.paymentAmount,
              type: payment.type
            });

            return isInRange;
          });

          console.log('Filtered payments count:', filteredPayments?.length);
          console.log('Filtered payments:', filteredPayments?.map(p => ({
            date: p.date,
            amount: p.paymentAmount,
            type: p.type
          })));

          return {
            ...party,
            payments: filteredPayments?.sort((a, b) => {
              const dateA = new Date(a.date?.split(/\s*[-–]\s*/)[0] || 0);
              const dateB = new Date(b.date?.split(/\s*[-–]\s*/)[0] || 0);
              return dateA - dateB;
            })
          };
        }).filter(party => party.payments && party.payments.length > 0)
      };

      // ✅ LOG 4: After filtering
      console.log('\n═══ AFTER FILTERING ═══');
      console.log('Parties with payments:', filteredData.parties?.length);
      const totalPaymentsAfter = filteredData.parties?.reduce(
        (sum, party) => sum + (party.payments?.length || 0), 
        0
      );
      console.log('Total payments AFTER filtering:', totalPaymentsAfter);
      console.log('Filtered data structure:', JSON.stringify(filteredData.parties, null, 2));

      setWeeklyData(filteredData);
    } else {
      setWeeklyData({ parties: [] });
    }
    
    // ✅ LOG 5: Expenses
    console.log('\n═══ EXPENSES DATA ═══');
    console.log('Expenses count:', expensesRes?.data?.length);
    console.log('Expenses:', expensesRes?.data);
    
    setExpenses(expensesRes?.data);
    setRefreshKey(prev => prev + 1);
  } catch (e) {
    console.error('❌ Data fetch error:', e);
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
          <Loader/>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 text-center">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        ) : (
          <WeeklySummary 
            key={refreshKey}  // Force unmount/remount on data update
            data={weeklyData} 
            expenses={expenses}
            onDataUpdate={fetchWeekData}  // Pass callback to child
          /> 
        )}
      </div>
    </div>
  );
}
