// routes/multiDayPayments.routes.js
import { Router } from 'express';
import { bulkUpsertPayments, getWeeklyPayments } from '../controllers/multipaymentController.js';


const router = Router();

// Save or update weekly multi-day payments for one or more parties
router.post('/payments/bulk-upsert', bulkUpsertPayments);

// Fetch weekly multi-day payments with filters
// Query: partyId, weekNumber, weekYear, startDate, endDate
router.get('/payments', getWeeklyPayments);

export default router;
