// routes/commissionRoutes.js
import express from 'express';
import {
  createCommission,
  getCommissions,
  bulkUpsertCommissions,
  updateCommission,
  toggleCommissionPaid,
  deleteCommission
} from '../controllers/commissionController.js';

const router = express.Router();

router.post('/bulk-upsert', bulkUpsertCommissions);
router.post('/', createCommission);
router.get('/', getCommissions);
router.patch('/:id/toggle-paid', toggleCommissionPaid);
router.patch('/:id', updateCommission);
router.delete('/:id', deleteCommission);

export default router;
