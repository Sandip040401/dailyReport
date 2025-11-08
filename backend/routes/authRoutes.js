// routes/bankColorRoutes.js
import express from 'express';
import { getRole, Login, Register } from '../controllers/authController.js';


const router = express.Router();

router.post('/login', Login);
router.post('/register', Register);
router.get('/role', getRole)
export default router;
