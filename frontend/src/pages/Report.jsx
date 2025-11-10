// src/pages/Report.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, IndianRupee, Banknote, Wallet, PiggyBank, TrendingUp, Calculator, Receipt, Coins } from 'lucide-react';
import { dashboardAPI, expenseAPI } from '../lib/api';
import { getIsoWeekBoundsFromDate } from '../utils/weekRange';


const toISO = (d) => d.toISOString().slice(0, 10);
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

  console.log('=== REPORT COMPONENT RENDER ===');
  console.log('Picked Date:', pickedDate);
  console.log('Week Start:', weekStart);
  console.log('Week End:', weekEnd);
  console.log('Week Start ISO:', toISO(weekStart));
  console.log('Week End ISO:', toISO(weekEnd));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        
        console.log('\n=== FETCHING DATA ===');
        console.log('Start Date:', toISO(weekStart));
        console.log('End Date:', toISO(weekEnd));

        const [paymentsRes, expensesRes] = await Promise.all([
          dashboardAPI.getRangeSummary(toISO(weekStart), toISO(weekEnd)),
          expenseAPI.getExpenses({ startDate: toISO(weekStart), endDate: toISO(weekEnd) }),
        ]);

        console.log('\n=== RAW API RESPONSES ===');
        console.log('Payments Response:', JSON.stringify(paymentsRes, null, 2));
        console.log('Expenses Response:', JSON.stringify(expensesRes, null, 2));

        if (cancelled) return;

        // Filter payments by date like Index.jsx
        if (paymentsRes?.success) {
          console.log('\n=== FILTERING PAYMENTS ===');
          console.log('Total Parties Before Filter:', paymentsRes.parties?.length);

          const weekStartDate = new Date(weekStart);
          const weekEndDate = new Date(weekEnd);
          
          console.log('Filter Range Start:', weekStartDate.toISOString());
          console.log('Filter Range End:', weekEndDate.toISOString());

          const filteredData = {
            ...paymentsRes,
            parties: paymentsRes.parties?.map((party, partyIndex) => {
              console.log(`\n--- Party ${partyIndex + 1}: ${party.partyCode} ---`);
              console.log('Total Payments:', party.payments?.length || 0);

              const filteredPayments = party.payments
                ?.filter((payment, paymentIndex) => {
                  if (!payment.date) {
                    console.log(`  Payment ${paymentIndex + 1}: NO DATE - EXCLUDED`);
                    return false;
                  }

                  const dates = payment.date.split(/\s*[-–]\s*(?=\d{4})/);
                  const paymentDate = new Date(dates[0]);
                  
                  const isInRange = paymentDate >= weekStartDate && paymentDate <= weekEndDate;
                  
                  console.log(`  Payment ${paymentIndex + 1}:`);
                  console.log(`    Original Date: ${payment.date}`);
                  console.log(`    Parsed Date: ${paymentDate.toISOString()}`);
                  console.log(`    Amount: ${payment.paymentAmount}`);
                  console.log(`    In Range: ${isInRange}`);

                  return isInRange;
                })
                .sort((a, b) => {
                  const dateA = new Date(a.date?.split(/\s*[-–]\s*/)[0] || 0);
                  const dateB = new Date(b.date?.split(/\s*[-–]\s*/)[0] || 0);
                  return dateA - dateB;
                });

              console.log(`Filtered Payments: ${filteredPayments?.length || 0}`);
              
              if (party.weeklyNP) {
                console.log(`Weekly NP: ${party.weeklyNP.amount}`);
              }

              return {
                ...party,
                payments: filteredPayments
              };
            })
            .filter((party, index) => {
              const hasPayments = party.payments && party.payments.length > 0;
              const hasNP = !!party.weeklyNP;
              const keepParty = hasPayments || hasNP;
              
              if (!keepParty) {
                console.log(`\nParty ${index + 1} EXCLUDED (no payments or NP)`);
              }
              
              return keepParty;
            })
          };
          
          console.log('\n=== FILTERED RESULTS ===');
          console.log('Total Parties After Filter:', filteredData.parties?.length);
          console.log('Filtered Data:', JSON.stringify(filteredData, null, 2));

          setWeeklyData(filteredData);
        } else {
          console.log('Payments response not successful, setting empty parties');
          setWeeklyData({ parties: [] });
        }

        console.log('\n=== EXPENSES ===');
        console.log('Total Expenses:', expensesRes?.data?.length || 0);
        console.log('Expenses Data:', JSON.stringify(expensesRes?.data, null, 2));

        setExpenses(expensesRes?.data || []);
      } catch (e) {
        console.error('\n=== ERROR ===');
        console.error('Error details:', e);
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


  // Aggregate all parties
  const grand = useMemo(() => {
    console.log('\n=== CALCULATING GRAND TOTALS ===');
    const parties = weeklyData?.parties || [];
    console.log('Parties to aggregate:', parties.length);

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

      console.log(`\nAggregating Party: ${party.partyCode}`);
      console.log(`  Payments count: ${party.payments?.length || 0}`);

      for (const payment of party?.payments || []) {
        subtotal.paymentAmount += payment?.paymentAmount || 0;
        subtotal.pwt += payment?.pwt || 0;
        subtotal.cash += payment?.cash || 0;
        subtotal.bank += payment?.bank || 0;
        subtotal.due += payment?.due || 0;
        subtotal.tda += payment?.tda || 0;
      }

      // CORRECTED: NP only adds to paymentAmount, not bank
      if (party?.weeklyNP) {
        const npAmount = party.weeklyNP.amount || 0;
        console.log(`  Adding Weekly NP: ${npAmount} (to paymentAmount only)`);
        subtotal.paymentAmount += npAmount;
        subtotal.npAmount = npAmount;
      }

      console.log('  Party Subtotal:', subtotal);

      acc.paymentAmount += subtotal.paymentAmount;
      acc.pwt += subtotal.pwt;
      acc.cash += subtotal.cash;
      acc.bank += subtotal.bank;
      acc.due += subtotal.due;
      acc.tda += subtotal.tda;
      acc.npAmount += subtotal.npAmount;
    }

    console.log('\n=== GRAND TOTAL ===');
    console.log(acc);

    return acc;
  }, [weeklyData]);


  const totalExpenses = useMemo(() => {
    if (!Array.isArray(expenses)) return 0;
    const total = expenses.reduce((sum, e) => sum + (e?.expenseAmount || 0), 0);
    console.log('\n=== TOTAL EXPENSES ===');
    console.log('Expenses count:', expenses.length);
    console.log('Total:', total);
    return total;
  }, [expenses]); 


  const finalCash = useMemo(() => {
    const result = (grand.cash || 0) - totalExpenses;
    console.log('\n=== FINAL CASH ===');
    console.log('Cash:', grand.cash);
    console.log('Expenses:', totalExpenses);
    console.log('Final Cash:', result);
    return result;
  }, [grand, totalExpenses]);


  const totalAllColumns = useMemo(() => {
    const result = (grand.pwt || 0)
      + (grand.cash || 0)
      + ((grand.bank || 0) - (grand.npAmount || 0))
      + (grand.due || 0)
      + (grand.tda || 0);

    console.log('\n=== COMBINED TOTAL ===');
    console.log('PWT:', grand.pwt);
    console.log('Cash:', grand.cash);
    console.log('Bank:', grand.bank);
    console.log('NP Amount:', grand.npAmount);
    console.log('Bank - NP:', grand.bank - grand.npAmount);
    console.log('Due:', grand.due);
    console.log('TDA:', grand.tda);
    console.log('Combined Total:', result);

    return result;
  }, [grand]); 


  const jumpByDays = (days) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + days);
    console.log(`\n=== JUMPING ${days} DAYS ===`);
    console.log('New Date:', next);
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
