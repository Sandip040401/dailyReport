// controllers/paymentSummaryController.js
import mongoose from 'mongoose';
import WeeklyPayment from '../models/WeeklyPayment.js';
import MultiDayPayment from '../models/MultiDayPayment.js';
import Party from '../models/Party.js';


// Helper functions
const toISO = (d) => new Date(d).toISOString().slice(0, 10);
const isValidDate = (d) => !Number.isNaN(new Date(d).getTime());


// Helper to check if date ranges overlap
const rangesOverlap = (start1, end1, start2, end2) => {
  return start1 <= end2 && end1 >= start2;
};

export const getRangeSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate || !isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({ message: 'startDate and endDate (YYYY-MM-DD) are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Fetch docs overlapping with the range
    const [weeklyDocs, multiDayDocs] = await Promise.all([
      WeeklyPayment.find({
        weekStartDate: { $lte: end },
        weekEndDate: { $gte: start },
      }).lean(),
      MultiDayPayment.find({
        weekStartDate: { $lte: end },
        weekEndDate: { $gte: start },
      }).lean(),
    ]);

    // Collect unique partyIds
    const idSet = new Set();
    for (const d of weeklyDocs) if (d.party) idSet.add(String(d.party));
    for (const d of multiDayDocs) if (d.party) idSet.add(String(d.party));
    const ids = Array.from(idSet);

    // Lookup Party names/codes once
    const partiesArr = await Party.find({ _id: { $in: ids } })
      .select('partyName partyCode')
      .lean();
    const partyIndex = new Map(
      partiesArr.map((p) => [String(p._id), { name: p.partyName, code: p.partyCode }])
    );

    const partyMap = new Map();

    // Helper to ensure party exists in map
    const ensureParty = (partyId) => {
      const pid = String(partyId);
      if (!partyMap.has(pid)) {
        const meta = partyIndex.get(pid) || { name: 'Unknown Party', code: '' };
        partyMap.set(pid, {
          partyId: pid,
          partyName: meta.name,
          partyCode: meta.code,
          payments: [],
          weeklyNP: null,
          partyTotalBankColor: null,
        });
      }
      return partyMap.get(pid);
    };

    // Process WeeklyPayment docs
    for (const doc of weeklyDocs) {
      const party = ensureParty(doc.party);

      // Check if this document's week overlaps the requested range
      const isOverlap = rangesOverlap(doc.weekStartDate, doc.weekEndDate, start, end);

      // Get party total bank color if overlaps
      if (doc.partyTotalBankColor && isOverlap) {
        party.partyTotalBankColor = doc.partyTotalBankColor;
      }

      // Extract daily payment entries filtered by the requested range
      if (doc.payments && (doc.payments instanceof Map ? doc.payments.size > 0 : Object.keys(doc.payments || {}).length > 0)) {
        const entries = doc.payments instanceof Map ? doc.payments.entries() : Object.entries(doc.payments);

        for (const [key, entry] of entries) {
          const entryDate = entry?.paymentDate ? new Date(entry.paymentDate) : new Date(key);
          if (!entryDate || Number.isNaN(entryDate.getTime())) continue;
          if (entryDate < start || entryDate > end) continue;

          party.payments.push({
            type: 'daily',
            source: 'DailyPayment',
            date: toISO(entryDate),
            sortDate: toISO(entryDate),
            paymentAmount: entry?.paymentAmount ?? 0,
            pwt: entry?.pwt ?? 0,
            cash: entry?.cash ?? 0,
            bank: entry?.bank ?? 0,
            due: entry?.due ?? 0,
            tda: entry?.tda ?? 0,
            bankColorStatus: entry?.bankColorStatus || null,
          });
        }
      }

      // Extract weeklyNP if overlapping and weeklyNP object present (no amount check)
      if (isOverlap && doc.weeklyNP && typeof doc.weeklyNP === 'object') {
        party.weeklyNP = {
          name: doc.weeklyNP.name || '',
          amount: doc.weeklyNP.amount || 0,
        };
      }
    }

    // Process MultiDayPayment docs
    for (const doc of multiDayDocs) {
      const party = ensureParty(doc.party);

      // Check if this document's week overlaps the requested range
      const isOverlap = rangesOverlap(doc.weekStartDate, doc.weekEndDate, start, end);

      // Get party total bank color if null and overlaps
      if (doc.partyTotalBankColor && !party.partyTotalBankColor && isOverlap) {
        party.partyTotalBankColor = doc.partyTotalBankColor;
      }

      // Extract payment ranges filtered by requested range
      if (Array.isArray(doc.paymentRanges) && doc.paymentRanges.length > 0) {
        for (const range of doc.paymentRanges) {
          const rs = new Date(range.startDate);
          const re = new Date(range.endDate);
          if (!(rs <= end && re >= start)) continue;

          party.payments.push({
            type: 'range',
            source: 'MultiDayPayment',
            date: `${toISO(rs)} – ${toISO(re)}`,
            sortDate: toISO(rs),
            startDate: toISO(rs),
            endDate: toISO(re),
            paymentAmount: range.paymentAmount || 0,
            pwt: range.pwt || 0,
            cash: range.cash || 0,
            bank: range.bank || 0,
            due: range.due || 0,
            tda: range.tda || 0,
            bankColorStatus: range.bankColorStatus || null,
          });
        }
      }

      // Extract weeklyNP if overlapping and weeklyNP object present (aggregate if already exists)
      if (isOverlap && doc.weeklyNP && typeof doc.weeklyNP === 'object') {
        if (party.weeklyNP) {
          party.weeklyNP.amount += doc.weeklyNP.amount || 0;
          if (doc.weeklyNP.name) {
            party.weeklyNP.name = party.weeklyNP.name
              ? `${party.weeklyNP.name}, ${doc.weeklyNP.name}`
              : doc.weeklyNP.name;
          }
        } else {
          party.weeklyNP = {
            name: doc.weeklyNP.name || '',
            amount: doc.weeklyNP.amount || 0,
          };
        }
      }
    }

    // Build final structured result
    const result = [];

    // Convert map to array and sort parties alphabetically
    const sortedParties = Array.from(partyMap.values()).sort((a, b) =>
      a.partyName.localeCompare(b.partyName)
    );

    for (const party of sortedParties) {
      // Sort payments within each party by date (ascending)
      party.payments.sort((a, b) => {
        const dateCompare = a.sortDate.localeCompare(b.sortDate);
        if (dateCompare !== 0) return dateCompare;
        // If same date, daily before range
        const typeOrder = { daily: 0, range: 1 };
        return (typeOrder[a.type] || 9) - (typeOrder[b.type] || 9);
      });

      // Add party data to result
      result.push({
        partyId: party.partyId,
        partyName: party.partyName,
        partyCode: party.partyCode,
        partyTotalBankColor: party.partyTotalBankColor,
        payments: party.payments,
        weeklyNP: party.weeklyNP,
      });
    }

    return res.json({
      success: true,
      startDate: toISO(start),
      endDate: toISO(end),
      parties: result,
    });
  } catch (e) {
    console.error('getRangeSummary error', e);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: e.message,
    });
  }
};
