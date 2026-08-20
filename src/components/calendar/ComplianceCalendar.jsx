import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../api/supabase";
import { useAuth } from "../../context/AuthContext";

const ComplianceCalendar = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const userRegion = profile?.region_name || null;
  
  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedOccurrences, setSelectedOccurrences] = useState([]);

  // Get region ID from region name
  const getRegionId = async (regionName) => {
    if (!regionName) return null;
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('id')
        .eq('name', regionName)
        .single();
      
      if (error) return null;
      return data?.id || null;
    } catch (error) {
      console.error('Error getting region ID:', error);
      return null;
    }
  };

  // Fetch occurrences with region filtering
  useEffect(() => {
    fetchCalendarData();
  }, [currentDate, view, userRegion, isAdmin]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      let regionId = null;
      if (!isAdmin && userRegion) {
        regionId = await getRegionId(userRegion);
      }

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const quarter = Math.floor(month / 3);
      
      let startDate, endDate;
      
      if (view === "month") {
        startDate = new Date(year, month, 1).toISOString().split('T')[0];
        endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
      } else if (view === "quarter") {
        const startMonth = quarter * 3;
        startDate = new Date(year, startMonth, 1).toISOString().split('T')[0];
        endDate = new Date(year, startMonth + 3, 0).toISOString().split('T')[0];
      } else { // year view
        startDate = new Date(year, 0, 1).toISOString().split('T')[0];
        endDate = new Date(year, 11, 31).toISOString().split('T')[0];
      }

      // Build query for occurrences
      let query = supabase
        .from('obligation_occurrences')
        .select(`
          *,
          obligation:obligations(
            obligation_id,
            name,
            domain,
            frequency,
            description,
            responsible,
            accountable,
            compliance_weight,
            evidence_required,
            evidence_type,
            mandatory,
            region,
            clause,
            due_date_rule
          )
        `)
        .gte('instance_date', startDate)
        .lte('instance_date', endDate)
        .order('due_date', { ascending: true });

      // Filter by region for non-admin users
      if (!isAdmin && regionId) {
        query = query.eq('region_id', regionId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Process occurrences
      const processedData = (data || []).map(occurrence => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(occurrence.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const isOverdue = dueDate < today && occurrence.status !== "Completed";
        
        return {
          ...occurrence,
          isOverdue,
          displayStatus: occurrence.status
        };
      });

      setOccurrences(processedData);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats for the current view
  const getViewStats = () => {
    const total = occurrences.length;
    const completed = occurrences.filter(o => o.status === "Completed").length;
    const overdue = occurrences.filter(o => o.isOverdue || o.status === "Overdue").length;
    const inProgress = occurrences.filter(o => 
      o.status === "In Progress" && !o.isOverdue
    ).length;
    
    return { total, completed, overdue, inProgress };
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
    if (isOverdue || status === "Overdue") {
      return "bg-red-100 text-red-800";
    }
    
    const badges = {
      Completed: "bg-green-100 text-green-800",
      "In Progress": "bg-blue-100 text-blue-800",
      Pending: "bg-yellow-100 text-yellow-800",
      "Due Today": "bg-orange-100 text-orange-800",
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

  const navigatePeriod = (direction) => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (view === "quarter") {
      newDate.setMonth(newDate.getMonth() + (direction * 3));
    } else if (view === "year") {
      newDate.setFullYear(newDate.getFullYear() + direction);
    }
    setCurrentDate(newDate);
  };

  const handleDateClick = (dateStr, dayOccurrences) => {
    setSelectedDate(dateStr);
    setSelectedOccurrences(dayOccurrences);
  };

  const navigateToObligation = (obligationId) => {
    navigate(`/compliance/${obligationId}`);
  };

  const formatDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get occurrences for a specific date - NOW USES due_date NOT instance_date
  const getOccurrencesForDate = (year, month, day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    
    return occurrences.filter((occurrence) => {
      // Use due_date for display on calendar, not instance_date
      const dueDate = new Date(occurrence.due_date);
      return dueDate.getFullYear() === year && 
             dueDate.getMonth() === month && 
             dueDate.getDate() === day;
    });
  };

  const renderMonthView = () => {
    const { daysInMonth, firstDayOfMonth } = getDaysInMonth(currentDate);
    const days = [];
    const monthName = currentDate.toLocaleString("default", { month: "long" });
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Empty cells for days before month starts
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 sm:h-20 md:h-24 bg-gray-50/50"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayOccurrences = getOccurrencesForDate(year, month, day);
      const hasOverdue = dayOccurrences.some(o => o.isOverdue);

      // Check if today
      const today = new Date();
      const isToday = 
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === day;

      // Check if date is in the past
      const isPast = new Date(year, month, day) < new Date(today.setHours(0, 0, 0, 0));

      days.push(
        <div
          key={day}
          onClick={() => handleDateClick(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, dayOccurrences)}
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
            {dayOccurrences.length > 0 && (
              <span className={`text-[9px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded-full ${
                hasOverdue ? "bg-red-100 text-red-800" : "bg-[#8cc63e] text-white"
              }`}>
                {dayOccurrences.length}
              </span>
            )}
          </div>
          <div className="mt-0.5 sm:mt-1 space-y-0.5 max-h-10 sm:max-h-14 md:max-h-16 overflow-y-auto">
            {dayOccurrences.slice(0, 2).map((occurrence) => (
              <div 
                key={occurrence.id} 
                className={`text-[8px] sm:text-xs truncate ${occurrence.isOverdue ? "bg-red-50 rounded px-0.5" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToObligation(occurrence.obligation?.obligation_id);
                }}
              >
                <span className={`font-medium ${occurrence.isOverdue ? "text-red-600" : ""}`}>
                  {occurrence.obligation?.name || "Unknown"}
                </span>
                <span
                  className={`ml-0.5 sm:ml-1 px-0.5 sm:px-1 text-[7px] sm:text-xs rounded ${getStatusBadge(occurrence.status, occurrence.isOverdue)}`}
                >
                  {occurrence.isOverdue ? "Overdue" : occurrence.status}
                </span>
              </div>
            ))}
            {dayOccurrences.length > 2 && (
              <div className="text-[7px] sm:text-xs text-gray-500">
                +{dayOccurrences.length - 2} more
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
              onClick={() => navigatePeriod(-1)}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs sm:text-sm text-gray-700"
            >
              ← Prev
            </button>
            <button
              onClick={() => navigatePeriod(1)}
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

    const months = quarterMonths[quarter];
    const monthIndices = [quarter * 3, quarter * 3 + 1, quarter * 3 + 2];

    // Group occurrences by month using due_date
    const groupedByMonth = {};
    monthIndices.forEach((monthIdx, index) => {
      const monthName = quarterMonths[quarter][index];
      const monthOccurrences = occurrences.filter(occ => {
        const dueDate = new Date(occ.due_date);
        return dueDate.getFullYear() === year && 
               dueDate.getMonth() === monthIdx;
      });
      groupedByMonth[monthName] = monthOccurrences;
    });

    return (
      <div>
        <div className="flex flex-wrap justify-between items-center mb-3 sm:mb-4 gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            {quarters[quarter]} {year}
          </h3>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            <button
              onClick={() => navigatePeriod(-1)}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs sm:text-sm text-gray-700"
            >
              ← Prev
            </button>
            <button
              onClick={() => navigatePeriod(1)}
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
            const monthOccurrences = groupedByMonth[monthName] || [];
            const completed = monthOccurrences.filter(
              (o) => o.status === "Completed"
            ).length;
            const overdue = monthOccurrences.filter(
              (o) => o.isOverdue
            ).length;
            const inProgress = monthOccurrences.filter(
              (o) => o.status === "In Progress" && !o.isOverdue
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
                      {monthOccurrences.length}
                    </span>
                  </div>
                </div>
                {monthOccurrences.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500 text-center py-3 sm:py-4">No obligations</p>
                ) : (
                  <>
                    <div className="flex justify-between text-xs sm:text-sm mb-1 sm:mb-2">
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-medium text-green-600">
                        {completed}/{monthOccurrences.length}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm mb-1 sm:mb-2">
                      <span className="text-gray-600">In Progress:</span>
                      <span className="font-medium text-blue-600">
                        {inProgress}/{monthOccurrences.length}
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
                          width: `${(completed / monthOccurrences.length) * 100}%`,
                          backgroundColor: "#8cc63e"
                        }}
                      ></div>
                    </div>
                    <div className="mt-2 sm:mt-3 space-y-1 sm:space-y-2 max-h-36 sm:max-h-48 overflow-y-auto">
                      {monthOccurrences.slice(0, 3).map((occurrence) => (
                        <div
                          key={occurrence.id}
                          className={`rounded p-1.5 sm:p-2 hover:bg-gray-100 transition-colors cursor-pointer ${
                            occurrence.isOverdue ? "bg-red-50 border-l-2 sm:border-l-4 border-l-red-500" : "bg-gray-50"
                          }`}
                          onClick={() => navigateToObligation(occurrence.obligation?.obligation_id)}
                        >
                          <div className="flex justify-between items-start">
                            <p className={`text-[10px] sm:text-xs font-medium truncate flex-1 ${
                              occurrence.isOverdue ? "text-red-600" : "text-gray-900"
                            }`}>
                              {occurrence.obligation?.name}
                            </p>
                            <span
                              className={`ml-1 px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-xs rounded ${getStatusBadge(occurrence.status, occurrence.isOverdue)}`}
                            >
                              {occurrence.isOverdue ? "Overdue" : occurrence.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                            <span
                              className={`px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[10px] rounded ${getTypeBadge(occurrence.obligation?.frequency)}`}
                            >
                              {occurrence.obligation?.frequency}
                            </span>
                            <span
                              className={`px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[10px] rounded ${getDomainColor(occurrence.obligation?.domain)}`}
                            >
                              {occurrence.obligation?.domain}
                            </span>
                            {occurrence.isOverdue && (
                              <span className="px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[10px] rounded bg-red-200 text-red-800">
                                ⚠ Overdue
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {monthOccurrences.length > 3 && (
                        <div className="text-[9px] sm:text-xs text-gray-500 text-center py-0.5 sm:py-1">
                          +{monthOccurrences.length - 3} more
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

    // Group occurrences by month using due_date
    const groupedByMonth = {};
    months.forEach((month, index) => {
      const monthOccurrences = occurrences.filter(occ => {
        const dueDate = new Date(occ.due_date);
        return dueDate.getFullYear() === year && 
               dueDate.getMonth() === index;
      });
      groupedByMonth[month] = monthOccurrences;
    });

    // Get current month for highlighting
    const currentMonth = new Date().getMonth();

    return (
      <div>
        <div className="flex flex-wrap justify-between items-center mb-3 sm:mb-4 gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Year {year}</h3>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            <button
              onClick={() => navigatePeriod(-1)}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs sm:text-sm text-gray-700"
            >
              ← Prev
            </button>
            <button
              onClick={() => navigatePeriod(1)}
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
            const monthOccurrences = groupedByMonth[monthName] || [];
            const completed = monthOccurrences.filter(
              (o) => o.status === "Completed"
            ).length;
            const overdue = monthOccurrences.filter(
              (o) => o.isOverdue
            ).length;
            const inProgress = monthOccurrences.filter(
              (o) => o.status === "In Progress" && !o.isOverdue
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
                    {monthOccurrences.length > 0 && (
                      <span className="text-[9px] sm:text-xs text-white px-1 sm:px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#8cc63e" }}>
                        {monthOccurrences.length}
                      </span>
                    )}
                  </div>
                </div>
                {monthOccurrences.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500 text-center py-2 sm:py-4">No obligations</p>
                ) : (
                  <>
                    <div className="flex justify-between text-[10px] sm:text-sm">
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-medium text-green-600">
                        {completed}/{monthOccurrences.length}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] sm:text-sm">
                      <span className="text-gray-600">In Progress:</span>
                      <span className="font-medium text-blue-600">
                        {inProgress}/{monthOccurrences.length}
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
                          width: `${(completed / monthOccurrences.length) * 100}%`,
                          backgroundColor: "#8cc63e"
                        }}
                      ></div>
                    </div>
                    <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1 max-h-24 sm:max-h-32 overflow-y-auto">
                      {monthOccurrences.slice(0, 2).map((occurrence) => (
                        <div 
                          key={occurrence.id} 
                          className={`text-[9px] sm:text-xs truncate cursor-pointer ${occurrence.isOverdue ? "bg-red-50 rounded px-0.5" : ""}`}
                          onClick={() => navigateToObligation(occurrence.obligation?.obligation_id)}
                        >
                          <span className={`font-medium ${occurrence.isOverdue ? "text-red-600" : ""}`}>
                            {occurrence.obligation?.name || "Unknown"}
                          </span>
                          <span
                            className={`ml-0.5 sm:ml-1 px-0.5 sm:px-1 text-[8px] sm:text-xs rounded ${getStatusBadge(occurrence.status, occurrence.isOverdue)}`}
                          >
                            {occurrence.isOverdue ? "Overdue" : occurrence.status}
                          </span>
                        </div>
                      ))}
                      {monthOccurrences.length > 2 && (
                        <div className="text-[8px] sm:text-xs text-gray-500">
                          +{monthOccurrences.length - 2} more
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

  // Modal for showing occurrences on a selected date
  const renderModal = () => {
    if (!selectedDate || selectedOccurrences.length === 0) return null;

    const hasOverdue = selectedOccurrences.some(o => o.isOverdue);

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
                setSelectedOccurrences([]);
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
              {selectedOccurrences.map((occurrence) => (
                <div
                  key={occurrence.id}
                  className={`border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer ${
                    occurrence.isOverdue ? "border-red-300 bg-red-50/50" : "bg-white"
                  }`}
                  onClick={() => {
                    setSelectedDate(null);
                    setSelectedOccurrences([]);
                    navigateToObligation(occurrence.obligation?.obligation_id);
                  }}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div className="flex-1 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <p className={`text-sm sm:text-base font-medium ${occurrence.isOverdue ? "text-red-600" : "text-gray-900"}`}>
                          {occurrence.obligation?.name || "Unknown Obligation"}
                        </p>
                        {occurrence.isOverdue && (
                          <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded-full bg-red-100 text-red-800">
                            ⚠ Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                        {occurrence.obligation?.obligation_id || ""} • {occurrence.obligation?.domain || ""}
                      </p>
                      <div className="flex flex-wrap gap-1 sm:gap-2 mt-1 sm:mt-2">
                        <span
                          className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs rounded-full ${getStatusBadge(occurrence.status, occurrence.isOverdue)}`}
                        >
                          {occurrence.isOverdue ? "Overdue" : occurrence.status}
                        </span>
                        <span
                          className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs rounded-full ${getTypeBadge(occurrence.obligation?.frequency)}`}
                        >
                          {occurrence.obligation?.frequency || "N/A"}
                        </span>
                        {occurrence.obligation?.mandatory && (
                          <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs rounded-full bg-red-100 text-red-800">
                            Mandatory
                          </span>
                        )}
                      </div>
                      {occurrence.obligation?.description && (
                        <p className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2">{occurrence.obligation?.description}</p>
                      )}
                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-0.5 sm:gap-y-1 mt-1 sm:mt-2 text-[10px] sm:text-xs">
                        <div>
                          <span className="font-medium text-gray-500">Responsible:</span>
                          <span className="ml-0.5 sm:ml-1 text-gray-700">{occurrence.obligation?.responsible}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Accountable:</span>
                          <span className="ml-0.5 sm:ml-1 text-gray-700">{occurrence.obligation?.accountable}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Weight:</span>
                          <span className="ml-0.5 sm:ml-1 text-gray-700">{occurrence.obligation?.compliance_weight}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Clause:</span>
                          <span className="ml-0.5 sm:ml-1 text-gray-700">{occurrence.obligation?.clause || 'N/A'}</span>
                        </div>
                        <div className="col-span-1 xs:col-span-2">
                          <span className="font-medium text-gray-500">Due Date:</span>
                          <span className={`ml-0.5 sm:ml-1 ${occurrence.isOverdue ? "text-red-600 font-bold" : "text-gray-700"}`}>
                            {new Date(occurrence.due_date).toLocaleDateString()}
                          </span>
                          {occurrence.isOverdue && (
                            <span className="ml-1 sm:ml-2 text-red-500 text-[9px] sm:text-xs">
                              (Overdue by {Math.ceil((new Date() - new Date(occurrence.due_date)) / (1000 * 60 * 60 * 24))} days)
                            </span>
                          )}
                        </div>
                        {isAdmin && occurrence.obligation?.region && (
                          <div className="col-span-1 xs:col-span-2">
                            <span className="font-medium text-gray-500">Region:</span>
                            <span className="ml-0.5 sm:ml-1 text-gray-700">{occurrence.obligation?.region}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {occurrence.obligation?.due_date_rule && (
                      <div className="text-xs text-gray-500 mt-2 sm:mt-0 sm:ml-4">
                        <p className="text-[9px] sm:text-xs text-gray-600 italic">"{occurrence.obligation?.due_date_rule}"</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <span className="text-[10px] sm:text-xs text-[#8cc63e] font-medium hover:underline">
                      Click to view details and upload evidence →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t p-3 sm:p-4 bg-gray-50">
            <button
              onClick={() => {
                setSelectedDate(null);
                setSelectedOccurrences([]);
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

  // Get stats for the current view
  const viewStats = getViewStats();

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Compliance Calendar</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
            {view === "month" && `${currentDate.toLocaleString("default", { month: "long" })} ${currentDate.getFullYear()}`}
            {view === "quarter" && `Q${Math.floor(currentDate.getMonth() / 3) + 1} ${currentDate.getFullYear()}`}
            {view === "year" && `Year ${currentDate.getFullYear()}`}
            {" - "}{viewStats.total} obligations
            {!isAdmin && userRegion && (
              <span className="ml-2 inline-flex items-center">
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  Region: {userRegion}
                </span>
              </span>
            )}
            {isAdmin && (
              <span className="ml-2 inline-flex items-center">
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                  Admin - All Regions
                </span>
              </span>
            )}
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

      {/* Stats Summary */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-2 sm:p-4 border-l-4 border-gray-400">
          <p className="text-[10px] sm:text-sm text-gray-500">Total</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{viewStats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-4 border-l-4 border-green-500">
          <p className="text-[10px] sm:text-sm text-gray-500">Completed</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600">{viewStats.completed}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-4 border-l-4 border-blue-500">
          <p className="text-[10px] sm:text-sm text-gray-500">In Progress</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600">{viewStats.inProgress}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-4 border-l-4 border-red-500 bg-red-50">
          <p className="text-[10px] sm:text-sm text-red-600 font-medium">⚠ Overdue</p>
          <p className="text-lg sm:text-2xl font-bold text-red-600">{viewStats.overdue}</p>
        </div>
      </div>

      {/* Legend */}
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
            <span className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-xs bg-blue-100 text-blue-800 rounded">In Progress</span>
            <span className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-xs bg-red-100 text-red-800 rounded font-bold">⚠ Overdue</span>
          </div>
        </div>
      </div>

      {/* Calendar View */}
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