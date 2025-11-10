// src/pages/MultiDayPaymentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Save,
  Calendar,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { paymentAPI, partyAPI, authAPI } from "../lib/api";

// ============================================================================
// DATE-ONLY UTILITIES (No timezone conversions - imported from dateUtils)
// ============================================================================
const pad2 = (n) => String(n).padStart(2, "0");

const fromYMD = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const dayOfWeek1to7 = (ymd) => {
  const d = fromYMD(ymd);
  const dow0 = d.getDay();
  return dow0 === 0 ? 7 : dow0;
};

const getWeekStart = (date) => {
  const ymd = typeof date === "string" ? date : toYMD(date);
  const d = fromYMD(ymd);
  const dow = dayOfWeek1to7(ymd);
  d.setDate(d.getDate() - (dow - 1));
  return toYMD(d);
};

const getWeekEnd = (mondayYmd) => {
  const d = fromYMD(mondayYmd);
  d.setDate(d.getDate() + 6);
  return toYMD(d);
};

const formatWeekRange = (startYmd, endYmd) => {
  const start = fromYMD(startYmd);
  const end = fromYMD(endYmd);
  const opts = { day: "2-digit", month: "short", year: "numeric" };
  return `${start.toLocaleDateString("en-IN", opts)} - ${end.toLocaleDateString(
    "en-IN",
    opts
  )}`;
};

// ============================================================================
// DATA UTILITIES
// ============================================================================
const cellOrder = ["paymentAmount", "pwt", "cash", "bank", "due", "atd"];
const dateOnly = (d) => (d ? toYMD(new Date(d)) : undefined);

// Empty row defaults to current selected week
const emptyRow = (weekStart, weekEnd) => ({
  id: crypto.randomUUID(),
  startDate: weekStart,
  endDate: weekEnd,
  fields: { paymentAmount: "", pwt: "", cash: "", bank: "", due: "", atd: "" },
  paymentMode: "MIXED",
  notes: "",
  temp: true,
  editingDate: false,
});

const pickDefinedNumbers = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== "" && v !== null && v !== undefined && !Number.isNaN(Number(v)))
      out[k] = Number(v);
  }
  return out;
};

// ============================================================================
// UI COMPONENTS
// ============================================================================

// Toast Alert
const ToastAlert = ({ type = "info", message, onClose }) => {
  const styles = {
    success: "bg-emerald-50 border-emerald-400 text-emerald-800",
    error: "bg-red-50 border-red-400 text-red-800",
    info: "bg-blue-50 border-blue-400 text-blue-800",
    warning: "bg-amber-50 border-amber-400 text-amber-800",
  };
  const icons = {
    success: <Check className="w-5 h-5 flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 flex-shrink-0" />,
    info: <AlertCircle className="w-5 h-5 flex-shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 flex-shrink-0" />,
  };
  return (
    <div
      className={`fixed top-6 right-6 z-50 min-w-[320px] max-w-md p-4 border-2 rounded-lg shadow-2xl flex items-center justify-between gap-3 animate-slide-in-right ${styles[type]}`}
      style={{ animation: "slideInRight 0.3s ease-out" }}
    >
      <div className="flex items-center gap-3">
        {icons[type]}
        <p className="font-medium">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="hover:opacity-70 transition-opacity"
          aria-label="Close alert"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

// Loading overlays
const LoadingOverlay = ({ message = "Loading..." }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
      <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      <p className="text-lg font-semibold text-gray-900">{message}</p>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-emerald-500 h-full rounded-full animate-pulse"
          style={{ width: "100%" }}
        ></div>
      </div>
    </div>
  </div>
);

const InlineLoader = ({ message = "Loading..." }) => (
  <div className="p-12 text-center">
    <div className="inline-flex flex-col items-center gap-4">
      <Loader2 className="w-16 h-16 text-emerald-500 animate-spin" />
      <p className="text-lg font-semibold text-gray-700">{message}</p>
    </div>
  </div>
);

// Week Range Selector - FIXED with date-only logic
const WeekRangeSelector = ({ selectedWeekStart, onWeekChange }) => {
  const weekEnd = getWeekEnd(selectedWeekStart);

  const goToPreviousWeek = () => {
    const d = fromYMD(selectedWeekStart);
    d.setDate(d.getDate() - 7);
    onWeekChange(toYMD(d));
  };

  const goToNextWeek = () => {
    const d = fromYMD(selectedWeekStart);
    d.setDate(d.getDate() + 7);
    onWeekChange(toYMD(d));
  };

  const goToCurrentWeek = () => onWeekChange(getWeekStart(new Date()));
  const isCurrentWeek = selectedWeekStart === getWeekStart(new Date());

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-md font-bold text-purple-700 mb-2 uppercase tracking-wider">
            Selected Week Range (7 Days - Monday to Sunday)
          </p>
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-purple-600" />
            <span className="text-2xl font-bold text-gray-900">
              {formatWeekRange(selectedWeekStart, weekEnd)}
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
        <p className="text-md text-purple-600 font-medium">
          📌 All entries will be recorded for this 7-day period (Monday to
          Sunday). Expense dates are limited to this week.
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function MultiDayPaymentsPage() {
  // Selected week state (defaults to current week)
  const [selectedWeekStart, setSelectedWeekStart] = useState(() =>
    getWeekStart(new Date())
  );
  const selectedWeekEnd = getWeekEnd(selectedWeekStart);

  const [parties, setParties] = useState([]);
  const [selectedParties, setSelectedParties] = useState([]);
  const [rowsByParty, setRowsByParty] = useState({});
  const [serverRowsByParty, setServerRowsByParty] = useState({});
  const [modifiedRows, setModifiedRows] = useState({});
  const [weeklyNPByParty, setWeeklyNPByParty] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [formData, setFormData] = useState({
    paymentAmount: "",
    pwt: "",
    cash: "",
    bank: "",
    due: "",
    atd: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // NEW: Role-based authentication state
  const [userRole, setUserRole] = useState("employee");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  // NEW: Fetch user role on component mount
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

  // Load parties
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const res = await partyAPI.getMultiDayParties();
        setParties(res.data || []);
      } catch {
        setError("Failed to load parties");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // Fetch weekly docs and map to grid rows for selected week
  useEffect(() => {
    const run = async () => {
      if (selectedParties.length === 0) return;
      try {
        setLoading(true);
        const map = {};
        const npMap = {};

        for (const partyId of selectedParties) {
          const res = await paymentAPI.getMultiDayPayments({ partyId });
          const weeks = Array.isArray(res.data) ? res.data : [];

          const rows = [];
          let np = { name: "", amount: 0 };

          for (const w of weeks) {
            const wStart = dateOnly(w.weekStartDate);
            if (wStart !== selectedWeekStart) continue;

            if (w.weeklyNP && typeof w.weeklyNP === "object") {
              np = {
                name: w.weeklyNP.name || "",
                amount: Number(w.weeklyNP.amount) || 0,
                _id: w._id,
              };
            }

            const ranges = Array.isArray(w.paymentRanges)
              ? w.paymentRanges
              : [];
            for (const range of ranges) {
              const s = dateOnly(range.startDate);
              const e = dateOnly(range.endDate);
              rows.push({
                id: `${w._id}-${s}-${e}`,
                startDate: s,
                endDate: e,
                fields: {
                  paymentAmount: range.paymentAmount ?? "",
                  pwt: range.pwt ?? "",
                  cash: range.cash ?? "",
                  bank: range.bank ?? "",
                  due: range.due ?? "",
                  atd: range.tda ?? "",
                },
                paymentMode: "MIXED",
                notes: "",
                temp: false,
                editingDate: false,
                _weekMeta: {
                  weekId: w._id,
                  weekStartDate: w.weekStartDate,
                  weekEndDate: w.weekEndDate,
                },
              });
            }
          }

          map[partyId] = rows.sort((a, b) =>
            a.startDate < b.startDate ? -1 : 1
          );
          npMap[partyId] = np;
        }

        setServerRowsByParty(map);
        setRowsByParty((prev) => {
          const next = { ...prev };
          for (const pid of selectedParties) {
            if (!next[pid]) next[pid] = (map[pid] || []).slice();
            else next[pid] = map[pid] || [];
          }
          return next;
        });
        setWeeklyNPByParty((prev) => ({ ...prev, ...npMap }));
        setError("");
      } catch {
        setError("Failed to load payments");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [selectedParties, selectedWeekStart]);

  // Auto-dismiss alerts
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 3000);
    return () => clearTimeout(t);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const handlePartyToggle = (partyId) => {
    setSelectedParties((prev) => {
      const isCurrentlySelected = prev.includes(partyId);

      if (!isCurrentlySelected) {
        // Party is being added - check if rows already exist from DB
        setRowsByParty((prevRows) => {
          const existing = prevRows[partyId];
          // Only auto-create row if NO rows exist (not even from DB)
          if (!existing || existing.length === 0) {
            const weekStartDate = fromYMD(selectedWeekStart);
            const firstStart = toYMD(weekStartDate);
            const firstEndDate = new Date(weekStartDate);
            firstEndDate.setDate(firstEndDate.getDate() + 2);
            const firstEnd = toYMD(firstEndDate);

            return {
              ...prevRows,
              [partyId]: [
                {
                  id: crypto.randomUUID(),
                  startDate: firstStart,
                  endDate: firstEnd,
                  fields: {
                    paymentAmount: "",
                    pwt: "",
                    cash: "",
                    bank: "",
                    due: "",
                    atd: "",
                  },
                  paymentMode: "MIXED",
                  notes: "",
                  temp: true,
                  editingDate: false,
                },
              ],
            };
          }
          return prevRows;
        });
      }

      return isCurrentlySelected
        ? prev.filter((x) => x !== partyId)
        : [...prev, partyId];
    });

    setCurrentRow(0);
    setCurrentCol(0);
    setEditingCell(null);
  };

  const tableRows = useMemo(() => {
    const out = [];
    selectedParties.forEach((partyId) => {
      const partyRows = rowsByParty[partyId] || [];
      partyRows.forEach((r) => out.push({ partyId, row: r }));
    });
    return out;
  }, [rowsByParty, selectedParties]);

  const totalDataRows = tableRows.length;

  const commitEditingCell = () => {
    if (!editingCell) return;
    const { partyId, rowId } = editingCell;
    setModifiedRows((prev) => {
      const key = `${partyId}-${rowId}`;
      const baseRow =
        (rowsByParty[partyId] || []).find((r) => r.id === rowId) || {};
      const merged = { ...(baseRow.fields || {}), ...formData };
      const cleaned = pickDefinedNumbers(merged);
      return {
        ...prev,
        [key]: {
          partyId,
          rowId,
          fields: cleaned,
          startDate: baseRow.startDate,
          endDate: baseRow.endDate,
        },
      };
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Update formData immediately for the input field
    setFormData((p) => ({
      ...p,
      [name]: value, // Keep as string for controlled input
    }));

    if (editingCell) {
      const { partyId, rowId } = editingCell;
      const key = `${partyId}-${rowId}`;

      setModifiedRows((prev) => {
        const existing = prev[key]?.fields || {};
        const nextFields = {
          ...existing,
          [name]: value === "" ? undefined : Number(value), // Convert to number for storage
        };

        return {
          ...prev,
          [key]: {
            partyId,
            rowId,
            fields: pickDefinedNumbers(nextFields),
            startDate:
              prev[key]?.startDate ??
              rowsByParty[partyId]?.find((r) => r.id === rowId)?.startDate,
            endDate:
              prev[key]?.endDate ??
              rowsByParty[partyId]?.find((r) => r.id === rowId)?.endDate,
          },
        };
      });
    }
  };

  const handleKeyDown = (e) => {
    const k = e.key.toLowerCase();
    if (!editingCell || !["a", "d", "w", "s"].includes(k)) return;
    e.preventDefault();
    let newRow = currentRow;
    let newCol = currentCol;
    if (k === "a") newCol = Math.max(0, currentCol - 1);
    if (k === "d") newCol = Math.min(cellOrder.length - 1, currentCol + 1);
    if (k === "w") newRow = Math.max(0, currentRow - 1);
    if (k === "s") newRow = Math.min(totalDataRows - 1, currentRow + 1);

    setCurrentRow(newRow);
    setCurrentCol(newCol);

    const target = tableRows[newRow];
    if (!target) return;
    const { partyId, row } = target;
    const modKey = `${partyId}-${row.id}`;
    const modified = modifiedRows[modKey];

    setEditingCell({ partyId, rowId: row.id, field: cellOrder[newCol] });
    const dataToLoad = { ...(row.fields || {}), ...(modified?.fields || {}) };
    setFormData({
      paymentAmount: dataToLoad.paymentAmount ?? "",
      pwt: dataToLoad.pwt ?? "",
      cash: dataToLoad.cash ?? "",
      bank: dataToLoad.bank ?? "",
      due: dataToLoad.due ?? "",
      atd: dataToLoad.atd ?? "",
    });
  };

  const handleCellClick = (partyId, row, colIndex, globalRowIndex) => {
    const modKey = `${partyId}-${row.id}`;
    const modified = modifiedRows[modKey];
    const dataToLoad = { ...(row.fields || {}), ...(modified?.fields || {}) };

    setCurrentCol(colIndex);
    setCurrentRow(globalRowIndex);
    setEditingCell({ partyId, rowId: row.id, field: cellOrder[colIndex] });
    setFormData({
      paymentAmount: dataToLoad.paymentAmount ?? "",
      pwt: dataToLoad.pwt ?? "",
      cash: dataToLoad.cash ?? "",
      bank: dataToLoad.bank ?? "",
      due: dataToLoad.due ?? "",
      atd: dataToLoad.atd ?? "",
    });
  };

  // Add only ONE row based on remaining days
  const addRow = (partyId) => {
    setRowsByParty((prev) => {
      const next = { ...(prev || {}) };
      const arr = next[partyId] ? [...next[partyId]] : [];

      const existingRanges = arr.map((r) => ({
        start: r.startDate,
        end: r.endDate,
      }));

      existingRanges.sort((a, b) => a.start.localeCompare(b.start));

      let newStartDate, newEndDate;

      if (existingRanges.length === 0) {
        // No existing rows - create first row
        newStartDate = selectedWeekStart;
        const endDate = fromYMD(selectedWeekStart);
        endDate.setDate(endDate.getDate() + 2);
        newEndDate = toYMD(endDate);
      } else {
        // Check if there's a gap at the BEGINNING of the week
        const firstExistingStart = existingRanges[0].start;

        if (firstExistingStart > selectedWeekStart) {
          // Gap exists at the beginning - fill it
          newStartDate = selectedWeekStart;
          const dayBeforeFirstRow = fromYMD(firstExistingStart);
          dayBeforeFirstRow.setDate(dayBeforeFirstRow.getDate() - 1);
          newEndDate = toYMD(dayBeforeFirstRow);
        } else {
          // No gap at beginning - add after last row
          const lastRow = existingRanges[existingRanges.length - 1];
          const nextStart = fromYMD(lastRow.end);
          nextStart.setDate(nextStart.getDate() + 1);
          newStartDate = toYMD(nextStart);
          newEndDate = selectedWeekEnd;
        }
      }

      // Only add if the new start date is within the week range
      if (newStartDate <= selectedWeekEnd) {
        arr.push({
          id: crypto.randomUUID(),
          startDate: newStartDate,
          endDate: newEndDate,
          fields: {
            paymentAmount: "",
            pwt: "",
            cash: "",
            bank: "",
            due: "",
            atd: "",
          },
          paymentMode: "MIXED",
          notes: "",
          temp: true,
          editingDate: false,
        });

        // Sort the array after adding the new row
        arr.sort((a, b) => a.startDate.localeCompare(b.startDate));
      }

      next[partyId] = arr;
      return next;
    });
  };

  // Delete local row
  const deleteRow = async (partyId, row) => {
    if (!window.confirm("Delete this entry?")) return;
    setRowsByParty((prev) => ({
      ...prev,
      [partyId]: (prev[partyId] || []).filter((r) => r.id !== row.id),
    }));
    setModifiedRows((prev) => {
      const key = `${partyId}-${row.id}`;
      const { [key]: _, ...rest } = prev;
      return rest;
    });
    setError("");
  };

  // Validate date edits: within selected week
  const updateRowDate = (partyId, rowId, next) => {
    const newStart = next.startDate;
    const newEnd = next.endDate;

    if (
      newStart &&
      (newStart < selectedWeekStart || newStart > selectedWeekEnd)
    ) {
      setError(
        `Start date must be within selected week (${formatWeekRange(
          selectedWeekStart,
          selectedWeekEnd
        )})`
      );
      return;
    }
    if (newEnd && (newEnd < selectedWeekStart || newEnd > selectedWeekEnd)) {
      setError(
        `End date must be within selected week (${formatWeekRange(
          selectedWeekStart,
          selectedWeekEnd
        )})`
      );
      return;
    }

    if (newStart && newEnd) {
      const start = fromYMD(newStart);
      const end = fromYMD(newEnd);
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        setError("End date must be after start date");
        return;
      }
    }

    setRowsByParty((prev) => {
      const list = (prev[partyId] || []).map((r) =>
        r.id === rowId ? { ...r, ...next } : r
      );
      return { ...prev, [partyId]: list };
    });
    setModifiedRows((prev) => {
      const key = `${partyId}-${rowId}`;
      const entry = prev[key] || { partyId, rowId, fields: {} };
      return {
        ...prev,
        [key]: {
          ...entry,
          startDate: next.startDate ?? entry.startDate,
          endDate: next.endDate ?? entry.endDate,
        },
      };
    });
    setError("");
  };

  const handleSaveAll = async () => {
    commitEditingCell();

    const payloadItems = [];
    const weekStartDate = selectedWeekStart;
    const weekEndDate = selectedWeekEnd;

    for (const { partyId, row } of tableRows) {
      const key = `${partyId}-${row.id}`;
      const mod = modifiedRows[key];
      const mergedFields = pickDefinedNumbers({
        ...(row.fields || {}),
        ...(mod?.fields || {}),
      });
      const startDate = mod?.startDate ?? row.startDate;
      const endDate = mod?.endDate ?? row.endDate;
      if (!startDate || !endDate) continue;
      if (Object.keys(mergedFields).length === 0) continue;

      payloadItems.push({
        party: partyId,
        paymentDate: startDate,
        paymentRange: [startDate, endDate],
        paymentAmount: mergedFields.paymentAmount ?? 0,
        pwt: mergedFields.pwt ?? 0,
        cash: mergedFields.cash ?? 0,
        bank: mergedFields.bank ?? 0,
        due: mergedFields.due ?? 0,
        tda: mergedFields.atd ?? 0,
      });
    }

    for (const pid of selectedParties) {
      const np = weeklyNPByParty[pid];
      if (np && typeof np.amount === "number" && np.amount >= 0) {
        payloadItems.push({
          party: pid,
          paymentDate: weekStartDate,
          weeklyNP: { name: np.name || "", amount: np.amount },
        });
      }
    }

    if (payloadItems.length === 0) {
      setError("No changes to save");
      return;
    }

    try {
      setSaving(true);
      await paymentAPI.createMultiDayPayment({
        weekStartDate,
        weekEndDate,
        payments: payloadItems,
      });

      setSuccess(
        `✓ Saved ${payloadItems.length} record(s) for ${formatWeekRange(
          weekStartDate,
          weekEndDate
        )}`
      );
      setModifiedRows({});
      setEditingCell(null);

      const refreshed = {};
      const npRefreshed = {};
      for (const pid of selectedParties) {
        const res = await paymentAPI.getMultiDayPayments({ partyId: pid });
        const weeks = Array.isArray(res.data) ? res.data : [];
        const rows = [];
        let np = { name: "", amount: 0 };

        for (const w of weeks) {
          const wStart = dateOnly(w.weekStartDate);
          if (wStart !== selectedWeekStart) continue;

          if (w.weeklyNP && typeof w.weeklyNP === "object") {
            np = {
              name: w.weeklyNP.name || "",
              amount: Number(w.weeklyNP.amount) || 0,
              _id: w._id,
            };
          }

          const ranges = Array.isArray(w.paymentRanges) ? w.paymentRanges : [];
          for (const range of ranges) {
            const s = dateOnly(range.startDate);
            const e = dateOnly(range.endDate);

            rows.push({
              id: `${w._id}-${s}-${e}`,
              startDate: s,
              endDate: e,
              fields: {
                paymentAmount: range.paymentAmount ?? "",
                pwt: range.pwt ?? "",
                cash: range.cash ?? "",
                bank: range.bank ?? "",
                due: range.due ?? "",
                atd: range.tda ?? "",
              },
              paymentMode: "MIXED",
              notes: "",
              temp: false,
              editingDate: false,
              _weekMeta: {
                weekId: w._id,
                weekStartDate: w.weekStartDate,
                weekEndDate: w.weekEndDate,
              },
            });
          }
        }
        refreshed[pid] = rows.sort((a, b) =>
          a.startDate < b.startDate ? -1 : 1
        );
        npRefreshed[pid] = np;
      }
      setServerRowsByParty(refreshed);
      setRowsByParty(refreshed);
      setWeeklyNPByParty(npRefreshed);
      setError("");
    } catch (e) {
      setError(e?.message || "Failed to save payments");
    } finally {
      setSaving(false);
    }
  };

  const totalsByParty = useMemo(() => {
    const out = {};
    selectedParties.forEach((pid) => {
      const list = rowsByParty[pid] || [];
      const partyTotal = list.reduce(
        (acc, r) => {
          const key = `${pid}-${r.id}`;
          const mod = modifiedRows[key]?.fields || {};
          const f = { ...r.fields, ...mod };
          acc.amount += Number(f.paymentAmount || 0);
          acc.pwt += Number(f.pwt || 0);
          acc.cash += Number(f.cash || 0);
          acc.bank += Number(f.bank || 0);
          acc.due += Number(f.due || 0);
          acc.atd += Number(f.atd || 0);
          return acc;
        },
        { amount: 0, pwt: 0, cash: 0, bank: 0, due: 0, atd: 0 }
      );
      const np = weeklyNPByParty[pid]?.amount || 0;
      out[pid] = { ...partyTotal, amountWithNP: partyTotal.amount + np, np };
    });
    return out;
  }, [rowsByParty, modifiedRows, selectedParties, weeklyNPByParty]);

  const grandTotals = useMemo(() => {
    const init = { amount: 0, pwt: 0, cash: 0, bank: 0, due: 0, atd: 0, np: 0 };
    return selectedParties.reduce((g, pid) => {
      const t = totalsByParty[pid] || init;
      return {
        amount: g.amount + t.amount,
        pwt: g.pwt + t.pwt,
        cash: g.cash + t.cash,
        bank: g.bank + t.bank,
        due: g.due + t.due,
        atd: g.atd + t.atd,
        np: g.np + (t.np || 0),
      };
    }, init);
  }, [totalsByParty, selectedParties]);

  const formatDate = (d) =>
    fromYMD(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });

  const renderCell = (
    colIndex,
    isEditing,
    isCurrentCell,
    row,
    partyId,
    globalRowIndex
  ) => {
    const fieldName = cellOrder[colIndex];
    const modKey = `${partyId}-${row.id}`;
    const modified = modifiedRows[modKey]?.fields || {};
    const effective = { ...(row.fields || {}), ...modified };
    const displayValue =
      typeof effective?.[fieldName] === "number" ? effective[fieldName] : 0;

    // Convert to string for input value
    const cellValue = String(formData[fieldName] ?? "");

    return (
      <td
        className={`border border-gray-500 px-3 py-2 text-right cursor-pointer transition-colors ${
          isCurrentCell ? "bg-emerald-100" : "hover:bg-gray-50"
        }`}
        onClick={() => handleCellClick(partyId, row, colIndex, globalRowIndex)}
      >
        {isEditing && isCurrentCell ? (
          <input
            type="number"
            name={fieldName}
            value={cellValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoFocus
            onWheel={(e) => {
              e.preventDefault();
              e.currentTarget.blur();
            }}
            className="w-full px-2 py-1 border-2 border-emerald-500 rounded text-md text-black focus:outline-none focus:ring-2 focus:ring-emerald-300 text-right"
          />
        ) : (
          <span
            className={`text-md font-medium ${
              displayValue ? "text-gray-900" : "text-gray-400"
            }`}
          >
            {displayValue ? Number(displayValue).toLocaleString() : "-"}
          </span>
        )}
      </td>
    );
  };

  // NEW: Check if admin
  const isAdmin = userRole === "admin";

  // Show initial authentication loading
  if (isLoading) {
    return <LoadingOverlay message={loadingMessage} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {saving && <LoadingOverlay message="Saving payments..." />}

      {success && (
        <ToastAlert
          type="success"
          message={success}
          onClose={() => setSuccess("")}
        />
      )}
      {error && (
        <ToastAlert type="error" message={error} onClose={() => setError("")} />
      )}

      <div className="bg-white border-b border-gray-500 shadow-sm">
        <div className="max-w-full mx-auto px-6 py-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            Multi-Day Payments
          </h1>

          <WeekRangeSelector
            selectedWeekStart={selectedWeekStart}
            onWeekChange={setSelectedWeekStart}
          />

          {/* Save Button - fixed top-right, always visible */}
          <div className="fixed top-4 right-6 z-50">
            <button
              onClick={handleSaveAll}
              disabled={
                saving ||
                (Object.keys(modifiedRows).length === 0 &&
                  !Object.values(weeklyNPByParty).some(
                    (v) => typeof v?.amount === "number" && v.amount > 0
                  ))
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
                    Save All
                    {(() => {
                      const count =
                        Object.keys(modifiedRows).length +
                        Object.values(weeklyNPByParty).filter(
                          (i) => typeof i?.amount === "number" && i.amount > 0
                        ).length;
                      return count > 0 ? ` (${count})` : "";
                    })()}
                  </span>
                </>
              )}
            </button>
          </div>

          <div>
            <p className="text-md font-bold text-gray-700 mb-4 uppercase tracking-wider">
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
                      : "bg-white text-gray-700 border-2 border-gray-500 hover:border-emerald-400 hover:bg-gray-50"
                  }`}
                >
                  {party.partyCode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedParties.length > 0 ? (
        <div className="max-w-full mx-auto px-6 py-8">
          <div className="bg-white border-2 border-gray-500 rounded-xl overflow-hidden shadow-lg">
            {loading ? (
              <InlineLoader message="Loading payment data..." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {selectedParties.map((partyId, pIndex) => {
                      const partyCode = parties.find(
                        (p) => p._id === partyId
                      )?.partyCode;
                      const rows = rowsByParty[partyId] || [];
                      const totals = totalsByParty[partyId] || {
                        amount: 0,
                        pwt: 0,
                        cash: 0,
                        bank: 0,
                        due: 0,
                        atd: 0,
                        np: 0,
                        amountWithNP: 0,
                      };

                      return (
                        <React.Fragment key={partyId}>
                          {/* UPDATED: Conditionally show ACT column header for admins only */}
                          <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b-2 border-gray-500">
                            <th className="border border-gray-500 px-4 py-3 text-left text-xs font-bold text-gray-800 w-40">
                              DATE RANGE
                            </th>
                            <th className="border border-gray-500 px-4 py-3 text-left text-xs font-bold text-gray-800 w-28">
                              PARTY NAME
                            </th>
                            <th className="border border-gray-500 px-4 py-3 text-right text-xs font-bold text-gray-800 w-24">
                              PAYMENT
                            </th>
                            <th className="border border-gray-500 px-4 py-3 text-right text-xs font-bold text-gray-800 w-20">
                              PWT
                            </th>
                            <th className="border border-gray-500 px-4 py-3 text-right text-xs font-bold text-gray-800 w-20">
                              CASH
                            </th>
                            <th className="border border-gray-500 px-4 py-3 text-right text-xs font-bold text-gray-800 w-20">
                              BANK
                            </th>
                            <th className="border border-gray-500 px-4 py-3 text-right text-xs font-bold text-gray-800 w-20">
                              DUE
                            </th>
                            <th className="border border-gray-500 px-4 py-3 text-right text-xs font-bold text-gray-800 w-20">
                              ATD
                            </th>
                            <th className="border border-gray-500 px-4 py-3 text-right text-xs font-bold text-gray-800 w-24">
                              TOTAL
                            </th>
                            {isAdmin && (
                              <th className="border border-gray-500 px-4 py-3 text-center text-xs font-bold text-gray-800 w-24">
                                ACT
                              </th>
                            )}
                          </tr>

                          {rows.map((row) => {
                            const globalIndex = tableRows.findIndex(
                              (t) =>
                                t.partyId === partyId && t.row.id === row.id
                            );
                            const modKey = `${partyId}-${row.id}`;
                            const modified = modifiedRows[modKey]?.fields;
                            const effective = {
                              ...(row.fields || {}),
                              ...(modified || {}),
                            };
                            const rowTotal =
                              Number(effective?.pwt || 0) +
                              Number(effective?.cash || 0) +
                              Number(effective?.bank || 0) +
                              Number(effective?.due || 0) +
                              Number(effective?.atd || 0);
                            const isCurrentRow = globalIndex === currentRow;
                            const isEditing =
                              editingCell?.partyId === partyId &&
                              editingCell?.rowId === row.id;

                            return (
                              <tr
                                key={row.id}
                                className={`border-b border-gray-500 cursor-pointer transition-colors ${
                                  isEditing
                                    ? "bg-emerald-50"
                                    : isCurrentRow
                                    ? "bg-blue-50"
                                    : "hover:bg-gray-50"
                                }`}
                              >
                                <td className="border border-gray-500 px-4 py-2">
                                  {row.editingDate ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="date"
                                        value={row.startDate}
                                        min={selectedWeekStart}
                                        max={selectedWeekEnd}
                                        onChange={(e) =>
                                          updateRowDate(partyId, row.id, {
                                            startDate: e.target.value,
                                          })
                                        }
                                        className="px-2 py-1 border-2 border-emerald-500 rounded text-md text-black focus:outline-none"
                                      />
                                      <span className="text-gray-500">→</span>
                                      <input
                                        type="date"
                                        value={row.endDate}
                                        min={selectedWeekStart}
                                        max={selectedWeekEnd}
                                        onChange={(e) =>
                                          updateRowDate(partyId, row.id, {
                                            endDate: e.target.value,
                                          })
                                        }
                                        className="px-2 py-1 border-2 border-emerald-500 rounded text-md text-black focus:outline-none"
                                      />
                                      <button
                                        className="ml-2 px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs"
                                        onClick={() =>
                                          setRowsByParty((prev) => ({
                                            ...prev,
                                            [partyId]: (
                                              prev[partyId] || []
                                            ).map((r) =>
                                              r.id === row.id
                                                ? { ...r, editingDate: false }
                                                : r
                                            ),
                                          }))
                                        }
                                      >
                                        Done
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      className="inline-flex items-center gap-2 px-2 py-1 border-2 border-gray-500 rounded hover:border-emerald-400"
                                      onClick={() =>
                                        setRowsByParty((prev) => ({
                                          ...prev,
                                          [partyId]: (prev[partyId] || []).map(
                                            (r) =>
                                              r.id === row.id
                                                ? { ...r, editingDate: true }
                                                : r
                                          ),
                                        }))
                                      }
                                      title="Set date range"
                                    >
                                      <Calendar className="w-4 h-4 text-emerald-600" />
                                      <span className="text-md font-semibold text-gray-900">
                                        {formatDate(row.startDate)} to{" "}
                                        {formatDate(row.endDate)}
                                      </span>
                                    </button>
                                  )}
                                </td>

                                <td className="border border-gray-500 px-4 py-2">
                                  <span className="text-md font-bold text-gray-900">
                                    {partyCode}
                                  </span>
                                </td>

                                {[0, 1, 2, 3, 4, 5].map((colIndex) =>
                                  renderCell(
                                    colIndex,
                                    isEditing,
                                    isCurrentRow && currentCol === colIndex,
                                    row,
                                    partyId,
                                    globalIndex
                                  )
                                )}

                                <td className="border border-gray-500 px-4 py-2 text-right bg-gray-50">
                                  <span className="text-md font-bold text-gray-900">
                                    {rowTotal.toLocaleString()}
                                  </span>
                                </td>

                                {/* UPDATED: Show ACT column only for admins */}
                                {isAdmin && (
                                  <td className="border border-gray-500 px-4 py-2 text-center">
                                    <div className="inline-flex items-center gap-2">
                                      <button
                                        onClick={() => deleteRow(partyId, row)}
                                        className="inline-flex items-center justify-center w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}

                          {/* Add Row Button */}
                          {(() => {
                            if (rows.length < 2) {
                              return (
                                <tr>
                                  <td
                                    colSpan={isAdmin ? 10 : 9}
                                    className="px-4 py-3"
                                  >
                                    <button
                                      onClick={() => addRow(partyId)}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded"
                                    >
                                      <Plus className="w-4 h-4" />
                                      <span>Add Row for {partyCode}</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            }
                            return null;
                          })()}

                          {/* NP Weekly Row */}
                          <tr className="border-t border-gray-500 bg-white">
                            <td className="border border-gray-500 px-4 py-2 text-left">
                              <span className="text-xs font-semibold text-gray-500">
                                NP WEEKLY
                              </span>
                            </td>
                            <td className="border border-gray-500 px-4 py-2">
                              <input
                                type="text"
                                value={weeklyNPByParty[partyId]?.name || ""}
                                onChange={(e) =>
                                  setWeeklyNPByParty((prev) => ({
                                    ...prev,
                                    [partyId]: {
                                      ...(prev[partyId] || {}),
                                      name: e.target.value,
                                      amount: prev[partyId]?.amount || 0,
                                    },
                                  }))
                                }
                                placeholder="NP Name"
                                className="w-full px-2 py-1 border-2 rounded text-md text-black focus:outline-none border-gray-500 focus:border-emerald-500"
                              />
                            </td>
                            <td className="border border-gray-500 px-4 py-2 text-right">
                              <input
                                type="number"
                                onWheel={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }}
                                value={weeklyNPByParty[partyId]?.amount ?? ""}
                                onChange={(e) =>
                                  setWeeklyNPByParty((prev) => ({
                                    ...prev,
                                    [partyId]: {
                                      ...(prev[partyId] || {}),
                                      amount: e.target.value
                                        ? parseFloat(e.target.value)
                                        : 0,
                                      name: prev[partyId]?.name || "",
                                    },
                                  }))
                                }
                                placeholder="NP Amount"
                                className="w-full px-2 py-1 border-2 rounded text-md text-black focus:outline-none text-right border-gray-500 focus:border-emerald-500"
                              />
                            </td>
                            <td
                              className="border border-gray-500 px-4 py-2"
                              colSpan={isAdmin ? 7 : 6}
                            ></td>
                          </tr>

                          {/* Party Total Row */}
                          <tr className="bg-gradient-to-r from-emerald-50 to-emerald-25 border-t-2 border-b-2 border-emerald-400 font-bold">
                            <td className="border border-gray-500 px-4 py-3 text-left text-md text-gray-900">
                              PARTY TOTAL
                            </td>
                            <td className="border border-gray-500 px-4 py-3 text-left text-md text-emerald-700"></td>
                            <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                              {Number(
                                totals.amountWithNP || 0
                              ).toLocaleString()}
                            </td>
                            <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                              {totals.pwt.toLocaleString()}
                            </td>
                            <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                              {totals.cash.toLocaleString()}
                            </td>
                            <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                              {totals.bank.toLocaleString()}
                            </td>
                            <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                              {totals.due.toLocaleString()}
                            </td>
                            <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                              {totals.atd.toLocaleString()}
                            </td>
                            <td className="border border-gray-500 px-4 py-3 text-right bg-emerald-100 text-emerald-700">
                              {(
                                totals.pwt +
                                totals.cash +
                                totals.bank +
                                totals.due +
                                totals.atd
                              ).toLocaleString()}
                            </td>
                            {isAdmin && (
                              <td className="border border-gray-500 px-4 py-3"></td>
                            )}
                          </tr>

                          {pIndex < selectedParties.length - 1 && (
                            <tr className="h-1 bg-gray-100">
                              <td colSpan={isAdmin ? 10 : 9}></td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Final Total Row */}
                    <tr className="bg-gradient-to-r from-blue-50 to-blue-25 border-t-2 border-blue-400 font-bold">
                      <td
                        colSpan="2"
                        className="border border-gray-500 px-4 py-3 text-left text-md text-blue-700"
                      >
                        FINAL TOTAL
                      </td>
                      <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                        {(grandTotals.amount + grandTotals.np).toLocaleString()}
                      </td>
                      <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                        {grandTotals.pwt.toLocaleString()}
                      </td>
                      <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                        {grandTotals.cash.toLocaleString()}
                      </td>
                      <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                        {grandTotals.bank.toLocaleString()}
                      </td>
                      <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                        {grandTotals.due.toLocaleString()}
                      </td>
                      <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                        {grandTotals.atd.toLocaleString()}
                      </td>
                      <td className="border border-gray-500 px-4 py-3 text-right bg-blue-100 text-blue-700">
                        {(
                          grandTotals.pwt +
                          grandTotals.cash +
                          grandTotals.bank +
                          grandTotals.due +
                          grandTotals.atd
                        ).toLocaleString()}
                      </td>
                      {isAdmin && (
                        <td className="border border-gray-500 px-4 py-3"></td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-full mx-auto px-6 py-16">
          <div className="text-center bg-white rounded-xl p-12 border-2 border-gray-500">
            <p className="text-xl text-gray-600 font-semibold">
              👆 Select parties to add multi-day rows
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
