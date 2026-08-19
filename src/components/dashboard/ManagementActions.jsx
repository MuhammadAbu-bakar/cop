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

      // Get overdue and in-progress from progress
      let progressQuery = supabase
        .from('obligation_progress')
        .select('obligation_id, status');

      if (regionId) {
        progressQuery = progressQuery.eq('region_id', regionId);
      }

      const { data: progressData, error: progressError } = await progressQuery;
      if (progressError) throw progressError;

      const overdueIds = progressData?.filter(p => p.status === 'Overdue').map(p => p.obligation_id) || [];
      const inProgressIds = progressData?.filter(p => p.status === 'In Progress').map(p => p.obligation_id) || [];

      const allIds = [...overdueIds, ...inProgressIds];
      
      if (allIds.length === 0) {
        setActions([]);
        setLoading(false);
        return;
      }

      const { data: obligationsData } = await supabase
        .from('obligations')
        .select('*')
        .in('id', allIds)
        .limit(5);

      if (!obligationsData) {
        setActions([]);
        setLoading(false);
        return;
      }

      const actionsData = obligationsData.map(o => {
        const isOverdue = overdueIds.includes(o.id);
        const isInProgress = inProgressIds.includes(o.id);
        
        let status = 'On Track';
        let action = `Review ${o.name}`;
        
        if (isOverdue) {
          status = 'Overdue';
          action = `Complete ${o.name}`;
        } else if (isInProgress) {
          status = 'In Progress';
          action = `Continue ${o.name}`;
        }

        return {
          action: action,
          region: o.region || 'Unknown Region',
          domain: o.domain || 'N/A',
          owner: o.responsible || 'Unassigned',
          dueDate: o.calculated_due_date || new Date().toISOString(),
          status: status,
          obligation_id: o.obligation_id,
        };
      });

      setActions(actionsData);

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
          No actions pending
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

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
          Management Action Tracker
        </h3>
        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
          {actions.filter(a => a.status === 'Overdue').length} overdue        </span>
      </div>
      
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <div className="min-w-[500px] sm:min-w-full">
          {/* Table Header */}
          <div className="grid grid-cols-5 gap-1 sm:gap-2 px-3 py-2 bg-[#b6d981] rounded-t-lg text-xs font-medium text-gray-500 uppercase">
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