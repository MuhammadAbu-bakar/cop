// ============================================================
// ComplianceStats.jsx - Executive Summary Cards with Recharts Donut Charts
// ============================================================

import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { 
  FaArrowUp, 
  FaArrowDown, 
  FaMinus,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaFileAlt,
  FaExclamationCircle,
  FaChartLine,
  FaShieldAlt,
  FaFlag,
  FaGlobe
} from 'react-icons/fa';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';

const ComplianceStats = ({ stats }) => {
  const navigate = useNavigate();

  const handleCardClick = (filterType, filterValue) => {
    const params = new URLSearchParams();
    if (filterType === 'status') {
      params.set('status', filterValue);
    }
    navigate(`/compliance${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const getChangeColor = (change) => {
    if (!change) return "text-gray-500";
    const numChange = parseFloat(change);
    if (numChange > 0) return "text-green-600";
    if (numChange < 0) return "text-red-600";
    return "text-gray-500";
  };

  const getChangeIcon = (change) => {
    if (!change) return null;
    const numChange = parseFloat(change);
    if (numChange > 0) {
      return <FaArrowUp className="h-3 w-3 inline" />;
    }
    if (numChange < 0) {
      return <FaArrowDown className="h-3 w-3 inline" />;
    }
    return <FaMinus className="h-3 w-3 inline" />;
  };

  // Get icon for each stat card
  const getStatIcon = (title, color) => {
    const iconMap = {
      "Overall Compliance": <FaChartLine className="h-4 w-4" style={{ color: color }} />,
      "Audit Readiness": <FaShieldAlt className="h-4 w-4" style={{ color: color }} />,
      "Mandatory Obligations": <FaCheckCircle className="h-4 w-4" style={{ color: color }} />,
      "Overdue Obligations": <FaClock className="h-4 w-4" style={{ color: color }} />,
      "Evidence Completion": <FaFileAlt className="h-4 w-4" style={{ color: color }} />,
      "High-Risk Gaps": <FaExclamationTriangle className="h-4 w-4" style={{ color: color }} />,
      "Regions Below Target": <FaGlobe className="h-4 w-4" style={{ color: color }} />,
    };
    return iconMap[title] || <FaExclamationCircle className="h-4 w-4" style={{ color: color }} />;
  };

  // Donut Chart Component using Recharts
  const DonutChart = ({ percentage, size = 70, color = "#000072" }) => {
    const getColor = (value) => {
      if (value >= 80) return "#22c55e";
      if (value >= 60) return "#eab308";
      if (value >= 40) return "#f97316";
      return "#ef4444";
    };

    const chartColor = color === "#000072" ? getColor(percentage) : color;
    
    const data = [
      { name: 'Completed', value: percentage },
      { name: 'Remaining', value: 100 - percentage }
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
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color: chartColor }}>
            {percentage}%
          </span>
        </div>
      </div>
    );
  };

  const statCards = [
    {
      title: "Overall Compliance",
      value: `${stats.overallCompliance || 0}%`,
      change: "2% vs. last month",
      color: "#000072",
      filterType: "all",
      filterValue: null,
      isPrimary: true,
      showDonut: true,
      percentage: stats.overallCompliance || 0,
    },
    {
      title: "Audit Readiness",
      value: `${stats.auditReadiness || 0}%`,
      change: "3% vs. last month",
      color: "#3b82f6",
      filterType: null,
      filterValue: null,
      showDonut: true,
      percentage: stats.auditReadiness || 0,
    },
    {
      title: "Mandatory Obligations",
      value: `${stats.completed || 0} / ${stats.totalObligations || 0}`,
      subtitle: `${Math.round((stats.completed / stats.totalObligations) * 100)}% Compliant`,
      color: "#22c55e",
      filterType: null,
      filterValue: null,
      isObligation: true,
      showDonut: false,
    },
    {
      title: "Overdue Obligations",
      value: stats.overdue || 0,
      change: "40% vs. last month",
      color: "#ef4444",
      filterType: "status",
      filterValue: "Overdue",
      isWarning: true,
      showDonut: false,
    },
    {
      title: "Evidence Completion",
      value: `${stats.evidenceCompletion || 0}%`,
      change: "2% vs. last month",
      color: "#8b5cf6",
      filterType: null,
      filterValue: null,
      showDonut: true,
      percentage: stats.evidenceCompletion || 0,
    },
    {
      title: "High-Risk Gaps",
      value: stats.highRiskGaps || 0,
      change: "50% vs. last month",
      color: "#f97316",
      filterType: null,
      filterValue: null,
      isWarning: true,
      showDonut: false,
    },
    {
      title: "Regions Below Target",
      value: `${stats.regionsBelowTarget || 0} / ${stats.regionsTotal || 6}`,
      color: "#ec4899",
      filterType: null,
      filterValue: null,
      showDonut: false,
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6 overflow-hidden">
      {/* Section Header */}
      <div className="mb-4">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
          Executive Summary
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">Compliance overview at a glance</p>
      </div>

      {/* Stats Cards Grid */}
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
              
              {/* Donut Chart or Value */}
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
              
              {/* Change Indicator */}
              {stat.change && (
                <div className="flex items-center justify-center mt-0.5">
                  <span className={`text-[10px] xs:text-xs font-medium ${getChangeColor(stat.change)}`}>
                    {getChangeIcon(stat.change)}
                    <span className="ml-0.5">{stat.change}</span>
                  </span>
                </div>
              )}
              
              {/* Subtitle for obligations */}
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