// src/components/WeeklySummary.jsx
import React, { useMemo, useState, useEffect } from "react";
import { authAPI, bankColorAPI } from "../lib/api";
import Loader from "./Loader";

const num = (v) => (v ?? 0).toLocaleString();

export default function WeeklySummary({ data, expenses = [] }) {
  const [bankCellColors, setBankCellColors] = useState({});
  const [userRole, setUserRole] = useState("employee");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading user data...");
  const [updatingKey, setUpdatingKey] = useState(null);

  // Decode token and set role
  useEffect(() => {
    const fetchRole = async () => {
      setIsLoading(true);
      setLoadingMessage("Authenticating user...");
      
      const token = localStorage.getItem("payment-token");
      console.log(token);
      
      if (!token) {
        setUserRole("employee");
        setIsLoading(false);
        return;
      }
      
      try {
        const role = await authAPI.role(token);
        setUserRole(role.role);
      } catch (error) {
        console.error("Error fetching role:", error);
        setUserRole("employee");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRole();
  }, []);

  // Load colors from backend data
  useEffect(() => {
    if (!data?.parties) return;

    setLoadingMessage("Loading bank colors...");
    
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
    if (userRole !== "admin" || updatingKey) return;

    const currentColor = bankCellColors[key] || "red";
    const newColor = currentColor === "red" ? "green" : "red";

    // Optimistic update with loading state
    setUpdatingKey(key);
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
      console.error("Error updating bank color:", error);
      // Revert on error
      setBankCellColors((prev) => ({ ...prev, [key]: currentColor }));
    } finally {
      setUpdatingKey(null);
    }
  };

  // Get bank cell style
  const getBankCellStyle = (key, amount) => {
    if (!amount || amount === 0) return {};
    const color = bankCellColors[key] || "red";
    return {
      backgroundColor: color === "red" ? "#f73737ff" : "#50C878",
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

  // OPTIMIZED: Larger fonts, compact widths
  const cellBase = "px-1.5 md:px-2 lg:px-3 xl:px-4 py-1.5 md:py-2 border-b border-gray-200 align-middle transition-colors duration-150";
  const dateCell = `${cellBase} text-xs sm:text-sm md:text-base`; // LARGER font for date
  const partyCell = `${cellBase} text-xs sm:text-sm md:text-base`; // LARGER font for party
  const dataCell = `${cellBase} text-xs sm:text-sm md:text-base whitespace-nowrap`; // LARGER font for numbers
  
  const cellLeft = "text-left";
  const cellRight = "text-right";
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

  // Show loader while fetching initial data
  if (isLoading) {
    return <Loader message={loadingMessage} />;
  }

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
    <div className="overflow-x-auto rounded-xl border-2 border-gray-300 shadow-2xl bg-white w-full">
      {/* Role indicator banner */}
      {userRole && (
        <div className="px-2 sm:px-3 md:px-4 py-1.5 md:py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-1.5 md:gap-2">
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            <span
              className={`inline-flex items-center px-1.5 sm:px-2 md:px-3 py-0.5 md:py-1 rounded-md text-[10px] md:text-xs font-bold ${
                userRole === "admin"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {userRole === "admin"
                ? "👑 ADMIN"
                : "👤 EMPLOYEE"}
            </span>
            <span className="text-[10px] md:text-xs lg:text-sm text-gray-600">
              {userRole === "admin"
                ? "Click bank cells"
                : "View only"}
            </span>
          </div>
        </div>
      )}

      <table className="w-full table-auto border-separate border-spacing-0">
        <thead className="text-xs sm:text-sm md:text-base text-gray-800 select-none">
          <tr className="bg-gradient-to-r from-gray-50 via-gray-100 to-gray-50">
            <th
              className={`${dateCell} ${cellLeft} sticky top-0 z-30 ${stickyDate} border-b-2 border-gray-400 font-bold py-2 md:py-3 w-16 sm:w-20`}
            >
              <div className="flex items-center gap-1">
                <svg
                  className="w-3 h-3 md:w-4 md:h-4 text-gray-600 hidden lg:block"
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
              className={`${partyCell} ${cellLeft} sticky top-0 z-30 ${stickyParty} border-b-2 border-gray-400 font-bold py-2 md:py-3 w-20 sm:w-24`}
            >
              <div className="flex items-center gap-1">
                <svg
                  className="w-3 h-3 md:w-4 md:h-4 text-gray-600 hidden lg:block"
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
                <span>Party</span>
              </div>
            </th>
            <th
              className={`${dataCell} ${cellRight} sticky top-0 z-30 bg-white border-b-2 border-gray-400 font-bold py-2 md:py-3`}
            >
              Payment
            </th>
            <th
              className={`${dataCell} ${cellRight} sticky top-0 z-30 bg-white border-b-2 border-gray-400 font-bold py-2 md:py-3`}
            >
              PWT
            </th>
            <th
              className={`${dataCell} ${cellRight} sticky top-0 z-30 bg-white border-b-2 border-gray-400 font-bold py-2 md:py-3`}
            >
              Cash
            </th>
            <th
              className={`${dataCell} ${cellRight} sticky top-0 z-30 bg-white border-b-2 border-gray-400 font-bold py-2 md:py-3`}
            >
              <div className="flex items-center justify-end gap-1">
                <span>Bank</span>
                {userRole === "admin" && (
                  <span className="text-[8px] text-gray-500 font-normal hidden xl:inline">
                    (click)
                  </span>
                )}
              </div>
            </th>
            <th
              className={`${dataCell} ${cellRight} sticky top-0 z-30 bg-white border-b-2 border-gray-400 font-bold py-2 md:py-3`}
            >
              Due
            </th>
            <th
              className={`${dataCell} ${cellRight} sticky top-0 z-30 bg-white border-b-2 border-gray-400 font-bold py-2 md:py-3`}
            >
              TDA
            </th>
            <th
              className={`${dataCell} ${cellRight} sticky top-0 z-30 bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-400 font-bold py-2 md:py-3 text-blue-800`}
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody className="font-semibold text-gray-900">
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
                    <td className={`${dateCell} ${cellLeft} ${stickyDate} w-16 sm:w-20`}>
                      <div className="flex flex-col leading-tight">
                        <span className="font-bold text-gray-900 break-words">
                          {payment.date || "—"}
                        </span>
                        {payment.source && (
                          <span className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 font-medium uppercase tracking-wide break-words">
                            {payment.source}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`${partyCell} ${cellLeft} ${stickyParty} w-20 sm:w-24`}
                      style={{ left: "var(--date-column-width, auto)" }}
                    >
                      <div className="flex flex-col max-w-[80px] sm:max-w-[96px]">
                        <span className="font-bold text-gray-900 truncate">
                          {party.partyCode}
                        </span>
                        {party.partyName && (
                          <span className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 font-mono truncate">
                            {party.partyName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`${dataCell} ${cellRight}`}>
                      <span className="text-gray-900 font-bold">
                        {num(payment.paymentAmount)}
                      </span>
                    </td>
                    <td className={`${dataCell} ${cellRight}`}>
                      <span className="text-gray-900 font-bold">{num(payment.pwt)}</span>
                    </td>
                    <td className={`${dataCell} ${cellRight}`}>
                      <span className="text-gray-900 font-bold">{num(payment.cash)}</span>
                    </td>
                    <td
                      className={`${dataCell} ${cellRight}`}
                      style={getBankCellStyle(bankCellKey, payment.bank)}
                      onClick={() =>
                        payment.bank > 0 &&
                        !updatingKey &&
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
                            : "View only"
                          : ""
                      }
                    >
                      {updatingKey === bankCellKey ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-2.5 h-2.5 md:w-3 md:h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                          <span className="text-gray-900 font-bold">
                            {num(payment.bank)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-900 font-bold">
                          {num(payment.bank)}
                        </span>
                      )}
                    </td>
                    <td className={`${dataCell} ${cellRight}`}>
                      <span className="text-gray-900 font-bold">{num(payment.due)}</span>
                    </td>
                    <td className={`${dataCell} ${cellRight}`}>
                      <span className="text-gray-900 font-bold">{num(payment.tda)}</span>
                    </td>
                    <td className={`${dataCell} ${cellRight} bg-blue-50/50`}>
                      <span className="font-bold text-blue-900 text-sm sm:text-base md:text-lg">
                        {num(rowTotal)}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {party.weeklyNP && (
                <tr className={rowCls("weeklyNP")}>
                  <td className={`${dateCell} ${cellLeft} ${stickyDate} w-16 sm:w-20`}>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-200 text-amber-900 text-[9px] md:text-[10px] font-bold break-words">
                      NP
                    </span>
                  </td>
                  <td
                    className={`${partyCell} ${cellLeft} ${stickyParty} w-20 sm:w-24`}
                    style={{ left: "var(--date-column-width, auto)" }}
                  >
                    {party.weeklyNP.name && (
                      <span className="text-gray-700 font-bold truncate max-w-[80px] sm:max-w-[96px] block">
                        {party.weeklyNP.name}
                      </span>
                    )}
                  </td>
                  <td className={`${dataCell} ${cellRight}`}>
                    <span className="text-amber-900 font-bold">
                      {num(party.weeklyNP.amount)}
                    </span>
                  </td>
                  <td className={`${dataCell} ${cellRight} text-gray-400`}>—</td>
                  <td className={`${dataCell} ${cellRight} text-gray-400`}>—</td>
                  <td className={`${dataCell} ${cellRight} text-gray-400`}>—</td>
                  <td className={`${dataCell} ${cellRight} text-gray-400`}>—</td>
                  <td className={`${dataCell} ${cellRight} text-gray-400`}>—</td>
                  <td className={`${dataCell} ${cellRight} bg-blue-50/50 text-gray-400`}>—</td>
                </tr>
              )}

              <tr className={rowCls("partyTotal")}>
                <td
                  className={`${dateCell} ${cellLeft} ${stickyDate} border-t-2 border-emerald-300 w-16 sm:w-20`}
                >
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] md:text-[10px] font-bold break-words">
                    TOTAL
                  </span>
                </td>
                <td
                  className={`${partyCell} ${cellLeft} ${stickyParty} border-t-2 border-emerald-300 w-20 sm:w-24`}
                  style={{ left: "var(--date-column-width, auto)" }}
                >
                  <span className="font-bold text-emerald-700 truncate max-w-[80px] sm:max-w-[96px] block">
                    -
                  </span>
                </td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-emerald-300`}>
                  <span className="font-bold text-emerald-700">
                    {num(party.partyTotal.paymentAmount)}
                  </span>
                </td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-emerald-300`}>
                  <span className="font-bold text-emerald-700">
                    {num(party.partyTotal.pwt)}
                  </span>
                </td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-emerald-300`}>
                  <span className="font-bold text-emerald-700">
                    {num(party.partyTotal.cash)}
                  </span>
                </td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-emerald-300`}>
                  <span className="font-bold text-emerald-700">
                    {num(party.partyTotal.bank)}
                  </span>
                </td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-emerald-300`}>
                  <span className="font-bold text-emerald-700">
                    {num(party.partyTotal.due)}
                  </span>
                </td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-emerald-300`}>
                  <span className="font-bold text-emerald-700">
                    {num(party.partyTotal.tda)}
                  </span>
                </td>
                <td
                  className={`${dataCell} ${cellRight} bg-emerald-100 border-t-2 border-emerald-400`}
                >
                  <span className="font-bold text-emerald-800 text-sm sm:text-base md:text-lg">
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
                <tr className="h-1.5 md:h-2 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100">
                  <td colSpan="9" className="border-b border-gray-200"></td>
                </tr>
              )}
            </React.Fragment>
          ))}

          {grandTotal && (
            <tr className={rowCls("grandTotal")}>
              <td
                className={`${dateCell} ${cellLeft} ${stickyDate} border-t-4 border-blue-500 w-16 sm:w-20`}
              >
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[9px] md:text-[10px] font-bold break-words">
                  GRAND
                </span>
              </td>
              <td
                className={`${partyCell} ${cellLeft} ${stickyParty} border-t-4 border-blue-500 w-20 sm:w-24`}
                style={{ left: "var(--date-column-width, auto)" }}
              >
                <span className="font-bold text-blue-800 truncate max-w-[80px] sm:max-w-[96px] block">
                  All
                </span>
              </td>
              <td className={`${dataCell} ${cellRight} border-t-4 border-blue-500`}>
                <span className="font-bold text-blue-800">
                  {num(grandTotal.paymentAmount)}
                </span>
              </td>
              <td className={`${dataCell} ${cellRight} border-t-4 border-blue-500`}>
                <span className="font-bold text-blue-800">
                  {num(grandTotal.pwt)}
                </span>
              </td>
              <td className={`${dataCell} ${cellRight} border-t-4 border-blue-500`}>
                <span className="font-bold text-blue-800">
                  {num(grandTotal.cash)}
                </span>
              </td>
              <td className={`${dataCell} ${cellRight} border-t-4 border-blue-500`}>
                <span className="font-bold text-blue-800">
                  {num(grandTotal.bank)}
                </span>
              </td>
              <td className={`${dataCell} ${cellRight} border-t-4 border-blue-500`}>
                <span className="font-bold text-blue-800">
                  {num(grandTotal.due)}
                </span>
              </td>
              <td className={`${dataCell} ${cellRight} border-t-4 border-blue-500`}>
                <span className="font-bold text-blue-800">
                  {num(grandTotal.tda)}
                </span>
              </td>
              <td
                className={`${dataCell} ${cellRight} bg-blue-200 border-t-4 border-blue-600`}
              >
                <span className="font-bold text-blue-900 text-base sm:text-lg md:text-xl">
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
              <tr className="h-2 md:h-3 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100">
                <td colSpan="9" className="border-b-2 border-gray-300"></td>
              </tr>

              {expenses.map((expense, idx) => (
                <tr key={expense._id || idx} className={rowCls("expense")}>
                  <td className={`${dateCell} ${cellLeft} ${stickyDate} w-16 sm:w-20`}>
                    <div className="flex flex-col leading-tight">
                      <span className="font-bold text-gray-900 break-words">
                        {new Date(expense.expenseDate).toLocaleDateString(
                          "en-IN",
                          { day: "2-digit", month: "short", year: "numeric" }
                        )}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-red-600 mt-0.5 font-medium uppercase tracking-wide break-words">
                        EXP
                      </span>
                    </div>
                  </td>
                  <td
                    className={`${partyCell} ${cellLeft} ${stickyParty} w-20 sm:w-24`}
                    style={{ left: "var(--date-column-width, auto)" }}
                  >
                    <div className="flex flex-col max-w-[80px] sm:max-w-[96px]">
                      <span className="font-bold text-gray-900 truncate">
                        {expense.expenseName}
                      </span>
                      {expense.expenseCategory && (
                        <span className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 truncate">
                          {expense.expenseCategory}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`${dataCell} ${cellRight} text-gray-400`}>—</td>
                  <td className={`${dataCell} ${cellRight} text-gray-400`}>—</td>
                  <td className={`${dataCell} ${cellRight}`}>
                    <span className="text-red-600 font-bold">
                      {num(expense.expenseAmount)}
                    </span>
                  </td>
                  <td className={`${dataCell} ${cellRight} text-gray-400`}>—</td>
                  <td className={`${dataCell} ${cellRight} text-gray-400`}>—</td>
                  <td className={`${dataCell} ${cellRight} text-gray-400`}>—</td>
                  <td className={`${dataCell} ${cellRight} bg-blue-50/50 text-gray-400`}>—</td>
                </tr>
              ))}

              <tr className={rowCls("expenseTotal")}>
                <td
                  className={`${dateCell} ${cellLeft} ${stickyDate} border-t-2 border-red-300 w-16 sm:w-20`}
                >
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[9px] md:text-[10px] font-bold break-words">
                    EXP
                  </span>
                </td>
                <td
                  className={`${partyCell} ${cellLeft} ${stickyParty} border-t-2 border-red-300 w-20 sm:w-24`}
                  style={{ left: "var(--date-column-width, auto)" }}
                >
                  <span className="font-bold text-red-700 truncate max-w-[80px] sm:max-w-[96px] block">
                    Tot Exp
                  </span>
                </td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-red-300 text-gray-400`}>—</td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-red-300 text-gray-400`}>—</td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-red-300`}>
                  <span className="font-bold text-red-700">
                    -{num(totalExpenses)}
                  </span>
                </td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-red-300 text-gray-400`}>—</td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-red-300 text-gray-400`}>—</td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-red-300 text-gray-400`}>—</td>
                <td className={`${dataCell} ${cellRight} border-t-2 border-red-300 text-gray-400`}>—</td>
              </tr>

              <tr className={rowCls("finalCash")}>
                <td
                  className={`${dateCell} ${cellLeft} ${stickyDate} border-t-4 border-green-500 w-16 sm:w-20`}
                >
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-green-600 text-white text-[9px] md:text-[10px] font-bold break-words">
                    FINAL
                  </span>
                </td>
                <td
                  className={`${partyCell} ${cellLeft} ${stickyParty} border-t-4 border-green-500 w-20 sm:w-24`}
                  style={{ left: "var(--date-column-width, auto)" }}
                >
                  <span className="font-bold text-green-800 truncate max-w-[80px] sm:max-w-[96px] block">
                    After
                  </span>
                </td>
                <td className={`${dataCell} ${cellRight} border-t-4 border-green-500 text-gray-400`}>—</td>
                <td className={`${dataCell} ${cellRight} border-t-4 border-green-500 text-gray-400`}>—</td>
                <td className={`${dataCell} ${cellRight} border-t-4 border-green-500`}>
                  <span className="font-bold text-green-800 text-base sm:text-lg md:text-xl">
                    {num(finalCash)}
                  </span>
                </td>
                <td className={`${dataCell} ${cellRight} border-t-4 border-green-500 text-gray-400`}>—</td>
                <td className={`${dataCell} ${cellRight} border-t-4 border-green-500 text-gray-400`}>—</td>
                <td className={`${dataCell} ${cellRight} border-t-4 border-green-500 text-gray-400`}>—</td>
                <td className={`${dataCell} ${cellRight} border-t-4 border-green-500 text-gray-400`}>—</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
