// ============================================================
// RegionalCompliance.jsx - With Horizontal Bar Charts (Optimized)
// ============================================================

const RegionalCompliance = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
          Regional Compliance
        </h3>
        <div className="text-center py-6 text-gray-500 text-sm">
          No regional data available
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

  const getBarColor = (value) => {
    if (value >= 90) return "bg-green-500";
    if (value >= 80) return "bg-yellow-500";
    if (value >= 70) return "bg-orange-500";
    return "bg-red-500";
  };

  const getBarTextColor = (value) => {
    if (value >= 70) return "text-white";
    return "text-gray-700";
  };

  const getOverdueColor = (value) => {
    if (value === 0) return "text-green-600";
    if (value <= 3) return "text-yellow-600";
    if (value <= 5) return "text-orange-600";
    return "text-red-600";
  };

  const getRiskLevel = (compliance, overdue) => {
    if (compliance >= 90 && overdue <= 3) return { level: "Low", color: "bg-green-500", dot: "🟢" };
    if (compliance >= 80 && overdue <= 5) return { level: "Medium", color: "bg-yellow-500", dot: "🟡" };
    if (compliance >= 70) return { level: "High", color: "bg-orange-500", dot: "🟠" };
    return { level: "Critical", color: "bg-red-500", dot: "🔴" };
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6 overflow-hidden">
      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-3 sm:mb-15">
        Regional Compliance
      </h3>
      
      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-[#b6d981]">
            <tr>
              <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Region
              </th>
              <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Compliance
              </th>
              <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Evidence
              </th>
              <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Overdue
              </th>
              <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Risk
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((region, index) => {
              const risk = getRiskLevel(region.compliance, region.overdue);
              return (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs font-medium text-gray-900">
                    {region.region}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap min-w-[120px]">
                    <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getBarColor(region.compliance)} transition-all duration-700 ease-in-out flex items-center justify-end pr-1.5`}
                        style={{ width: `${region.compliance}%` }}
                      >
                        <span className={`text-[9px] font-semibold ${getBarTextColor(region.compliance)}`}>
                          {region.compliance}%
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                    {region.evidence}%
                  </td>
                  <td className={`px-2 py-1.5 whitespace-nowrap text-xs font-medium ${getOverdueColor(region.overdue)}`}>
                    {region.overdue}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-0.5">
                      <span className="text-sm">{risk.dot}</span>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                        risk.level === "Low" ? "bg-green-100 text-green-700" :
                        risk.level === "Medium" ? "bg-yellow-100 text-yellow-700" :
                        risk.level === "High" ? "bg-orange-100 text-orange-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {risk.level}
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
        {data.map((region, index) => {
          const risk = getRiskLevel(region.compliance, region.overdue);
          return (
            <div key={index} className="bg-gray-50 rounded-lg p-2.5">
              <div className="flex justify-between items-start mb-1.5">
                <span className="font-medium text-gray-900 text-sm">{region.region}</span>
                <span className={`text-xs font-bold ${getStatusColor(region.compliance)}`}>
                  {region.compliance}%
                </span>
              </div>
              {/* Horizontal Bar for Mobile */}
              <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full ${getBarColor(region.compliance)} transition-all duration-700 ease-in-out flex items-center justify-end pr-1.5`}
                  style={{ width: `${region.compliance}%` }}
                >
                  <span className={`text-[9px] font-semibold ${getBarTextColor(region.compliance)}`}>
                    {region.compliance}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <div className="space-y-0.5">
                  <div className="text-gray-500">Evidence: <span className="font-medium text-gray-700">{region.evidence}%</span></div>
                  <div className="text-gray-500">Overdue: <span className={`font-medium ${getOverdueColor(region.overdue)}`}>{region.overdue}</span></div>
                </div>
                <div className="flex items-center gap-0.5">
                  <span className="text-sm">{risk.dot}</span>
                  <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded-full ${
                    risk.level === "Low" ? "bg-green-100 text-green-700" :
                    risk.level === "Medium" ? "bg-yellow-100 text-yellow-700" :
                    risk.level === "High" ? "bg-orange-100 text-orange-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {risk.level}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RegionalCompliance;