import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getDashboardStats,
  getComplianceByDomain,
  getUpcomingDeadlines,
} from "../../api/compliance";
import ComplianceStats from "./ComplianceStats";
import ComplianceChart from "./ComplianceChart";
import UpcomingDeadlines from "./UpcomingDeadlines";

const Dashboard = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    overallCompliance: 0,
    auditReadiness: 0,
    totalObligations: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    inProgress: 0,
    notStarted: 0,
  });
  const [chartData, setChartData] = useState({ domains: [], compliance: [] });
  const [deadlines, setDeadlines] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, chartData, deadlinesData] = await Promise.all([
        getDashboardStats(),
        getComplianceByDomain(),
        getUpcomingDeadlines(),
      ]);

      setStats(statsData);
      setChartData(chartData);
      setDeadlines(deadlinesData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 max-w-full overflow-x-hidden">
      {/* Welcome Section - Updated to #8cc63e */}
      <div
        className="rounded-lg shadow-lg p-4 sm:p-6 text-white"
        style={{ backgroundColor: "#8cc63e" }}
      >
        <h1 className="text-xl sm:text-2xl font-bold break-words">
          Welcome back, {profile?.full_name || "User"}!
        </h1>
        <p className="mt-1 sm:mt-2 text-white/90 text-sm sm:text-base">
          Here's your compliance overview for today.
        </p>
      </div>

      {/* Stats Cards */}
      <ComplianceStats stats={stats} />

      {/* Charts and Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <ComplianceChart data={chartData} />
        <UpcomingDeadlines deadlines={deadlines} />
      </div>

      {/* Quick Actions */}
      {/* <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <button className="p-3 sm:p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <svg
              className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">New Obligation</p>
          </button>

          <button className="p-3 sm:p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
            <svg
              className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">Upload Evidence</p>
          </button>

          <button className="p-3 sm:p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
            <svg
              className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">Generate Report</p>
          </button>

          <button className="p-3 sm:p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
            <svg
              className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">View Calendar</p>
          </button>
        </div>
      </div> */}
    </div>
  );
};

export default Dashboard;