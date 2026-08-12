const ComplianceChart = ({ data }) => {
  const maxValue = Math.max(...data.compliance, 100);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Compliance by Domain
      </h3>
      <div className="space-y-4">
        {data.domains.map((domain, index) => {
          const percentage = data.compliance[index] || 0;
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
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">{domain}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">
                    {percentage}%
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
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
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${getBarColor(percentage)} transition-all duration-700 ease-in-out`}
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
