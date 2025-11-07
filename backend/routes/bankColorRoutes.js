// routes/bankColorRoutes.js
import express from 'express';
import { updateBankColor } from '../controllers/bankColorController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = express.Router();

router.patch('/',protect, authorize('admin'), updateBankColor);

export default router;
