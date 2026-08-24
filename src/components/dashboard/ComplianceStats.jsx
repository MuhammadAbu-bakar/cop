import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { 
  FaChartLine, 
  FaFlag, 
  FaClock, 
  FaFileAlt, 
  FaExclamationTriangle, 
  FaGlobe,
  FaCheckCircle,
  FaExclamationCircle
} from 'react-icons/fa';
import { getDashboardStats } from "../../api/compliance";

const ComplianceStats = ({ userRegion, isAdmin }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    overallCompliance: 0,
    totalObligations: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    inProgress: 0,
    notStarted: 0,
    highRiskGaps: 0,
    regionsBelowTarget: 0,
    regionsTotal: 0,
    evidenceCompletion: 0,
    mandatoryObligations: 0,
    totalOccurrences: 0,
  });
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    fetchStats();
  }, [userRegion, isAdmin]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      console.log('📊 [ComplianceStats] Fetching stats for:', { userRegion, isAdmin });
      const statsData = await getDashboardStats(userRegion, isAdmin);
      console.log('📊 [ComplianceStats] Stats received:', statsData);
      
      // Store debug info
      setDebugInfo({
        totalOccurrences: statsData.totalOccurrences,
        closed: statsData.completed,
        submitted: statsData.inProgress,
        open: statsData.pending,
        overdue: statsData.overdue,
        evidenceCount: statsData.evidenceCompletion
      });
      
      setStats(statsData);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (filterType, filterValue) => {
    const params = new URLSearchParams();
    if (filterType === 'status') {
      params.set('status', filterValue);
    }
    navigate(`/compliance${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const getStatIcon = (title, color) => {
    const iconMap = {
      "Overall Compliance": <FaChartLine className="h-4 w-4" style={{ color: color }} />,
      "Mandatory Obligations": <FaFlag className="h-4 w-4" style={{ color: color }} />,
      "Overdue Obligations": <FaClock className="h-4 w-4" style={{ color: color }} />,
      "Evidence Completion": <FaFileAlt className="h-4 w-4" style={{ color: color }} />,
      "High-Risk Gaps": <FaExclamationTriangle className="h-4 w-4" style={{ color: color }} />,
      "Regions Below Target": <FaGlobe className="h-4 w-4" style={{ color: color }} />,
      "Closed Obligations": <FaCheckCircle className="h-4 w-4" style={{ color: color }} />,
    };
    return iconMap[title] || <FaExclamationCircle className="h-4 w-4" style={{ color: color }} />;
  };

  const DonutChart = ({ percentage, size = 70, color = "#000072" }) => {
    const getColor = (value) => {
      if (value >= 80) return "#22c55e";
      if (value >= 60) return "#eab308";
      if (value >= 40) return "#f97316";
      return "#ef4444";
    };

    const chartColor = color === "#000072" ? getColor(percentage) : color;
    
    const data = [
      { name: 'Completed', value: Math.min(percentage, 100) },
      { name: 'Remaining', value: Math.max(0, 100 - Math.min(percentage, 100)) }
    ];

    return (
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={0}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              <Cell key="completed" fill={chartColor} />
              <Cell key="remaining" fill="#e5e7eb" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color: chartColor }}>
            {Math.min(percentage, 100)}%
          </span>
        </div>
      </div>
    );
  };

  const statCards = [
    {
      title: "Overall Compliance",
      value: `${Math.min(stats.overallCompliance || 0, 100)}%`,
      color: "#000072",
      filterType: "all",
      filterValue: null,
      isPrimary: true,
      showDonut: true,
      percentage: Math.min(stats.overallCompliance || 0, 100),
    },
    {
      title: "Closed Obligations",
      value: stats.completed || 0,
      subtitle: `Out of ${stats.totalOccurrences || 0} total`,
      color: "#22c55e",
      filterType: "status",
      filterValue: "Closed",
      showDonut: false,
    },
    {
      title: "Overdue Obligations",
      value: stats.overdue || 0,
      color: "#ef4444",
      filterType: "status",
      filterValue: "Overdue",
      isWarning: true,
      showDonut: false,
    },
    {
      title: "Evidence Completion",
      value: `${Math.min(stats.evidenceCompletion || 0, 100)}%`,
      color: "#8b5cf6",
      filterType: null,
      filterValue: null,
      showDonut: true,
      percentage: Math.min(stats.evidenceCompletion || 0, 100),
    },
    {
      title: "Mandatory Obligations",
      value: stats.mandatoryObligations || 0,
      subtitle: `${stats.totalOccurrences > 0 ? Math.round((stats.mandatoryObligations / stats.totalOccurrences) * 100) : 0}% of total`,
      color: "#f59e0b",
      filterType: null,
      filterValue: null,
      showDonut: false,
    },
    {
      title: "High-Risk Gaps",
      value: stats.highRiskGaps || 0,
      color: "#f97316",
      filterType: null,
      filterValue: null,
      isWarning: true,
      showDonut: false,
    },
    {
      title: "Regions Below Target",
      value: `${stats.regionsBelowTarget || 0} / ${stats.regionsTotal || 0}`,
      color: "#ec4899",
      filterType: null,
      filterValue: null,
      showDonut: false,
    },
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6 overflow-hidden">
        <div className="mb-4">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
            Executive Summary
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Loading compliance data...</p>
        </div>
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          {[...Array(7)].map((_, index) => (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 flex flex-col items-center animate-pulse">
              <div className="w-12 h-3 bg-gray-200 rounded mb-2"></div>
              <div className="w-12 h-8 bg-gray-200 rounded mt-1"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6 overflow-hidden">
      <div className="mb-4">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
          Executive Summary
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">Compliance overview at a glance</p>
        
        {/* Debug Info - Remove in production */}
        {debugInfo && (
          <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-500 overflow-x-auto">
            <span className="font-medium">Debug:</span> 
            Total: {debugInfo.totalOccurrences} | 
            Closed: {debugInfo.closed} | 
            Submitted: {debugInfo.submitted} | 
            Open: {debugInfo.open} | 
            Overdue: {debugInfo.overdue} | 
            Evidence: {debugInfo.evidenceCount}%
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            onClick={() => stat.filterType && handleCardClick(stat.filterType, stat.filterValue)}
            className={`bg-white rounded-lg border hover:shadow-lg transition-all p-3 sm:p-4 flex flex-col items-center ${
              stat.filterType ? "cursor-pointer hover:border-gray-300" : "cursor-default"
            } ${stat.isWarning ? "border-red-200" : "border-gray-200"} ${
              stat.isPrimary ? "border-t-4" : ""
            }`}
            style={stat.isPrimary ? { borderTopColor: stat.color } : {}}
          >
            <div className="flex-1 w-full">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {getStatIcon(stat.title, stat.color)}
                <p className="text-[10px] xs:text-[11px] text-gray-500 font-medium uppercase tracking-wide text-center">
                  {stat.title}
                </p>
              </div>
              
              {stat.showDonut ? (
                <div className="flex flex-col items-center mt-1">
                  <DonutChart 
                    percentage={stat.percentage} 
                    size={70}
                    color={stat.color}
                  />
                </div>
              ) : (
                <div className="mt-1 text-center">
                  <span className={`text-lg sm:text-xl md:text-2xl font-bold ${
                    stat.isWarning ? "text-red-600" : "text-gray-900"
                  }`}>
                    {stat.value}
                  </span>
                </div>
              )}
              
              {stat.subtitle && (
                <p className="text-[10px] xs:text-xs text-gray-500 text-center mt-0.5">{stat.subtitle}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComplianceStats;