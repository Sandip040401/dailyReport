// src/pages/CommissionPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Trash2,
  AlertCircle,
  Check,
  Save,
  Loader2,
  Plus
} from "lucide-react";
import { partyAPI, commissionAPI, authAPI } from "../lib/api";

// ============================================================================
// DATE UTILITIES
// ============================================================================
const pad2 = (n) => String(n).padStart(2, "0");

const fromYMD = (ymd) => {
  if (!ymd) return new Date();
  const [y, m, d] = String(ymd).split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d);
};

const toYMD = (d) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const d = fromYMD(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
};

const cellOrder = ["quantity", "percentage", "emlot"];

const emptyRow = (startDate = "", endDate = "") => {
  const todayStr = toYMD(new Date());
  return {
    id: crypto.randomUUID(),
    startDate: startDate || todayStr,
    endDate: endDate || todayStr,
    fields: { quantity: "", percentage: "", emlot: "" },
    paid: false,
    remarks: "",
    temp: true,
    editingDate: false,
  };
};

const calculateFormulaTotal = (quantity, percentage, emlot) => {
  const q = Number(quantity);
  const p = Number(percentage);
  const em = Number(emlot) || 0;
  if (isNaN(q) || isNaN(p)) return 0;
  const commissionFromRate = (q * p) / 100;
  const res = commissionFromRate - em;
  return Number(res.toFixed(2));
};

export default function CommissionPage() {
  const [parties, setParties] = useState([]);
  const [selectedParties, setSelectedParties] = useState([]);

  const [rowsByParty, setRowsByParty] = useState({});
  const [modifiedRows, setModifiedRows] = useState({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [userRole, setUserRole] = useState("employee");
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const [partyAtdValues, setPartyAtdValues] = useState({});
  const [savingAtd, setSavingAtd] = useState({});

  const [editingCell, setEditingCell] = useState(null); // { partyId, rowId, field }
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [formData, setFormData] = useState({
    quantity: "",
    percentage: "",
    emlot: "",
  });

  // Auth role fetch
  useEffect(() => {
    const fetchRole = async () => {
      setIsLoadingAuth(true);
      const token = localStorage.getItem("payment-token");
      if (!token) {
        setUserRole("employee");
        setIsLoadingAuth(false);
        return;
      }
      try {
        const role = await authAPI.role(token);
        setUserRole(role.role);
      } catch (e) {
        console.error("Error fetching role:", e);
        setUserRole("employee");
      } finally {
        setIsLoadingAuth(false);
      }
    };
    fetchRole();
  }, []);

  // Fetch parties
  useEffect(() => {
    fetchParties();
  }, []);

  const fetchParties = async () => {
    try {
      const res = await partyAPI.getAllParties();
      const activeParties = (res?.data || []).filter(
        (p) => p.isActive !== false
      );
      setParties(activeParties);
      const atdMap = {};
      activeParties.forEach((p) => {
        atdMap[p._id] = p.atd !== undefined && p.atd !== null ? p.atd : "";
      });
      setPartyAtdValues(atdMap);
    } catch (e) {
      console.error("Error fetching parties:", e);
      setError("Failed to load parties");
    }
  };

  const handleAtdChange = (partyId, val) => {
    setPartyAtdValues((prev) => ({
      ...prev,
      [partyId]: val,
    }));
  };

  const handleSaveAtd = async (partyId) => {
    const rawVal = partyAtdValues[partyId];
    const numVal = rawVal === "" || isNaN(Number(rawVal)) ? 0 : Number(rawVal);
    try {
      setSavingAtd((prev) => ({ ...prev, [partyId]: true }));
      await partyAPI.updateParty(partyId, { atd: numVal });
      setParties((prev) =>
        prev.map((p) => (p._id === partyId ? { ...p, atd: numVal } : p))
      );
      setPartyAtdValues((prev) => ({ ...prev, [partyId]: numVal }));
      setSuccess("Party ATD saved successfully");
    } catch (err) {
      console.error("Error saving ATD:", err);
      setError("Failed to save Party ATD");
    } finally {
      setSavingAtd((prev) => ({ ...prev, [partyId]: false }));
    }
  };

  const handleDeleteAtd = async (partyId) => {
    if (!window.confirm("Are you sure you want to delete/clear ATD for this party?")) {
      return;
    }
    try {
      setSavingAtd((prev) => ({ ...prev, [partyId]: true }));
      await partyAPI.updateParty(partyId, { atd: 0 });
      setParties((prev) =>
        prev.map((p) => (p._id === partyId ? { ...p, atd: 0 } : p))
      );
      setPartyAtdValues((prev) => ({ ...prev, [partyId]: "" }));
      setSuccess("Party ATD deleted successfully");
    } catch (err) {
      console.error("Error deleting ATD:", err);
      setError("Failed to delete Party ATD");
    } finally {
      setSavingAtd((prev) => ({ ...prev, [partyId]: false }));
    }
  };

  // Fetch all commission records for selected parties
  useEffect(() => {
    if (selectedParties.length > 0) {
      fetchAllCommissions();
      setModifiedRows({});
      setEditingCell(null);
    } else {
      setRowsByParty({});
      setModifiedRows({});
    }
  }, [selectedParties]);

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

  const fetchAllCommissions = async () => {
    try {
      setLoading(true);
      const nextRows = {};

      for (const partyId of selectedParties) {
        const res = await commissionAPI.getCommissions({ partyId });

        const records = Array.isArray(res.data) ? res.data : [];
        const partyRows = [];

        records.forEach((c) => {
          const s = toYMD(c.startDate);
          const e = toYMD(c.endDate);
          partyRows.push({
            id: c._id,
            _id: c._id,
            startDate: s,
            endDate: e,
            fields: {
              quantity: c.quantity ?? "",
              percentage: c.percentage ?? "",
              emlot: c.emlot ?? "",
            },
            paid: Boolean(c.paid),
            remarks: c.remarks || "",
            temp: false,
            editingDate: false,
          });
        });

        if (partyRows.length === 0) {
          partyRows.push(emptyRow());
        } else {
          partyRows.sort((a, b) => a.startDate.localeCompare(b.startDate));
        }

        nextRows[partyId] = partyRows;
      }

      setRowsByParty(nextRows);
      setError("");
    } catch (e) {
      console.error("Error fetching commissions:", e);
      setError("Failed to load commissions");
    } finally {
      setLoading(false);
    }
  };

  const handlePartyToggle = (partyId) => {
    setSelectedParties((prev) => {
      if (prev.includes(partyId)) {
        return [];
      }
      return [partyId];
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
    const key = `${partyId}-${rowId}`;
    setModifiedRows((prev) => {
      const baseRow =
        (rowsByParty[partyId] || []).find((r) => r.id === rowId) || {};
      const existing = prev[key] || {};
      const mergedFields = {
        ...(baseRow.fields || {}),
        ...(existing.fields || {}),
        quantity: formData.quantity === "" ? "" : Number(formData.quantity),
        percentage:
          formData.percentage === "" ? "" : Number(formData.percentage),
        emlot: formData.emlot === "" ? "" : Number(formData.emlot),
      };

      return {
        ...prev,
        [key]: {
          partyId,
          rowId,
          _id: baseRow._id,
          startDate: existing.startDate ?? baseRow.startDate,
          endDate: existing.endDate ?? baseRow.endDate,
          paid: existing.paid !== undefined ? existing.paid : baseRow.paid,
          remarks:
            existing.remarks !== undefined ? existing.remarks : baseRow.remarks,
          fields: mergedFields,
        },
      };
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (editingCell) {
      const { partyId, rowId } = editingCell;
      const key = `${partyId}-${rowId}`;

      setModifiedRows((prev) => {
        const baseRow =
          (rowsByParty[partyId] || []).find((r) => r.id === rowId) || {};
        const existing = prev[key] || {};
        const nextFields = {
          ...(baseRow.fields || {}),
          ...(existing.fields || {}),
          [name]: value === "" ? "" : Number(value),
        };

        return {
          ...prev,
          [key]: {
            partyId,
            rowId,
            _id: baseRow._id,
            startDate: existing.startDate ?? baseRow.startDate,
            endDate: existing.endDate ?? baseRow.endDate,
            paid: existing.paid !== undefined ? existing.paid : baseRow.paid,
            remarks:
              existing.remarks !== undefined
                ? existing.remarks
                : baseRow.remarks,
            fields: nextFields,
          },
        };
      });
    }
  };

  const handleKeyDown = (e) => {
    const navKeys = ["a", "A", "d", "D", "w", "W", "s", "S"];
    if (navKeys.includes(e.key) && editingCell) {
      e.preventDefault();

      let newRow = currentRow;
      let newCol = currentCol;
      const k = e.key.toLowerCase();

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
        quantity: dataToLoad.quantity ?? "",
        percentage: dataToLoad.percentage ?? "",
        emlot: dataToLoad.emlot ?? "",
      });
    }
  };

  const handleCellClick = (partyId, row, colIndex, globalRowIndex) => {
    const modKey = `${partyId}-${row.id}`;
    const modified = modifiedRows[modKey];
    const dataToLoad = { ...(row.fields || {}), ...(modified?.fields || {}) };

    setCurrentCol(colIndex);
    setCurrentRow(globalRowIndex);
    setEditingCell({ partyId, rowId: row.id, field: cellOrder[colIndex] });
    setFormData({
      quantity: dataToLoad.quantity ?? "",
      percentage: dataToLoad.percentage ?? "",
      emlot: dataToLoad.emlot ?? "",
    });
  };

  const addRow = (partyId) => {
    setRowsByParty((prev) => {
      const next = { ...(prev || {}) };
      const arr = next[partyId] ? [...next[partyId]] : [];

      let nextStart = toYMD(new Date());
      let nextEnd = toYMD(new Date());

      if (arr.length > 0) {
        const lastRow = arr[arr.length - 1];
        if (lastRow.endDate) {
          const d = fromYMD(lastRow.endDate);
          d.setDate(d.getDate() + 1);
          nextStart = toYMD(d);
          nextEnd = toYMD(d);
        }
      }

      const newR = emptyRow(nextStart, nextEnd);
      next[partyId] = [...arr, newR];
      return next;
    });
  };

  const deleteRow = async (partyId, rowId) => {
    const row = (rowsByParty[partyId] || []).find((r) => r.id === rowId);
    if (!row) return;

    if (row._id && !row.temp) {
      if (!window.confirm("Are you sure you want to delete this commission entry?"))
        return;
      try {
        await commissionAPI.deleteCommission(row._id);
        setSuccess("Commission deleted successfully");
      } catch (err) {
        console.error("Error deleting commission:", err);
        setError("Failed to delete commission");
        return;
      }
    }

    setRowsByParty((prev) => {
      const list = (prev[partyId] || []).filter((r) => r.id !== rowId);
      return {
        ...prev,
        [partyId]: list.length === 0 ? [emptyRow()] : list,
      };
    });

    setModifiedRows((prev) => {
      const key = `${partyId}-${rowId}`;
      const next = { ...prev };
      delete next[key];
      return next;
    });

    if (editingCell?.rowId === rowId) {
      setEditingCell(null);
    }
  };

  const updateRowDates = (partyId, rowId, next) => {
    const current = (rowsByParty[partyId] || []).find((r) => r.id === rowId);
    if (!current) return;

    const newStart = next.startDate ?? current.startDate;
    const newEnd = next.endDate ?? current.endDate;

    if (newStart && newEnd) {
      const start = fromYMD(newStart);
      const end = fromYMD(newEnd);
      if (end < start) {
        setError("End date must be on or after start date");
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
      const entry = prev[key] || {
        partyId,
        rowId,
        _id: current._id,
        fields: current.fields,
      };
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

  const toggleRowPaid = async (partyId, rowId) => {
    const baseRow = (rowsByParty[partyId] || []).find((r) => r.id === rowId);
    if (!baseRow) return;

    const modKey = `${partyId}-${rowId}`;
    const currentPaid =
      modifiedRows[modKey]?.paid !== undefined
        ? modifiedRows[modKey].paid
        : baseRow.paid;
    const nextPaid = !currentPaid;

    setRowsByParty((prev) => {
      const list = (prev[partyId] || []).map((r) =>
        r.id === rowId ? { ...r, paid: nextPaid } : r
      );
      return { ...prev, [partyId]: list };
    });

    setModifiedRows((prev) => {
      const entry = prev[modKey] || {
        partyId,
        rowId,
        _id: baseRow._id,
        startDate: baseRow.startDate,
        endDate: baseRow.endDate,
        fields: baseRow.fields,
        remarks: baseRow.remarks,
      };
      return {
        ...prev,
        [modKey]: {
          ...entry,
          paid: nextPaid,
        },
      };
    });

    if (baseRow._id && !baseRow.temp) {
      try {
        await commissionAPI.togglePaid(baseRow._id);
        setSuccess(`Payment marked as ${nextPaid ? "Paid" : "Unpaid"}`);
      } catch (err) {
        console.error("Error toggling paid status:", err);
      }
    }
  };

  const handleSaveAll = async () => {
    commitEditingCell();

    const payloadCommissions = [];

    for (const { partyId, row } of tableRows) {
      const key = `${partyId}-${row.id}`;
      const mod = modifiedRows[key];
      const effectiveFields = {
        ...(row.fields || {}),
        ...(mod?.fields || {}),
      };

      const quantity =
        effectiveFields.quantity === "" ||
        effectiveFields.quantity === undefined
          ? 0
          : Number(effectiveFields.quantity);
      const percentage =
        effectiveFields.percentage === "" ||
        effectiveFields.percentage === undefined
          ? 0
          : Number(effectiveFields.percentage);
      const emlot =
        effectiveFields.emlot === "" || effectiveFields.emlot === undefined
          ? 0
          : Number(effectiveFields.emlot);

      const startDate = mod?.startDate ?? row.startDate;
      const endDate = mod?.endDate ?? row.endDate;
      const paid = mod?.paid !== undefined ? mod.paid : row.paid;
      const remarks = mod?.remarks !== undefined ? mod.remarks : row.remarks;

      const hasData =
        quantity > 0 || percentage > 0 || emlot > 0 || (row._id && !row.temp);
      if (!hasData) continue;

      payloadCommissions.push({
        _id: row._id && !row.temp ? row._id : undefined,
        partyId,
        startDate,
        endDate,
        quantity,
        percentage,
        emlot,
        paid: Boolean(paid),
        remarks: remarks || "",
      });
    }

    if (payloadCommissions.length === 0) {
      setError("No valid changes to save");
      return;
    }

    try {
      setSaving(true);
      await commissionAPI.bulkUpsertCommissions({
        commissions: payloadCommissions,
      });

      setSuccess(`Successfully saved ${payloadCommissions.length} record(s)`);
      setModifiedRows({});
      setEditingCell(null);
      await fetchAllCommissions();
    } catch (e) {
      console.error("Error saving commissions:", e);
      setError(e?.message || "Failed to save commissions");
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
          const q = Number(f.quantity || 0);
          const p = Number(f.percentage || 0);
          const em = Number(f.emlot || 0);
          const total = calculateFormulaTotal(q, p, em);

          acc.quantity += q;
          acc.emlot += em;
          acc.total += total;
          return acc;
        },
        { quantity: 0, emlot: 0, total: 0 }
      );
      out[pid] = partyTotal;
    });
    return out;
  }, [rowsByParty, modifiedRows, selectedParties]);

  const grandTotals = useMemo(() => {
    const init = { quantity: 0, emlot: 0, total: 0 };
    return selectedParties.reduce((g, pid) => {
      const t = totalsByParty[pid] || { quantity: 0, emlot: 0, total: 0 };
      g.quantity += t.quantity;
      g.emlot += t.emlot;
      g.total += t.total;
      return g;
    }, init);
  }, [totalsByParty, selectedParties]);

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
    const displayValue = effective?.[fieldName];
    const cellValue = String(formData[fieldName] ?? "");

    return (
      <td
        key={fieldName}
        className={`border border-gray-500 px-3 py-2 text-right cursor-pointer transition-colors ${
          isCurrentCell
            ? "bg-emerald-100 border-emerald-400"
            : "hover:bg-gray-50"
        }`}
        onClick={() => handleCellClick(partyId, row, colIndex, globalRowIndex)}
      >
        {isEditing && isCurrentCell ? (
          <input
            type="number"
            step="any"
            name={fieldName}
            value={cellValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoFocus
            onWheel={(e) => {
              e.preventDefault();
              e.currentTarget.blur();
            }}
            className="w-full px-2 py-1 border-2 border-emerald-500 rounded text-md text-black focus:outline-none focus:ring-2 focus:ring-emerald-300 text-right font-medium"
          />
        ) : (
          <span
            className={`text-md font-medium ${
              displayValue !== "" &&
              displayValue !== undefined &&
              displayValue !== null
                ? "text-gray-900"
                : "text-gray-400"
            }`}
          >
            {displayValue !== "" &&
            displayValue !== undefined &&
            displayValue !== null
              ? Number(displayValue).toLocaleString()
              : "-"}
          </span>
        )}
      </td>
    );
  };

  const isAdmin = userRole === "admin";

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
          <p className="text-lg font-semibold text-gray-900">
            Authenticating user...
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full animate-pulse"
              style={{ width: "100%" }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-red-200 shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 text-sm mb-6">
            The Commission page is restricted to administrators only. Please contact your system administrator if you require access.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-all shadow"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-3 w-96">
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

        {loading && (
          <div className="bg-white border-2 border-blue-400 rounded-lg shadow-2xl overflow-hidden animate-slide-in-right">
            <div className="flex items-start p-4">
              <div className="flex-shrink-0">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-bold text-blue-900">Loading</h3>
                <p className="mt-1 text-sm text-blue-700">
                  Fetching commission data...
                </p>
              </div>
            </div>
            <div className="h-1 bg-blue-500">
              <div className="h-full bg-blue-600 animate-loading-bar"></div>
            </div>
          </div>
        )}

        {saving && (
          <div className="bg-white border-2 border-purple-400 rounded-lg shadow-2xl overflow-hidden animate-slide-in-right">
            <div className="flex items-start p-4">
              <div className="flex-shrink-0">
                <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-bold text-purple-900">Saving</h3>
                <p className="mt-1 text-sm text-purple-700">
                  Saving commission records...
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
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-bold text-gray-900">
              Commission
            </h1>
          </div>

          {/* Save Button - Fixed Top Right */}
          <div className="fixed top-4 right-6 z-50">
            <button
              onClick={handleSaveAll}
              disabled={saving || Object.keys(modifiedRows).length === 0}
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
                    {Object.keys(modifiedRows).length > 0 &&
                      `(${Object.keys(modifiedRows).length})`}
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

      {/* Main Content - Table */}
      {selectedParties.length > 0 ? (
        <div className="max-w-full mx-auto px-6 py-8 space-y-4">
          {/* ATD Row for Selected Party */}
          {selectedParties.map((partyId) => {
            const party = parties.find((p) => p._id === partyId);
            const partyCode = party?.partyCode || "";
            const currentAtd = partyAtdValues[partyId] ?? "";
            const isSavingThisAtd = Boolean(savingAtd[partyId]);

            return (
              <div
                key={`atd-${partyId}`}
                className="flex items-center justify-between bg-white border-2 border-emerald-500 rounded-xl px-6 py-3 shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Party:
                    </span>
                    <span className="text-md font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                      {partyCode}
                    </span>
                  </div>
                  <div className="h-5 w-[1px] bg-gray-300"></div>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`atd-input-${partyId}`}
                      className="text-sm font-bold text-gray-800 uppercase tracking-wide"
                    >
                      ATD:
                    </label>
                    <input
                      id={`atd-input-${partyId}`}
                      type="number"
                      step="any"
                      placeholder="0"
                      value={currentAtd}
                      onChange={(e) => handleAtdChange(partyId, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveAtd(partyId);
                        }
                      }}
                      className="w-36 px-3 py-1.5 border-2 border-gray-300 focus:border-emerald-500 rounded-lg text-md font-semibold text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveAtd(partyId)}
                    disabled={isSavingThisAtd}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold transition-all shadow-sm"
                  >
                    {isSavingThisAtd ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Save ATD</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteAtd(partyId)}
                    disabled={isSavingThisAtd || (currentAtd === "" && !party?.atd)}
                    className="inline-flex items-center justify-center w-8 h-8 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-lg transition-colors shadow-sm"
                    title="Delete / Clear ATD"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="bg-white border border-gray-500 rounded-xl overflow-hidden shadow-lg">
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
                      const party = parties.find((p) => p._id === partyId);
                      const partyCode = party?.partyCode || "";
                      const rows = rowsByParty[partyId] || [];
                      const totals = totalsByParty[partyId] || {
                        quantity: 0,
                        emlot: 0,
                        total: 0,
                      };

                      return (
                        <React.Fragment key={partyId}>
                          {/* Column Headers */}
                          <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b-2 border-gray-400">
                            <th className="border border-gray-400 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-800 w-36">
                              DATE RANGE
                            </th>
                            <th className="border border-gray-400 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-800 w-28">
                              PARTY NAME
                            </th>
                            <th className="border border-gray-400 bg-gray-50 px-4 py-3 text-right text-xs font-bold text-gray-800 w-28">
                              QUANTITY
                            </th>
                            <th className="border border-gray-400 bg-gray-50 px-4 py-3 text-right text-xs font-bold text-gray-800 w-28">
                              PERCENTAGE
                            </th>
                            <th className="border border-gray-400 bg-gray-50 px-4 py-3 text-right text-xs font-bold text-gray-800 w-28">
                              EMLOT
                            </th>
                            <th className="border border-gray-400 bg-gray-50 px-4 py-3 text-right text-xs font-bold text-gray-800 w-28">
                              TOTAL
                            </th>
                            <th className="border border-gray-400 bg-gray-50 px-4 py-3 text-center text-xs font-bold text-gray-800 w-20">
                              STATUS
                            </th>
                            <th className="border border-gray-400 bg-gray-50 px-4 py-3 text-center text-xs font-bold text-gray-800 w-16">
                              ACT
                            </th>
                          </tr>

                          {/* Rows */}
                          {rows.map((row) => {
                            const globalIndex = tableRows.findIndex(
                              (t) =>
                                t.partyId === partyId && t.row.id === row.id
                            );
                            const modKey = `${partyId}-${row.id}`;
                            const modified = modifiedRows[modKey];
                            const effectiveFields = {
                              ...(row.fields || {}),
                              ...(modified?.fields || {}),
                            };

                            const q = Number(effectiveFields.quantity || 0);
                            const p = Number(effectiveFields.percentage || 0);
                            const em = Number(effectiveFields.emlot || 0);
                            const rowTotal = calculateFormulaTotal(q, p, em);

                            const currentPaid =
                              modified?.paid !== undefined
                                ? modified.paid
                                : row.paid;

                            const isCurrentRow = globalIndex === currentRow;
                            const isEditing =
                              editingCell?.partyId === partyId &&
                              editingCell?.rowId === row.id;

                            return (
                              <tr
                                key={row.id}
                                className={`border-b border-gray-200 cursor-pointer transition-colors ${
                                  isEditing
                                    ? "bg-emerald-50"
                                    : modified
                                    ? "bg-yellow-50"
                                    : isCurrentRow
                                    ? "bg-blue-50"
                                    : "hover:bg-gray-50"
                                }`}
                              >
                                {/* Date Range Cell */}
                                <td className="border border-gray-500 px-4 py-2">
                                  {row.editingDate ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="date"
                                        value={row.startDate || ""}
                                        onChange={(e) =>
                                          updateRowDates(partyId, row.id, {
                                            startDate: e.target.value,
                                          })
                                        }
                                        className="px-2 py-1 border-2 border-emerald-500 rounded text-md text-black focus:outline-none"
                                      />
                                      <span className="text-gray-500 font-bold">→</span>
                                      <input
                                        type="date"
                                        value={row.endDate || ""}
                                        onChange={(e) =>
                                          updateRowDates(partyId, row.id, {
                                            endDate: e.target.value,
                                          })
                                        }
                                        className="px-2 py-1 border-2 border-emerald-500 rounded text-md text-black focus:outline-none"
                                      />
                                      <button
                                        className="ml-2 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-medium text-xs shadow"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRowsByParty((prev) => ({
                                            ...prev,
                                            [partyId]: (prev[partyId] || []).map((r) =>
                                              r.id === row.id
                                                ? { ...r, editingDate: false }
                                                : r
                                            ),
                                          }));
                                        }}
                                      >
                                        Done
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-2 px-3 py-1 border-2 border-gray-400 hover:border-emerald-500 bg-white rounded-lg shadow-sm transition-all"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRowsByParty((prev) => ({
                                          ...prev,
                                          [partyId]: (prev[partyId] || []).map((r) =>
                                            r.id === row.id
                                              ? { ...r, editingDate: true }
                                              : r
                                          ),
                                        }));
                                      }}
                                      title="Click to set date range"
                                    >
                                      <span className="text-md font-semibold text-gray-900 whitespace-nowrap">
                                        {formatDate(row.startDate)} to {formatDate(row.endDate)}
                                      </span>
                                    </button>
                                  )}
                                </td>

                                {/* Party Name */}
                                <td className="border border-gray-500 px-4 py-2">
                                  <span className="text-sm font-bold text-gray-900">
                                    {partyCode}
                                  </span>
                                </td>

                                {/* Quantity, Percentage, Emlot */}
                                {[0, 1, 2].map((colIndex) =>
                                  renderCell(
                                    colIndex,
                                    isEditing,
                                    isCurrentRow && currentCol === colIndex,
                                    row,
                                    partyId,
                                    globalIndex
                                  )
                                )}

                                {/* Row Total */}
                                <td className="border border-gray-500 px-4 py-2 text-right bg-gray-50">
                                  <span
                                    className={`text-md font-bold ${
                                      modified
                                        ? "text-yellow-600"
                                        : "text-gray-900"
                                    }`}
                                  >
                                    {rowTotal ? rowTotal.toLocaleString() : "-"}
                                  </span>
                                </td>

                                {/* Status Toggle */}
                                <td className="border border-gray-500 px-4 py-2 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleRowPaid(partyId, row.id);
                                    }}
                                    className={`px-2.5 py-0.5 rounded text-xs font-bold transition-all ${
                                      currentPaid
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                        : "bg-red-100 text-red-800 border border-red-300"
                                    }`}
                                  >
                                    {currentPaid ? "PAID" : "DUE"}
                                  </button>
                                </td>

                                {/* ACT (Delete) */}
                                <td className="border border-gray-500 px-4 py-2 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteRow(partyId, row.id);
                                    }}
                                    className="inline-flex items-center justify-center w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}

                          {/* Party Total Row */}
                          <tr className="bg-gradient-to-r from-emerald-50 to-emerald-25 border-t-2 border-b-2 border-emerald-400 font-bold">
                            <td className="border border-gray-500 px-4 py-3 text-left text-sm text-gray-900">
                              <button
                                onClick={() => addRow(partyId)}
                                className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-bold"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Row</span>
                              </button>
                            </td>
                            <td className="border border-gray-500 px-4 py-3 text-left text-sm text-emerald-700">
                              PARTY TOTAL
                            </td>
                            <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                              {totals.quantity.toLocaleString()}
                            </td>
                            <td className="border border-gray-500 px-4 py-3 text-right text-gray-400">
                              -
                            </td>
                            <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                              {totals.emlot.toLocaleString()}
                            </td>
                            <td className="border border-gray-500 px-4 py-3 text-right bg-emerald-100 text-emerald-700">
                              {totals.total.toLocaleString()}
                            </td>
                            <td
                              className="border border-gray-500 px-4 py-3"
                              colSpan="2"
                            ></td>
                          </tr>

                          {/* Spacer between parties */}
                          {partyIndex < selectedParties.length - 1 && (
                            <tr className="h-1 bg-gray-100">
                              <td colSpan="8"></td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Final Grand Total Row */}
                    <tr className="bg-gradient-to-r from-blue-50 to-blue-25 border-t-2 border-blue-400 font-bold">
                      <td
                        colSpan="2"
                        className="border border-gray-500 px-4 py-3 text-left text-sm text-blue-700"
                      >
                        FINAL TOTAL
                      </td>
                      <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                        {grandTotals.quantity.toLocaleString()}
                      </td>
                      <td className="border border-gray-500 px-4 py-3 text-right text-gray-400">
                        -
                      </td>
                      <td className="border border-gray-500 px-4 py-3 text-right text-gray-900">
                        {grandTotals.emlot.toLocaleString()}
                      </td>
                      <td className="border border-gray-500 px-4 py-3 text-right bg-blue-100 text-blue-800 text-lg">
                        {grandTotals.total.toLocaleString()}
                      </td>
                      <td
                        className="border border-gray-500 px-4 py-3"
                        colSpan="2"
                      ></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-full mx-auto px-6 py-12 text-center text-gray-500">
          <p className="text-lg">
            Please select at least one party above to view and enter commission data.
          </p>
        </div>
      )}
    </div>
  );
}
