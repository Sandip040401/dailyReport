// src/pages/Report.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, IndianRupee, Banknote, Wallet, PiggyBank, TrendingUp, Calculator, Receipt, Coins } from 'lucide-react';
import { dashboardAPI, expenseAPI } from '../lib/api';
import { getIsoWeekBoundsFromDate } from '../utils/weekRange';

const toISO = (d) => d.toISOString().slice(0, 10);
// Group digits; add options if you want decimals: { minimumFractionDigits: 2, maximumFractionDigits: 2 }
const num = (v) => (v ?? 0).toLocaleString();

export const Report = () => {
  const [pickedDate, setPickedDate] = useState(new Date());
  const { weekStart, weekEnd } = useMemo(
    () => getIsoWeekBoundsFromDate(pickedDate),
    [pickedDate]
  );
  const [weeklyData, setWeeklyData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const [paymentsRes, expensesRes] = await Promise.all([
          dashboardAPI.getRangeSummary(toISO(weekStart), toISO(weekEnd)),
          expenseAPI.getExpenses({ startDate: toISO(weekStart), endDate: toISO(weekEnd) }),
        ]);
        if (cancelled) return;
        setWeeklyData(paymentsRes?.success ? paymentsRes : { parties: [] });
        setExpenses(expensesRes?.data || []);
      } catch {
        if (!cancelled) {
          setError('Failed to load report');
          setWeeklyData({ parties: [] });
          setExpenses([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [weekStart, weekEnd]);

  // Aggregate all parties (matches your existing logic)
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
      if (party?.weeklyNP) {
        const npAmount = party.weeklyNP.amount || 0;
        subtotal.paymentAmount += npAmount;
        subtotal.bank += npAmount;
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

  const finalCash = useMemo(() => (grand.cash || 0) - totalExpenses, [grand, totalExpenses]);

  // Matches your displayed grand total: pwt + cash + (bank - np) + due + tda
  const totalAllColumns = useMemo(() => {
    return (grand.pwt || 0)
      + (grand.cash || 0)
      + ((grand.bank || 0) - (grand.npAmount || 0))
      + (grand.due || 0)
      + (grand.tda || 0);
  }, [grand]); 

  const jumpByDays = (days) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + days);
    setPickedDate(next);
  };

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
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Weekly Report</h1>
            <p className="text-sm text-gray-600">
              {weekStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} — {weekEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} (Mon–Sun)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => jumpByDays(-7)}
              className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium"
            >
              ← Previous Week
            </button>
            <button
              onClick={() => setPickedDate(new Date())}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium shadow"
            >
              Today
            </button>
            <button
              onClick={() => jumpByDays(7)}
              className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium"
            >
              Next Week →
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Loading report...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 text-center">
            <p className="text-red-700 font-medium">{error}</p>
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
                    {num(finalCash)}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Calculated as Cash − Expenses for the selected week
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-gray-500">PWT + Cash + (Bank − NP) + Due + TDA</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{num(totalAllColumns)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-gray-500">NP counted in Payment & Bank; excluded from Combined Total</p>
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
