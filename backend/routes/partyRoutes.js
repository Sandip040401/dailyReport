// routes/partyRoutes.js
import express from 'express';
import {
  createParty,
  getAllParties,
  getPartyDetails,
  updateParty,
  deactivateParty,
  getDailyParties,
  getMultiDayParties
} from '../controllers/partyController.js';

const router = express.Router();

router.post('/', createParty);

router.patch('/:id', updateParty);
router.patch('/:id/deactivate', deactivateParty);
router.get('/daily', getDailyParties);
router.get('/multiday', getMultiDayParties);
router.get('/', getAllParties);
router.get('/:id', getPartyDetails);
export default router;
