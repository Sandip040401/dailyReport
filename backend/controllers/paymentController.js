// controllers/paymentController.js
import MultiDayPayment from "../models/MultiDayPayment.js";
import Party from "../models/Party.js";
import { getWeekNumber } from "../utils/dateUtils.js";

import WeeklyPayment from "../models/WeeklyPayment.js";

// controllers/paymentController.js

// controllers/paymentController.js

export const bulkUpsertPayments = async (req, res) => {
  try {
    const body = req.body?.payments?.payments ? req.body.payments : req.body;
    const { payments, weekStartDate, weekEndDate } = body || {};

    if (!Array.isArray(payments) || payments.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Payments array is required" });
    }

    // Week meta based on weekStartDate
    const start = new Date(weekStartDate);
    const weekYear = start.getFullYear();
    const weekNumber = Math.ceil(
      ((start - new Date(weekYear, 0, 1)) / 86400000 + start.getDay() + 1) / 7
    );

    // Build updates per party
    const updatesByParty = {};

    for (const p of payments) {
      const partyId = p.party || p.partyId;
      const paymentDate = p.paymentDate;
      if (!partyId || !paymentDate) continue;

      const dateKey = new Date(paymentDate).toISOString().split("T")[0];

      if (!updatesByParty[partyId]) {
        updatesByParty[partyId] = {
          filter: { party: partyId, weekNumber, weekYear },
          update: {
            $set: {},
            $setOnInsert: {
              party: partyId,
              weekNumber,
              weekYear,
              weekStartDate: new Date(weekStartDate),
              weekEndDate: new Date(weekEndDate),
              createdAt: new Date(),
            },
          },
          options: { upsert: true, new: true, setDefaultsOnInsert: true },
        };
      }

      const setMap = updatesByParty[partyId].update.$set;

      // Ensure date node
      setMap[`payments.${dateKey}.paymentDate`] = new Date(paymentDate);

      // Only include defined numeric fields
      for (const field of [
        "paymentAmount",
        "pwt",
        "cash",
        "bank",
        "due",
        "tda",
      ]) {
        const v = p[field];
        if (typeof v === "number" && !Number.isNaN(v)) {
          setMap[`payments.${dateKey}.${field}`] = v;
        }
      }

      // Weekly NP as dot paths (no parent in $set)
      if (p.weeklyNP && typeof p.weeklyNP === "object") {
        const { amount, name } = p.weeklyNP;
        if (typeof amount === "number" && !Number.isNaN(amount)) {
          setMap["weeklyNP.amount"] = amount;
        }
        if (typeof name === "string") {
          setMap["weeklyNP.name"] = name;
        }
      }
    }

    // Execute all updates
    const results = await Promise.all(
      Object.values(updatesByParty).map(({ filter, update, options }) =>
        WeeklyPayment.findOneAndUpdate(filter, update, options).lean()
      )
    );

    return res.status(200).json({
      success: true,
      message: "Weekly payments saved successfully",
      data: results,
    });
  } catch (error) {
    console.error("bulkUpsertPayments error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while saving weekly payments",
      error: error.message,
    });
  }
};

export const getWeeklyPayments = async (req, res) => {
  try {
    const { partyId, weekNumber, weekYear, startDate, endDate } = req.query;

    const filter = {};
    if (partyId) filter.party = partyId;
    if (weekNumber) filter.weekNumber = parseInt(weekNumber, 10);
    if (weekYear) filter.weekYear = parseInt(weekYear, 10);

    // If a date range is provided, match any week that overlaps this window
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && end) {
        // overlap: weekEndDate >= start AND weekStartDate <= end
        filter.$and = [
          { weekEndDate: { $gte: start } },
          { weekStartDate: { $lte: end } },
        ];
      } else if (start) {
        filter.weekEndDate = { $gte: start };
      } else if (end) {
        filter.weekStartDate = { $lte: end };
      }
    }

    const weeks = await WeeklyPayment.find(filter)
      .populate("party", "partyName partyCode")
      .sort({ weekNumber: -1 })
      .lean();

    // If a date range is provided, trim payments to the range
    let data = weeks;
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      data = weeks.map((w) => {
        if (!w.payments) return w;

        const entries = {};
        for (const [key, val] of Object.entries(w.payments)) {
          // key is "YYYY-MM-DD"
          const keyDate = new Date(key);
          const inLower = !start || keyDate >= start;
          const inUpper = !end || keyDate <= end;
          if (inLower && inUpper) {
            entries[key] = val;
          }
        }
        return { ...w, payments: entries };
      });
    }

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Error fetching weekly payments:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// Multi-Day Payment Controllers
export const createMultiDayPayment = async (req, res) => {
  try {
    const {
      partyId,
      startDate,
      endDate,
      paymentAmount,
      pwt,
      cash,
      bank,
      due,
      atd,
    } = req.body;

    const party = await Party.findById(partyId);
    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }

    const start = new Date(startDate);
    const { week, year } = getWeekNumber(start);

    const multiPayment = new MultiDayPayment({
      party: partyId,
      startDate: start,
      endDate: new Date(endDate),
      paymentAmount,
      pwt,
      cash,
      bank,
      due,
      atd,
      weekNumber: week,
      weekYear: year,
      createdBy: req.user?._id,
    });

    await multiPayment.save();
    await multiPayment.populate("party");

    res.status(201).json({
      success: true,
      message: "Multi-day payment created successfully",
      data: multiPayment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMultiDayPayments = async (req, res) => {
  try {
    const { partyId, startDate, endDate, weekNumber } = req.query;
    const filter = {};

    if (partyId) filter.party = partyId;
    if (weekNumber) filter.weekNumber = parseInt(weekNumber);

    if (startDate || endDate) {
      filter.$or = [];
      if (startDate) {
        filter.$or.push({ startDate: { $gte: new Date(startDate) } });
      }
      if (endDate) {
        filter.$or.push({ endDate: { $lte: new Date(endDate) } });
      }
    }

    const payments = await MultiDayPayment.find(filter)
      .populate("party", "partyName partyCode")
      .sort({ startDate: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};




