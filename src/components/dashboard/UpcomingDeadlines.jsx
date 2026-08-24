import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../api/supabase";

const UpcomingDeadlines = ({ userRegion, isAdmin }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [deadlines, setDeadlines] = useState([]);

  useEffect(() => {
    fetchDeadlines();
  }, [userRegion, isAdmin]);

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

  const fetchDeadlines = async () => {
    setLoading(true);
    try {
      // Get region ID if not admin
      let regionId = null;
      if (!isAdmin && userRegion) {
        regionId = await getRegionId(userRegion);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get date range for next 30 days
      const nextMonth = new Date(today);
      nextMonth.setDate(nextMonth.getDate() + 30);
      const nextMonthStr = nextMonth.toISOString().split('T')[0];

      // Build query for compliance_progress
      let progressQuery = supabase
        .from('compliance_progress')
        .select(`
          id,
          obligation_id,
          region_id,
          occurrence_date,
          calculated_due_date,
          status,
          comments,
          evidence_id,
          uploaded_by,
          updated_by,
          created_at,
          updated_at,
          obligation:compliance_obligations(
            obligation_id,
            obligation_name,
            domain,
            frequency,
            description,
            responsible,
            accountable,
            compliance_weight,
            evidence_required,
            evidence_type,
            mandatory,
            policy,
            clause,
            due_date_rule
          )
        `)
        .order('calculated_due_date', { ascending: true, nulls_last: true });

      // Filter by region if not admin
      if (regionId) {
        progressQuery = progressQuery.eq('region_id', regionId);
      }

      // Only get upcoming deadlines (not closed)
      progressQuery = progressQuery.neq('status', 'Closed');

      const { data: progressData, error: progressError } = await progressQuery;

      if (progressError) {
        console.error('Progress query error:', progressError);
        throw progressError;
      }

      if (!progressData || progressData.length === 0) {
        setDeadlines([]);
        setLoading(false);
        return;
      }

      // Filter deadlines: only include those with calculated_due_date >= today and <= next 30 days
      const upcomingDeadlines = progressData.filter(item => {
        if (!item.calculated_due_date) return false;
        const dueDate = new Date(item.calculated_due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate >= today && dueDate <= nextMonth;
      });

      // Map to the expected format
      const mappedDeadlines = upcomingDeadlines.map(item => {
        const obligation = item.obligation || {};
        return {
          id: item.id,
          obligation_id: item.obligation_id,
          obligation: {
            obligation_id: obligation.obligation_id || item.obligation_id,
            name: obligation.obligation_name || 'Unknown Obligation',
            domain: obligation.domain || 'N/A',
            frequency: obligation.frequency || 'N/A',
          },
          due_date: item.calculated_due_date,
          occurrence_date: item.occurrence_date,
          status: item.status,
          comments: item.comments,
          evidence_id: item.evidence_id,
          region_id: item.region_id,
        };
      });

      // Sort by due date
      mappedDeadlines.sort((a, b) => {
        const dateA = new Date(a.due_date);
        const dateB = new Date(b.due_date);
        return dateA - dateB;
      });

      // Limit to 10 items
      setDeadlines(mappedDeadlines.slice(0, 10));

    } catch (error) {
      console.error("Error fetching deadlines:", error);
      setDeadlines([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Open': "bg-gray-100 text-gray-800",
      'Submitted/Under Review': "bg-yellow-100 text-yellow-800",
      'Closed': "bg-green-100 text-green-800",
      'Overdue': "bg-red-100 text-red-800",
      'Pending': "bg-blue-100 text-blue-800",
      'In Progress': "bg-blue-100 text-blue-800",
      'Due Today': "bg-orange-100 text-orange-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status) => {
    const icons = {
      'Open': '🟡',
      'Submitted/Under Review': '🟠',
      'Closed': '🟢',
      'Overdue': '🔴',
      'Pending': '🔵',
      'In Progress': '🔵',
      'Due Today': '🟠',
    };
    return icons[status] || '⚪';
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate - today;
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

  const getDueDateColor = (dueDate) => {
    if (!dueDate) return "text-gray-500";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "text-red-600 font-medium";
    if (diffDays === 0) return "text-orange-600 font-medium";
    if (diffDays <= 7) return "text-yellow-600";
    return "text-green-600";
  };

  const getPriorityBadge = (dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span className="text-[10px] font-bold text-red-600">⚠️ OVERDUE</span>;
    } else if (diffDays === 0) {
      return <span className="text-[10px] font-bold text-orange-600">🔴 DUE TODAY</span>;
    } else if (diffDays <= 3) {
      return <span className="text-[10px] font-bold text-orange-500">🔶 URGENT</span>;
    } else if (diffDays <= 7) {
      return <span className="text-[10px] font-bold text-yellow-600">🟡 SOON</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
            Upcoming Deadlines
          </h3>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full animate-pulse">
            Loading...
          </span>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-lg p-4 h-16"></div>
          ))}
        </div>
      </div>
    );
  }

  if (deadlines.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
          Upcoming Deadlines
        </h3>
        <div className="text-center py-6 md:py-8 text-gray-500">
          <svg className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm md:text-base">No upcoming deadlines</p>
          <p className="text-xs text-gray-400 mt-1">All caught up! 🎉</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
          Upcoming Deadlines
        </h3>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {deadlines.length} items
        </span>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {deadlines.map((deadline, index) => {
          const isOverdue = deadline.due_date && new Date(deadline.due_date) < new Date();
          const isDueToday = deadline.due_date && 
            new Date(deadline.due_date).toDateString() === new Date().toDateString();
          
          return (
            <div
              key={deadline.id || index}
              className="flex flex-col gap-1 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border-l-4"
              style={{
                borderLeftColor: 
                  isOverdue ? '#ef4444' :
                  isDueToday ? '#f97316' :
                  deadline.status === 'Closed' ? '#22c55e' :
                  deadline.status === 'Submitted/Under Review' ? '#eab308' :
                  '#9ca3af'
              }}
              onClick={() => {
                const obligationId = deadline.obligation?.obligation_id || deadline.obligation_id;
                if (obligationId) {
                  navigate(`/compliance/${obligationId}`);
                }
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 break-words">
                    {deadline.obligation?.name || deadline.name || "Unknown Obligation"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {deadline.obligation?.obligation_id || deadline.obligation_id || ""} •{" "}
                    {deadline.obligation?.domain || deadline.domain || ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {getPriorityBadge(deadline.due_date)}
                  <span className="text-sm">{getStatusIcon(deadline.status)}</span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(deadline.status)}`}
                  >
                    {deadline.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-1">
                <p className={`text-xs ${getDueDateColor(deadline.due_date)}`}>
                  {formatDate(deadline.due_date)}
                </p>
                <div className="flex items-center gap-2">
                  {deadline.evidence_id && (
                    <span className="text-[10px] text-green-600">📎 Evidence</span>
                  )}
                  {deadline.occurrence_date && (
                    <span className="text-[10px] text-gray-400">
                      Period: {new Date(deadline.occurrence_date).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Footer with navigation */}
      {deadlines.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <button 
            onClick={() => navigate('/compliance')}
            className="text-xs text-[#8cc63e] hover:underline font-medium"
          >
            View all obligations →
          </button>
        </div>
      )}
    </div>
  );
};

export default UpcomingDeadlines;