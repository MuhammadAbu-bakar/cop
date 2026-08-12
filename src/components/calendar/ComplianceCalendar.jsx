import { useState } from "react";

const ComplianceCalendar = () => {
  const [view, setView] = useState("month"); // month, quarter, year
  const [currentDate] = useState(new Date());

  // Mock data - replace with API calls
  const obligations = [
    {
      id: 1,
      title: "Network Security Audit",
      date: "2026-07-20",
      type: "monthly",
      status: "pending",
    },
    {
      id: 2,
      title: "Data Backup Verification",
      date: "2026-07-25",
      type: "monthly",
      status: "completed",
    },
    {
      id: 3,
      title: "Access Control Review",
      date: "2026-07-30",
      type: "monthly",
      status: "pending",
    },
    {
      id: 4,
      title: "Incident Response Test",
      date: "2026-08-05",
      type: "quarterly",
      status: "pending",
    },
    {
      id: 5,
      title: "Business Continuity Plan Update",
      date: "2026-08-10",
      type: "annual",
      status: "pending",
    },
    {
      id: 6,
      title: "Vulnerability Assessment",
      date: "2026-08-15",
      type: "quarterly",
      status: "overdue",
    },
  ];

  const getTypeBadge = (type) => {
    const badges = {
      monthly: "bg-blue-100 text-blue-800",
      quarterly: "bg-purple-100 text-purple-800",
      annual: "bg-green-100 text-green-800",
      event: "bg-orange-100 text-orange-800",
    };
    return badges[type] || "bg-gray-100 text-gray-800";
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      overdue: "bg-red-100 text-red-800",
      "in-progress": "bg-blue-100 text-blue-800",
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
      const dayObligations = obligations.filter((ob) => ob.date === dateStr);

      days.push(
        <div
          key={day}
          className="h-24 border border-gray-200 p-1 hover:bg-gray-50 transition-colors"
        >
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-gray-700">{day}</span>
            {dayObligations.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                {dayObligations.length}
              </span>
            )}
          </div>
          <div className="mt-1 space-y-0.5 max-h-16 overflow-y-auto">
            {dayObligations.slice(0, 2).map((ob) => (
              <div key={ob.id} className="text-xs truncate">
                <span className="font-medium">{ob.title}</span>
                <span
                  className={`ml-1 px-1 text-xs rounded ${getStatusBadge(ob.status)}`}
                >
                  {ob.status}
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
            <button className="px-3 py-1 border rounded-md hover:bg-gray-50">
              Previous
            </button>
            <button className="px-3 py-1 border rounded-md hover:bg-gray-50">
              Next
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Compliance Calendar
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setView("month")}
            className={`px-4 py-2 rounded-md ${
              view === "month" ? "btn-primary" : "btn-secondary"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setView("quarter")}
            className={`px-4 py-2 rounded-md ${
              view === "quarter" ? "btn-primary" : "btn-secondary"
            }`}
          >
            Quarterly
          </button>
          <button
            onClick={() => setView("year")}
            className={`px-4 py-2 rounded-md ${
              view === "year" ? "btn-primary" : "btn-secondary"
            }`}
          >
            Annual
          </button>
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
            <span className="w-3 h-3 bg-green-100 border border-green-300 rounded mr-2"></span>
            <span className="text-sm text-gray-600">Annual</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 bg-orange-100 border border-orange-300 rounded mr-2"></span>
            <span className="text-sm text-gray-600">Event</span>
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
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-white rounded-lg shadow p-6">
        {view === "month" && renderMonthView()}
        {view === "quarter" && (
          <div className="text-center py-12">
            <p className="text-gray-500">Quarterly view coming soon</p>
          </div>
        )}
        {view === "year" && (
          <div className="text-center py-12">
            <p className="text-gray-500">Annual view coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplianceCalendar;
