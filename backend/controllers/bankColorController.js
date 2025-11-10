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
    startDate: dates[0],
    endDate: dates[1]
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

      if (isPartyTotal) {
        // Update party total bank color
        updatedDoc = await MultiDayPayment.findOneAndUpdate(
          { party: partyObjectId },
          { $set: { partyTotalBankColor: color } },
          { new: true, sort: { createdAt: -1 } }
        );
      } else {
        // Parse the date range
        const { startDate, endDate } = parseDateRange(paymentDate);
        const startDateObj = new Date(startDate + 'T00:00:00.000Z');
        const endDateObj = new Date(endDate + 'T00:00:00.000Z');
        
        // Find document with matching range
        const multiDayDoc = await MultiDayPayment.findOne({
          party: partyObjectId,
          paymentRanges: {
            $elemMatch: {
              startDate: startDateObj,
              endDate: endDateObj
            }
          }
        });

        if (!multiDayDoc) {
          return res.status(404).json({ 
            success: false, 
            message: 'MultiDayPayment not found',
            debug: { partyId, paymentDate }
          });
        }

        // Find the matching payment range index
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

        // ✅ Use findOneAndUpdate with positional operator to update specific array element
        updatedDoc = await MultiDayPayment.findOneAndUpdate(
          { 
            _id: multiDayDoc._id,
            'paymentRanges.startDate': startDateObj,
            'paymentRanges.endDate': endDateObj
          },
          { $set: { 'paymentRanges.$.bankColorStatus': color } },
          { new: true }
        );
      }

      if (!updatedDoc) {
        return res.status(404).json({ 
          success: false, 
          message: 'Failed to update MultiDayPayment' 
        });
      }

    } else if (paymentType === 'daily' || paymentType === 'weekly') {
      // DAILY/WEEKLY PAYMENT (WeeklyPayment model with Map)
      
      if (!isPartyTotal && !paymentDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'paymentDate is required for individual payment' 
        });
      }

      if (isPartyTotal) {
        // Update party total bank color
        updatedDoc = await WeeklyPayment.findOneAndUpdate(
          { party: partyObjectId },
          { $set: { partyTotalBankColor: color } },
          { new: true, sort: { createdAt: -1 } }
        );
      } else {
        // ✅ Use dot notation to update only bankColorStatus in the Map
        updatedDoc = await WeeklyPayment.findOneAndUpdate(
          { 
            party: partyObjectId,
            [`payments.${paymentDate}`]: { $exists: true }
          },
          { $set: { [`payments.${paymentDate}.bankColorStatus`]: color } },
          { new: true }
        );
      }

      if (!updatedDoc) {
        return res.status(404).json({ 
          success: false, 
          message: 'WeeklyPayment not found for this date',
          debug: { partyId, paymentDate }
        });
      }

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
