// index.js (or server.js)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import paymentRoutes from './routes/paymentRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import partyRoutes from './routes/partyRoutes.js';
import multiDayPaymentRoutes from './routes/multipaymentRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import bankColorRoutes from './routes/bankColorRoutes.js';
import authRoutes from './routes/authRoutes.js';
import commissionRoutes from './routes/commissionRoutes.js';


// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/payment-manager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard Middlewares
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://daily.dearportel.in'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

connectDB();

// Serve static files from frontend
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    mongodbConnected: mongoose.connection.readyState === 1
  });
});

// API Routes
app.use('/api/payments', paymentRoutes);
app.use('/api/multi-day-payments', multiDayPaymentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/bank-color', bankColorRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/commissions', commissionRoutes);

// Fallback for SPA (Must be AFTER API routes)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close();
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close();
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
