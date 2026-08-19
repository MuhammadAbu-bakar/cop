import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
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
  const isAdmin = profile?.role === "admin";
  const userRegion = profile?.region_name || null;

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5 lg:space-y-6 px-1 sm:px-2 md:px-3 lg:px-4 max-w-full overflow-x-hidden">
      {/* Executive Summary Stats Cards - Fetches data internally */}
      <ComplianceStats userRegion={userRegion} isAdmin={isAdmin} />

      {/* Regional Compliance and Trend in one row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
        <RegionalCompliance userRegion={userRegion} isAdmin={isAdmin} />
        <ComplianceTrend userRegion={userRegion} isAdmin={isAdmin} />
      </div>

      {/* Compliance by Domain and Top Compliance Risks in one row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
        <ComplianceChart userRegion={userRegion} isAdmin={isAdmin} />
        <ComplianceRisks userRegion={userRegion} isAdmin={isAdmin} />
      </div>

      {/* Obligation Status and Aging Gaps in one row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
        <ObligationStatus userRegion={userRegion} isAdmin={isAdmin} />
        <AgingGaps userRegion={userRegion} isAdmin={isAdmin} />
      </div>

      {/* Management Action Tracker - Full Width */}
      <ManagementActions userRegion={userRegion} isAdmin={isAdmin} />

      {/* Upcoming Deadlines - Full Width */}
      <UpcomingDeadlines userRegion={userRegion} isAdmin={isAdmin} />
    </div>
  );
};

export default Dashboard;