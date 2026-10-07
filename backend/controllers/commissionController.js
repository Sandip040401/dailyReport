// controllers/commissionController.js
import mongoose from 'mongoose';
import Commission from '../models/Commission.js';
import Party from '../models/Party.js';

export const createCommission = async (req, res) => {
  try {
    const { partyId, startDate, endDate, quantity, percentage, emlot, total, paid, remarks } = req.body;

    if (!partyId || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Party, start date and end date are required' });
    }

    const party = await Party.findById(partyId);
    if (!party) {
      return res.status(404).json({ success: false, message: 'Party not found' });
    }

    const q = Number(quantity) || 0;
    const p = Number(percentage) || 0;
    const em = Number(emlot) || 0;

    const calculatedTotal = Number(((q * p) / 100 - em).toFixed(2));

    const finalTotal = total !== undefined && total !== null ? Number(total) : calculatedTotal;

    const commission = new Commission({
      partyId,
      partyName: party.partyName,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      quantity: q,
      percentage: p,
      emlot: em,
      total: finalTotal,
      paid: Boolean(paid),
      remarks: remarks || '',
      createdBy: req.user?._id
    });

    await commission.save();

    res.status(201).json({
      success: true,
      message: 'Commission entry created successfully',
      data: commission
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCommissions = async (req, res) => {
  try {
    const { partyId, startDate, endDate, paid } = req.query;
    const filter = {};

    if (partyId) filter.partyId = partyId;
    if (paid !== undefined && paid !== '') filter.paid = paid === 'true';

    if (startDate || endDate) {
      filter.$and = [];
      if (startDate) {
        filter.$and.push({ endDate: { $gte: new Date(startDate) } });
      }
      if (endDate) {
        filter.$and.push({ startDate: { $lte: new Date(endDate) } });
      }
    }

    const commissions = await Commission.find(filter)
      .populate('partyId', 'partyName partyCode partyType')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: commissions.length,
      data: commissions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.partyId) {
      const party = await Party.findById(updates.partyId);
      if (party) {
        updates.partyName = party.partyName;
      }
    }

    const commission = await Commission.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('partyId', 'partyName partyCode partyType');

    if (!commission) {
      return res.status(404).json({ success: false, message: 'Commission record not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Commission updated successfully',
      data: commission
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleCommissionPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const commission = await Commission.findById(id);

    if (!commission) {
      return res.status(404).json({ success: false, message: 'Commission record not found' });
    }

    commission.paid = !commission.paid;
    await commission.save();

    res.status(200).json({
      success: true,
      message: `Commission status updated to ${commission.paid ? 'Paid' : 'Unpaid'}`,
      data: commission
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bulkUpsertCommissions = async (req, res) => {
  try {
    const { commissions, weekStartDate, weekEndDate } = req.body;

    if (!Array.isArray(commissions) || commissions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Commissions array is required'
      });
    }

    const results = [];

    for (const item of commissions) {
      const { _id, partyId, startDate, endDate, quantity, percentage, emlot, paid, remarks } = item;

      if (!partyId || !startDate || !endDate) {
        continue;
      }

      const party = await Party.findById(partyId);
      if (!party) continue;

      const q = Number(quantity) || 0;
      const p = Number(percentage) || 0;
      const em = Number(emlot) || 0;

      const total = Number(((q * p) / 100 - em).toFixed(2));

      if (_id && mongoose.Types.ObjectId.isValid(_id)) {
        const updated = await Commission.findByIdAndUpdate(
          _id,
          {
            partyId,
            partyName: party.partyName,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            quantity: q,
            percentage: p,
            emlot: em,
            total,
            paid: Boolean(paid),
            remarks: remarks || '',
            createdBy: req.user?._id
          },
          { new: true }
        );
        if (updated) results.push(updated);
      } else {
        // If an entry exists for the same party and exact same date range, update it or create new
        const existing = await Commission.findOne({
          partyId,
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        });

        if (existing) {
          existing.partyName = party.partyName;
          existing.quantity = q;
          existing.percentage = p;
          existing.emlot = em;
          existing.total = total;
          if (paid !== undefined) existing.paid = Boolean(paid);
          if (remarks !== undefined) existing.remarks = remarks;
          await existing.save();
          results.push(existing);
        } else {
          const newDoc = new Commission({
            partyId,
            partyName: party.partyName,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            quantity: q,
            percentage: p,
            emlot: em,
            total,
            paid: Boolean(paid),
            remarks: remarks || '',
            createdBy: req.user?._id
          });
          await newDoc.save();
          results.push(newDoc);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully processed ${results.length} commission records`,
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const commission = await Commission.findByIdAndDelete(id);

    if (!commission) {
      return res.status(404).json({ success: false, message: 'Commission record not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Commission deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

