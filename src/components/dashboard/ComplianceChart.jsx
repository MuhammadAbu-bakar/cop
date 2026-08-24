import { useState, useEffect } from "react";
import { supabase } from "../../api/supabase";
import { getComplianceByDomain } from "../../api/compliance";

const ComplianceChart = ({ userRegion, isAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState({ domains: [], compliance: [] });
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    fetchChartData();
  }, [userRegion, isAdmin]);

  const fetchChartData = async () => {
    setLoading(true);
    try {
      console.log('📊 [ComplianceChart] Fetching for:', { userRegion, isAdmin });
      
      // Use the updated API function
      const result = await getComplianceByDomain(userRegion, isAdmin);
      console.log('📊 [ComplianceChart] Result from API:', result);
      
      if (result && result.domains && result.compliance) {
        // Store debug info
        setDebugInfo(result.details);
        
        // Consolidate domains
        const consolidatedData = consolidateDomains(result.domains, result.compliance, result.details);
        console.log('📊 [ComplianceChart] Consolidated data:', consolidatedData);
        setChartData(consolidatedData);
      } else {
        console.log('📊 [ComplianceChart] No data received');
        setChartData({ domains: [], compliance: [] });
        setDebugInfo(null);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setChartData({ domains: [], compliance: [] });
    } finally {
      setLoading(false);
    }
  };

  // Consolidate domains
  const consolidateDomains = (domains, compliance, details) => {
    const consolidationRules = {
      'Power': ['Power', 'CP Billing', 'Battery'],
      'Inventory': ['Inventory', 'Asset'],
      'Security': ['Security', 'Maintenance'],
      'Fuel': ['Fuel'],
      'Audit': ['Audit'],
      'Complaint Handling': ['Complaint Handling'],
      'Core Transmission': ['Core Transmission']
    };

    const getConsolidatedKey = (domain) => {
      for (const [key, values] of Object.entries(consolidationRules)) {
        if (values.includes(domain)) {
          return key;
        }
      }
      return domain;
    };

    const domainMapConsolidated = {};

    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      const value = compliance[i] || 0;
      const consolidatedKey = getConsolidatedKey(domain);
      
      if (!domainMapConsolidated[consolidatedKey]) {
        domainMapConsolidated[consolidatedKey] = {
          totalValue: 0,
          count: 0,
          domains: [],
          totalWeight: 0,
          achievedWeight: 0,
          totalObligations: 0,
          closedObligations: 0
        };
      }
      
      domainMapConsolidated[consolidatedKey].totalValue += value;
      domainMapConsolidated[consolidatedKey].count += 1;
      domainMapConsolidated[consolidatedKey].domains.push(domain);
      
      // Add detail data if available
      if (details && details[domain]) {
        domainMapConsolidated[consolidatedKey].totalWeight += details[domain].totalWeight || 0;
        domainMapConsolidated[consolidatedKey].achievedWeight += details[domain].achievedWeight || 0;
        domainMapConsolidated[consolidatedKey].totalObligations += details[domain].total || 0;
        domainMapConsolidated[consolidatedKey].closedObligations += details[domain].closed || 0;
      }
    }

    const consolidatedDomains = [];
    const consolidatedCompliance = [];

    for (const [key, value] of Object.entries(domainMapConsolidated)) {
      consolidatedDomains.push(key);
      // Calculate weighted average if we have weight data
      let average;
      if (value.totalWeight > 0) {
        average = parseFloat(((value.achievedWeight / value.totalWeight) * 100).toFixed(1));
      } else {
        average = parseFloat((value.totalValue / value.count).toFixed(1));
      }
      consolidatedCompliance.push(average);
      
      console.log(`📊 [ComplianceChart] Consolidated ${key}: ${average}% (${value.closedObligations}/${value.totalObligations} closed)`);
    }

    return { 
      domains: consolidatedDomains, 
      compliance: consolidatedCompliance
    };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-3">
          Compliance by Domain
        </h3>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex justify-between mb-1">
                <div className="h-3 bg-gray-200 rounded w-20"></div>
                <div className="h-3 bg-gray-200 rounded w-10"></div>
              </div>
              <div className="h-1.5 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (chartData.domains.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-3">
          Compliance by Domain
        </h3>
        <div className="text-center py-4 text-gray-500 text-sm">
          No domain data available
        </div>
      </div>
    );
  }

  const getStatusColor = (value) => {
    if (value >= 90) return "text-green-600";
    if (value >= 80) return "text-yellow-600";
    if (value >= 70) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreColor = (value) => {
    if (value >= 90) return "bg-green-100 text-green-800";
    if (value >= 80) return "bg-yellow-100 text-yellow-800";
    if (value >= 70) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const getBarColor = (value) => {
    if (value >= 90) return "bg-green-500";
    if (value >= 80) return "bg-yellow-500";
    if (value >= 70) return "bg-orange-500";
    return "bg-red-500";
  };

  const getDomainEmoji = (domain) => {
    const emojis = {
      'Power': '⚡',
      'Fuel': '⛽',
      'Inventory': '📦',
      'Security': '🔒',
      'Audit': '📊',
      'Core Transmission': '📡',
      'Maintenance': '🔧',
      'Complaint Handling': '📞',
      'CP Billing': '💰',
      'Battery': '🔋',
      'Asset': '🏗️',
    };
    return emojis[domain] || '📋';
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 overflow-hidden">
      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-2">
        Compliance by Domain
      </h3>
      
      
      
      {/* Desktop Table View */}
      <div className="hidden sm:block">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-[#ff0099]">
            <tr>
              <th className="px-2 py-1.5 text-left text-[10px] font-medium text-white uppercase tracking-wider">
                Domain
              </th>
              <th className="px-2 py-1.5 text-left text-[10px] font-medium text-white uppercase tracking-wider">
                Compliance Score
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {chartData.domains.map((domain, index) => {
              const percentage = chartData.compliance[index] || 0;
              const emoji = getDomainEmoji(domain);
              return (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs font-medium text-gray-900">
                    <span className="mr-1">{emoji}</span>
                    {domain}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${getStatusColor(percentage)}`}>
                        {percentage}%
                      </span>
                      <div className="w-16 sm:w-20 md:w-28 bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${getBarColor(percentage)} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span
                        className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${getScoreColor(percentage)}`}
                      >
                        {percentage >= 90 ? "Excellent" :
                         percentage >= 80 ? "Good" :
                         percentage >= 70 ? "Fair" :
                         "Needs Attention"}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-2">
        {chartData.domains.map((domain, index) => {
          const percentage = chartData.compliance[index] || 0;
          const emoji = getDomainEmoji(domain);
          return (
            <div key={index} className="bg-gray-50 rounded-lg p-2.5">
              <div className="flex justify-between items-start mb-1.5">
                <span className="font-medium text-gray-900 text-xs">
                  <span className="mr-1">{emoji}</span>
                  {domain}
                </span>
                <span className={`text-xs font-bold ${getStatusColor(percentage)}`}>
                  {percentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1.5">
                <div
                  className={`h-1.5 rounded-full ${getBarColor(percentage)} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              <div className="flex justify-end">
                <span
                  className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${getScoreColor(percentage)}`}
                >
                  {percentage >= 90 ? "Excellent" :
                   percentage >= 80 ? "Good" :
                   percentage >= 70 ? "Fair" :
                   "Needs Attention"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* View Details Link */}
      <div className="mt-3 pt-2 border-t border-gray-200">
        <button 
          onClick={() => window.location.href = '/compliance'}
          className="text-xs font-medium text-[#000072] hover:underline flex items-center gap-1 transition-colors"
        >
          View Details
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ComplianceChart;