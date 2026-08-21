import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import Login from "./components/auth/Login";
import Dashboard from "./components/dashboard/Dashboard";
import Layout from "./components/common/Layout";
import ComplianceRegister from "./components/compliance/ComplianceRegister";
import ObligationDetails from "./components/compliance/ObligationDetails";
import ComplianceCalendar from "./components/calendar/ComplianceCalendar";
import Reports from "./components/reports/Reports";
import AdminPanel from "./components/admin/AdminPanel";
import Policies from "./components/policies/Policies";
import AuditHistory from "./components/audit/AuditHistory";
import Approvals from "./components/approvals/Approvals"; // Import Approvals component

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        {/* ToastContainer with all options */}
        <ToastContainer 
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          limit={5} // Limit number of toasts shown at once
        />
        
        <Routes>
          {/* Public Routes - Only Login */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes with Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="compliance" element={<ComplianceRegister />} />
            <Route path="compliance/:id" element={<ObligationDetails />} />
            <Route path="calendar" element={<ComplianceCalendar />} />
            <Route path="reports" element={<Reports />} />
            <Route path="policies" element={<Policies />} />
            <Route path="audit-history" element={<AuditHistory />} />
            
            {/* Approvals Route - Admin only */}
            <Route
              path="approvals"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <Approvals />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes - Only accessible by admin */}
            <Route
              path="admin"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;