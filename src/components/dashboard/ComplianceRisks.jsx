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

  const fetchRisksData = async () => {
    setLoading(true);
    try {
      // Get region ID
      let regionId = null;
      if (!isAdmin && userRegion) {
        regionId = await getRegionId(userRegion);
      }

      let progressQuery = supabase
        .from('obligation_progress')
        .select('obligation_id')
        .eq('status', 'Overdue');

      if (regionId) {
        progressQuery = progressQuery.eq('region_id', regionId);
      }

      const { data: overdueProgress, error } = await progressQuery;
      if (error) throw error;

      const overdueIds = overdueProgress?.map(p => p.obligation_id) || [];

      if (overdueIds.length === 0) {
        setRisks([]);
        setLoading(false);
        return;
      }

      const { data: overdueObligations } = await supabase
        .from('obligations')
        .select('*')
        .in('id', overdueIds)
        .gte('compliance_weight', 7)
        .limit(5);

      if (!overdueObligations || overdueObligations.length === 0) {
        setRisks([]);
        setLoading(false);
        return;
      }

      const risksData = overdueObligations.map(o => ({
        severity: o.compliance_weight >= 9 ? "Critical" : 
                 o.compliance_weight >= 7 ? "High" : "Medium",
        title: `${o.name} — ${o.region || 'Unknown Region'}`,
        description: o.description || 'Obligation overdue',
        status: o.current_status,
        obligation_id: o.obligation_id,
      }));

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
    };
    return styles[severity] || "bg-gray-100 text-gray-800 border-gray-300";
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
          No high-risk gaps identified
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
        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
          {risks.length} risks
        </span>
      </div>
      
      <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto">
        {risks.map((risk, index) => (
          <div
            key={index}
            className={`border-l-4 rounded-lg p-3 sm:p-4 ${getSeverityStyles(risk.severity)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${getSeverityStyles(risk.severity)}`}>
                    {risk.severity}
                  </span>
                  <h4 className="text-sm font-medium text-gray-900 break-words">
                    {risk.title}
                  </h4>
                </div>
                <p className="text-xs text-gray-600 mt-0.5 break-words">
                  {risk.description}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-500">
                    ID: {risk.obligation_id}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[9px] rounded-full bg-gray-200 text-gray-700`}>
                    {risk.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComplianceRisks;