// src/pages/DailyPaymentsPage.jsx

import React, { useState, useEffect } from "react";
import {
  Trash2,
  AlertCircle,
  Check,
  Save,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
} from "lucide-react";
import { paymentAPI, partyAPI } from "../lib/api";
import { getWeekStart, getWeekEnd, formatWeekRange } from "../utils/dateUtils";

export default function DailyPaymentsPage() {
  const [allPayments, setAllPayments] = useState({});
  const [modifiedPayments, setModifiedPayments] = useState({});
  const [weeklyNPData, setWeeklyNPData] = useState({});
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedWeekStart, setSelectedWeekStart] = useState(() =>
    getWeekStart(new Date())
  );
  const selectedWeekEnd = getWeekEnd(selectedWeekStart);

  const [selectedParties, setSelectedParties] = useState([]);

  const [editingCell, setEditingCell] = useState(null);
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);

  const [formData, setFormData] = useState({
    paymentAmount: "",
    pwt: "",
    cash: "",
    bank: "",
    due: "",
    tda: "",
  });

  const cellOrder = ["paymentAmount", "pwt", "cash", "bank", "due", "tda"];

  const dateOnly = (d) => (d ? String(d).split("T")[0] : undefined);

  const generateDateArray = () => {
    const dateArray = [];
    const start = new Date(selectedWeekStart);
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dateArray.push(date.toISOString().split("T")[0]);
    }
    return dateArray;
  };

  const dateArray = generateDateArray();
  const totalDataRows = selectedParties.length * (dateArray.length + 1);

  useEffect(() => {
    fetchParties();
  }, []);

  useEffect(() => {
    if (selectedParties.length > 0) {
      fetchAllPayments();
      setModifiedPayments({});
    }
  }, [selectedWeekStart, selectedParties]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchParties = async () => {
    try {
      const response = await partyAPI.getDailyParties();
      setParties(response.data);
    } catch (error) {
      console.error("Error fetching parties:", error);
      setError("Failed to load parties");
    }
  };

  const fetchAllPayments = async () => {
    try {
      setLoading(true);
      const paymentsData = {};
      const weeklyNPMap = {};

      for (const partyId of selectedParties) {
        const response = await paymentAPI.getDailyPayments({
          partyId,
          startDate: selectedWeekStart,
          endDate: selectedWeekEnd,
        });

        let flat = [];

        if (Array.isArray(response.data)) {
          if (
            response.data.length &&
            response.data[0]?.payments &&
            typeof response.data[0].payments === "object"
          ) {
            const doc = response.data[0];
            flat = Object.entries(doc.payments || {}).map(([d, v]) => ({
              ...v,
              paymentDate: v?.paymentDate ? String(v.paymentDate) : d,
            }));
            if (doc.weeklyNP && typeof doc.weeklyNP === "object") {
              weeklyNPMap[partyId] = {
                name: doc.weeklyNP.name || "",
                amount: Number(doc.weeklyNP.amount) || 0,
              };
            }
          } else {
            flat = response.data.map((p) => ({
              ...p,
              paymentDate: p?.paymentDate ? String(p.paymentDate) : null,
            }));
          }
        } else if (
          response.data?.payments &&
          typeof response.data.payments === "object"
        ) {
          const doc = response.data;
          flat = Object.entries(doc.payments || {}).map(([d, v]) => ({
            ...v,
            paymentDate: v?.paymentDate ? String(v.paymentDate) : d,
          }));
          if (doc.weeklyNP && typeof doc.weeklyNP === "object") {
            weeklyNPMap[partyId] = {
              name: doc.weeklyNP.name || "",
              amount: Number(doc.weeklyNP.amount) || 0,
            };
          }
        } else {
          flat = [];
        }

        paymentsData[partyId] = flat;
      }

      setAllPayments(paymentsData);
      setWeeklyNPData(weeklyNPMap);
      setError("");
    } catch (error) {
      console.error("Error fetching payments:", error);
      setError("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousWeek = () => {
    const d = new Date(selectedWeekStart);
    d.setDate(d.getDate() - 7);
    setSelectedWeekStart(d.toISOString().split("T")[0]);
  };

  const goToNextWeek = () => {
    const d = new Date(selectedWeekStart);
    d.setDate(d.getDate() + 7);
    setSelectedWeekStart(d.toISOString().split("T")[0]);
  };

  const goToCurrentWeek = () => {
    setSelectedWeekStart(getWeekStart(new Date()));
  };

  const isCurrentWeek = selectedWeekStart === getWeekStart(new Date());

  const handlePartyToggle = (partyId) => {
    setSelectedParties((prev) => {
      if (prev.includes(partyId)) return prev.filter((id) => id !== partyId);
      return [...prev, partyId];
    });
    setCurrentRow(0);
    setCurrentCol(0);
    setEditingCell(null);
  };

  const pickDefinedNumbers = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (
        v !== "" &&
        v !== null &&
        v !== undefined &&
        !Number.isNaN(Number(v))
      ) {
        out[k] = Number(v);
      }
    }
    return out;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (editingCell) {
      const key = `${editingCell.partyId}-${editingCell.date}`;
      setModifiedPayments((prev) => {
        const existingRow =
          allPayments[editingCell.partyId]?.find(
            (p) => dateOnly(p.paymentDate) === editingCell.date
          ) || {};
        const prevData = prev[key]?.data || existingRow || {};
        const nextData = {
          ...prevData,
          [name]: value === "" ? undefined : Number(value),
        };
        const cleaned = pickDefinedNumbers(nextData);
        return {
          ...prev,
          [key]: {
            partyId: editingCell.partyId,
            date: editingCell.date,
            data: cleaned,
          },
        };
      });
    }
  };

  const handleKeyDown = (e) => {
    const navigationKeys = ["a", "A", "d", "D", "w", "W", "s", "S"];
    if (navigationKeys.includes(e.key) && editingCell) {
      e.preventDefault();

      let newRow = currentRow;
      let newCol = currentCol;

      if (e.key.toLowerCase() === "a") newCol = Math.max(0, currentCol - 1);
      if (e.key.toLowerCase() === "d")
        newCol = Math.min(cellOrder.length - 1, currentCol + 1);
      if (e.key.toLowerCase() === "w") newRow = Math.max(0, currentRow - 1);
      if (e.key.toLowerCase() === "s")
        newRow = Math.min(totalDataRows - 1, currentRow + 1);

      setCurrentRow(newRow);
      setCurrentCol(newCol);

      const newPartyIndex = Math.floor(newRow / (dateArray.length + 1));
      const newDateIndex = newRow % (dateArray.length + 1);

      if (
        newPartyIndex < selectedParties.length &&
        newDateIndex < dateArray.length
      ) {
        const newPartyId = selectedParties[newPartyIndex];
        const newDate = dateArray[newDateIndex];

        const newPaymentData = allPayments[newPartyId]?.find(
          (p) => dateOnly(p?.paymentDate) === newDate
        );
        const modKey = `${newPartyId}-${newDate}`;
        const modifiedData = modifiedPayments[modKey];

        setEditingCell({ partyId: newPartyId, date: newDate });

        const dataToLoad = modifiedData?.data || newPaymentData || {};
        setFormData({
          paymentAmount: dataToLoad.paymentAmount ?? "",
          pwt: dataToLoad.pwt ?? "",
          cash: dataToLoad.cash ?? "",
          bank: dataToLoad.bank ?? "",
          due: dataToLoad.due ?? "",
          tda: dataToLoad.tda ?? "",
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      paymentAmount: "",
      pwt: "",
      cash: "",
      bank: "",
      due: "",
      tda: "",
    });
    setEditingCell(null);
  };

  const updateCellData = (partyId, date) => {
    if (!editingCell) return;
    const key = `${partyId}-${date}`;
    setModifiedPayments((prev) => {
      const prevData = prev[key]?.data || {};
      const merged = {
        ...prevData,
        paymentAmount:
          formData.paymentAmount === ""
            ? undefined
            : Number(formData.paymentAmount),
        pwt: formData.pwt === "" ? undefined : Number(formData.pwt),
        cash: formData.cash === "" ? undefined : Number(formData.cash),
        bank: formData.bank === "" ? undefined : Number(formData.bank),
        due: formData.due === "" ? undefined : Number(formData.due),
        tda: formData.tda === "" ? undefined : Number(formData.tda),
      };
      const cleaned = pickDefinedNumbers(merged);
      return { ...prev, [key]: { partyId, date, data: cleaned } };
    });
  };

  const handleCellClick = (
    partyId,
    date,
    paymentData,
    colIndex,
    globalIndex
  ) => {
    const modKey = `${partyId}-${date}`;
    const modifiedData = modifiedPayments[modKey];

    const dataToLoad = modifiedData?.data || paymentData || {};

    setCurrentCol(colIndex);
    setCurrentRow(globalIndex);
    setEditingCell({ partyId, date });
    setFormData({
      paymentAmount: dataToLoad.paymentAmount ?? "",
      pwt: dataToLoad.pwt ?? "",
      cash: dataToLoad.cash ?? "",
      bank: dataToLoad.bank ?? "",
      due: dataToLoad.due ?? "",
      tda: dataToLoad.tda ?? "",
    });
  };

  const handleSaveAll = async () => {
    if (editingCell) {
      updateCellData(editingCell.partyId, editingCell.date);
    }

    const hasNP = Object.keys(weeklyNPData).length > 0;

    if (Object.keys(modifiedPayments).length === 0 && !hasNP) {
      setError("No changes to save");
      return;
    }

    try {
      setSaving(true);

      const paymentsToSave = [];

      for (const { partyId, date, data } of Object.values(modifiedPayments)) {
        const base = { party: partyId, paymentDate: date };
        for (const field of [
          "paymentAmount",
          "pwt",
          "cash",
          "bank",
          "due",
          "tda",
        ]) {
          if (typeof data[field] === "number") base[field] = data[field];
        }
        paymentsToSave.push(base);
      }

      Object.entries(weeklyNPData).forEach(([partyId, w]) => {
        const isAmountNumber = typeof w?.amount === "number";
        const isAmountEmpty =
          w?.amount === undefined || w?.amount === null || w?.amount === "";

        if (isAmountNumber || isAmountEmpty) {
          paymentsToSave.push({
            party: partyId,
            paymentDate: new Date().toISOString().split("T")[0],
            weeklyNP: {
              name: w?.name || "",
              amount: isAmountNumber ? w.amount : 0,
              clear: isAmountEmpty ? true : false,
            },
          });
        }
      });

      if (paymentsToSave.length === 0) {
        setError("No valid changes to save");
        return;
      }

      const payload = {
        payments: paymentsToSave,
        weekStartDate: selectedWeekStart,
        weekEndDate: selectedWeekEnd,
      };

      await paymentAPI.bulkUpsertPayments(payload);
      setSuccess(`Successfully saved ${paymentsToSave.length} record(s)`);
      setModifiedPayments({});
      setWeeklyNPData({});
      fetchAllPayments();
      resetForm();
      setError("");
    } catch (error) {
      console.error("Error saving payments:", error);
      setError(error.message || "Failed to save payments");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (partyId, date) => {
    const payment = allPayments[partyId]?.find(
      (p) => dateOnly(p?.paymentDate) === date
    );
    if (!payment) return;

    if (window.confirm("Are you sure you want to delete this payment?")) {
      try {
        await paymentAPI.deleteDailyPayment(payment._id);
        fetchAllPayments();
        setError("");
        setSuccess("Payment deleted successfully");
      } catch (error) {
        console.error("Error deleting payment:", error);
        setError("Failed to delete payment");
      }
    }
  };

  const getMergedPayments = (partyId) => {
    const savedPayments = allPayments[partyId] || [];
    const mergedMap = {};

    savedPayments.forEach((payment) => {
      const dateKey = dateOnly(payment?.paymentDate);
      if (!dateKey) return;
      mergedMap[dateKey] = { ...payment };
    });

    dateArray.forEach((date) => {
      const modKey = `${partyId}-${date}`;
      if (modifiedPayments[modKey]) {
        mergedMap[date] = {
          ...mergedMap[date],
          paymentDate: date,
          ...modifiedPayments[modKey].data,
        };
      }
    });

    return Object.values(mergedMap);
  };

  const totalsByParty = {};
  selectedParties.forEach((partyId) => {
    const payments = getMergedPayments(partyId);
    totalsByParty[partyId] = {
      amount: payments.reduce((sum, p) => sum + (p.paymentAmount || 0), 0),
      pwt: payments.reduce((sum, p) => sum + (p.pwt || 0), 0),
      cash: payments.reduce((sum, p) => sum + (p.cash || 0), 0),
      bank: payments.reduce((sum, p) => sum + (p.bank || 0), 0),
      due: payments.reduce((sum, p) => sum + (p.due || 0), 0),
      tda: payments.reduce((sum, p) => sum + (p.tda || 0), 0),
    };
  });

  const grandTotals = {
    amount: Object.values(totalsByParty).reduce((sum, t) => sum + t.amount, 0),
    pwt: Object.values(totalsByParty).reduce((sum, t) => sum + t.pwt, 0),
    cash: Object.values(totalsByParty).reduce((sum, t) => sum + t.cash, 0),
    bank: Object.values(totalsByParty).reduce((sum, t) => sum + t.bank, 0),
    due: Object.values(totalsByParty).reduce((sum, t) => sum + t.due, 0),
    tda: Object.values(totalsByParty).reduce((sum, t) => sum + t.tda, 0),
  };

  const formatDateDisplay = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  const renderCell = (
    colIndex,
    isEditing,
    isCurrentCell,
    paymentData,
    partyId,
    date,
    globalIndex
  ) => {
    const fieldName = cellOrder[colIndex];
    const cellValue = formData[fieldName];
    const displayValue =
      typeof paymentData?.[fieldName] === "number" ? paymentData[fieldName] : 0;

    return (
      <td
        className={`border border-gray-200 px-3 py-2 text-right cursor-pointer transition-colors ${
          isCurrentCell ? "bg-emerald-100" : "hover:bg-gray-50"
        }`}
        onClick={() =>
          handleCellClick(partyId, date, paymentData, colIndex, globalIndex)
        }
      >
        {isEditing && isCurrentCell ? (
          <input
            type="number"
            name={fieldName}
            value={cellValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full px-2 py-1 border-2 border-emerald-500 rounded text-sm text-black focus:outline-none focus:ring-2 focus:ring-emerald-300 text-right"
          />
        ) : (
          <span
            className={`text-sm font-medium ${
              displayValue ? "text-gray-900" : "text-gray-400"
            }`}
          >
            {displayValue ? displayValue.toLocaleString() : "-"}
          </span>
        )}
      </td>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Notifications - Right Side */}
      <div className="fixed top-4 right-4 z-50 space-y-3 w-96">
        {/* Error Toast */}
        {error && (
          <div className="bg-white border-2 border-red-400 rounded-lg shadow-2xl overflow-hidden animate-slide-in-right">
            <div className="flex items-start p-4">
              <div className="flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-bold text-red-900">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setError("")}
                className="flex-shrink-0 ml-4 text-red-400 hover:text-red-600 transition-colors"
              >
                <span className="text-xl font-bold">×</span>
              </button>
            </div>
            <div className="h-1 bg-red-500 animate-progress"></div>
          </div>
        )}

        {/* Success Toast */}
        {success && (
          <div className="bg-white border-2 border-green-400 rounded-lg shadow-2xl overflow-hidden animate-slide-in-right">
            <div className="flex items-start p-4">
              <div className="flex-shrink-0">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-bold text-green-900">Success</h3>
                <p className="mt-1 text-sm text-green-700">{success}</p>
              </div>
              <button
                onClick={() => setSuccess("")}
                className="flex-shrink-0 ml-4 text-green-400 hover:text-green-600 transition-colors"
              >
                <span className="text-xl font-bold">×</span>
              </button>
            </div>
            <div className="h-1 bg-green-500 animate-progress"></div>
          </div>
        )}

        {/* Loading Toast - Data Fetching */}
        {loading && (
          <div className="bg-white border-2 border-blue-400 rounded-lg shadow-2xl overflow-hidden animate-slide-in-right">
            <div className="flex items-start p-4">
              <div className="flex-shrink-0">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-bold text-blue-900">Loading</h3>
                <p className="mt-1 text-sm text-blue-700">
                  Fetching payment data...
                </p>
              </div>
            </div>
            <div className="h-1 bg-blue-500">
              <div className="h-full bg-blue-600 animate-loading-bar"></div>
            </div>
          </div>
        )}

        {/* Saving Toast */}
        {saving && (
          <div className="bg-white border-2 border-purple-400 rounded-lg shadow-2xl overflow-hidden animate-slide-in-right">
            <div className="flex items-start p-4">
              <div className="flex-shrink-0">
                <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-bold text-purple-900">Saving</h3>
                <p className="mt-1 text-sm text-purple-700">
                  Saving payment records...
                </p>
              </div>
            </div>
            <div className="h-1 bg-purple-500">
              <div className="h-full bg-purple-600 animate-loading-bar"></div>
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-full mx-auto px-6 py-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            Daily Payments
          </h1>

          {/* Week Range Selector */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-bold text-purple-700 mb-2 uppercase tracking-wider">
                  Selected Week Range (7 Days - Monday to Sunday)
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
                📌 All payments will be recorded for this 7-day period (Monday
                to Sunday). Always 7 days selected.
              </p>
            </div>
          </div>

          {/* Save Button - Fixed Right Side, Always Visible */}
          <div className="fixed top-4 right-6 z-50">
            <button
              onClick={handleSaveAll}
              disabled={
                saving ||
                (Object.keys(modifiedPayments).length === 0 &&
                  Object.keys(weeklyNPData).length === 0)
              }
              className="flex items-center space-x-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors shadow-lg"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>
                    Save All{" "}
                    {Object.keys(modifiedPayments).length +
                      Object.keys(weeklyNPData).length >
                      0 &&
                      `(${
                        Object.keys(modifiedPayments).length +
                        Object.keys(weeklyNPData).length
                      })`}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Party Selection */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">
              Select Parties:
            </p>
            <div className="flex flex-wrap gap-3">
              {parties.map((party) => (
                <button
                  key={party._id}
                  onClick={() => handlePartyToggle(party._id)}
                  className={`px-5 py-2 rounded-lg font-semibold transition-all ${
                    selectedParties.includes(party._id)
                      ? "bg-emerald-500 text-white shadow-lg scale-105"
                      : "bg-white text-gray-700 border-2 border-gray-200 hover:border-emerald-400 hover:bg-gray-50"
                  }`}
                >
                  {party.partyName}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Table (Keep rest of your existing table code) */}
      {selectedParties.length > 0 ? (
        <div className="max-w-full mx-auto px-6 py-8">
          <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-lg">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto" />
                <p className="mt-4 text-gray-600 font-medium">
                  Loading payment data...
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {selectedParties.map((partyId, partyIndex) => {
                      const partyName = parties.find(
                        (p) => p._id === partyId
                      )?.partyName;
                      const payments = getMergedPayments(partyId);
                      const totals = totalsByParty[partyId];

                      return (
                        <React.Fragment key={partyId}>
                          {/* Header row */}
                          <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b-2 border-gray-300">
                            <th className="border border-gray-200 px-4 py-3 text-left text-xs font-bold text-gray-800 w-20">
                              DATE
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-left text-xs font-bold text-gray-800 w-28">
                              PARTY NAME
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-xs font-bold text-gray-800 w-24">
                              PAYMENT
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-xs font-bold text-gray-800 w-20">
                              PWT
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-xs font-bold text-gray-800 w-20">
                              CASH
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-xs font-bold text-gray-800 w-20">
                              BANK
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-xs font-bold text-gray-800 w-20">
                              DUE
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-xs font-bold text-gray-800 w-20">
                              TDA
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-xs font-bold text-gray-800 w-24">
                              TOTAL
                            </th>
                            <th className="border border-gray-200 px-4 py-3 text-center text-xs font-bold text-gray-800 w-16">
                              ACT
                            </th>
                          </tr>

                          {/* Data rows */}
                          {dateArray.map((date, dayIndex) => {
                            const globalIndex =
                              partyIndex * (dateArray.length + 1) + dayIndex;
                            const payment = allPayments[partyId]?.find(
                              (p) => dateOnly(p?.paymentDate) === date
                            );
                            const modKey = `${partyId}-${date}`;
                            const modifiedData = modifiedPayments[modKey];
                            const isCurrentRow = globalIndex === currentRow;
                            const isEditing =
                              editingCell?.partyId === partyId &&
                              editingCell?.date === date;

                            const displayPayment =
                              modifiedData?.data || payment || {};
                            const rowTotal =
                              (displayPayment?.pwt || 0) +
                              (displayPayment?.cash || 0) +
                              (displayPayment?.bank || 0) +
                              (displayPayment?.due || 0) +
                              (displayPayment?.tda || 0);

                            return (
                              <tr
                                key={`${partyId}-${date}`}
                                className={`border-b border-gray-200 cursor-pointer transition-colors ${
                                  isEditing
                                    ? "bg-emerald-50"
                                    : modifiedData
                                    ? "bg-yellow-50"
                                    : isCurrentRow
                                    ? "bg-blue-50"
                                    : "hover:bg-gray-50"
                                }`}
                              >
                                <td className="border border-gray-200 px-4 py-2">
                                  <span className="text-sm font-semibold text-gray-900">
                                    {new Date(date).toLocaleDateString(
                                      "en-IN",
                                      {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "2-digit",
                                      }
                                    )}
                                  </span>
                                </td>
                                <td className="border border-gray-200 px-4 py-2">
                                  <span className="text-sm font-bold text-gray-900">
                                    {partyName}
                                  </span>
                                </td>

                                {[0, 1, 2, 3, 4, 5].map((colIndex) =>
                                  renderCell(
                                    colIndex,
                                    isEditing,
                                    isCurrentRow && currentCol === colIndex,
                                    displayPayment,
                                    partyId,
                                    date,
                                    globalIndex
                                  )
                                )}

                                <td className="border border-gray-200 px-4 py-2 text-right bg-gray-50">
                                  <span
                                    className={`text-sm font-bold ${
                                      modifiedData
                                        ? "text-yellow-600"
                                        : "text-gray-900"
                                    }`}
                                  >
                                    {rowTotal.toLocaleString()}
                                  </span>
                                </td>

                                <td className="border border-gray-200 px-4 py-2 text-center">
                                  {payment ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(partyId, date);
                                      }}
                                      className="inline-flex items-center justify-center w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Weekly NP Row */}
                          <tr
                            className={`border-b border-gray-200 cursor-pointer transition-colors ${
                              currentRow ===
                              partyIndex * (dateArray.length + 1) +
                                dateArray.length
                                ? "bg-blue-50"
                                : "bg-white hover:bg-gray-50"
                            }`}
                            onClick={() =>
                              setCurrentRow(
                                partyIndex * (dateArray.length + 1) +
                                  dateArray.length
                              )
                            }
                          >
                            <td className="border border-gray-200 px-4 py-2">
                              <span className="text-sm text-gray-400"></span>
                            </td>
                            <td className="border border-gray-200 px-4 py-2 text-left cursor-pointer">
                              <input
                                type="text"
                                value={weeklyNPData[partyId]?.name || ""}
                                onChange={(e) => {
                                  const nameVal = e.target.value;
                                  setWeeklyNPData((prev) => {
                                    const existing = prev[partyId] || {};
                                    const amountVal =
                                      typeof existing.amount === "number"
                                        ? existing.amount
                                        : existing.amount;

                                    if (
                                      (nameVal ?? "") === "" &&
                                      (amountVal === undefined ||
                                        amountVal === null ||
                                        amountVal === "")
                                    ) {
                                      const next = { ...prev };
                                      delete next[partyId];
                                      return next;
                                    }

                                    return {
                                      ...prev,
                                      [partyId]: {
                                        name: nameVal,
                                        amount: amountVal,
                                      },
                                    };
                                  });
                                }}
                                placeholder="NP Name"
                                className="w-full px-2 py-1 border-2 rounded text-sm text-black focus:outline-none border-gray-300 focus:border-emerald-500"
                              />
                            </td>
                            <td className="border border-gray-200 px-4 py-2 text-right cursor-pointer">
                              <input
                                type="number"
                                value={weeklyNPData[partyId]?.amount ?? ""}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  setWeeklyNPData((prev) => {
                                    const nameVal = prev[partyId]?.name || "";

                                    if (raw === "") {
                                      if (!nameVal) {
                                        const next = { ...prev };
                                        delete next[partyId];
                                        return next;
                                      }
                                      return {
                                        ...prev,
                                        [partyId]: {
                                          name: nameVal,
                                          amount: undefined,
                                        },
                                      };
                                    }

                                    const num = Number(raw);
                                    return {
                                      ...prev,
                                      [partyId]: {
                                        name: nameVal,
                                        amount: Number.isNaN(num)
                                          ? undefined
                                          : num,
                                      },
                                    };
                                  });
                                }}
                                placeholder="NP Amount"
                                className="w-full px-2 py-1 border-2 rounded text-sm text-black focus:outline-none text-right border-gray-300 focus:border-emerald-500"
                              />
                            </td>
                            <td
                              colSpan="5"
                              className="border border-gray-200 px-4 py-2"
                            ></td>
                            <td className="border border-gray-200 px-4 py-2 text-right bg-gray-50">
                              <span className="text-sm font-bold text-gray-900">
                                -
                              </span>
                            </td>
                            <td className="border border-gray-200 px-4 py-2"></td>
                          </tr>

                          {/* Party Total Row */}
                          <tr className="bg-gradient-to-r from-emerald-50 to-emerald-25 border-t-2 border-b-2 border-emerald-400 font-bold">
                            <td className="border border-gray-200 px-4 py-3 text-left text-sm text-gray-900">
                              PARTY TOTAL
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-left text-sm text-emerald-700"></td>
                            <td className="border border-gray-200 px-4 py-3 text-right text-gray-900">
                              {(
                                totals.amount +
                                (typeof weeklyNPData[partyId]?.amount ===
                                "number"
                                  ? weeklyNPData[partyId].amount
                                  : 0)
                              ).toLocaleString()}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-right text-gray-900">
                              {totals.pwt.toLocaleString()}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-right text-gray-900">
                              {totals.cash.toLocaleString()}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-right text-gray-900">
                              {totals.bank.toLocaleString()}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-right text-gray-900">
                              {totals.due.toLocaleString()}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-right text-gray-900">
                              {totals.tda.toLocaleString()}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-right bg-emerald-100 text-emerald-700">
                              {(
                                totals.pwt +
                                totals.cash +
                                totals.bank +
                                totals.due +
                                totals.tda
                              ).toLocaleString()}
                            </td>
                            <td className="border border-gray-200 px-4 py-3"></td>
                          </tr>

                          {/* Spacer between parties */}
                          {partyIndex < selectedParties.length - 1 && (
                            <tr className="h-1 bg-gray-100">
                              <td colSpan="10"></td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Final Total Row */}
                    <tr className="bg-gradient-to-r from-blue-50 to-blue-25 border-t-2 border-blue-400 font-bold">
                      <td
                        colSpan="2"
                        className="border border-gray-200 px-4 py-3 text-left text-sm text-blue-700"
                      >
                        FINAL TOTAL
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-right text-gray-900">
                        {(
                          grandTotals.amount +
                          Object.values(weeklyNPData).reduce(
                            (sum, item) =>
                              sum +
                              (typeof item?.amount === "number"
                                ? item.amount
                                : 0),
                            0
                          )
                        ).toLocaleString()}
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-right text-gray-900">
                        {grandTotals.pwt.toLocaleString()}
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-right text-gray-900">
                        {grandTotals.cash.toLocaleString()}
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-right text-gray-900">
                        {grandTotals.bank.toLocaleString()}
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-right text-gray-900">
                        {grandTotals.due.toLocaleString()}
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-right text-gray-900">
                        {grandTotals.tda.toLocaleString()}
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-right bg-blue-100 text-blue-700">
                        {(
                          grandTotals.pwt +
                          grandTotals.cash +
                          grandTotals.bank +
                          grandTotals.due +
                          grandTotals.tda
                        ).toLocaleString()}
                      </td>
                      <td className="border border-gray-200 px-4 py-3"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-full mx-auto px-6 py-16">
          <div className="text-center bg-white rounded-xl p-12 border-2 border-gray-200">
            <p className="text-xl text-gray-600 font-semibold">
              👆 Select week and parties to view payments
            </p>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }

        @keyframes loading-bar {
          0% {
            width: 0%;
          }
          50% {
            width: 70%;
          }
          100% {
            width: 100%;
          }
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }

        .animate-progress {
          animation: progress 3s linear forwards;
        }

        .animate-loading-bar {
          animation: loading-bar 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
