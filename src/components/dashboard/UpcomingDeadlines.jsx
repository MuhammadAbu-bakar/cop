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
      dateStr += ` (${Math.abs(diffDays)} days overdue)`;
    } else if (diffDays === 0) {
      dateStr += " (Today)";
    } else if (diffDays <= 7) {
      dateStr += ` (${diffDays} days left)`;
    }

    return dateStr;
  };

  if (deadlines.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
          Upcoming Deadlines
        </h3>
        <div className="text-center py-6 md:py-8 text-gray-500">
          <p className="text-sm md:text-base">No upcoming deadlines</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
        Upcoming Deadlines
      </h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {deadlines.map((deadline) => (
          <div
            key={deadline.id}
            className="flex flex-col gap-1 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 break-words">
                  {deadline.obligation?.name || "Unknown Obligation"}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {deadline.obligation?.obligation_id || ""} •{" "}
                  {deadline.obligation?.domain || ""}
                </p>
              </div>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${getPriorityColor(deadline.status)}`}
              >
                {deadline.status}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {formatDate(deadline.due_date)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingDeadlines;