// controllers/bankColorController.js
import WeeklyPayment from "../models/WeeklyPayment.js";
import MultiDayPayment from "../models/MultiDayPayment.js";
import mongoose from "mongoose";

/**
 * ✨ NEW: Helper to check if payment entry has at least one non-zero value
 */
const hasValidPaymentData = (entry) => {
  if (!entry) return false;

  const paymentAmount = entry.paymentAmount ?? 0;
  const pwt = entry.pwt ?? 0;
  const cash = entry.cash ?? 0;
  const bank = entry.bank ?? 0;
  const due = entry.due ?? 0;
  const tda = entry.tda ?? 0;

  // Return true if at least one field is non-zero
  return (
    paymentAmount !== 0 ||
    pwt !== 0 ||
    cash !== 0 ||
    bank !== 0 ||
    due !== 0 ||
    tda !== 0
  );
};

/**
 * Parse date range string like "2025-11-03 – 2025-11-05"
 * Returns { startDate, endDate } as string format YYYY-MM-DD
 */
const parseDateRange = (rangeString) => {
  const datePattern = /\d{4}-\d{2}-\d{2}/g;
  const dates = rangeString.match(datePattern);

  if (!dates || dates.length !== 2) {
    console.error("Failed to parse date range:", rangeString);
    console.error("Found dates:", dates);
    throw new Error(`Invalid date range format: ${rangeString}`);
  }

  return {
    startDate: dates[0],
    endDate: dates[1],
  };
};

/**
 * Check if two dates match (ignoring time)
 */
const datesMatch = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  );
};

// Update bank color for a specific payment entry
export const updateBankColor = async (req, res) => {
  try {
    console.log("\n═══════════════════════════════════════");
    console.log("🎨 BANK COLOR UPDATE REQUEST");
    console.log("═══════════════════════════════════════");
    console.log("📥 Request Body:", JSON.stringify(req.body, null, 2));

    const { partyId, paymentDate, color, isPartyTotal, paymentType } = req.body;

    // Validate required fields
    if (!partyId) {
      console.log("❌ Validation Failed: partyId missing");
      return res
        .status(400)
        .json({ success: false, message: "partyId is required" });
    }

    if (!["red", "green"].includes(color)) {
      console.log("❌ Validation Failed: Invalid color:", color);
      return res
        .status(400)
        .json({
          success: false,
          message: 'Invalid color. Must be "red" or "green"',
        });
    }

    const partyObjectId = new mongoose.Types.ObjectId(partyId);
    console.log("✅ Validation Passed");
    console.log("🔑 Party ObjectId:", partyObjectId.toString());
    console.log("🎨 Target Color:", color);
    console.log("📅 Payment Date:", paymentDate);
    console.log("📊 Payment Type:", paymentType);
    console.log("🎯 Is Party Total:", isPartyTotal);

    let updatedDoc;
    let savedColor;

    // Handle different payment types
    if (paymentType === "range") {
      console.log("\n--- RANGE PAYMENT PROCESSING ---");

      if (!isPartyTotal && !paymentDate) {
        console.log("❌ Missing paymentDate for individual range payment");
        return res.status(400).json({
          success: false,
          message: "paymentDate is required for individual range payment",
        });
      }

      if (isPartyTotal) {
        console.log("🔄 Updating PARTY TOTAL color for MultiDayPayment...");

        updatedDoc = await WeeklyPayment.findOneAndUpdate(
          {
            _id: existingDoc._id,
            [`payments.${paymentDate}`]: { $exists: true },
          },
          {
            $set: {
              [`payments.${paymentDate}.bankColorStatus`]: color,
            },
          },
          { new: true },
        );

        if (!updatedDoc) {
          return res.status(404).json({
            success: false,
            message: "Failed to update payment color",
          });
        }

        savedColor = updatedDoc.payments?.get(paymentDate)?.bankColorStatus;
      } else {
        console.log("🔄 Updating INDIVIDUAL range payment color...");

        // Parse the date range
        const { startDate, endDate } = parseDateRange(paymentDate);
        console.log("📅 Parsed Range:", { startDate, endDate });

        const startDateObj = new Date(startDate + "T00:00:00.000Z");
        const endDateObj = new Date(endDate + "T00:00:00.000Z");
        console.log("📅 Date Objects:", { startDateObj, endDateObj });

        // Find document with matching range
        console.log("🔍 Searching for MultiDayPayment document...");
        const multiDayDoc = await MultiDayPayment.findOne({
          party: partyObjectId,
          paymentRanges: {
            $elemMatch: {
              startDate: startDateObj,
              endDate: endDateObj,
            },
          },
        });

        console.log("📄 MultiDayDoc Found:", multiDayDoc ? "YES" : "NO");

        if (!multiDayDoc) {
          console.log("❌ MultiDayPayment not found for range:", paymentDate);
          return res.status(404).json({
            success: false,
            message: "MultiDayPayment not found",
            debug: { partyId, paymentDate },
          });
        }

        // ✨ CRITICAL FIX: Find the matching payment range with valid data
        const rangeIndex = multiDayDoc.paymentRanges.findIndex((range) => {
          const datesMatchCheck =
            datesMatch(range.startDate, startDateObj) &&
            datesMatch(range.endDate, endDateObj);
          const hasValidData = hasValidPaymentData(range);

          console.log("🔍 Checking range:", {
            dates: `${range.startDate} to ${range.endDate}`,
            datesMatch: datesMatchCheck,
            hasValidData,
            data: {
              paymentAmount: range.paymentAmount,
              pwt: range.pwt,
              cash: range.cash,
              bank: range.bank,
              due: range.due,
              tda: range.tda,
            },
          });

          return datesMatchCheck && hasValidData;
        });

        console.log("📍 Valid Range Index Found:", rangeIndex);

        if (rangeIndex === -1) {
          console.log("❌ Payment range with valid data not found in document");
          return res.status(404).json({
            success: false,
            message: "Payment range with valid data not found",
            debug: {
              searchedRange: paymentDate,
              availableRanges: multiDayDoc.paymentRanges.map((r) => ({
                start: r.startDate,
                end: r.endDate,
                hasData: hasValidPaymentData(r),
              })),
            },
          });
        }

        // Get the actual range to update
        const targetRange = multiDayDoc.paymentRanges[rangeIndex];

        console.log("🔄 Updating range color...");
        // Update specific array element using the matched range's exact dates
        updatedDoc = await MultiDayPayment.findOneAndUpdate(
          {
            _id: multiDayDoc._id,
            "paymentRanges.startDate": targetRange.startDate,
            "paymentRanges.endDate": targetRange.endDate,
          },
          { $set: { "paymentRanges.$.bankColorStatus": color } },
          { new: true },
        );

        console.log("📄 Update Result:", updatedDoc ? "SUCCESS" : "FAILED");

        // Extract the saved color from the updated range
        const updatedRange = updatedDoc?.paymentRanges.find(
          (range) =>
            datesMatch(range.startDate, targetRange.startDate) &&
            datesMatch(range.endDate, targetRange.endDate),
        );
        savedColor = updatedRange?.bankColorStatus;
        console.log("💾 Saved Color from DB:", savedColor);
      }
    } else if (paymentType === "daily" || paymentType === "weekly") {
      console.log("\n--- DAILY/WEEKLY PAYMENT PROCESSING ---");

      if (!isPartyTotal && !paymentDate) {
        console.log("❌ Missing paymentDate for individual payment");
        return res.status(400).json({
          success: false,
          message: "paymentDate is required for individual payment",
        });
      }

      if (isPartyTotal) {
        console.log("🔄 Updating PARTY TOTAL color for WeeklyPayment...");

        updatedDoc = await WeeklyPayment.findOneAndUpdate(
          { party: partyObjectId },
          { $set: { partyTotalBankColor: color } },
          { new: true, sort: { createdAt: -1 } },
        );

        console.log("📄 Updated Document:", updatedDoc ? "Found" : "NOT FOUND");
        if (updatedDoc) {
          console.log(
            "💾 Saved partyTotalBankColor:",
            updatedDoc.partyTotalBankColor,
          );
        }

        if (!updatedDoc) {
          console.log(
            "❌ WeeklyPayment document not found for party:",
            partyObjectId.toString(),
          );
          return res.status(404).json({
            success: false,
            message: "WeeklyPayment document not found",
          });
        }

        savedColor = updatedDoc.partyTotalBankColor;
      } else {
        console.log("🔄 Updating INDIVIDUAL daily/weekly payment color...");
        console.log("🔍 Searching for payment with date:", paymentDate);

        // ✨ CRITICAL FIX: Find the document and iterate to find valid payment
        const existingDoc = await WeeklyPayment.findOne({
          party: partyObjectId,
          [`payments.${paymentDate}`]: { $exists: true },
        });

        console.log("📄 Existing Document Found:", existingDoc ? "YES" : "NO");
        if (existingDoc) {
          console.log("📦 Document ID:", existingDoc._id);
          console.log("📊 Total Payments in Map:", existingDoc.payments?.size);
          console.log(
            "🗓️ Available Payment Dates:",
            Array.from(existingDoc.payments?.keys() || []),
          );
        }

        if (!existingDoc) {
          console.log("❌ WeeklyPayment not found for date:", paymentDate);
          return res.status(404).json({
            success: false,
            message: "WeeklyPayment not found for this date",
            debug: { partyId, paymentDate },
          });
        }

        // ✨ CRITICAL FIX: Get the existing payment and validate it has data
        const existingPayment = existingDoc.payments.get(paymentDate);

        console.log(
          "💳 Existing Payment Data:",
          existingPayment ? "FOUND" : "NOT FOUND",
        );
        if (existingPayment) {
          console.log(
            "📋 BEFORE Update:",
            JSON.stringify(existingPayment, null, 2),
          );
          console.log(
            "🎨 Current bankColorStatus:",
            existingPayment.bankColorStatus,
          );
          console.log(
            "✅ Has Valid Data:",
            hasValidPaymentData(existingPayment),
          );
        }

        if (!existingPayment) {
          console.log(
            "❌ Payment data not found in Map for date:",
            paymentDate,
          );
          return res.status(404).json({
            success: false,
            message: "Payment data not found in Map",
            debug: { partyId, paymentDate },
          });
        }

        // ✨ CRITICAL FIX: Validate payment has actual data before updating
        if (!hasValidPaymentData(existingPayment)) {
          console.log("❌ Payment entry has all zero values, skipping update");

          // Try to find another document/entry for this date with valid data
          console.log("🔍 Searching for alternative entry with valid data...");

          // Get all documents for this party
          const allDocs = await WeeklyPayment.find({
            party: partyObjectId,
            [`payments.${paymentDate}`]: { $exists: true },
          });

          console.log("📚 Found", allDocs.length, "document(s) with this date");

          // Find a document with valid payment data for this date
          let validDoc = null;
          let validPayment = null;

          for (const doc of allDocs) {
            const payment = doc.payments.get(paymentDate);
            if (hasValidPaymentData(payment)) {
              validDoc = doc;
              validPayment = payment;
              console.log("✅ Found valid payment in document:", doc._id);
              break;
            }
          }

          if (!validDoc || !validPayment) {
            console.log("❌ No valid payment data found for this date");
            return res.status(404).json({
              success: false,
              message: "No payment entry with valid data found for this date",
              debug: { partyId, paymentDate },
            });
          }

          // Update the valid entry
          console.log("🔄 Updating valid payment entry...");
          validPayment.bankColorStatus = color;
          validDoc.payments.set(paymentDate, validPayment);
          validDoc.markModified("payments");
          await validDoc.save();

          // Reload and verify
          const reloadedDoc = await WeeklyPayment.findById(validDoc._id);
          const verifyPayment = reloadedDoc?.payments?.get(paymentDate);

          console.log(
            "📋 AFTER Update (reloaded):",
            JSON.stringify(verifyPayment, null, 2),
          );
          console.log(
            "🎨 Verified bankColorStatus:",
            verifyPayment?.bankColorStatus,
          );

          savedColor = verifyPayment?.bankColorStatus;
          updatedDoc = reloadedDoc;
        } else {
          // Payment has valid data, proceed with normal update
          console.log("🔄 Modifying Map value directly...");

          existingPayment.bankColorStatus = color;
          existingDoc.payments.set(paymentDate, existingPayment);
          existingDoc.markModified("payments");

          console.log("💾 Saving document with markModified...");
          await existingDoc.save();

          console.log("✅ Document saved successfully");

          // Reload document from database to verify the save
          console.log("🔍 Reloading document to verify...");
          const reloadedDoc = await WeeklyPayment.findById(existingDoc._id);
          const verifyPayment = reloadedDoc?.payments?.get(paymentDate);

          console.log(
            "📋 AFTER Update (reloaded):",
            JSON.stringify(verifyPayment, null, 2),
          );
          console.log(
            "🎨 Verified bankColorStatus:",
            verifyPayment?.bankColorStatus,
          );

          savedColor = verifyPayment?.bankColorStatus;
          updatedDoc = reloadedDoc;
        }
      }

      if (!updatedDoc) {
        console.log("❌ Failed to update WeeklyPayment");
        return res.status(404).json({
          success: false,
          message: "Failed to update WeeklyPayment",
        });
      }
    } else {
      console.log("❌ Invalid paymentType:", paymentType);
      return res.status(400).json({
        success: false,
        message: 'Invalid paymentType. Must be "daily", "weekly", or "range"',
      });
    }

    console.log("\n✅ UPDATE SUCCESSFUL");
    console.log("💾 Final Saved Color:", savedColor);
    console.log("═══════════════════════════════════════\n");

    // Return the saved color from the database
    res.json({
      success: true,
      message: "Bank color updated successfully",
      data: {
        color: savedColor || color,
      },
    });
  } catch (error) {
    console.error("\n❌❌❌ ERROR OCCURRED ❌❌❌");
    console.error("Error Message:", error.message);
    console.error("Error Stack:", error.stack);
    console.error("═══════════════════════════════════════\n");

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
