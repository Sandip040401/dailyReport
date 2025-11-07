// controllers/multiDayPayment.controller.js
import MultiDayPayment from '../models/MultiDayPayment.js';

const asDate = (d) => (d instanceof Date ? d : new Date(d));
const isValid = (d) => d instanceof Date && !Number.isNaN(d.getTime());

export const bulkUpsertPayments = async (req, res) => {
  try {
    const { payments, weekStartDate, weekEndDate, weekNumber: wkNumOverride, weekYear: wkYrOverride } = req.body;

    if (!Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({ success: false, message: "Payments array is required" });
    }

    const ws = asDate(weekStartDate);
    const we = asDate(weekEndDate);
    if (!isValid(ws) || !isValid(we) || ws > we) {
      return res.status(400).json({ success: false, message: "Invalid weekStartDate/weekEndDate" });
    }

    // Week meta (override if provided)
    const weekYear = Number.isInteger(wkYrOverride) ? wkYrOverride : ws.getFullYear();
    const weekNumber = Number.isInteger(wkNumOverride)
      ? wkNumOverride
      : Math.ceil(((ws - new Date(weekYear, 0, 1)) / 86400000 + ws.getDay() + 1) / 7);

    // Group by party
    const paymentsByParty = {};

    for (const p of payments) {
      const partyId = p.party || p.partyId;
      if (!partyId) continue;

      if (!paymentsByParty[partyId]) {
        paymentsByParty[partyId] = {
          partyId,
          paymentRanges: [],
          weeklyNP: { amount: 0, name: '' }
        };
      }

      // Handle weeklyNP entries (no paymentRange)
      if (p.weeklyNP && typeof p.weeklyNP === 'object') {
        const { amount, name } = p.weeklyNP;
        if (typeof amount === 'number' && !Number.isNaN(amount)) {
          paymentsByParty[partyId].weeklyNP.amount = amount;
        }
        if (typeof name === 'string') {
          paymentsByParty[partyId].weeklyNP.name = name;
        }
        continue; // Skip this entry, it's not a payment range
      }

      // Handle payment range entries
      if (!Array.isArray(p.paymentRange) || p.paymentRange.length !== 2) {
        continue; // Skip invalid payment ranges
      }

      const startDate = asDate(p.paymentRange[0]);
      const endDate = asDate(p.paymentRange[1]);

      if (!isValid(startDate) || !isValid(endDate) || startDate > endDate) {
        continue; // Skip invalid date ranges
      }

      // Build the payment range object
      const rangeEntry = {
        startDate,
        endDate,
        paymentAmount: typeof p.paymentAmount === 'number' ? p.paymentAmount : 0,
        pwt: typeof p.pwt === 'number' ? p.pwt : 0,
        cash: typeof p.cash === 'number' ? p.cash : 0,
        bank: typeof p.bank === 'number' ? p.bank : 0,
        due: typeof p.due === 'number' ? p.due : 0,
        tda: typeof p.tda === 'number' ? p.tda : 0,
      };

      paymentsByParty[partyId].paymentRanges.push(rangeEntry);
    }

    // Execute upserts for each party
    const results = await Promise.all(
      Object.values(paymentsByParty).map(async ({ partyId, paymentRanges, weeklyNP }) => {
        const filter = { party: partyId, weekNumber, weekYear };
        
        const update = {
          $set: {
            weekStartDate: ws,
            weekEndDate: we,
            paymentRanges,
            weeklyNP,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            party: partyId,
            weekNumber,
            weekYear,
            createdAt: new Date(),
            isApproved: false,
          },
        };

        return MultiDayPayment.findOneAndUpdate(
          filter,
          update,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
      })
    );

    return res.status(200).json({
      success: true,
      message: "Weekly multi-day payments saved successfully",
      data: results,
    });
  } catch (error) {
    console.error('Error saving multi-day payments:', error);
    return res.status(500).json({
      success: false,
      message: "Server error while saving weekly multi-day payments",
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

    // Overlap against [startDate, endDate] window if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && end) {
        filter.$and = [{ weekEndDate: { $gte: start } }, { weekStartDate: { $lte: end } }];
      } else if (start) {
        filter.weekEndDate = { $gte: start };
      } else if (end) {
        filter.weekStartDate = { $lte: end };
      }
    }

    const weeks = await MultiDayPayment.find(filter)
      .populate("party", "partyName partyCode")
      .sort({ weekNumber: -1 })
      .lean();

    // If a date range is provided, trim payments map keys to window
    let data = weeks;
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      data = weeks.map((w) => {
        if (!w.payments) return w;

        const entries = {};
        for (const [key, val] of Object.entries(w.payments)) {
          // key is "YYYY-MM-DD"; retain entries whose key date falls inside the requested window
          const keyDate = new Date(key);
          const inLower = !start || keyDate >= start;
          const inUpper = !end || keyDate <= end;
          if (inLower && inUpper) entries[key] = val;
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
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
