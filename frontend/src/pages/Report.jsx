// src/pages/Report.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, IndianRupee, Banknote, Wallet, PiggyBank, TrendingUp, Calculator, Receipt, Coins, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { dashboardAPI, expenseAPI } from '../lib/api';


// ============================================================================
// DATE-ONLY UTILITIES (No timezone conversions) - COPIED FROM ExpensesPage.jsx
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


export const Report = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Selected week state (defaults to current week - Monday to Sunday)
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getWeekStart(new Date()));
  const selectedWeekEnd = getWeekEnd(selectedWeekStart);

  const [weeklyData, setWeeklyData] = useState(null);

  useEffect(() => {
    fetchData();
  }, [selectedWeekStart]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {
        startDate: selectedWeekStart,
        endDate: selectedWeekEnd
      };

      const [paymentsRes, expensesRes] = await Promise.all([
        dashboardAPI.getRangeSummary(selectedWeekStart, selectedWeekEnd),
        expenseAPI.getExpenses(params)
      ]);

      // Filter payments by date like Index.jsx
      if (paymentsRes?.success) {
        const weekStartDate = fromYMD(selectedWeekStart);
        const weekEndDate = fromYMD(selectedWeekEnd);

        const filteredData = {
          ...paymentsRes,
          parties: paymentsRes.parties?.map((party) => {
            const filteredPayments = party.payments
              ?.filter((payment) => {
                if (!payment.date) return false;

                const dates = payment.date.split(/\s*[-–]\s*(?=\d{4})/);
                const paymentDate = fromYMD(dates[0]);

                return paymentDate >= weekStartDate && paymentDate <= weekEndDate;
              })
              .sort((a, b) => {
                const dateA = fromYMD(a.date?.split(/\s*[-–]\s*/)[0] || selectedWeekStart);
                const dateB = fromYMD(b.date?.split(/\s*[-–]\s*/)[0] || selectedWeekStart);
                return dateA - dateB;
              });

            return {
              ...party,
              payments: filteredPayments
            };
          })
          .filter((party) => {
            const hasPayments = party.payments && party.payments.length > 0;
            const hasNP = !!party.weeklyNP;
            return hasPayments || hasNP;
          })
        };

        setWeeklyData(filteredData);
      } else {
        setWeeklyData({ parties: [] });
      }

      setExpenses(expensesRes?.data || []);
      setError('');
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load report');
      setWeeklyData({ parties: [] });
      setExpenses([]);
    } finally {
      setLoading(false);
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

  // Aggregate all parties
  const grand = useMemo(() => {
    const parties = weeklyData?.parties || [];

    const acc = {
      paymentAmount: 0,
      pwt: 0,
      cash: 0,
      bank: 0,
      due: 0,
      tda: 0,
      npAmount: 0,
    };

    for (const party of parties) {
      const subtotal = {
        paymentAmount: 0,
        pwt: 0,
        cash: 0,
        bank: 0,
        due: 0,
        tda: 0,
        npAmount: 0,
      };

      for (const payment of party?.payments || []) {
        subtotal.paymentAmount += payment?.paymentAmount || 0;
        subtotal.pwt += payment?.pwt || 0;
        subtotal.cash += payment?.cash || 0;
        subtotal.bank += payment?.bank || 0;
        subtotal.due += payment?.due || 0;
        subtotal.tda += payment?.tda || 0;
      }

      // NP only adds to paymentAmount, not bank
      if (party?.weeklyNP) {
        const npAmount = party.weeklyNP.amount || 0;
        subtotal.paymentAmount += npAmount;
        subtotal.npAmount = npAmount;
      }

      acc.paymentAmount += subtotal.paymentAmount;
      acc.pwt += subtotal.pwt;
      acc.cash += subtotal.cash;
      acc.bank += subtotal.bank;
      acc.due += subtotal.due;
      acc.tda += subtotal.tda;
      acc.npAmount += subtotal.npAmount;
    }

    return acc;
  }, [weeklyData]);

  const totalExpenses = useMemo(() => {
    if (!Array.isArray(expenses)) return 0;
    return expenses.reduce((sum, e) => sum + (e?.expenseAmount || 0), 0);
  }, [expenses]);

  const finalCash = useMemo(() => {
    return (grand.cash || 0) - totalExpenses;
  }, [grand, totalExpenses]);

  const totalAllColumns = useMemo(() => {
    return (grand.pwt || 0)
      + (grand.cash || 0)
      + (grand.bank || 0)
      + (grand.due || 0)
      + (grand.tda || 0);
  }, [grand]);

  const num = (v) => (v ?? 0).toLocaleString();

  const StatCard = ({ title, value, icon: Icon, accent = 'emerald' }) => (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all">
      <div className={`absolute inset-x-0 top-0 h-1 bg-${accent}-500`} />
      <div className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <div className={`p-2 rounded-lg bg-${accent}-50 text-${accent}-600`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight text-gray-900">{num(value)}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-black">Weekly Report</h1>
              <p className="text-sm text-gray-600">Track weekly summary (Monday to Sunday)</p>
            </div>
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
                📌 Viewing data for this 7-day period (Monday to Sunday)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg flex items-center space-x-3">
            <p className="text-red-700">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">✕</button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Loading report...</p>
          </div>
        ) : (
          <>
            {/* Primary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <StatCard title="Total Payment" value={grand.paymentAmount} icon={IndianRupee} accent="blue" />
              <StatCard title="Total PWT" value={grand.pwt} icon={TrendingUp} accent="indigo" />
              <StatCard title="Total Cash" value={grand.cash} icon={Wallet} accent="emerald" />
              <StatCard title="Total Bank" value={grand.bank} icon={Banknote} accent="teal" />
              <StatCard title="Total Due" value={grand.due} icon={Calculator} accent="orange" />
              <StatCard title="Total TDA" value={grand.tda} icon={PiggyBank} accent="cyan" />
              <StatCard title="Combined Total" value={totalAllColumns} icon={Coins} accent="violet" />
              <StatCard title="Expenses (Week)" value={-totalExpenses} icon={Receipt} accent="rose" />
            </div>

            {/* Final Cash */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500 font-medium">Cash After Expenses</p>
                    <div className="p-2 rounded-lg bg-green-50 text-green-600">
                      <Wallet className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900">
                    ₹{num(finalCash)}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Calculated as Cash − Expenses for the selected week
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-gray-500">NP counted in Payment only; excluded from Combined Total</p>
                  <p className="mt-1 text-xs text-gray-400">Based on weekly NP adjustments</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
