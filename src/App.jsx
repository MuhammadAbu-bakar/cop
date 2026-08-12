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
import EvidenceRepository from "./components/evidence/EvidenceRepository";
import ComplianceCalendar from "./components/calendar/ComplianceCalendar";
import Reports from "./components/reports/Reports";
import AdminPanel from "./components/admin/AdminPanel";
import Policies from "./components/policies/Policies";
import AuditHistory from "./components/audit/AuditHistory";

function App() {
  return (
    <Router>
      <AuthProvider>
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
            <Route path="evidence" element={<EvidenceRepository />} />
            <Route path="calendar" element={<ComplianceCalendar />} />
            <Route path="reports" element={<Reports />} />
            <Route path="policies" element={<Policies />} />
            <Route path="audit-history" element={<AuditHistory />} />

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
