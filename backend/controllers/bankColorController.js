// controllers/bankColorController.js
import WeeklyPayment from '../models/WeeklyPayment.js';
import MultiDayPayment from '../models/MultiDayPayment.js';

/**
 * Helper function to get ISO week number and year from a date
 * ISO week starts on Monday
 */
const getISOWeekInfo = (date) => {
  const targetDate = new Date(date);
  
  // Set to nearest Thursday (current date + 4 - current day number)
  // Make Sunday's day number 7
  const dayNum = targetDate.getUTCDay() || 7;
  targetDate.setUTCDate(targetDate.getUTCDate() + 4 - dayNum);
  
  // Get first day of year
  const yearStart = new Date(Date.UTC(targetDate.getUTCFullYear(), 0, 1));
  
  // Calculate full weeks to nearest Thursday
  const weekNumber = Math.ceil((((targetDate - yearStart) / 86400000) + 1) / 7);
  
  return {
    weekNumber,
    weekYear: targetDate.getUTCFullYear()
  };
};

/**
 * Parse date range string like "2025-11-03 – 2025-11-06"
 * Returns { startDate, endDate } as Date objects
 */
/**
 * Parse date range string like "2025-11-03 – 2025-11-09"
 * Returns { startDate, endDate } as Date objects
 */
const parseDateRange = (rangeString) => {
  // Extract all date patterns (YYYY-MM-DD)
  const datePattern = /\d{4}-\d{2}-\d{2}/g;
  const dates = rangeString.match(datePattern);
  
  if (!dates || dates.length !== 2) {
    console.error('Failed to parse date range:', rangeString);
    console.error('Found dates:', dates);
    throw new Error(`Invalid date range format: ${rangeString}`);
  }
  
  return {
    startDate: new Date(dates[0]),
    endDate: new Date(dates[1])
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

    let updatedDoc;
    let weekNumber, weekYear;

    // Handle different payment types
    if (paymentType === 'range') {
      // RANGE PAYMENT (MultiDayPayment)
      if (!isPartyTotal && !paymentDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'paymentDate is required for individual range payment' 
        });
      }

      // Calculate week info from payment date range (use start date)
      let referenceDate;
      if (isPartyTotal) {
        // For party total, use current date to find the week
        referenceDate = new Date().toISOString().split('T')[0];
      } else {
        // Parse the date range and use start date
        const { startDate } = parseDateRange(paymentDate);
        referenceDate = startDate.toISOString().split('T')[0];
      }

      const weekInfo = getISOWeekInfo(referenceDate);
      weekNumber = weekInfo.weekNumber;
      weekYear = weekInfo.weekYear;

      const multiDayDoc = await MultiDayPayment.findOne({
        party: partyId,
        weekNumber,
        weekYear,
      });

      if (!multiDayDoc) {
        return res.status(404).json({ 
          success: false, 
          message: 'MultiDayPayment not found',
          debug: { partyId, weekNumber, weekYear }
        });
      }

      if (isPartyTotal) {
        // Update party total bank color
        multiDayDoc.partyTotalBankColor = color;
      } else {
        // Find the matching payment range by comparing start and end dates
        const { startDate, endDate } = parseDateRange(paymentDate);
        
        const rangeIndex = multiDayDoc.paymentRanges.findIndex(range => 
          datesMatch(range.startDate, startDate) && 
          datesMatch(range.endDate, endDate)
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
      
      // For individual payment, calculate week from paymentDate
      // For party total, we need a reference date (use current date or first available payment)
      if (!isPartyTotal && !paymentDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'paymentDate is required for individual payment' 
        });
      }

      // Calculate week info from payment date (or use current date for party total)
      const referenceDate = paymentDate || new Date().toISOString().split('T')[0];
      const weekInfo = getISOWeekInfo(referenceDate);
      weekNumber = weekInfo.weekNumber;
      weekYear = weekInfo.weekYear;

      const weeklyDoc = await WeeklyPayment.findOne({
        party: partyId,
        weekNumber,
        weekYear,
      });

      if (!weeklyDoc) {
        return res.status(404).json({ 
          success: false, 
          message: 'WeeklyPayment not found',
          debug: { partyId, weekNumber, weekYear, referenceDate }
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
