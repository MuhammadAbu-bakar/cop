import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { 
  FaChartLine, 
  FaClock, 
  FaFileAlt, 
  FaExclamationTriangle, 
  FaGlobe,
  FaCheckCircle,
  FaExclamationCircle,
  FaCheck,
  FaTimes,
  FaExclamation
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
  const [regionsData, setRegionsData] = useState([]);
  const [showRegionsModal, setShowRegionsModal] = useState(false);

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

      // Fetch regions data for the "Regions Below Target" card
      await fetchRegionsData();
      
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegionsData = async () => {
    try {
      const { data: regions, error } = await supabase
        .from('regions')
        .select('id, name')
        .order('name');

      if (error) throw error;

      // Get all progress records for each region
      const regionStats = await Promise.all(regions.map(async (region) => {
        const { data: progress, error: progressError } = await supabase
          .from('compliance_progress')
          .select('status, calculated_due_date')
          .eq('region_id', region.id);

        if (progressError) throw progressError;

        const total = progress?.length || 0;
        const closed = progress?.filter(p => p.status === 'Closed').length || 0;
        const compliance = total > 0 ? (closed / total) * 100 : 0;
        const isBelowTarget = compliance < 80 && total > 0;

        return {
          ...region,
          total,
          closed,
          compliance: Number(compliance.toFixed(1)),
          isBelowTarget
        };
      }));

      setRegionsData(regionStats);
    } catch (error) {
      console.error('Error fetching regions data:', error);
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
      "Submitted/Under Review": <FaFileAlt className="h-4 w-4" style={{ color: color }} />,
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
      title: "Evidence Completion",
      value: `${Math.min(stats.overallCompliance || 0, 100)}%`,
      color: "#8b5cf6",
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
      title: "Submitted/Under Review",
      value: stats.inProgress || 0,
      subtitle: `Awaiting approval`,
      color: "#3b82f6",
      filterType: "status",
      filterValue: "Submitted/Under Review",
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
      value: isAdmin 
        ? `${stats.regionsBelowTarget || 0} / ${stats.regionsTotal || 0}`
        : regionsData.length > 0 && regionsData[0]?.isBelowTarget ? "Yes" : "No",
      color: "#ec4899",
      filterType: null,
      filterValue: null,
      showDonut: false,
      isClickable: true,
    },
  ];

  const renderRegionsModal = () => {
    if (!showRegionsModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Regions Compliance Status</h3>
            <button
              onClick={() => setShowRegionsModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-3">
              {regionsData.map((region) => (
                <div 
                  key={region.id} 
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    region.isBelowTarget ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                  }`}
                >
                  <div>
                    <span className="font-medium text-gray-900">{region.name}</span>
                    <div className="text-xs text-gray-500">
                      {region.total} obligations • {region.closed} closed • {region.compliance}% compliance
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {region.isBelowTarget ? (
                      <span className="flex items-center gap-1 text-red-600">
                        <FaTimes className="h-5 w-5" />
                        <span className="text-sm font-medium">Below Target</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600">
                        <FaCheck className="h-5 w-5" />
                        <span className="text-sm font-medium">On Target</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setShowRegionsModal(false)}
              className="w-full px-4 py-2 bg-[#8cc63e] text-white rounded-md hover:bg-[#7ab83a] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6 overflow-hidden">
        <div className="mb-4">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
            Executive Summary
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Loading compliance data...</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {[...Array(6)].map((_, index) => (
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            onClick={() => {
              if (stat.title === "Regions Below Target") {
                setShowRegionsModal(true);
              } else if (stat.filterType === 'status' && stat.filterValue === 'Overdue') {
                navigate('/compliance?status=overdue');
              } else if (stat.filterType) {
                handleCardClick(stat.filterType, stat.filterValue);
              }
            }}
            className={`bg-white rounded-lg border hover:shadow-lg transition-all p-3 sm:p-4 flex flex-col items-center ${
              stat.filterType || stat.title === "Regions Below Target" ? "cursor-pointer hover:border-gray-300" : "cursor-default"
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
                  {stat.title === "Regions Below Target" && !isAdmin && regionsData.length > 0 && regionsData[0]?.isBelowTarget ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <FaExclamation className="h-5 w-5 text-red-600" />
                      <span className={`text-lg sm:text-xl md:text-2xl font-bold text-red-600`}>
                        Yes
                      </span>
                    </div>
                  ) : stat.title === "Regions Below Target" && !isAdmin ? (
                    <span className={`text-lg sm:text-xl md:text-2xl font-bold text-red-600`}>
                      Yes
                    </span>
                  ) : (
                    <span className={`text-lg sm:text-xl md:text-2xl font-bold ${
                      stat.isWarning ? "text-red-600" : "text-gray-900"
                    }`}>
                      {stat.value}
                    </span>
                  )}
                </div>
              )}
              
              {stat.subtitle && (
                <p className="text-[10px] xs:text-xs text-gray-500 text-center mt-0.5">{stat.subtitle}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Regions Modal */}
      {renderRegionsModal()}
    </div>
  );
};

export default ComplianceStats;