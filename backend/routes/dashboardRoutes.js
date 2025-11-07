// routes/paymentRoutes.js
import express from 'express';
import { getRangeSummary } from '../controllers/dashboardController.js';

const router = express.Router();
router.get('/summary', getRangeSummary);

export default router;
