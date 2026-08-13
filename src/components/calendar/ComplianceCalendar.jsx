import { useState, useEffect } from "react";
import { getObligations, getObligationInstances } from "../../api/compliance";

const ComplianceCalendar = () => {
  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [obligations, setObligations] = useState([]);
  const [allInstances, setAllInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedObligations, setSelectedObligations] = useState([]);

  // Fetch obligations and instances
  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      // Fetch all obligations
      const { data: obligationsData } = await getObligations();
      setObligations(obligationsData || []);

      // Fetch instances for all obligations
      let allInstancesData = [];
      if (obligationsData && obligationsData.length > 0) {
        for (const obligation of obligationsData) {
          const { data: instances } = await getObligationInstances(obligation.id);
          if (instances && instances.length > 0) {
            const instancesWithObligation = instances.map(instance => ({
              ...instance,
              obligation: {
                id: obligation.id,
                name: obligation.name,
                obligation_id: obligation.obligation_id,
                domain: obligation.domain,
                frequency: obligation.frequency,
                current_status: obligation.current_status
              }
            }));
            allInstancesData = [...allInstancesData, ...instancesWithObligation];
          }
        }
      }
      setAllInstances(allInstancesData);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeBadge = (frequency) => {
    const badges = {
      Monthly: "bg-blue-100 text-blue-800",
      Quarterly: "bg-purple-100 text-purple-800",
      "Bi-Annual": "bg-indigo-100 text-indigo-800",
      Annual: "bg-green-100 text-green-800",
      "One-Time": "bg-orange-100 text-orange-800",
    };
    return badges[frequency] || "bg-gray-100 text-gray-800";
  };

  const getStatusBadge = (status) => {
    const badges = {
      Completed: "bg-green-100 text-green-800",
      "In Progress": "bg-blue-100 text-blue-800",
      Pending: "bg-yellow-100 text-yellow-800",
      Overdue: "bg-red-100 text-red-800",
      "Not Started": "bg-gray-100 text-gray-800",
      Approved: "bg-purple-100 text-purple-800",
      Submitted: "bg-indigo-100 text-indigo-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    return { daysInMonth, firstDayOfMonth };
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const handleDateClick = (dateStr, dayObligations) => {
    setSelectedDate(dateStr);
    setSelectedObligations(dayObligations);
  };

  // Helper function to format date consistently
  const formatDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const renderMonthView = () => {
    const { daysInMonth, firstDayOfMonth } = getDaysInMonth(currentDate);
    const days = [];
    const monthName = currentDate.toLocaleString("default", { month: "long" });
    const year = currentDate.getFullYear();

    // Empty cells for days before month starts
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      
      // Filter obligations for this specific date using proper date comparison
      const dayObligations = allInstances.filter((inst) => {
        if (!inst.due_date) return false;
        const formattedDueDate = formatDate(inst.due_date);
        return formattedDueDate === dateStr;
      });

      // Check if today
      const today = new Date();
      const isToday = 
        today.getFullYear() === year &&
        today.getMonth() === currentDate.getMonth() &&
        today.getDate() === day;

      days.push(
        <div
          key={day}
          onClick={() => handleDateClick(dateStr, dayObligations)}
          className={`min-h-24 border border-gray-200 p-1 hover:bg-gray-50 transition-colors cursor-pointer ${
            isToday ? "bg-blue-50 border-blue-300" : ""
          }`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-sm font-medium ${
              isToday ? "text-blue-600 font-bold" : "text-gray-700"
            }`}>
              {day}
            </span>
            {dayObligations.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                {dayObligations.length}
              </span>
            )}
          </div>
          <div className="mt-1 space-y-0.5 max-h-16 overflow-y-auto">
            {dayObligations.slice(0, 2).map((inst) => (
              <div key={inst.id} className="text-xs truncate">
                <span className="font-medium">{inst.obligation?.name || "Unknown"}</span>
                <span
                  className={`ml-1 px-1 text-xs rounded ${getStatusBadge(inst.status)}`}
                >
                  {inst.status}
                </span>
              </div>
            ))}
            {dayObligations.length > 2 && (
              <div className="text-xs text-gray-500">
                +{dayObligations.length - 2} more
              </div>
            )}
          </div>
        </div>,
      );
    }

    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {monthName} {year}
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="px-3 py-1 border rounded-md hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => navigateMonth(1)}
              className="px-3 py-1 border rounded-md hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 bg-[#8cc63e] text-white rounded-md hover:bg-[#7ab83a] transition-colors"
            >
              Today
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-gray-500 py-2 bg-gray-50"
            >
              {day}
            </div>
          ))}
          {days}
        </div>
      </div>
    );
  };

  const renderQuarterView = () => {
    const year = currentDate.getFullYear();
    const quarter = Math.floor(currentDate.getMonth() / 3);
    const quarters = ["Q1", "Q2", "Q3", "Q4"];
    const quarterMonths = [
      ["January", "February", "March"],
      ["April", "May", "June"],
      ["July", "August", "September"],
      ["October", "November", "December"],
    ];

    // Get months in quarter
    const months = quarterMonths[quarter];
    const monthIndices = [quarter * 3, quarter * 3 + 1, quarter * 3 + 2];

    // Get obligations for this quarter
    const quarterObligations = allInstances.filter((inst) => {
      if (!inst.due_date) return false;
      const instDate = new Date(inst.due_date);
      const instMonth = instDate.getMonth();
      const instYear = instDate.getFullYear();
      return instYear === year && monthIndices.includes(instMonth);
    });

    // Group by month
    const groupedByMonth = {};
    monthIndices.forEach((monthIdx, index) => {
      const monthName = quarterMonths[quarter][index];
      groupedByMonth[monthName] = quarterObligations.filter((inst) => {
        const instDate = new Date(inst.due_date);
        return instDate.getMonth() === monthIdx;
      });
    });

    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {quarters[quarter]} {year}
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() - 3);
                setCurrentDate(newDate);
              }}
              className="px-3 py-1 border rounded-md hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() + 3);
                setCurrentDate(newDate);
              }}
              className="px-3 py-1 border rounded-md hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 bg-[#8cc63e] text-white rounded-md hover:bg-[#7ab83a] transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {months.map((monthName, index) => {
            const monthObligations = groupedByMonth[monthName] || [];
            return (
              <div key={monthName} className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">{monthName}</h4>
                {monthObligations.length === 0 ? (
                  <p className="text-sm text-gray-500">No obligations</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {monthObligations.map((inst) => (
                      <div
                        key={inst.id}
                        className="bg-gray-50 rounded-lg p-2 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {inst.obligation?.name || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {inst.obligation?.obligation_id || ""} •{" "}
                              {inst.obligation?.domain || ""}
                            </p>
                            <p className="text-xs text-gray-500">
                              Due: {new Date(inst.due_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 ml-2">
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(inst.status)}`}
                            >
                              {inst.status}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${getTypeBadge(inst.obligation?.frequency)}`}
                            >
                              {inst.obligation?.frequency || "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Get obligations for this year
    const yearObligations = allInstances.filter((inst) => {
      if (!inst.due_date) return false;
      const instDate = new Date(inst.due_date);
      return instDate.getFullYear() === year;
    });

    // Group by month
    const groupedByMonth = {};
    months.forEach((month, index) => {
      groupedByMonth[month] = yearObligations.filter((inst) => {
        const instDate = new Date(inst.due_date);
        return instDate.getMonth() === index;
      });
    });

    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Year {year}</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setFullYear(newDate.getFullYear() - 1);
                setCurrentDate(newDate);
              }}
              className="px-3 py-1 border rounded-md hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setFullYear(newDate.getFullYear() + 1);
                setCurrentDate(newDate);
              }}
              className="px-3 py-1 border rounded-md hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 bg-[#8cc63e] text-white rounded-md hover:bg-[#7ab83a] transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {months.map((monthName) => {
            const monthObligations = groupedByMonth[monthName] || [];
            const completed = monthObligations.filter(
              (inst) => inst.status === "Completed" || inst.status === "Approved"
            ).length;

            return (
              <div key={monthName} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900">{monthName}</h4>
                  {monthObligations.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      {monthObligations.length}
                    </span>
                  )}
                </div>
                {monthObligations.length === 0 ? (
                  <p className="text-sm text-gray-500">No obligations</p>
                ) : (
                  <>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-medium text-green-600">
                        {completed}/{monthObligations.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#8cc63e] rounded-full h-2 transition-all duration-300"
                        style={{
                          width: `${(completed / monthObligations.length) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {monthObligations.slice(0, 3).map((inst) => (
                        <div key={inst.id} className="text-xs truncate">
                          <span className="font-medium">
                            {inst.obligation?.name || "Unknown"}
                          </span>
                          <span
                            className={`ml-1 px-1 text-xs rounded ${getStatusBadge(inst.status)}`}
                          >
                            {inst.status}
                          </span>
                        </div>
                      ))}
                      {monthObligations.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{monthObligations.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Modal for showing obligations on a selected date
  const renderModal = () => {
    if (!selectedDate || selectedObligations.length === 0) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              Obligations for {new Date(selectedDate).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <button
              onClick={() => {
                setSelectedDate(null);
                setSelectedObligations([]);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-3">
              {selectedObligations.map((inst) => (
                <div
                  key={inst.id}
                  className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {inst.obligation?.name || "Unknown Obligation"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {inst.obligation?.obligation_id || ""} •{" "}
                        {inst.obligation?.domain || ""}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(inst.status)}`}
                        >
                          {inst.status}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${getTypeBadge(inst.obligation?.frequency)}`}
                        >
                          {inst.obligation?.frequency || "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 ml-4">
                      {inst.comments && (
                        <p className="text-xs text-gray-600 italic">"{inst.comments}"</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t p-4 bg-gray-50">
            <button
              onClick={() => {
                setSelectedDate(null);
                setSelectedObligations([]);
              }}
              className="w-full px-4 py-2 bg-[#8cc63e] text-white rounded-md hover:bg-[#7ab83a] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading calendar data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Calendar</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setView("month")}
            className={`px-4 py-2 rounded-md transition-colors ${
              view === "month"
                ? "bg-[#8cc63e] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setView("quarter")}
            className={`px-4 py-2 rounded-md transition-colors ${
              view === "quarter"
                ? "bg-[#8cc63e] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Quarterly
          </button>
          <button
            onClick={() => setView("year")}
            className={`px-4 py-2 rounded-md transition-colors ${
              view === "year"
                ? "bg-[#8cc63e] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Annual
          </button>
          <button
            onClick={fetchCalendarData}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center"
          >
            <svg
              className="h-4 w-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Obligations</p>
          <p className="text-2xl font-bold text-gray-900">{allInstances.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-green-600">
            {allInstances.filter(i => i.status === "Completed" || i.status === "Approved").length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">
            {allInstances.filter(i => i.status === "Pending").length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Overdue</p>
          <p className="text-2xl font-bold text-red-600">
            {allInstances.filter(i => i.status === "Overdue").length}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center">
            <span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded mr-2"></span>
            <span className="text-sm text-gray-600">Monthly</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 bg-purple-100 border border-purple-300 rounded mr-2"></span>
            <span className="text-sm text-gray-600">Quarterly</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 bg-indigo-100 border border-indigo-300 rounded mr-2"></span>
            <span className="text-sm text-gray-600">Bi-Annual</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 bg-green-100 border border-green-300 rounded mr-2"></span>
            <span className="text-sm text-gray-600">Annual</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 bg-orange-100 border border-orange-300 rounded mr-2"></span>
            <span className="text-sm text-gray-600">One-Time</span>
          </div>
          <div className="flex items-center ml-4">
            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded mr-2">
              Completed
            </span>
          </div>
          <div className="flex items-center">
            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded mr-2">
              Pending
            </span>
          </div>
          <div className="flex items-center">
            <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded mr-2">
              Overdue
            </span>
          </div>
          <div className="flex items-center">
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded mr-2">
              In Progress
            </span>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6">
        {view === "month" && renderMonthView()}
        {view === "quarter" && renderQuarterView()}
        {view === "year" && renderYearView()}
      </div>

      {/* Modal */}
      {renderModal()}
    </div>
  );
};

export default ComplianceCalendar;