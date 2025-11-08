// src/components/WeeklySummary.jsx
import React, { useMemo, useState, useEffect } from "react";
import { authAPI, bankColorAPI } from "../lib/api";

const num = (v) => (v ?? 0).toLocaleString();

export default function WeeklySummary({ data, expenses = [] }) {
  const [bankCellColors, setBankCellColors] = useState({});
  const [userRole, setUserRole] = useState("employee");

  // Decode token and set role
  useEffect(() => {
    const fetchRole = async () => {
      const token = localStorage.getItem("payment-token");
      console.log(token);
      
      if (!token) return "employee";
      const role = await authAPI.role(token);
      setUserRole(role.role);
    };

    fetchRole();
  }, []);

  // Load colors from backend data
  useEffect(() => {
    if (!data?.parties) return;

    const initialColors = {};
    data.parties.forEach((party) => {
      party.payments.forEach((payment, idx) => {
        const key = `${party.partyId}-${idx}`;
        initialColors[key] = payment.bankColorStatus || "red";
      });

      const partyTotalKey = `${party.partyId}-partyTotal`;
      initialColors[partyTotalKey] = party.partyTotalBankColor || "red";
    });

    setBankCellColors(initialColors);
  }, [data]);

  // Toggle and save bank color (admin only)
  const toggleBankColor = async (
    key,
    partyId,
    weekNumber,
    weekYear,
    paymentDate,
    isPartyTotal,
    paymentType
  ) => {
    if (userRole !== "admin") return;

    const currentColor = bankCellColors[key] || "red";
    const newColor = currentColor === "red" ? "green" : "red";

    // Optimistic update
    setBankCellColors((prev) => ({ ...prev, [key]: newColor }));

    try {
      await bankColorAPI.updateBankColor({
        partyId,
        weekNumber,
        weekYear,
        paymentDate,
        color: newColor,
        isPartyTotal: !!isPartyTotal,
        paymentType: paymentType || "weekly",
      });
    } catch (error) {
      // Revert on error
      setBankCellColors((prev) => ({ ...prev, [key]: currentColor }));
    }
  };

  // Get bank cell style
  const getBankCellStyle = (key, amount) => {
    if (!amount || amount === 0) return {};
    const color = bankCellColors[key] || "red";
    return {
      backgroundColor: color === "red" ? "#fee2e2" : "#d1fae5",
      cursor: userRole === "admin" ? "pointer" : "default",
      transition: "background-color 0.2s ease",
      opacity: userRole === "admin" ? 1 : 0.9,
    };
  };

  const { parties, grandTotal } = useMemo(() => {
    const partiesData = data?.parties || [];
    if (!Array.isArray(partiesData) || partiesData.length === 0) {
      return { parties: [], grandTotal: null };
    }

    const grandTotalCalc = {
      paymentAmount: 0,
      pwt: 0,
      cash: 0,
      bank: 0,
      due: 0,
      tda: 0,
      npAmount: 0,
    };

    const enrichedParties = partiesData.map((party) => {
      const partyTotal = {
        paymentAmount: 0,
        pwt: 0,
        cash: 0,
        bank: 0,
        due: 0,
        tda: 0,
        npAmount: 0,
      };

      for (const payment of party.payments) {
        partyTotal.paymentAmount += payment.paymentAmount || 0;
        partyTotal.pwt += payment.pwt || 0;
        partyTotal.cash += payment.cash || 0;
        partyTotal.bank += payment.bank || 0;
        partyTotal.due += payment.due || 0;
        partyTotal.tda += payment.tda || 0;
      }

      if (party.weeklyNP) {
        const npAmount = party.weeklyNP.amount || 0;
        partyTotal.paymentAmount += npAmount;
        partyTotal.bank += npAmount;
        partyTotal.npAmount = npAmount;
      }

      grandTotalCalc.paymentAmount += partyTotal.paymentAmount;
      grandTotalCalc.pwt += partyTotal.pwt;
      grandTotalCalc.cash += partyTotal.cash;
      grandTotalCalc.bank += partyTotal.bank;
      grandTotalCalc.due += partyTotal.due;
      grandTotalCalc.tda += partyTotal.tda;
      grandTotalCalc.npAmount += partyTotal.npAmount;

      return { ...party, partyTotal };
    });

    return { parties: enrichedParties, grandTotal: grandTotalCalc };
  }, [data]);

  // Safe guards for expenses not being an array
  const totalExpenses = useMemo(() => {
    if (!Array.isArray(expenses)) return 0;
    return expenses.reduce((sum, exp) => sum + (exp.expenseAmount || 0), 0);
  }, [expenses]);

  const finalCash = useMemo(() => {
    if (!grandTotal) return 0;
    return grandTotal.cash - totalExpenses;
  }, [grandTotal, totalExpenses]);

  const weekNumber = data?.weekNumber;
  const weekYear = data?.weekYear;

  const dateColWidth = "w-[120px] min-w-[120px] max-w-[120px]";
  const partyColWidth = "w-[120px] min-w-[120px] max-w-[120px]";
  const numColWidth = "w-[120px] min-w-[120px]";
  const cellBase =
    "px-4 py-3 border-b border-gray-200 align-middle transition-colors duration-150";
  const cellLeft = "text-left";
  const cellRight = "text-right font-mono";
  const stickyBase = "sticky bg-white";
  const stickyDate = `${stickyBase} left-0 z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]`;
  const stickyParty = `${stickyBase} z-20 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]`;

  const rowCls = (t) => {
    if (t === "weeklyNP") return "bg-amber-50/80 hover:bg-amber-100/80";
    if (t === "partyTotal")
      return "bg-emerald-50 hover:bg-emerald-100 font-semibold";
    if (t === "grandTotal") return "bg-blue-100 hover:bg-blue-200 font-bold";
    if (t === "expense") return "bg-red-50 hover:bg-red-100";
    if (t === "expenseTotal")
      return "bg-red-100 hover:bg-red-200 font-semibold";
    if (t === "finalCash") return "bg-green-100 hover:bg-green-200 font-bold";
    return "bg-white hover:bg-gray-50";
  };

  if (
    parties.length === 0 &&
    (!Array.isArray(expenses) || expenses.length === 0)
  ) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center shadow-lg">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-xl text-gray-700 font-semibold">No data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-xl border-2 border-gray-300 shadow-2xl bg-white">
      {/* Role indicator banner */}
      {userRole && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold ${
                userRole === "admin"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {userRole === "admin"
                ? "👑 ADMIN MODE"
                : "👤 EMPLOYEE - VIEW ONLY"}
            </span>
            <span className="text-sm text-gray-600">
              {userRole === "admin"
                ? "Click bank cells to toggle colors"
                : "Bank colors are view-only"}
            </span>
          </div>
        </div>
      )}

      <table className="min-w-full table-auto border-separate border-spacing-0">
        <thead className="text-sm text-gray-800 select-none">
          <tr className="bg-gradient-to-r from-gray-50 via-gray-100 to-gray-50">
            <th
              className={`${cellBase} ${cellLeft} sticky top-0 z-30 ${dateColWidth} ${stickyBase} border-b-2 border-gray-400 font-bold text-base py-4`}
            >
              <div className="flex items中心 gap-2">
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>Date</span>
              </div>
            </th>
            <th
              className={`${cellBase} ${cellLeft} sticky top-0 z-30 ${partyColWidth} ${stickyBase} border-b-2 border-gray-400 font-bold text-base py-4`}
              style={{ left: 120 }}
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <span>Party Name</span>
              </div>
            </th>
            <th
              className={`${cellBase} ${cellRight} ${numColWidth} sticky top-0 z-30 bg-white border-b-2 border-gray-400 font-bold text-base py-4`}
            >
              Payment
            </th>
            <th
              className={`${cellBase} ${cellRight} ${numColWidth} sticky top-0 z-30 bg-white border-b-2 border-gray-400 font-bold text-base py-4`}
            >
              PWT
            </th>
            <th
              className={`${cellBase} ${cellRight} ${numColWidth} sticky top-0 z-30 bg-white border-b-2 border-gray-400 font-bold text-base py-4`}
            >
              Cash
            </th>
            <th
              className={`${cellBase} ${cellRight} ${numColWidth} sticky top-0 z-30 bg-white border-b-2 border-gray-400 font-bold text-base py-4`}
            >
              <div className="flex items-center justify-end gap-2">
                <span>Bank</span>
                {userRole === "admin" && (
                  <span className="text-xs text-gray-500 font-normal">
                    (click)
                  </span>
                )}
              </div>
            </th>
            <th
              className={`${cellBase} ${cellRight} ${numColWidth} sticky top-0 z-30 bg-white border-b-2 border-gray-400 font-bold text-base py-4`}
            >
              Due
            </th>
            <th
              className={`${cellBase} ${cellRight} ${numColWidth} sticky top-0 z-30 bg-white border-b-2 border-gray-400 font-bold text-base py-4`}
            >
              TDA
            </th>
            <th
              className={`${cellBase} ${cellRight} ${numColWidth} sticky top-0 z-30 bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-400 font-bold text-base py-4 text-blue-800`}
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody className="text-sm text-gray-900">
          {parties.map((party, partyIndex) => (
            <React.Fragment key={party.partyId || partyIndex}>
              {party.payments.map((payment, paymentIndex) => {
                const rowTotal =
                  (payment.pwt || 0) +
                  (payment.cash || 0) +
                  (payment.bank || 0) +
                  (payment.due || 0) +
                  (payment.tda || 0);
                const bankCellKey = `${party.partyId}-${paymentIndex}`;

                return (
                  <tr
                    key={`${party.partyId}-payment-${paymentIndex}`}
                    className={rowCls(payment.type)}
                  >
                    <td
                      className={`${cellBase} ${cellLeft} ${dateColWidth} ${stickyDate}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-base font-semibold text-gray-900">
                          {payment.date || "—"}
                        </span>
                        {payment.source && (
                          <span className="text-xs text-gray-500 mt-0.5 font-medium uppercase tracking-wide">
                            {payment.source}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`${cellBase} ${cellLeft} ${partyColWidth} ${stickyParty}`}
                      style={{ left: 120 }}
                    >
                      <div className="flex flex-col">
                        <span className="text-base font-semibold text-gray-900">
                          {party.partyCode}
                        </span>
                        {party.partyName && (
                          <span className="text-xs text-gray-500 mt-0.5 font-mono">
                            {party.partyName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`${cellBase} ${cellRight} ${numColWidth}`}>
                      <span className="text-gray-900">
                        {num(payment.paymentAmount)}
                      </span>
                    </td>
                    <td className={`${cellBase} ${cellRight} ${numColWidth}`}>
                      <span className="text-gray-900">{num(payment.pwt)}</span>
                    </td>
                    <td className={`${cellBase} ${cellRight} ${numColWidth}`}>
                      <span className="text-gray-900">{num(payment.cash)}</span>
                    </td>
                    <td
                      className={`${cellBase} ${cellRight} ${numColWidth}`}
                      style={getBankCellStyle(bankCellKey, payment.bank)}
                      onClick={() =>
                        payment.bank > 0 &&
                        toggleBankColor(
                          bankCellKey,
                          party.partyId,
                          weekNumber,
                          weekYear,
                          payment.date,
                          false,
                          payment.type
                        )
                      }
                      title={
                        payment.bank > 0
                          ? userRole === "admin"
                            ? "Click to toggle color"
                            : "View only - Admin access required"
                          : ""
                      }
                    >
                      <span className="text-gray-900 font-semibold">
                        {num(payment.bank)}
                      </span>
                    </td>
                    <td className={`${cellBase} ${cellRight} ${numColWidth}`}>
                      <span className="text-gray-900">{num(payment.due)}</span>
                    </td>
                    <td className={`${cellBase} ${cellRight} ${numColWidth}`}>
                      <span className="text-gray-900">{num(payment.tda)}</span>
                    </td>
                    <td
                      className={`${cellBase} ${cellRight} ${numColWidth} bg-blue-50/50`}
                    >
                      <span className="font-semibold text-blue-900">
                        {num(rowTotal)}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {party.weeklyNP && (
                <tr className={rowCls("weeklyNP")}>
                  <td
                    className={`${cellBase} ${cellLeft} ${dateColWidth} ${stickyDate}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-200 text-amber-900 text-xs font-bold">
                        NP/DUE
                      </span>
                    </div>
                  </td>
                  <td
                    className={`${cellBase} ${cellLeft} ${partyColWidth} ${stickyParty}`}
                    style={{ left: 120 }}
                  >
                    {party.weeklyNP.name && (
                      <span className="text-sm text-gray-700 font-medium">
                        {party.weeklyNP.name}
                      </span>
                    )}
                  </td>
                  <td className={`${cellBase} ${cellRight} ${numColWidth}`}>
                    <span className="text-amber-900 font-semibold">
                      {num(party.weeklyNP.amount)}
                    </span>
                  </td>
                  <td
                    className={`${cellBase} ${cellRight} ${numColWidth} text-gray-400`}
                  >
                    —
                  </td>
                  <td
                    className={`${cellBase} ${cellRight} ${numColWidth} text-gray-400`}
                  >
                    —
                  </td>
                  <td
                    className={`${cellBase} ${cellRight} ${numColWidth} text-gray-400`}
                  >
                    —
                  </td>
                  <td
                    className={`${cellBase} ${cellRight} ${numColWidth} text-gray-400`}
                  >
                    —
                  </td>
                  <td
                    className={`${cellBase} ${cellRight} ${numColWidth} text-gray-400`}
                  >
                    —
                  </td>
                  <td
                    className={`${cellBase} ${cellRight} ${numColWidth} bg-blue-50/50 text-gray-400`}
                  >
                    —
                  </td>
                </tr>
              )}

              <tr className={rowCls("partyTotal")}>
                <td
                  className={`${cellBase} ${cellLeft} ${dateColWidth} ${stickyDate} border-t-2 border-emerald-300`}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-600 text-white text-xs font-bold">
                      TOTAL
                    </span>
                  </div>
                </td>
                <td
                  className={`${cellBase} ${cellLeft} ${partyColWidth} ${stickyParty} border-t-2 border-emerald-300`}
                  style={{ left: 120 }}
                >
                  <span className="text-base font-bold text-emerald-700">
                    {party.partyCode} Total
                  </span>
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-emerald-300`}
                >
                  <span className="font-bold text-emerald-700">
                    {num(party.partyTotal.paymentAmount)}
                  </span>
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-emerald-300`}
                >
                  <span className="font-bold text-emerald-700">
                    {num(party.partyTotal.pwt)}
                  </span>
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-emerald-300`}
                >
                  <span className="font-bold text-emerald-700">
                    {num(party.partyTotal.cash)}
                  </span>
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-emerald-300`}
                >
                  <span className="font-bold text-emerald-700">
                    {num(party.partyTotal.bank)}
                  </span>
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-emerald-300`}
                >
                  <span className="font-bold text-emerald-700">
                    {num(party.partyTotal.due)}
                  </span>
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-emerald-300`}
                >
                  <span className="font-bold text-emerald-700">
                    {num(party.partyTotal.tda)}
                  </span>
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} bg-emerald-100 border-t-2 border-emerald-400`}
                >
                  <span className="font-bold text-emerald-800 text-base">
                    {num(
                      party.partyTotal.pwt +
                        party.partyTotal.cash +
                        (party.partyTotal.bank - party.partyTotal.npAmount) +
                        party.partyTotal.due +
                        party.partyTotal.tda
                    )}
                  </span>
                </td>
              </tr>

              {partyIndex < parties.length - 1 && (
                <tr className="h-3 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100">
                  <td colSpan="9" className="border-b border-gray-200"></td>
                </tr>
              )}
            </React.Fragment>
          ))}

          {grandTotal && (
            <tr className={rowCls("grandTotal")}>
              <td
                className={`${cellBase} ${cellLeft} ${dateColWidth} ${stickyDate} border-t-4 border-blue-500`}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-bold">
                    GRAND TOTAL
                  </span>
                </div>
              </td>
              <td
                className={`${cellBase} ${cellLeft} ${partyColWidth} ${stickyParty} border-t-4 border-blue-500`}
                style={{ left: 120 }}
              >
                <span className="text-base font-bold text-blue-800">
                  All Parties Combined
                </span>
              </td>
              <td
                className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-blue-500`}
              >
                <span className="font-bold text-blue-800 text-base">
                  {num(grandTotal.paymentAmount)}
                </span>
              </td>
              <td
                className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-blue-500`}
              >
                <span className="font-bold text-blue-800 text-base">
                  {num(grandTotal.pwt)}
                </span>
              </td>
              <td
                className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-blue-500`}
              >
                <span className="font-bold text-blue-800 text-base">
                  {num(grandTotal.cash)}
                </span>
              </td>
              <td
                className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-blue-500`}
              >
                <span className="font-bold text-blue-800 text-base">
                  {num(grandTotal.bank)}
                </span>
              </td>
              <td
                className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-blue-500`}
              >
                <span className="font-bold text-blue-800 text-base">
                  {num(grandTotal.due)}
                </span>
              </td>
              <td
                className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-blue-500`}
              >
                <span className="font-bold text-blue-800 text-base">
                  {num(grandTotal.tda)}
                </span>
              </td>
              <td
                className={`${cellBase} ${cellRight} ${numColWidth} bg-blue-200 border-t-4 border-blue-600`}
              >
                <span className="font-bold text-blue-900 text-lg">
                  {num(
                    grandTotal.pwt +
                      grandTotal.cash +
                      (grandTotal.bank - grandTotal.npAmount) +
                      grandTotal.due +
                      grandTotal.tda
                  )}
                </span>
              </td>
            </tr>
          )}

          {Array.isArray(expenses) && expenses.length > 0 && (
            <>
              <tr className="h-4 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100">
                <td colSpan="9" className="border-b-2 border-gray-300"></td>
              </tr>

              {expenses.map((expense, idx) => (
                <tr key={expense._id || idx} className={rowCls("expense")}>
                  <td
                    className={`${cellBase} ${cellLeft} ${dateColWidth} ${stickyDate}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-base font-semibold text-gray-900">
                        {new Date(expense.expenseDate).toLocaleDateString(
                          "en-IN",
                          { day: "2-digit", month: "short", year: "numeric" }
                        )}
                      </span>
                      <span className="text-xs text-red-600 mt-0.5 font-medium uppercase tracking-wide">
                        EXPENSE
                      </span>
                    </div>
                  </td>
                  <td
                    className={`${cellBase} ${cellLeft} ${partyColWidth} ${stickyParty}`}
                    style={{ left: 120 }}
                  >
                    <div className="flex flex-col">
                      <span className="text-base font-semibold text-gray-900">
                        {expense.expenseName}
                      </span>
                      {expense.expenseCategory && (
                        <span className="text-xs text-gray-500 mt-0.5">
                          {expense.expenseCategory}
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className={`${cellBase} ${cellRight} ${numColWidth} text-gray-400`}
                  >
                    —
                  </td>
                  <td
                    className={`${cellBase} ${cellRight} ${numColWidth} text-gray-400`}
                  >
                    —
                  </td>
                  <td className={`${cellBase} ${cellRight} ${numColWidth}`}>
                    <span className="text-red-600 font-semibold">
                      {num(expense.expenseAmount)}
                    </span>
                  </td>
                  <td
                    className={`${cellBase} ${cellRight} ${numColWidth} text-gray-400`}
                  >
                    —
                  </td>
                  <td
                    className={`${cellBase} ${cellRight} ${numColWidth} text-gray-400`}
                  >
                    —
                  </td>
                  <td
                    className={`${cellBase} ${cellRight} ${numColWidth} text-gray-400`}
                  >
                    —
                  </td>
                  <td
                    className={`${cellBase} ${cellRight} ${numColWidth} bg-blue-50/50 text-gray-400`}
                  >
                    —
                  </td>
                </tr>
              ))}

              <tr className={rowCls("expenseTotal")}>
                <td
                  className={`${cellBase} ${cellLeft} ${dateColWidth} ${stickyDate} border-t-2 border-red-300`}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-red-600 text-white text-xs font-bold">
                      EXPENSES
                    </span>
                  </div>
                </td>
                <td
                  className={`${cellBase} ${cellLeft} ${partyColWidth} ${stickyParty} border-t-2 border-red-300`}
                  style={{ left: 120 }}
                >
                  <span className="text-base font-bold text-red-700">
                    Total Expenses
                  </span>
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-red-300 text-gray-400`}
                >
                  —
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-red-300 text-gray-400`}
                >
                  —
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-red-300`}
                >
                  <span className="font-bold text-red-700 text-base">
                    -{num(totalExpenses)}
                  </span>
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-red-300 text-gray-400`}
                >
                  —
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-red-300 text-gray-400`}
                >
                  —
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-red-300 text-gray-400`}
                >
                  —
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-2 border-red-300 text-gray-400`}
                >
                  —
                </td>
              </tr>

              <tr className={rowCls("finalCash")}>
                <td
                  className={`${cellBase} ${cellLeft} ${dateColWidth} ${stickyDate} border-t-4 border-green-500`}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-md bg-green-600 text-white text-xs font-bold">
                      FINAL CASH
                    </span>
                  </div>
                </td>
                <td
                  className={`${cellBase} ${cellLeft} ${partyColWidth} ${stickyParty} border-t-4 border-green-500`}
                  style={{ left: 120 }}
                >
                  <span className="text-base font-bold text-green-800">
                    Cash After Expenses
                  </span>
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-green-500 text-gray-400`}
                >
                  —
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-green-500 text-gray-400`}
                >
                  —
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-green-500`}
                >
                  <span className="font-bold text-green-800 text-lg">
                    {num(finalCash)}
                  </span>
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-green-500 text-gray-400`}
                >
                  —
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-green-500 text-gray-400`}
                >
                  —
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-green-500 text-gray-400`}
                >
                  —
                </td>
                <td
                  className={`${cellBase} ${cellRight} ${numColWidth} border-t-4 border-green-500 text-gray-400`}
                >
                  —
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
