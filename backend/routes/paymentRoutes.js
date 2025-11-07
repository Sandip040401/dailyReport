// routes/paymentRoutes.js
import express from 'express';
import {
  bulkUpsertPayments,
  getWeeklyPayments
} from '../controllers/paymentController.js';

const router = express.Router();

// Daily Payment Routes
router.post('/bulk-upsert', bulkUpsertPayments);
router.get('/daily', getWeeklyPayments);


export default router;
