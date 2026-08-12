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

  const maxValue = Math.max(...consolidatedData.compliance, 100);

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
        Compliance by Domain
      </h3>
      <div className="space-y-3 sm:space-y-4">
        {consolidatedData.domains.map((domain, index) => {
          const percentage = consolidatedData.compliance[index] || 0;
          const barWidth = (percentage / 100) * 100;

          const getBarColor = (value) => {
            if (value >= 80) return "bg-green-500";
            if (value >= 60) return "bg-yellow-500";
            if (value >= 40) return "bg-orange-500";
            return "bg-red-500";
          };

          const getStatusLabel = (value) => {
            if (value >= 80) return "Good";
            if (value >= 60) return "Moderate";
            if (value >= 40) return "Needs Improvement";
            return "Critical";
          };

          return (
            <div key={index}>
              <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-1 xs:gap-0 mb-1">
                <span className="text-xs sm:text-sm text-gray-600 break-words">{domain}</span>
                <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-medium text-gray-900">
                    {percentage}%
                  </span>
                  <span
                    className={`text-[8px] xs:text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full ${
                      percentage >= 80
                        ? "bg-green-100 text-green-800"
                        : percentage >= 60
                          ? "bg-yellow-100 text-yellow-800"
                          : percentage >= 40
                            ? "bg-orange-100 text-orange-800"
                            : "bg-red-100 text-red-800"
                    }`}
                  >
                    {getStatusLabel(percentage)}
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3">
                <div
                  className={`h-2.5 sm:h-3 rounded-full ${getBarColor(percentage)} transition-all duration-700 ease-in-out`}
                  style={{ width: `${barWidth}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComplianceChart;