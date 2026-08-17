// ============================================================
// ComplianceChart.jsx - Updated with table design matching image
// ============================================================

const ComplianceChart = ({ data }) => {
  // Consolidate domains
  const consolidateDomains = (domains, compliance) => {
    const domainMap = {};
    
    // Define domain consolidation rules
    const consolidationRules = {
      'Power': ['Power', 'CP Billing', 'Battery'],
      'Inventory': ['Inventory', 'Asset'],
      'Security': ['Security', 'Maintenance']
    };

    // First, map each domain to its consolidated group
    const getConsolidatedKey = (domain) => {
      for (const [key, values] of Object.entries(consolidationRules)) {
        if (values.includes(domain)) {
          return key;
        }
      }
      return domain; // Keep original if no consolidation rule matches
    };

    // Calculate weighted averages for each consolidated domain
    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      const value = compliance[i] || 0;
      const consolidatedKey = getConsolidatedKey(domain);
      
      if (!domainMap[consolidatedKey]) {
        domainMap[consolidatedKey] = {
          totalValue: 0,
          count: 0,
          domains: []
        };
      }
      
      domainMap[consolidatedKey].totalValue += value;
      domainMap[consolidatedKey].count += 1;
      domainMap[consolidatedKey].domains.push(domain);
    }

    // Calculate averages
    const consolidatedDomains = [];
    const consolidatedCompliance = [];

    for (const [key, value] of Object.entries(domainMap)) {
      consolidatedDomains.push(key);
      // Calculate weighted average
      const average = Math.round(value.totalValue / value.count);
      consolidatedCompliance.push(average);
    }

    return { domains: consolidatedDomains, compliance: consolidatedCompliance };
  };

  // Consolidate the data
  const consolidatedData = data && data.domains && data.compliance 
    ? consolidateDomains(data.domains, data.compliance)
    : { domains: [], compliance: [] };

  // If no data, show fallback
  if (consolidatedData.domains.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
          Compliance by Domain
        </h3>
        <div className="text-center py-6 text-gray-500 text-sm">
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

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6 overflow-hidden">
      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
        Compliance by Domain
      </h3>
      
      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-[#b6d981]">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Domain
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Compliance Score
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {consolidatedData.domains.map((domain, index) => {
              const percentage = consolidatedData.compliance[index] || 0;
              return (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                    {domain}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold ${getStatusColor(percentage)}`}>
                        {percentage}%
                      </span>
                      <div className="w-24 sm:w-32 md:w-40 bg-gray-200 rounded-full h-1.5 sm:h-2">
                        <div
                          className={`h-1.5 sm:h-2 rounded-full ${getBarColor(percentage)} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${getScoreColor(percentage)}`}
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
      <div className="sm:hidden space-y-3">
        {consolidatedData.domains.map((domain, index) => {
          const percentage = consolidatedData.compliance[index] || 0;
          return (
            <div key={index} className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-gray-900 text-sm">{domain}</span>
                <span className={`text-sm font-bold ${getStatusColor(percentage)}`}>
                  {percentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                <div
                  className={`h-1.5 rounded-full ${getBarColor(percentage)} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              <div className="flex justify-end">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${getScoreColor(percentage)}`}
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
      <div className="mt-4 pt-3 border-t border-gray-200">
        <button 
          onClick={() => window.location.href = '/compliance'}
          className="text-sm font-medium text-[#000072] hover:underline flex items-center gap-1 transition-colors"
        >
          View Details
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ComplianceChart;