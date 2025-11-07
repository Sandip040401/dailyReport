// routes/expenseRoutes.js
import express from 'express';
import {
  createExpense,
  getExpenses,
  updateExpense,
  deleteExpense
} from '../controllers/expenseController.js';

const router = express.Router();

router.post('/', createExpense);
router.get('/', getExpenses);
router.patch('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;
