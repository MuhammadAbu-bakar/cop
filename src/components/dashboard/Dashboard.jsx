// ============================================================
// Dashboard.jsx - Updated Layout
// ============================================================

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
import RegionalCompliance from "./RegionalCompliance";
import ComplianceRisks from "./ComplianceRisks";
import ComplianceTrend from "./ComplianceTrend";
import AgingGaps from "./AgingGaps";
import ManagementActions from "./ManagementActions";
import ObligationStatus from "./ObligationStatus";

const Dashboard = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    overallCompliance: 91,
    auditReadiness: 94,
    totalObligations: 252,
    completed: 238,
    pending: 14,
    overdue: 14,
    inProgress: 0,
    notStarted: 0,
    highRiskGaps: 7,
    regionsBelowTarget: 2,
    regionsTotal: 6,
    evidenceCompletion: 96,
  });
  const [chartData, setChartData] = useState({ 
    domains: [], 
    compliance: [] 
  });
  const [deadlines, setDeadlines] = useState([]);
  const [regionalData, setRegionalData] = useState([]);
  const [risksData, setRisksData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [agingData, setAgingData] = useState([]);
  const [actionsData, setActionsData] = useState([]);
  const [obligationData, setObligationData] = useState({
    total: 252,
    compliant: 238,
    notApplicable: 9,
    pending: 5,
  });

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
      
      // Set static data for missing API endpoints
      setRegionalData([
        { region: "Central-1", compliance: 96, evidence: 98, overdue: 2 },
        { region: "Central-2", compliance: 91, evidence: 94, overdue: 5 },
        { region: "Central-3", compliance: 84, evidence: 88, overdue: 11 },
        { region: "Central-4", compliance: 94, evidence: 97, overdue: 3 },
        { region: "Central-5", compliance: 92, evidence: 93, overdue: 4 },
        { region: "Central-6", compliance: 90, evidence: 92, overdue: 3 },
      ]);
      
      setRisksData([
        { 
          severity: "Critical", 
          title: "Battery Health Reports — Central-3", 
          description: "8 sites missing quarterly discharge reports",
          status: "Critical"
        },
        { 
          severity: "High", 
          title: "Monthly PM Analysis — Central-2", 
          description: "Report not submitted",
          status: "High"
        },
        { 
          severity: "Medium", 
          title: "Lube Oil Purchase Evidence", 
          description: "3 purchase proofs missing",
          status: "Medium"
        },
        { 
          severity: "Medium", 
          title: "Site Audit Reports — Central-5", 
          description: "2 reports pending",
          status: "Medium"
        },
      ]);
      
      setTrendData([
        { month: "Feb", value: 78 },
        { month: "Mar", value: 82 },
        { month: "Apr", value: 85 },
        { month: "May", value: 88 },
        { month: "Jun", value: 89 },
        { month: "Jul", value: 90 },
        { month: "Aug", value: 91 },
      ]);
      
      setAgingData([
        { label: "0-30 days", count: 18 },
        { label: "31-60 days", count: 9 },
        { label: "61-90 days", count: 4 },
        { label: "90+ days", count: 3 },
      ]);
      
      setActionsData([
        { 
          action: "Submit Preventive Maintenance report", 
          region: "Central-3", 
          domain: "PM", 
          owner: "MS Vendor", 
          dueDate: "2026-08-16", 
          status: "Overdue" 
        },
        { 
          action: "Upload Utility Management evidence", 
          region: "Central-2", 
          domain: "Utility", 
          owner: "CMPak Team", 
          dueDate: "2026-08-17", 
          status: "Due Soon" 
        },
        { 
          action: "Close audit observation", 
          region: "Central-5", 
          domain: "Security", 
          owner: "Field Team", 
          dueDate: "2026-08-19", 
          status: "On Track" 
        },
        { 
          action: "Update vendor compliance checklist", 
          region: "Central-4", 
          domain: "Vendor Mgmt", 
          owner: "Vendor A", 
          dueDate: "2026-08-20", 
          status: "On Track" 
        },
      ]);
      
      setObligationData({
        total: 252,
        compliant: 238,
        notApplicable: 9,
        pending: 5,
      });
      
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
          <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 border-b-2 border-[#000072] mx-auto"></div>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5 lg:space-y-6 px-1 sm:px-2 md:px-3 lg:px-4 max-w-full overflow-x-hidden">
      {/* Executive Summary Stats Cards */}
      <ComplianceStats stats={stats} />

      {/* Regional Compliance and Trend in one row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
        <RegionalCompliance data={regionalData} />
        <ComplianceTrend data={trendData} />
      </div>

      {/* Compliance by Domain and Top Compliance Risks in one row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
        <ComplianceChart data={chartData} />
        <ComplianceRisks risks={risksData} />
      </div>

      {/* Obligation Status and Aging Gaps in one row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
        <ObligationStatus data={obligationData} />
        <AgingGaps data={agingData} />
      </div>

      {/* Management Action Tracker - Full Width */}
      <ManagementActions actions={actionsData} />

      {/* Upcoming Deadlines - Full Width */}
      <UpcomingDeadlines deadlines={deadlines} />
    </div>
  );
};

export default Dashboard;