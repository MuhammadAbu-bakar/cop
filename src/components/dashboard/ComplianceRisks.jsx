import { useState, useEffect } from "react";
import { supabase } from "../../api/supabase";

const ComplianceRisks = ({ userRegion, isAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState([]);

  useEffect(() => {
    fetchRisksData();
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

  const getRegionName = async (regionId) => {
    if (!regionId) return null;
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('name')
        .eq('id', regionId)
        .single();
      
      if (error) return null;
      return data?.name || null;
    } catch (error) {
      console.error('Error getting region name:', error);
      return null;
    }
  };

  const fetchRisksData = async () => {
    setLoading(true);
    try {
      // Get region ID
      let regionId = null;
      if (!isAdmin && userRegion) {
        regionId = await getRegionId(userRegion);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get overdue progress from compliance_progress
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

      // Get non-closed obligations with calculated_due_date in the past
      progressQuery = progressQuery.neq('status', 'Closed');

      const { data: progressData, error: progressError } = await progressQuery;

      if (progressError) {
        console.error('Progress query error:', progressError);
        throw progressError;
      }

      if (!progressData || progressData.length === 0) {
        setRisks([]);
        setLoading(false);
        return;
      }

      // Filter overdue items
      const overdueItems = progressData.filter(item => {
        if (!item.calculated_due_date) return false;
        const dueDate = new Date(item.calculated_due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today && item.status !== 'Closed';
      });

      if (overdueItems.length === 0) {
        setRisks([]);
        setLoading(false);
        return;
      }

      // Get region names for all unique region IDs
      const regionIds = [...new Set(overdueItems.map(item => item.region_id).filter(id => id))];
      const regionNameMap = {};
      
      for (const id of regionIds) {
        const name = await getRegionName(id);
        if (name) {
          regionNameMap[id] = name;
        }
      }

      // Map to risks data with severity based on compliance_weight
      const risksData = overdueItems
        .map(item => {
          const obligation = item.obligation || {};
          const weight = obligation.compliance_weight || 1;
          
          let severity = "Medium";
          if (weight >= 9) severity = "Critical";
          else if (weight >= 7) severity = "High";
          else if (weight >= 5) severity = "Medium";
          else severity = "Low";

          // Calculate days overdue
          const dueDate = new Date(item.calculated_due_date);
          dueDate.setHours(0, 0, 0, 0);
          const diffTime = today - dueDate;
          const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Get region name
          let regionName = '';
          if (item.region_id && regionNameMap[item.region_id]) {
            regionName = regionNameMap[item.region_id];
          }

          // Skip items without a valid region name
          if (!regionName) return null;

          return {
            severity: severity,
            title: `${obligation.obligation_name || 'Unknown Obligation'} — ${regionName}`,
            description: obligation.description || 'Obligation overdue',
            status: item.status,
            obligation_id: obligation.obligation_id || item.obligation_id,
            due_date: item.calculated_due_date,
            days_overdue: daysOverdue,
            compliance_weight: weight,
            domain: obligation.domain || 'N/A',
            evidence_id: item.evidence_id,
            region_id: item.region_id,
            region_name: regionName,
          };
        })
        .filter(risk => risk !== null) // Remove null entries (items without region name)
        // Sort by severity (Critical first) and then by days overdue
        .sort((a, b) => {
          const severityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
          if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[a.severity] - severityOrder[b.severity];
          }
          return b.days_overdue - a.days_overdue;
        })
        .slice(0, 5); // Limit to top 5 risks

      setRisks(risksData);

    } catch (error) {
      console.error('Error fetching risks data:', error);
      setRisks([]);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityStyles = (severity) => {
    const styles = {
      Critical: "bg-red-100 text-red-800 border-red-300",
      High: "bg-orange-100 text-orange-800 border-orange-300",
      Medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
      Low: "bg-blue-100 text-blue-800 border-blue-300",
    };
    return styles[severity] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      Critical: '🔴',
      High: '🟠',
      Medium: '🟡',
      Low: '🔵',
    };
    return icons[severity] || '⚪';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
            Top Compliance Risks
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

  if (risks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
          Top Compliance Risks
        </h3>
        <div className="text-center py-6 text-gray-500 text-sm">
          <svg className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No high-risk gaps identified</p>
          <p className="text-xs text-gray-400 mt-1">All obligations are on track ✅</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
          Top Compliance Risks
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
            {risks.filter(r => r.severity === 'Critical').length} critical
          </span>
          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
            {risks.filter(r => r.severity === 'High').length} high
          </span>
        </div>
      </div>
      
      <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto">
        {risks.map((risk, index) => (
          <div
            key={index}
            className={`border-l-4 rounded-lg p-3 sm:p-4 ${getSeverityStyles(risk.severity)} cursor-pointer hover:shadow-md transition-shadow`}
            onClick={() => {
              if (risk.obligation_id) {
                window.location.href = `/compliance/${risk.obligation_id}`;
              }
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base">{getSeverityIcon(risk.severity)}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${getSeverityStyles(risk.severity)}`}>
                    {risk.severity}
                  </span>
                  <span className="text-[10px] font-medium text-gray-500">
                    Weight: {risk.compliance_weight}
                  </span>
                  <span className="text-[10px] font-medium text-gray-500">
                    {risk.domain}
                  </span>
                  {risk.evidence_id && (
                    <span className="text-[10px] text-green-600">📎</span>
                  )}
                </div>
                <h4 className="text-sm font-medium text-gray-900 mt-0.5 break-words">
                  {risk.title}
                </h4>
                <p className="text-xs text-gray-600 mt-0.5 break-words">
                  {risk.description}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-gray-500">
                    ID: {risk.obligation_id}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[9px] rounded-full bg-gray-200 text-gray-700`}>
                    {risk.status}
                  </span>
                  <span className="text-[10px] text-red-600 font-medium">
                    {risk.days_overdue} days overdue
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Due: {formatDate(risk.due_date)}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {risks.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between text-[10px] text-gray-500">
          <span>{risks.length} risks identified</span>
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

export default ComplianceRisks;