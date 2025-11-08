// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import DailyPaymentsPage from "./pages/DailyPaymentsPage";
import MultiDayPaymentsPage from "./pages/MultiDayPaymentsPage";
import ExpensesPage from "./pages/ExpensesPage";
import PartiesPage from "./pages/PartiesPage";
import Login from "./pages/Login";
import { Report } from "./pages/Report";

// Protected Route Wrapper
function ProtectedLayout() {
  const token = localStorage.getItem('payment-token');
  
  if (!token) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<Login />} />

        {/* Protected Routes with Layout */}
        <Route element={<ProtectedLayout />}>
          <Route path="/user" element={<Index />} />
          <Route path="/daily-payments" element={<DailyPaymentsPage />} />
          <Route path="/multi-day-payments" element={<MultiDayPaymentsPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/parties" element={<PartiesPage />} />
          <Route path="/reports" element={<Report />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
