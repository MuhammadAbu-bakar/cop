import { useState, useEffect } from "react";
import { getObligations } from "../../api/compliance";

const ComplianceCalendar = () => {
  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedObligations, setSelectedObligations] = useState([]);

  // Fetch obligations
  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      // Fetch all obligations with calculated_due_date
      const { data: obligationsData, error } = await getObligations();
      if (error) throw error;
      
      // Filter obligations that have a calculated_due_date
      const obligationsWithDueDate = (obligationsData || []).filter(
        (o) => o.calculated_due_date
      );
      
      // Calculate overdue status for each obligation
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const obligationsWithOverdue = obligationsWithDueDate.map((obligation) => {
        const dueDate = new Date(obligation.calculated_due_date);
        dueDate.setHours(0, 0, 0, 0);
        const isOverdue = dueDate < today && obligation.current_status !== "Completed";
        return {
          ...obligation,
          isOverdue
        };
      });
      
      setObligations(obligationsWithOverdue);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeBadge = (frequency) => {
    const badges = {
      Monthly: "bg-green-100 text-green-800",
      Quarterly: "bg-emerald-100 text-emerald-800",
      "Bi-Annual": "bg-teal-100 text-teal-800",
      Annual: "bg-lime-100 text-lime-800",
      "One-Time": "bg-amber-100 text-amber-800",
      "Event Based": "bg-amber-100 text-amber-800",
      Continuous: "bg-cyan-100 text-cyan-800",
    };
    return badges[frequency] || "bg-gray-100 text-gray-800";
  };

  const getStatusBadge = (status, isOverdue) => {
    // If overdue, always show as Overdue
    if (isOverdue) {
      return "bg-red-100 text-red-800";
    }
    
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

  const getDomainColor = (domain) => {
    const colors = {
      "Preventive Maintenance": "bg-emerald-100 text-emerald-800",
      "Security Management": "bg-rose-100 text-rose-800",
      "Fuel Management": "bg-amber-100 text-amber-800",
      "Inventory Management": "bg-cyan-100 text-cyan-800",
      "Utility Management": "bg-violet-100 text-violet-800",
      "Vendor Management": "bg-fuchsia-100 text-fuchsia-800",
    };
    return colors[domain] || "bg-gray-100 text-gray-800";
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
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get obligations for a specific date
  const getObligationsForDate = (dateStr) => {
    return obligations.filter((obligation) => {
      if (!obligation.calculated_due_date) return false;
      const formattedDueDate = formatDate(obligation.calculated_due_date);
      return formattedDueDate === dateStr;
    });
  };

  const renderMonthView = () => {
    const { daysInMonth, firstDayOfMonth } = getDaysInMonth(currentDate);
    const days = [];
    const monthName = currentDate.toLocaleString("default", { month: "long" });
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");

    // Empty cells for days before month starts
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 sm:h-20 md:h-24 bg-gray-50/50"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${month}-${String(day).padStart(2, "0")}`;
      const dayObligations = getObligationsForDate(dateStr);
      const hasOverdue = dayObligations.some(o => o.isOverdue);

      // Check if today
      const today = new Date();
      const isToday = 
        today.getFullYear() === year &&
        today.getMonth() === currentDate.getMonth() &&
        today.getDate() === day;

      // Check if date is in the past
      const isPast = new Date(year, currentDate.getMonth(), day) < new Date(today.setHours(0, 0, 0, 0));

      days.push(
        <div
          key={day}
          onClick={() => handleDateClick(dateStr, dayObligations)}
          className={`min-h-16 sm:min-h-20 md:min-h-24 border border-gray-200 p-0.5 sm:p-1 hover:bg-gray-50 transition-colors cursor-pointer ${
            isToday ? "bg-green-50 border-green-300" : ""
          } ${isPast && !isToday ? "bg-gray-50/30" : ""} ${
            hasOverdue ? "border-l-4 border-l-red-500" : ""
          }`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-xs sm:text-sm font-medium ${
              isToday ? "text-[#8cc63e] font-bold" : "text-gray-700"
            }`}>
              {day}
            </span>
            {dayObligations.length > 0 && (
              <span className={`text-[9px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded-full ${
                hasOverdue ? "bg-red-100 text-red-800" : "bg-[#8cc63e] text-white"
              }`}>
                {dayObligations.length}
              </span>
            )}
          </div>
          <div className="mt-0.5 sm:mt-1 space-y-0.5 max-h-10 sm:max-h-14 md:max-h-16 overflow-y-auto">
            {dayObligations.slice(0, 2).map((obligation) => (
              <div key={obligation.id} className={`text-[8px] sm:text-xs truncate ${obligation.isOverdue ? "bg-red-50 rounded px-0.5" : ""}`}>
                <span className={`font-medium ${obligation.isOverdue ? "text-red-600" : ""}`}>
                  {obligation.name || "Unknown"}
                </span>
                <span
                  className={`ml-0.5 sm:ml-1 px-0.5 sm:px-1 text-[7px] sm:text-xs rounded ${getStatusBadge(obligation.current_status, obligation.isOverdue)}`}
                >
                  {obligation.isOverdue ? "Overdue" : obligation.current_status}
                </span>
              </div>
            ))}
            {dayObligations.length > 2 && (
              <div className="text-[7px] sm:text-xs text-gray-500">
                +{dayObligations.length - 2} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="flex flex-wrap justify-between items-center mb-3 sm:mb-4 gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            {monthName} {year}
          </h3>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs sm:text-sm text-gray-700"
            >
              ← Prev
            </button>
            <button
              onClick={() => navigateMonth(1)}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs sm:text-sm text-gray-700"
            >
              Next →
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2 sm:px-3 py-1 text-white rounded-md hover:opacity-90 transition-colors text-xs sm:text-sm"
              style={{ backgroundColor: "#8cc63e" }}
            >
              Today
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-[10px] sm:text-sm font-medium text-gray-500 py-1 sm:py-2 bg-gray-50 border-b border-gray-200"
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
    const quarterObligations = obligations.filter((obligation) => {
      if (!obligation.calculated_due_date) return false;
      const instDate = new Date(obligation.calculated_due_date);
      const instMonth = instDate.getMonth();
      const instYear = instDate.getFullYear();
      return instYear === year && monthIndices.includes(instMonth);
    });

    // Group by month
    const groupedByMonth = {};
    monthIndices.forEach((monthIdx, index) => {
      const monthName = quarterMonths[quarter][index];
      groupedByMonth[monthName] = quarterObligations.filter((obligation) => {
        const instDate = new Date(obligation.calculated_due_date);
        return instDate.getMonth() === monthIdx;
      });
    });

    return (
      <div>
        <div className="flex flex-wrap justify-between items-center mb-3 sm:mb-4 gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            {quarters[quarter]} {year}
          </h3>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() - 3);
                setCurrentDate(newDate);
              }}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs sm:text-sm text-gray-700"
            >
              ← Prev
            </button>
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() + 3);
                setCurrentDate(newDate);
              }}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs sm:text-sm text-gray-700"
            >
              Next →
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2 sm:px-3 py-1 text-white rounded-md hover:opacity-90 transition-colors text-xs sm:text-sm"
              style={{ backgroundColor: "#8cc63e" }}
            >
              Today
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {months.map((monthName, index) => {
            const monthObligations = groupedByMonth[monthName] || [];
            const completed = monthObligations.filter(
              (o) => o.current_status === "Completed"
            ).length;
            const overdue = monthObligations.filter(
              (o) => o.isOverdue
            ).length;

            return (
              <div key={monthName} className="border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <h4 className="text-sm sm:text-base font-semibold text-gray-900">{monthName}</h4>
                  <div className="flex gap-1 sm:gap-2">
                    {overdue > 0 && (
                      <span className="text-[10px] sm:text-xs bg-red-100 text-red-800 px-1.5 sm:px-2 py-0.5 rounded-full">
                        {overdue} Overdue
                      </span>
                    )}
                    <span className="text-[10px] sm:text-xs text-white px-1.5 sm:px-2 py-0.5 rounded-full" style={{ backgroundColor: "#8cc63e" }}>
                      {monthObligations.length}
                    </span>
                  </div>
                </div>
                {monthObligations.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500 text-center py-3 sm:py-4">No obligations</p>
                ) : (
                  <>
                    <div className="flex justify-between text-xs sm:text-sm mb-1 sm:mb-2">
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-medium text-green-600">
                        {completed}/{monthObligations.length}
                      </span>
                    </div>
                    {overdue > 0 && (
                      <div className="flex justify-between text-xs sm:text-sm mb-1 sm:mb-2">
                        <span className="text-gray-600">Overdue:</span>
                        <span className="font-medium text-red-600">
                          {overdue}
                        </span>
                      </div>
                    )}
                    <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                      <div
                        className="rounded-full h-1.5 sm:h-2 transition-all duration-300"
                        style={{
                          width: `${(completed / monthObligations.length) * 100}%`,
                          backgroundColor: "#8cc63e"
                        }}
                      ></div>
                    </div>
                    <div className="mt-2 sm:mt-3 space-y-1 sm:space-y-2 max-h-36 sm:max-h-48 overflow-y-auto">
                      {monthObligations.slice(0, 3).map((obligation) => (
                        <div
                          key={obligation.id}
                          className={`rounded p-1.5 sm:p-2 hover:bg-gray-100 transition-colors ${
                            obligation.isOverdue ? "bg-red-50 border-l-2 sm:border-l-4 border-l-red-500" : "bg-gray-50"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <p className={`text-[10px] sm:text-xs font-medium truncate flex-1 ${
                              obligation.isOverdue ? "text-red-600" : "text-gray-900"
                            }`}>
                              {obligation.name}
                            </p>
                            <span
                              className={`ml-1 px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-xs rounded ${getStatusBadge(obligation.current_status, obligation.isOverdue)}`}
                            >
                              {obligation.isOverdue ? "Overdue" : obligation.current_status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                            <span
                              className={`px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[10px] rounded ${getTypeBadge(obligation.frequency)}`}
                            >
                              {obligation.frequency}
                            </span>
                            <span
                              className={`px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[10px] rounded ${getDomainColor(obligation.domain)}`}
                            >
                              {obligation.domain}
                            </span>
                            {obligation.isOverdue && (
                              <span className="px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[10px] rounded bg-red-200 text-red-800">
                                ⚠ Overdue
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {monthObligations.length > 3 && (
                        <div className="text-[9px] sm:text-xs text-gray-500 text-center py-0.5 sm:py-1">
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

  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Get obligations for this year
    const yearObligations = obligations.filter((obligation) => {
      if (!obligation.calculated_due_date) return false;
      const instDate = new Date(obligation.calculated_due_date);
      return instDate.getFullYear() === year;
    });

    // Group by month
    const groupedByMonth = {};
    months.forEach((month, index) => {
      groupedByMonth[month] = yearObligations.filter((obligation) => {
        const instDate = new Date(obligation.calculated_due_date);
        return instDate.getMonth() === index;
      });
    });

    // Get current month for highlighting
    const currentMonth = new Date().getMonth();

    return (
      <div>
        <div className="flex flex-wrap justify-between items-center mb-3 sm:mb-4 gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Year {year}</h3>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setFullYear(newDate.getFullYear() - 1);
                setCurrentDate(newDate);
              }}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs sm:text-sm text-gray-700"
            >
              ← Prev
            </button>
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setFullYear(newDate.getFullYear() + 1);
                setCurrentDate(newDate);
              }}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs sm:text-sm text-gray-700"
            >
              Next →
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2 sm:px-3 py-1 text-white rounded-md hover:opacity-90 transition-colors text-xs sm:text-sm"
              style={{ backgroundColor: "#8cc63e" }}
            >
              Today
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {months.map((monthName, index) => {
            const monthObligations = groupedByMonth[monthName] || [];
            const completed = monthObligations.filter(
              (o) => o.current_status === "Completed"
            ).length;
            const overdue = monthObligations.filter(
              (o) => o.isOverdue
            ).length;
            const isCurrentMonth = index === currentMonth && new Date().getFullYear() === year;

            return (
              <div 
                key={monthName} 
                className={`border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow ${
                  isCurrentMonth ? "border-green-300 bg-green-50/30" : ""
                } ${overdue > 0 ? "border-l-2 sm:border-l-4 border-l-red-500" : ""}`}
              >
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                  <h4 className={`text-sm sm:text-base font-semibold ${isCurrentMonth ? "text-[#8cc63e]" : "text-gray-900"}`}>
                    {monthName}
                    {isCurrentMonth && " ◄"}
                  </h4>
                  <div className="flex gap-0.5 sm:gap-1">
                    {overdue > 0 && (
                      <span className="text-[9px] sm:text-xs bg-red-100 text-red-800 px-1 sm:px-1.5 py-0.5 rounded-full">
                        {overdue}
                      </span>
                    )}
                    {monthObligations.length > 0 && (
                      <span className="text-[9px] sm:text-xs text-white px-1 sm:px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#8cc63e" }}>
                        {monthObligations.length}
                      </span>
                    )}
                  </div>
                </div>
                {monthObligations.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500 text-center py-2 sm:py-4">No obligations</p>
                ) : (
                  <>
                    <div className="flex justify-between text-[10px] sm:text-sm">
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-medium text-green-600">
                        {completed}/{monthObligations.length}
                      </span>
                    </div>
                    {overdue > 0 && (
                      <div className="flex justify-between text-[10px] sm:text-sm">
                        <span className="text-gray-600">Overdue:</span>
                        <span className="font-medium text-red-600">
                          {overdue}
                        </span>
                      </div>
                    )}
                    <div className="w-full bg-gray-200 rounded-full h-1 sm:h-1.5 mt-0.5 sm:mt-1">
                      <div
                        className="rounded-full h-1 sm:h-1.5 transition-all duration-300"
                        style={{
                          width: `${(completed / monthObligations.length) * 100}%`,
                          backgroundColor: "#8cc63e"
                        }}
                      ></div>
                    </div>
                    <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1 max-h-24 sm:max-h-32 overflow-y-auto">
                      {monthObligations.slice(0, 2).map((obligation) => (
                        <div key={obligation.id} className={`text-[9px] sm:text-xs truncate ${obligation.isOverdue ? "bg-red-50 rounded px-0.5" : ""}`}>
                          <span className={`font-medium ${obligation.isOverdue ? "text-red-600" : ""}`}>
                            {obligation.name || "Unknown"}
                          </span>
                          <span
                            className={`ml-0.5 sm:ml-1 px-0.5 sm:px-1 text-[8px] sm:text-xs rounded ${getStatusBadge(obligation.current_status, obligation.isOverdue)}`}
                          >
                            {obligation.isOverdue ? "Overdue" : obligation.current_status}
                          </span>
                        </div>
                      ))}
                      {monthObligations.length > 2 && (
                        <div className="text-[8px] sm:text-xs text-gray-500">
                          +{monthObligations.length - 2} more
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

    const hasOverdue = selectedObligations.some(o => o.isOverdue);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          <div className={`flex justify-between items-center p-3 sm:p-4 border-b ${hasOverdue ? "bg-red-50" : ""}`} style={!hasOverdue ? { backgroundColor: "#8cc63e" } : {}}>
            <div>
              <h3 className={`text-sm sm:text-base md:text-lg font-semibold ${hasOverdue ? "text-gray-900" : "text-white"}`}>
                Obligations for {new Date(selectedDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              {hasOverdue && (
                <p className="text-xs sm:text-sm text-red-600 font-medium mt-0.5 sm:mt-1">
                  ⚠ Contains overdue obligations
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedDate(null);
                setSelectedObligations([]);
              }}
              className={`${hasOverdue ? "text-gray-400 hover:text-gray-600" : "text-white/80 hover:text-white"} transition-colors`}
            >
              <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-3 sm:p-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-2 sm:space-y-3">
              {selectedObligations.map((obligation) => (
                <div
                  key={obligation.id}
                  className={`border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow ${
                    obligation.isOverdue ? "border-red-300 bg-red-50/50" : "bg-white"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div className="flex-1 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <p className={`text-sm sm:text-base font-medium ${obligation.isOverdue ? "text-red-600" : "text-gray-900"}`}>
                          {obligation.name || "Unknown Obligation"}
                        </p>
                        {obligation.isOverdue && (
                          <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded-full bg-red-100 text-red-800">
                            ⚠ Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                        {obligation.obligation_id || ""} • {obligation.domain || ""}
                      </p>
                      <div className="flex flex-wrap gap-1 sm:gap-2 mt-1 sm:mt-2">
                        <span
                          className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs rounded-full ${getStatusBadge(obligation.current_status, obligation.isOverdue)}`}
                        >
                          {obligation.isOverdue ? "Overdue" : obligation.current_status}
                        </span>
                        <span
                          className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs rounded-full ${getTypeBadge(obligation.frequency)}`}
                        >
                          {obligation.frequency || "N/A"}
                        </span>
                        {obligation.mandatory && (
                          <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs rounded-full bg-red-100 text-red-800">
                            Mandatory
                          </span>
                        )}
                      </div>
                      {obligation.description && (
                        <p className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2">{obligation.description}</p>
                      )}
                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-0.5 sm:gap-y-1 mt-1 sm:mt-2 text-[10px] sm:text-xs">
                        <div>
                          <span className="font-medium text-gray-500">Responsible:</span>
                          <span className="ml-0.5 sm:ml-1 text-gray-700">{obligation.responsible}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Accountable:</span>
                          <span className="ml-0.5 sm:ml-1 text-gray-700">{obligation.accountable}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Weight:</span>
                          <span className="ml-0.5 sm:ml-1 text-gray-700">{obligation.compliance_weight}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Clause:</span>
                          <span className="ml-0.5 sm:ml-1 text-gray-700">{obligation.clause || 'N/A'}</span>
                        </div>
                        <div className="col-span-1 xs:col-span-2">
                          <span className="font-medium text-gray-500">Due Date:</span>
                          <span className={`ml-0.5 sm:ml-1 ${obligation.isOverdue ? "text-red-600 font-bold" : "text-gray-700"}`}>
                            {new Date(obligation.calculated_due_date).toLocaleDateString()}
                          </span>
                          {obligation.isOverdue && (
                            <span className="ml-1 sm:ml-2 text-red-500 text-[9px] sm:text-xs">
                              (Overdue by {Math.ceil((new Date() - new Date(obligation.calculated_due_date)) / (1000 * 60 * 60 * 24))} days)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {obligation.due_date_rule && (
                      <div className="text-xs text-gray-500 mt-2 sm:mt-0 sm:ml-4">
                        <p className="text-[9px] sm:text-xs text-gray-600 italic">"{obligation.due_date_rule}"</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t p-3 sm:p-4 bg-gray-50">
            <button
              onClick={() => {
                setSelectedDate(null);
                setSelectedObligations([]);
              }}
              className="w-full px-4 py-2 text-white rounded-md hover:opacity-90 transition-colors text-sm"
              style={{ backgroundColor: "#8cc63e" }}
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: "#8cc63e" }}></div>
          <p className="mt-4 text-gray-600">Loading calendar data...</p>
        </div>
      </div>
    );
  }

  // Calculate stats
  const totalObligations = obligations.length;
  const completedObligations = obligations.filter(o => o.current_status === "Completed").length;
  const overdueObligations = obligations.filter(o => o.isOverdue).length;
  const pendingObligations = obligations.filter(o => 
    (o.current_status === "Pending" || o.current_status === "In Progress") && !o.isOverdue
  ).length;
  const notStartedObligations = obligations.filter(o => 
    o.current_status === "Not Started" && !o.isOverdue
  ).length;

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Compliance Calendar</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
            {totalObligations} obligations with calculated due dates
          </p>
        </div>
        <div className="flex flex-wrap gap-1 sm:gap-2 w-full sm:w-auto">
          <button
            onClick={() => setView("month")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-md transition-colors text-xs sm:text-sm ${
              view === "month"
                ? "text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            style={view === "month" ? { backgroundColor: "#8cc63e" } : {}}
          >
            Monthly
          </button>
          <button
            onClick={() => setView("quarter")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-md transition-colors text-xs sm:text-sm ${
              view === "quarter"
                ? "text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            style={view === "quarter" ? { backgroundColor: "#8cc63e" } : {}}
          >
            Quarterly
          </button>
          <button
            onClick={() => setView("year")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-md transition-colors text-xs sm:text-sm ${
              view === "year"
                ? "text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            style={view === "year" ? { backgroundColor: "#8cc63e" } : {}}
          >
            Annual
          </button>
          <button
            onClick={fetchCalendarData}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-xs sm:text-sm flex items-center justify-center"
          >
            <svg
              className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2"
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
            <span className="hidden xs:inline">Refresh</span>
            <span className="xs:hidden">↻</span>
          </button>
        </div>
      </div>

      {/* Stats Summary - Responsive */}
      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-2 sm:p-4">
          <p className="text-[10px] sm:text-sm text-gray-500">Total</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{totalObligations}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-4">
          <p className="text-[10px] sm:text-sm text-gray-500">Completed</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600">{completedObligations}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-4">
          <p className="text-[10px] sm:text-sm text-gray-500">Pending</p>
          <p className="text-lg sm:text-2xl font-bold text-yellow-600">{pendingObligations}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-4">
          <p className="text-[10px] sm:text-sm text-gray-500">Not Started</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-600">{notStartedObligations}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-4 border-2 border-red-200 bg-red-50 col-span-2 xs:col-span-3 sm:col-span-1">
          <p className="text-[10px] sm:text-sm text-red-600 font-medium">⚠ Overdue</p>
          <p className="text-lg sm:text-2xl font-bold text-red-600">{overdueObligations}</p>
        </div>
      </div>

      {/* Legend - Responsive */}
      <div className="bg-white rounded-lg shadow p-2 sm:p-4">
        <div className="flex flex-wrap gap-2 sm:gap-4 items-start sm:items-center">
          <span className="text-xs sm:text-sm font-medium text-gray-700">Frequency:</span>
          <div className="flex flex-wrap gap-1.5 sm:gap-3">
            <div className="flex items-center">
              <span className="w-2 h-2 sm:w-3 sm:h-3 bg-green-100 border border-green-300 rounded mr-1"></span>
              <span className="text-[10px] sm:text-xs text-gray-600">Monthly</span>
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 sm:w-3 sm:h-3 bg-emerald-100 border border-emerald-300 rounded mr-1"></span>
              <span className="text-[10px] sm:text-xs text-gray-600">Quarterly</span>
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 sm:w-3 sm:h-3 bg-teal-100 border border-teal-300 rounded mr-1"></span>
              <span className="text-[10px] sm:text-xs text-gray-600">Bi-Annual</span>
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 sm:w-3 sm:h-3 bg-lime-100 border border-lime-300 rounded mr-1"></span>
              <span className="text-[10px] sm:text-xs text-gray-600">Annual</span>
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 sm:w-3 sm:h-3 bg-amber-100 border border-amber-300 rounded mr-1"></span>
              <span className="text-[10px] sm:text-xs text-gray-600">Event Based</span>
            </div>
          </div>
          <span className="text-xs sm:text-sm font-medium text-gray-700">Status:</span>
          <div className="flex flex-wrap gap-1.5 sm:gap-3">
            <span className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-xs bg-green-100 text-green-800 rounded">Completed</span>
            <span className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-xs bg-yellow-100 text-yellow-800 rounded">Pending</span>
            <span className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-xs bg-blue-100 text-blue-800 rounded">In Progress</span>
            <span className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-xs bg-red-100 text-red-800 rounded font-bold">⚠ Overdue</span>
            <span className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-xs bg-gray-100 text-gray-800 rounded">Not Started</span>
          </div>
        </div>
      </div>

      {/* Calendar View - Responsive */}
      <div className="bg-white rounded-lg shadow p-2 sm:p-4 md:p-6 overflow-x-auto">
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