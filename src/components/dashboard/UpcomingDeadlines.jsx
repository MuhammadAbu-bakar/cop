const UpcomingDeadlines = ({ deadlines }) => {
  const getPriorityColor = (status) => {
    const colors = {
      Overdue: "bg-red-100 text-red-800",
      Pending: "bg-yellow-100 text-yellow-800",
      "In Progress": "bg-blue-100 text-blue-800",
      Approved: "bg-green-100 text-green-800",
      Submitted: "bg-purple-100 text-purple-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getPriorityDotColor = (status) => {
    const colors = {
      Overdue: "bg-red-500",
      Pending: "bg-yellow-500",
      "In Progress": "bg-blue-500",
      Approved: "bg-green-500",
      Submitted: "bg-purple-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (diffDays < 0) {
      dateStr += ` (${Math.abs(diffDays)}d overdue)`;
    } else if (diffDays === 0) {
      dateStr += " (Today)";
    } else if (diffDays <= 7) {
      dateStr += ` (${diffDays}d left)`;
    }

    return dateStr;
  };

  if (deadlines.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 h-full">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
          Upcoming Deadlines
        </h3>
        <div className="flex flex-col items-center justify-center py-8 sm:py-10 md:py-12 text-gray-500">
          <svg
            className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm sm:text-base">No upcoming deadlines</p>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            All caught up! 🎉
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 h-full">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">
          Upcoming Deadlines
        </h3>
        <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {deadlines.length} {deadlines.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      
      <div className="space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[350px] md:max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {deadlines.map((deadline) => {
          const isOverdue = new Date(deadline.due_date) < new Date();
          return (
            <div
              key={deadline.id}
              className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200 gap-2 sm:gap-3 hover:shadow-sm border-l-4 hover:border-l-[#8cc63e]"
              style={{
                borderLeftColor: isOverdue ? '#ef4444' : '#8cc63e'
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  {/* Priority dot for mobile */}
                  <span className={`inline-block w-2 h-2 rounded-full mt-1.5 sm:mt-1 flex-shrink-0 ${getPriorityDotColor(deadline.status)}`} />
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-medium text-gray-900 break-words leading-tight">
                      {deadline.obligation?.name || "Unknown Obligation"}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                      <span className="text-[10px] sm:text-xs text-gray-500">
                        {deadline.obligation?.obligation_id || ""}
                      </span>
                      {deadline.obligation?.obligation_id && deadline.obligation?.domain && (
                        <span className="text-[10px] sm:text-xs text-gray-300">•</span>
                      )}
                      <span className="text-[10px] sm:text-xs text-gray-500">
                        {deadline.obligation?.domain || ""}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <svg
                        className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p className={`text-[10px] sm:text-xs font-medium ${
                        isOverdue ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {formatDate(deadline.due_date)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <span
                className={`px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-full self-start sm:self-center whitespace-nowrap ${
                  getPriorityColor(deadline.status)
                }`}
              >
                {deadline.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UpcomingDeadlines;