// controllers/bankColorController.js
import WeeklyPayment from "../models/WeeklyPayment.js";
import MultiDayPayment from "../models/MultiDayPayment.js";
import mongoose from "mongoose";

/**
 * Parse date range string like "2025-11-03 – 2025-11-05"
 */
const parseDateRange = (rangeString) => {
  const datePattern = /\d{4}-\d{2}-\d{2}/g;
  const dates = rangeString.match(datePattern);

  if (!dates || dates.length !== 2) {
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
      return res.status(400).json({
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

    // ─────────────────────────────────────────
    // RANGE PAYMENT
    // ─────────────────────────────────────────
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

        // ✅ FIXED: use MultiDayPayment, not WeeklyPayment
        updatedDoc = await MultiDayPayment.findOneAndUpdate(
          { party: partyObjectId },
          { $set: { partyTotalBankColor: color } },
          { new: true, sort: { createdAt: -1 } }
        );

        console.log("📄 Updated Document:", updatedDoc ? "Found" : "NOT FOUND");

        if (!updatedDoc) {
          console.log(
            "❌ MultiDayPayment document not found for party:",
            partyObjectId.toString()
          );
          return res.status(404).json({
            success: false,
            message: "MultiDayPayment document not found",
          });
        }

        savedColor = updatedDoc.partyTotalBankColor;
        console.log("💾 Saved partyTotalBankColor:", savedColor);

      } else {
        console.log("🔄 Updating INDIVIDUAL range payment color...");

        const { startDate, endDate } = parseDateRange(paymentDate);
        console.log("📅 Parsed Range:", { startDate, endDate });

        const startDateObj = new Date(startDate + "T00:00:00.000Z");
        const endDateObj = new Date(endDate + "T00:00:00.000Z");
        console.log("📅 Date Objects:", { startDateObj, endDateObj });

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

        // Find the matching range index
        const rangeIndex = multiDayDoc.paymentRanges.findIndex((range) =>
          datesMatch(range.startDate, startDateObj) &&
          datesMatch(range.endDate, endDateObj)
        );

        console.log("📍 Range Index Found:", rangeIndex);

        if (rangeIndex === -1) {
          console.log("❌ Payment range not found in document");
          return res.status(404).json({
            success: false,
            message: "Payment range not found",
            debug: { searchedRange: paymentDate },
          });
        }

        const targetRange = multiDayDoc.paymentRanges[rangeIndex];

        console.log("🔄 Updating range color...");
        // ✅ FIXED: findOneAndUpdate — no .save(), no validation issue
        updatedDoc = await MultiDayPayment.findOneAndUpdate(
          {
            _id: multiDayDoc._id,
            "paymentRanges.startDate": targetRange.startDate,
            "paymentRanges.endDate": targetRange.endDate,
          },
          { $set: { "paymentRanges.$.bankColorStatus": color } },
          { new: true }
        );

        console.log("📄 Update Result:", updatedDoc ? "SUCCESS" : "FAILED");

        if (!updatedDoc) {
          return res.status(404).json({
            success: false,
            message: "Failed to update range color",
          });
        }

        const updatedRange = updatedDoc.paymentRanges.find(
          (range) =>
            datesMatch(range.startDate, targetRange.startDate) &&
            datesMatch(range.endDate, targetRange.endDate)
        );

        savedColor = updatedRange?.bankColorStatus;
        console.log("💾 Saved Color from DB:", savedColor);
      }

    // ─────────────────────────────────────────
    // DAILY / WEEKLY PAYMENT
    // ─────────────────────────────────────────
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
          { new: true, sort: { createdAt: -1 } }
        );

        console.log("📄 Updated Document:", updatedDoc ? "Found" : "NOT FOUND");

        if (!updatedDoc) {
          console.log(
            "❌ WeeklyPayment document not found for party:",
            partyObjectId.toString()
          );
          return res.status(404).json({
            success: false,
            message: "WeeklyPayment document not found",
          });
        }

        savedColor = updatedDoc.partyTotalBankColor;
        console.log("💾 Saved partyTotalBankColor:", savedColor);

      } else {
        console.log("🔄 Updating INDIVIDUAL daily/weekly payment color...");
        console.log("🔍 Searching for payment with date:", paymentDate);

        const existingDoc = await WeeklyPayment.findOne({
          party: partyObjectId,
          [`payments.${paymentDate}`]: { $exists: true },
        });

        console.log("📄 Existing Document Found:", existingDoc ? "YES" : "NO");

        if (!existingDoc) {
          console.log("❌ WeeklyPayment not found for date:", paymentDate);
          return res.status(404).json({
            success: false,
            message: "WeeklyPayment not found for this date",
            debug: { partyId, paymentDate },
          });
        }

        console.log("📦 Document ID:", existingDoc._id);

        // ✅ FIXED: Use findOneAndUpdate — bypasses Mongoose validation entirely
        // No .save(), no "paymentAmount is required" error
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
          { new: true }
        );

        if (!updatedDoc) {
          console.log("❌ Failed to update bankColorStatus");
          return res.status(404).json({
            success: false,
            message: "Failed to update payment color",
            debug: { partyId, paymentDate },
          });
        }

        savedColor = updatedDoc.payments?.get(paymentDate)?.bankColorStatus;
        console.log("💾 Saved Color:", savedColor);
      }

      if (!updatedDoc) {
        console.log("❌ Failed to update WeeklyPayment");
        return res.status(404).json({
          success: false,
          message: "Failed to update WeeklyPayment",
        });
      }

    // ─────────────────────────────────────────
    // INVALID PAYMENT TYPE
    // ─────────────────────────────────────────
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