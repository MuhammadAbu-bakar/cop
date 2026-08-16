// ============================================================
// ObligationStatus.jsx - Square bar design with fixed legend
// ============================================================

const ObligationStatus = ({ data }) => {
  if (!data || !data.total) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
          Obligation Status
        </h3>
        <div className="text-center py-6 text-gray-500 text-sm">
          No obligation data available
        </div>
      </div>
    );
  }

  const { total, compliant, notApplicable, pending, overdue, inProgress } = data;
  const compliantPercentage = Math.round((compliant / total) * 100);
  const notApplicablePercentage = Math.round((notApplicable / total) * 100);
  const pendingPercentage = Math.round((pending / total) * 100);
  const overduePercentage = Math.round((overdue / total) * 100);
  const inProgressPercentage = Math.round((inProgress / total) * 100);

  // Status items for the bar
  const statusItems = [
    { 
      label: "Compliant", 
      count: compliant, 
      percentage: compliantPercentage, 
      color: "#22c55e", // green-500
    },
    { 
      label: "In Progress", 
      count: inProgress || 0, 
      percentage: inProgressPercentage, 
      color: "#3b82f6", // blue-500
    },
    { 
      label: "Pending", 
      count: pending, 
      percentage: pendingPercentage, 
      color: "#eab308", // yellow-500
    },
    { 
      label: "Overdue", 
      count: overdue || 0, 
      percentage: overduePercentage, 
      color: "#ef4444", // red-500
    },
    { 
      label: "Not Applicable", 
      count: notApplicable, 
      percentage: notApplicablePercentage, 
      color: "#9ca3af", // gray-400
    },
  ];

  // Filter out items with 0 count for cleaner display
  const visibleItems = statusItems.filter(item => item.count > 0);

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
        Obligation Status
      </h3>
      
      {/* Total Obligations */}
      <div className="mb-3">
        <p className="text-sm text-gray-600 mt-20">
          <span className="font-semibold text-gray-900">Total Obligations:</span> 106
        </p>
      </div>

      {/* Horizontal Square Bar Chart */}
      <div className="w-full bg-gray-200 rounded-md h-8 sm:h-10 md:h-12 overflow-hidden mb-4">
        {visibleItems.map((item, index) => (
          <div
            key={index}
            className="h-full transition-all duration-500 ease-in-out float-left flex items-center justify-center text-xs text-white font-medium"
            style={{
              width: `${item.percentage}%`,
              backgroundColor: item.color,
              minWidth: item.percentage > 0 ? '2%' : '0%',
            }}
          >
            {item.percentage > 10 && (
              <span className="text-[10px] sm:text-xs truncate px-1">
                {item.percentage}%
              </span>
            )}
          </div>
        ))}
      </div>

    

      {/* Legend Section with clear separation */}
      <div className="border-t border-gray-200 pt-3 mt-30">
        <p className="text-xs text-gray-500 font-medium mb-2">Status Legend:</p>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {statusItems.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span 
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: item.color }}
              ></span>
              <span className="text-xs text-gray-600">
                {item.label}
              </span>
              <span className="text-xs font-semibold text-gray-900">
                ({item.count})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ObligationStatus;