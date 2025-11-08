// controllers/bankColorController.js
import WeeklyPayment from '../models/WeeklyPayment.js';
import MultiDayPayment from '../models/MultiDayPayment.js';
import mongoose from 'mongoose';

/**
 * Parse date range string like "2025-11-03 – 2025-11-05"
 * Returns { startDate, endDate } as string format YYYY-MM-DD
 */
const parseDateRange = (rangeString) => {
  const datePattern = /\d{4}-\d{2}-\d{2}/g;
  const dates = rangeString.match(datePattern);
  
  if (!dates || dates.length !== 2) {
    console.error('Failed to parse date range:', rangeString);
    console.error('Found dates:', dates);
    throw new Error(`Invalid date range format: ${rangeString}`);
  }
  
  return {
    startDate: dates[0], // Return as string
    endDate: dates[1]    // Return as string
  };
};

/**
 * Check if two dates match (ignoring time)
 */
const datesMatch = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  return d1.getUTCFullYear() === d2.getUTCFullYear() &&
         d1.getUTCMonth() === d2.getUTCMonth() &&
         d1.getUTCDate() === d2.getUTCDate();
};

// Update bank color for a specific payment entry
export const updateBankColor = async (req, res) => {
  try {
    const { partyId, paymentDate, color, isPartyTotal, paymentType } = req.body;
    
    // Validate required fields
    if (!partyId) {
      return res.status(400).json({ success: false, message: 'partyId is required' });
    }

    if (!['red', 'green'].includes(color)) {
      return res.status(400).json({ success: false, message: 'Invalid color. Must be "red" or "green"' });
    }
    
    const partyObjectId = new mongoose.Types.ObjectId(partyId);

    let updatedDoc;

    // Handle different payment types
    if (paymentType === 'range') {
      // RANGE PAYMENT (MultiDayPayment)
      if (!isPartyTotal && !paymentDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'paymentDate is required for individual range payment' 
        });
      }

      let multiDayDoc;

      if (isPartyTotal) {
        // For party total, get the most recent document
        multiDayDoc = await MultiDayPayment.findOne({
          party: partyObjectId
        }).sort({ createdAt: -1 });
      } else {
        // Parse the date range to get string dates
        const { startDate, endDate } = parseDateRange(paymentDate);
        
        // Create Date objects for querying (start of day)
        const startDateObj = new Date(startDate + 'T00:00:00.000Z');
        const endDateObj = new Date(endDate + 'T00:00:00.000Z');
        
        // Query to find document with matching date range in paymentRanges array
        multiDayDoc = await MultiDayPayment.findOne({
          party: partyObjectId,
          paymentRanges: {
            $elemMatch: {
              startDate: startDateObj,
              endDate: endDateObj
            }
          }
        });
      }

      if (!multiDayDoc) {
        return res.status(404).json({ 
          success: false, 
          message: 'MultiDayPayment not found',
          debug: { partyId, paymentDate }
        });
      }

      if (isPartyTotal) {
        // Update party total bank color
        multiDayDoc.partyTotalBankColor = color;
      } else {
        // Parse again for comparison
        const { startDate, endDate } = parseDateRange(paymentDate);
        const startDateObj = new Date(startDate + 'T00:00:00.000Z');
        const endDateObj = new Date(endDate + 'T00:00:00.000Z');
        
        // Find the matching payment range
        const rangeIndex = multiDayDoc.paymentRanges.findIndex(range => 
          datesMatch(range.startDate, startDateObj) && 
          datesMatch(range.endDate, endDateObj)
        );

        if (rangeIndex === -1) {
          return res.status(404).json({ 
            success: false, 
            message: 'Payment range not found',
            debug: { 
              searchedRange: paymentDate,
              availableRanges: multiDayDoc.paymentRanges.map(r => ({
                start: r.startDate,
                end: r.endDate
              }))
            }
          });
        }

        // Update the bank color status for the found range
        multiDayDoc.paymentRanges[rangeIndex].bankColorStatus = color;
      }

      updatedDoc = await multiDayDoc.save();

    } else if (paymentType === 'daily' || paymentType === 'weekly') {
      // DAILY/WEEKLY PAYMENT (both use WeeklyPayment model)
      
      if (!isPartyTotal && !paymentDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'paymentDate is required for individual payment' 
        });
      }

      // Query by date in payments Map using dot notation
      let weeklyDoc;
      
      if (isPartyTotal) {
        // For party total, just get the most recent document for this party
        weeklyDoc = await WeeklyPayment.findOne({
          party: partyObjectId
        }).sort({ createdAt: -1 });
      } else {
        // Find document where this specific date exists in payments Map
        weeklyDoc = await WeeklyPayment.findOne({
          party: partyObjectId,
          [`payments.${paymentDate}`]: { $exists: true }
        });
      }

      if (!weeklyDoc) {
        return res.status(404).json({ 
          success: false, 
          message: 'WeeklyPayment not found for this date',
          debug: { partyId, paymentDate }
        });
      }

      if (isPartyTotal) {
        // Update party total bank color
        weeklyDoc.partyTotalBankColor = color;
      } else {
        // Update specific date payment color
        const paymentEntry = weeklyDoc.payments.get(paymentDate);
        
        if (!paymentEntry) {
          return res.status(404).json({ 
            success: false, 
            message: 'Payment entry not found for this date',
            debug: { 
              paymentDate, 
              availableDates: Array.from(weeklyDoc.payments.keys()) 
            }
          });
        }

        // Update the bank color status
        paymentEntry.bankColorStatus = color;
        weeklyDoc.payments.set(paymentDate, paymentEntry);
      }

      updatedDoc = await weeklyDoc.save();

    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid paymentType. Must be "daily", "weekly", or "range"' 
      });
    }

    res.json({
      success: true,
      message: 'Bank color updated successfully',
      data: updatedDoc,
    });

  } catch (error) {
    console.error('Error updating bank color:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};
