// ============================================================
// ManagementActions.jsx
// ============================================================

const ManagementActions = ({ actions }) => {
  if (!actions || actions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
          Management Action Tracker
        </h3>
        <div className="text-center py-6 text-gray-500 text-sm">
          No actions pending
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      Overdue: "bg-red-100 text-red-800",
      "Due Soon": "bg-orange-100 text-orange-800",
      "On Track": "bg-green-100 text-green-800",
      Completed: "bg-blue-100 text-blue-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusDot = (status) => {
    const colors = {
      Overdue: "bg-red-500",
      "Due Soon": "bg-orange-500",
      "On Track": "bg-green-500",
      Completed: "bg-blue-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
        Management Action Tracker
      </h3>
      
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <div className="min-w-[500px] sm:min-w-full">
          {/* Table Header */}
          <div className="grid grid-cols-5 gap-1 sm:gap-2 px-3 py-2 bg-blue-100 rounded-t-lg text-xs font-medium text-gray-500 uppercase">
            <span className="col-span-1">Action</span>
            <span className="col-span-1">Region/Domain</span>
            <span className="col-span-1">Owner</span>
            <span className="col-span-1">Due Date</span>
            <span className="col-span-1 text-right">Status</span>
          </div>
          
          {/* Table Body */}
          <div className="divide-y divide-gray-100">
            {actions.map((action, index) => (
              <div key={index} className="grid grid-cols-5 gap-1 sm:gap-2 px-3 py-2 sm:py-3 hover:bg-gray-50 transition-colors items-center">
                <span className="col-span-1 text-xs sm:text-sm text-gray-700 truncate" title={action.action}>
                  {action.action}
                </span>
                <span className="col-span-1 text-xs text-gray-500">
                  {action.region} / {action.domain}
                </span>
                <span className="col-span-1 text-xs text-gray-500">
                  {action.owner}
                </span>
                <span className="col-span-1 text-xs text-gray-500">
                  {formatDate(action.dueDate)}
                </span>
                <span className="col-span-1 flex justify-end">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(action.status)}`}>
                    {action.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagementActions;