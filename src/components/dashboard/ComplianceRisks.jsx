// ============================================================
// ComplianceRisks.jsx
// ============================================================

const ComplianceRisks = ({ risks }) => {
  if (!risks || risks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
          Top Compliance Risks
        </h3>
        <div className="text-center py-6 text-gray-500 text-sm">
          No risks identified
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity) => {
    const colors = {
      Critical: "bg-red-100 text-red-800 border-red-300",
      High: "bg-orange-100 text-orange-800 border-orange-300",
      Medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
      Low: "bg-blue-100 text-blue-800 border-blue-300",
    };
    return colors[severity] || colors.Medium;
  };

  const getSeverityDot = (severity) => {
    const colors = {
      Critical: "bg-red-500",
      High: "bg-orange-500",
      Medium: "bg-yellow-500",
      Low: "bg-blue-500",
    };
    return colors[severity] || colors.Medium;
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
        Top Compliance Risks
      </h3>
      <div className="space-y-2 sm:space-y-3">
        {risks.map((risk, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border-l-4 ${getSeverityColor(risk.severity)} bg-opacity-50`}
          >
            <div className="flex items-start gap-2">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getSeverityDot(risk.severity)}`}></div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                  <span className="text-xs font-semibold text-gray-700">{risk.severity}</span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900 break-words">
                    {risk.title}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1 break-words">
                  {risk.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComplianceRisks;