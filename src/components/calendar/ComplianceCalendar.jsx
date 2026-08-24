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
  const [progressRecords, setProgressRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedRecords, setSelectedRecords] = useState([]);

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

  // Fetch progress records with region filtering
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

      // ---------------------------------------------------------
      // 1. QUERY compliance_progress WITH DATE FILTER
      // ---------------------------------------------------------
      let progressQuery = supabase
        .from('compliance_progress')
        .select(`
          id,
          obligation_id,
          region_id,
          occurrence_date,
          calculated_due_date,
          status,
          evidence_id,
          uploaded_by,
          updated_by,
          comments,
          created_at,
          updated_at
        `)
        .gte('calculated_due_date', startDate)
        .lte('calculated_due_date', endDate)
        .order('calculated_due_date', { ascending: true });

      // Filter by region for non-admin users
      if (!isAdmin && regionId) {
        progressQuery = progressQuery.eq('region_id', regionId);
      }

      const { data: progressData, error: progressError } = await progressQuery;
      if (progressError) throw progressError;

      if (!progressData || progressData.length === 0) {
        setProgressRecords([]);
        setLoading(false);
        return;
      }

      // ---------------------------------------------------------
      // 2. Get obligation details for these records
      // ---------------------------------------------------------
      const obligationIds = [...new Set(progressData.map(p => p.obligation_id))];
      
      const { data: obligations, error: obligationsError } = await supabase
        .from('compliance_obligations')
        .select('*')
        .in('obligation_id', obligationIds);

      if (obligationsError) throw obligationsError;

      // Create map for quick lookup
      const obligationMap = {};
      obligations.forEach(ob => {
        obligationMap[ob.obligation_id] = ob;
      });

      // ---------------------------------------------------------
      // 3. Get region names for region_ids
      // ---------------------------------------------------------
      const regionIds = [...new Set(progressData.map(p => p.region_id).filter(Boolean))];
      let regionMap = {};
      
      if (regionIds.length > 0) {
        const { data: regions, error: regionsError } = await supabase
          .from('regions')
          .select('id, name')
          .in('id', regionIds);
        
        if (!regionsError && regions) {
          regions.forEach(r => {
            regionMap[r.id] = r.name;
          });
        }
      }

      // ---------------------------------------------------------
      // 4. Process data - combine progress with obligation details
      // ---------------------------------------------------------
      const processedData = progressData.map(progress => {
        const obligation = obligationMap[progress.obligation_id] || {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(progress.calculated_due_date);
        dueDate.setHours(0, 0, 0, 0);
        const isOverdue = dueDate < today && progress.status !== "Closed";
        
        // Map status to calendar-friendly status
        let displayStatus = progress.status;
        if (isOverdue && progress.status === "Open") {
          displayStatus = "Overdue";
        }

        return {
          ...progress,
          // Obligation details
          obligation_name: obligation.obligation_name || 'Unknown',
          obligation_id_text: obligation.obligation_id || progress.obligation_id,
          domain: obligation.domain || '',
          frequency: obligation.frequency || '',
          description: obligation.description || '',
          responsible: obligation.responsible || '',
          accountable: obligation.accountable || '',
          compliance_weight: obligation.compliance_weight || 1,
          evidence_required: obligation.evidence_required || false,
          evidence_type: obligation.evidence_type || '',
          mandatory: obligation.mandatory || false,
          region_name: regionMap[progress.region_id] || obligation.region || '',
          clause: obligation.clause || '',
          due_date_rule: obligation.due_date_rule || '',
          obligation_type: obligation.obligation_type || '',
          // Progress fields
          progress_id: progress.id,
          progress_status: progress.status,
          // Calculated fields
          isOverdue,
          displayStatus,
          due_date: progress.calculated_due_date
        };
      });

      setProgressRecords(processedData);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats for the current view
  const getViewStats = () => {
    const total = progressRecords.length;
    const completed = progressRecords.filter(o => o.status === "Closed").length;
    const overdue = progressRecords.filter(o => o.isOverdue).length;
    const inProgress = progressRecords.filter(o => 
      o.status === "Submitted/Under Review" && !o.isOverdue
    ).length;
    
    return { total, completed, overdue, inProgress };
  };

  const getTypeBadge = (frequency) => {
    const badges = {
      Monthly: "bg-green-100 text-green-800",
      Quarterly: "bg-emerald-100 text-emerald-800",
      "Bi-Annual": "bg-teal-100 text-teal-800",
      Annual: "bg-lime-100 text-lime-800",
      "Event Based": "bg-amber-100 text-amber-800",
      Continuous: "bg-cyan-100 text-cyan-800",
      "Yearly": "bg-lime-100 text-lime-800",
    };
    return badges[frequency] || "bg-gray-100 text-gray-800";
  };

  const getStatusBadge = (status, isOverdue) => {
    if (isOverdue || status === "Overdue") {
      return "bg-red-100 text-red-800";
    }
    
    const badges = {
      Closed: "bg-green-100 text-green-800",
      "Submitted/Under Review": "bg-blue-100 text-blue-800",
      Open: "bg-yellow-100 text-yellow-800",
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

  const handleDateClick = (dateStr, dayRecords) => {
    setSelectedDate(dateStr);
    setSelectedRecords(dayRecords);
  };

  const navigateToObligation = (obligationId) => {
    if (obligationId) {
      navigate(`/compliance/${obligationId}`);
    }
  };

  // Get records for a specific date - uses calculated_due_date
  const getRecordsForDate = (year, month, day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    
    return progressRecords.filter((record) => {
      if (!record.due_date) return false;
      const dueDate = new Date(record.due_date);
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
      const dayRecords = getRecordsForDate(year, month, day);
      const hasOverdue = dayRecords.some(o => o.isOverdue);

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
          onClick={() => handleDateClick(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, dayRecords)}
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
            {dayRecords.length > 0 && (
              <span className={`text-[9px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded-full ${
                hasOverdue ? "bg-red-100 text-red-800" : "bg-[#8cc63e] text-white"
              }`}>
                {dayRecords.length}
              </span>
            )}
          </div>
          <div className="mt-0.5 sm:mt-1 space-y-0.5 max-h-10 sm:max-h-14 md:max-h-16 overflow-y-auto">
            {dayRecords.slice(0, 2).map((record) => (
              <div 
                key={record.id} 
                className={`text-[8px] sm:text-xs truncate ${record.isOverdue ? "bg-red-50 rounded px-0.5" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToObligation(record.obligation_id_text);
                }}
              >
                <span className={`font-medium ${record.isOverdue ? "text-red-600" : ""}`}>
                  {record.obligation_name || "Unknown"}
                </span>
                <span
                  className={`ml-0.5 sm:ml-1 px-0.5 sm:px-1 text-[7px] sm:text-xs rounded ${getStatusBadge(record.status, record.isOverdue)}`}
                >
                  {record.isOverdue ? "Overdue" : record.status}
                </span>
              </div>
            ))}
            {dayRecords.length > 2 && (
              <div className="text-[7px] sm:text-xs text-gray-500">
                +{dayRecords.length - 2} more
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

    // Group records by month using calculated_due_date
    const groupedByMonth = {};
    monthIndices.forEach((monthIdx, index) => {
      const monthName = quarterMonths[quarter][index];
      const monthRecords = progressRecords.filter(record => {
        if (!record.due_date) return false;
        const dueDate = new Date(record.due_date);
        return dueDate.getFullYear() === year && 
               dueDate.getMonth() === monthIdx;
      });
      groupedByMonth[monthName] = monthRecords;
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
            const monthRecords = groupedByMonth[monthName] || [];
            const completed = monthRecords.filter(
              (o) => o.status === "Closed"
            ).length;
            const overdue = monthRecords.filter(
              (o) => o.isOverdue
            ).length;
            const inProgress = monthRecords.filter(
              (o) => o.status === "Submitted/Under Review" && !o.isOverdue
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
                      {monthRecords.length}
                    </span>
                  </div>
                </div>
                {monthRecords.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500 text-center py-3 sm:py-4">No obligations</p>
                ) : (
                  <>
                    <div className="flex justify-between text-xs sm:text-sm mb-1 sm:mb-2">
                      <span className="text-gray-600">Closed:</span>
                      <span className="font-medium text-green-600">
                        {completed}/{monthRecords.length}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm mb-1 sm:mb-2">
                      <span className="text-gray-600">In Progress:</span>
                      <span className="font-medium text-blue-600">
                        {inProgress}/{monthRecords.length}
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
                          width: `${(completed / monthRecords.length) * 100}%`,
                          backgroundColor: "#8cc63e"
                        }}
                      ></div>
                    </div>
                    <div className="mt-2 sm:mt-3 space-y-1 sm:space-y-2 max-h-36 sm:max-h-48 overflow-y-auto">
                      {monthRecords.slice(0, 3).map((record) => (
                        <div
                          key={record.id}
                          className={`rounded p-1.5 sm:p-2 hover:bg-gray-100 transition-colors cursor-pointer ${
                            record.isOverdue ? "bg-red-50 border-l-2 sm:border-l-4 border-l-red-500" : "bg-gray-50"
                          }`}
                          onClick={() => navigateToObligation(record.obligation_id_text)}
                        >
                          <div className="flex justify-between items-start">
                            <p className={`text-[10px] sm:text-xs font-medium truncate flex-1 ${
                              record.isOverdue ? "text-red-600" : "text-gray-900"
                            }`}>
                              {record.obligation_name || "Unknown"}
                            </p>
                            <span
                              className={`ml-1 px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-xs rounded ${getStatusBadge(record.status, record.isOverdue)}`}
                            >
                              {record.isOverdue ? "Overdue" : record.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                            <span
                              className={`px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[10px] rounded ${getTypeBadge(record.frequency)}`}
                            >
                              {record.frequency || "N/A"}
                            </span>
                            <span
                              className={`px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[10px] rounded ${getDomainColor(record.domain)}`}
                            >
                              {record.domain || "N/A"}
                            </span>
                            {record.isOverdue && (
                              <span className="px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[10px] rounded bg-red-200 text-red-800">
                                ⚠ Overdue
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {monthRecords.length > 3 && (
                        <div className="text-[9px] sm:text-xs text-gray-500 text-center py-0.5 sm:py-1">
                          +{monthRecords.length - 3} more
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

    // Group records by month using calculated_due_date
    const groupedByMonth = {};
    months.forEach((month, index) => {
      const monthRecords = progressRecords.filter(record => {
        if (!record.due_date) return false;
        const dueDate = new Date(record.due_date);
        return dueDate.getFullYear() === year && 
               dueDate.getMonth() === index;
      });
      groupedByMonth[month] = monthRecords;
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
            const monthRecords = groupedByMonth[monthName] || [];
            const completed = monthRecords.filter(
              (o) => o.status === "Closed"
            ).length;
            const overdue = monthRecords.filter(
              (o) => o.isOverdue
            ).length;
            const inProgress = monthRecords.filter(
              (o) => o.status === "Submitted/Under Review" && !o.isOverdue
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
                    {monthRecords.length > 0 && (
                      <span className="text-[9px] sm:text-xs text-white px-1 sm:px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#8cc63e" }}>
                        {monthRecords.length}
                      </span>
                    )}
                  </div>
                </div>
                {monthRecords.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500 text-center py-2 sm:py-4">No obligations</p>
                ) : (
                  <>
                    <div className="flex justify-between text-[10px] sm:text-sm">
                      <span className="text-gray-600">Closed:</span>
                      <span className="font-medium text-green-600">
                        {completed}/{monthRecords.length}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] sm:text-sm">
                      <span className="text-gray-600">In Progress:</span>
                      <span className="font-medium text-blue-600">
                        {inProgress}/{monthRecords.length}
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
                          width: `${(completed / monthRecords.length) * 100}%`,
                          backgroundColor: "#8cc63e"
                        }}
                      ></div>
                    </div>
                    <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1 max-h-24 sm:max-h-32 overflow-y-auto">
                      {monthRecords.slice(0, 2).map((record) => (
                        <div 
                          key={record.id} 
                          className={`text-[9px] sm:text-xs truncate cursor-pointer ${record.isOverdue ? "bg-red-50 rounded px-0.5" : ""}`}
                          onClick={() => navigateToObligation(record.obligation_id_text)}
                        >
                          <span className={`font-medium ${record.isOverdue ? "text-red-600" : ""}`}>
                            {record.obligation_name || "Unknown"}
                          </span>
                          <span
                            className={`ml-0.5 sm:ml-1 px-0.5 sm:px-1 text-[8px] sm:text-xs rounded ${getStatusBadge(record.status, record.isOverdue)}`}
                          >
                            {record.isOverdue ? "Overdue" : record.status}
                          </span>
                        </div>
                      ))}
                      {monthRecords.length > 2 && (
                        <div className="text-[8px] sm:text-xs text-gray-500">
                          +{monthRecords.length - 2} more
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

  // Modal for showing records on a selected date
  const renderModal = () => {
    if (!selectedDate || selectedRecords.length === 0) return null;

    const hasOverdue = selectedRecords.some(o => o.isOverdue);

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
                setSelectedRecords([]);
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
              {selectedRecords.map((record) => (
                <div
                  key={record.id}
                  className={`border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer ${
                    record.isOverdue ? "border-red-300 bg-red-50/50" : "bg-white"
                  }`}
                  onClick={() => {
                    setSelectedDate(null);
                    setSelectedRecords([]);
                    navigateToObligation(record.obligation_id_text);
                  }}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div className="flex-1 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <p className={`text-sm sm:text-base font-medium ${record.isOverdue ? "text-red-600" : "text-gray-900"}`}>
                          {record.obligation_name || "Unknown Obligation"}
                        </p>
                        {record.isOverdue && (
                          <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded-full bg-red-100 text-red-800">
                            ⚠ Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                        {record.obligation_id_text || ""} • {record.domain || ""}
                      </p>
                      <div className="flex flex-wrap gap-1 sm:gap-2 mt-1 sm:mt-2">
                        <span
                          className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs rounded-full ${getStatusBadge(record.status, record.isOverdue)}`}
                        >
                          {record.isOverdue ? "Overdue" : record.status}
                        </span>
                        <span
                          className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs rounded-full ${getTypeBadge(record.frequency)}`}
                        >
                          {record.frequency || "N/A"}
                        </span>
                        {record.mandatory && (
                          <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs rounded-full bg-red-100 text-red-800">
                            Mandatory
                          </span>
                        )}
                      </div>
                      {record.description && (
                        <p className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2">{record.description}</p>
                      )}
                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-0.5 sm:gap-y-1 mt-1 sm:mt-2 text-[10px] sm:text-xs">
                        <div>
                          <span className="font-medium text-gray-500">Responsible:</span>
                          <span className="ml-0.5 sm:ml-1 text-gray-700">{record.responsible || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Accountable:</span>
                          <span className="ml-0.5 sm:ml-1 text-gray-700">{record.accountable || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Weight:</span>
                          <span className="ml-0.5 sm:ml-1 text-gray-700">{record.compliance_weight || 1}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Clause:</span>
                          <span className="ml-0.5 sm:ml-1 text-gray-700">{record.clause || 'N/A'}</span>
                        </div>
                        <div className="col-span-1 xs:col-span-2">
                          <span className="font-medium text-gray-500">Due Date:</span>
                          <span className={`ml-0.5 sm:ml-1 ${record.isOverdue ? "text-red-600 font-bold" : "text-gray-700"}`}>
                            {record.due_date ? new Date(record.due_date).toLocaleDateString() : 'N/A'}
                          </span>
                          {record.isOverdue && record.due_date && (
                            <span className="ml-1 sm:ml-2 text-red-500 text-[9px] sm:text-xs">
                              (Overdue by {Math.ceil((new Date() - new Date(record.due_date)) / (1000 * 60 * 60 * 24))} days)
                            </span>
                          )}
                        </div>
                        {isAdmin && record.region_name && (
                          <div className="col-span-1 xs:col-span-2">
                            <span className="font-medium text-gray-500">Region:</span>
                            <span className="ml-0.5 sm:ml-1 text-gray-700">{record.region_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {record.due_date_rule && (
                      <div className="text-xs text-gray-500 mt-2 sm:mt-0 sm:ml-4">
                        <p className="text-[9px] sm:text-xs text-gray-600 italic">"{record.due_date_rule}"</p>
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
                setSelectedRecords([]);
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
          <p className="text-[10px] sm:text-sm text-gray-500">Closed</p>
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
            <span className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-xs bg-green-100 text-green-800 rounded">Closed</span>
            <span className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-xs bg-blue-100 text-blue-800 rounded">In Progress</span>
            <span className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-xs bg-red-100 text-red-800 rounded font-bold">⚠ Overdue</span>
            <span className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-xs bg-yellow-100 text-yellow-800 rounded">Open</span>
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