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
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5 lg:space-y-6 px-1 sm:px-2 md:px-3 lg:px-4 max-w-full overflow-x-hidden">
      {/* Welcome Section */}
      <div
        className="rounded-lg shadow-lg p-3 sm:p-4 md:p-5 lg:p-6 text-white"
        style={{ backgroundColor: "#8cc63e" }}
      >
        <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold break-words">
          Welcome back, {profile?.full_name || "User"}!
        </h1>
        <p className="mt-1 sm:mt-2 text-white/90 text-xs sm:text-sm md:text-base">
          Here's your compliance overview for today.
        </p>
      </div>

      {/* Stats Cards */}
      <ComplianceStats stats={stats} />

      {/* Charts and Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
        <ComplianceChart data={chartData} />
        <UpcomingDeadlines deadlines={deadlines} />
      </div>
    </div>
  );
};

export default Dashboard;