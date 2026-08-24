import { useState, useEffect } from "react";
import { supabase } from "../../api/supabase";

const ManagementActions = ({ userRegion, isAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState([]);

  useEffect(() => {
    fetchManagementActions();
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

  const fetchManagementActions = async () => {
    setLoading(true);
    try {
      // Get region ID
      let regionId = null;
      if (!isAdmin && userRegion) {
        regionId = await getRegionId(userRegion);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get overdue and in-progress from compliance_progress
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
        `);

      if (regionId) {
        progressQuery = progressQuery.eq('region_id', regionId);
      }

      // Get all non-closed obligations
      progressQuery = progressQuery.neq('status', 'Closed');

      const { data: progressData, error: progressError } = await progressQuery;

      if (progressError) {
        console.error('Progress query error:', progressError);
        throw progressError;
      }

      if (!progressData || progressData.length === 0) {
        setActions([]);
        setLoading(false);
        return;
      }

      // Filter and categorize obligations
      const overdueItems = [];
      const inProgressItems = [];
      const onTrackItems = [];

      progressData.forEach(item => {
        const obligation = item.obligation || {};
        
        // Determine if overdue
        let isOverdue = false;
        let isInProgress = false;
        let isOnTrack = false;

        if (item.calculated_due_date) {
          const dueDate = new Date(item.calculated_due_date);
          dueDate.setHours(0, 0, 0, 0);
          
          if (dueDate < today && item.status !== 'Closed') {
            isOverdue = true;
          }
        }

        if (item.status === 'Submitted/Under Review') {
          isInProgress = true;
        }

        if (!isOverdue && !isInProgress && item.status === 'Open') {
          isOnTrack = true;
        }

        // Only include if it needs attention
        if (isOverdue || isInProgress) {
          let status = 'On Track';
          let action = `Review ${obligation.obligation_name || 'Unknown'}`;
          
          if (isOverdue) {
            status = 'Overdue';
            action = `Complete ${obligation.obligation_name || 'Unknown'}`;
          } else if (isInProgress) {
            status = 'In Progress';
            action = `Continue ${obligation.obligation_name || 'Unknown'}`;
          }

          // Get region name from region_id
          let regionName = 'Unknown Region';
          if (item.region_id) {
            // We'll fetch region names in a separate call or use the region from obligation
            regionName = obligation.region || 'Unknown Region';
          }

          actions.push({
            id: item.id,
            action: action,
            region: regionName,
            domain: obligation.domain || 'N/A',
            owner: obligation.responsible || 'Unassigned',
            dueDate: item.calculated_due_date || item.occurrence_date || new Date().toISOString(),
            status: status,
            obligation_id: obligation.obligation_id || item.obligation_id,
            obligation_name: obligation.obligation_name || 'Unknown',
            evidence_id: item.evidence_id,
            comments: item.comments,
          });
        }
      });

      // Sort: Overdue first, then In Progress
      actions.sort((a, b) => {
        if (a.status === 'Overdue' && b.status !== 'Overdue') return -1;
        if (a.status !== 'Overdue' && b.status === 'Overdue') return 1;
        if (a.status === 'In Progress' && b.status === 'On Track') return -1;
        return 0;
      });

      // Limit to 10 items
      setActions(actions.slice(0, 10));

    } catch (error) {
      console.error('Error fetching management actions:', error);
      setActions([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
            Management Action Tracker
          </h3>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full animate-pulse">
            Loading...
          </span>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-12"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
          Management Action Tracker
        </h3>
        <div className="text-center py-6 text-gray-500 text-sm">
          <svg className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No actions pending</p>
          <p className="text-xs text-gray-400 mt-1">All obligations are on track! 🎉</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      Overdue: "bg-red-100 text-red-800",
      "In Progress": "bg-blue-100 text-blue-800",
      "On Track": "bg-green-100 text-green-800",
      Completed: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status) => {
    const icons = {
      Overdue: '🔴',
      "In Progress": '🟠',
      "On Track": '🟢',
      Completed: '✅',
    };
    return icons[status] || '⚪';
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
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
      dateStr += ` (${Math.abs(diffDays)}d overdue)`;
    } else if (diffDays === 0) {
      dateStr += " (Today)";
    } else if (diffDays <= 3) {
      dateStr += ` (${diffDays}d left)`;
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
    if (diffDays <= 3) return "text-orange-500";
    if (diffDays <= 7) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
          Management Action Tracker
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
            {actions.filter(a => a.status === 'Overdue').length} overdue
          </span>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
            {actions.filter(a => a.status === 'In Progress').length} in progress
          </span>
        </div>
      </div>
      
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <div className="min-w-[600px] sm:min-w-full">
          {/* Table Header */}
          <div className="grid grid-cols-6 gap-1 sm:gap-2 px-3 py-2 bg-[#b6d981] rounded-t-lg text-xs font-medium text-gray-700 uppercase">
            <span className="col-span-1">Status</span>
            <span className="col-span-2">Action</span>
            <span className="col-span-1">Region/Domain</span>
            <span className="col-span-1">Owner</span>
            <span className="col-span-1">Due Date</span>
          </div>
          
          {/* Table Body */}
          <div className="divide-y divide-gray-100">
            {actions.map((action, index) => (
              <div 
                key={action.id || index} 
                className="grid grid-cols-6 gap-1 sm:gap-2 px-3 py-2 sm:py-3 hover:bg-gray-50 transition-colors items-center cursor-pointer"
                onClick={() => {
                  if (action.obligation_id) {
                    window.location.href = `/compliance/${action.obligation_id}`;
                  }
                }}
              >
                <span className="col-span-1">
                  <span className="text-base">{getStatusIcon(action.status)}</span>
                </span>
                <span className="col-span-2 text-xs sm:text-sm text-gray-700 truncate" title={action.action}>
                  {action.action}
                  {action.evidence_id && (
                    <span className="ml-1 text-[10px] text-green-600">📎</span>
                  )}
                </span>
                <span className="col-span-1 text-xs text-gray-500 truncate">
                  {action.region} / {action.domain}
                </span>
                <span className="col-span-1 text-xs text-gray-500 truncate">
                  {action.owner}
                </span>
                <span className="col-span-1">
                  <span className={`text-xs ${getDueDateColor(action.dueDate)}`}>
                    {formatDate(action.dueDate)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      {actions.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between text-[10px] text-gray-500">
          <span>{actions.length} actions pending</span>
          <button 
            onClick={() => window.location.href = '/compliance'}
            className="text-[#8cc63e] hover:underline font-medium"
          >
            View all →
          </button>
        </div>
      )}
    </div>
  );
};

export default ManagementActions;