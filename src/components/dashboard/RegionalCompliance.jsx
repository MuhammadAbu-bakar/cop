import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../api/supabase";

const RegionalCompliance = ({ userRegion, isAdmin }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchRegionalData();
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

  const fetchRegionalData = async () => {
    setLoading(true);
    try {
      // Build query for regions
      let query = supabase
        .from('regions')
        .select('id, name, code');

      // If not admin, only get user's region
      if (!isAdmin && userRegion) {
        query = query.eq('name', userRegion);
      }

      const { data: regions, error: regionError } = await query;

      if (regionError) throw regionError;
      if (!regions || regions.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Get today's date for filtering (only past/current obligations)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // For each region, get progress data from compliance_progress (only up to today)
      const regionalPromises = regions.map(async (region) => {
        // Get progress data for this region - only up to today
        const { data: progressData, error: progressError } = await supabase
          .from('compliance_progress')
          .select('status, obligation_id, evidence_id, calculated_due_date, occurrence_date')
          .eq('region_id', region.id)
          .lte('occurrence_date', todayStr);  // Only past/current obligations

        if (progressError) {
          console.error(`Error fetching progress for region ${region.name}:`, progressError);
          return {
            region: region.name,
            compliance: 0,
            evidence: 0,
            overdue: 0,
            totalProgress: 0,
            closed: 0,
            submitted: 0,
            inProgress: 0,
          };
        }

        // Calculate compliance: percentage of 'Closed' status
        const total = progressData?.length || 0;
        const closed = progressData?.filter(p => p.status === 'Closed').length || 0;
        const submitted = progressData?.filter(p => p.status === 'Submitted/Under Review').length || 0;
        
        // Compliance = Closed / Total (with 1 decimal place)
        const compliance = total > 0 ? Number(((closed / total) * 100).toFixed(1)) : 0;
        
        // Calculate evidence completion: percentage with evidence_id (with 1 decimal place)
        const withEvidence = progressData?.filter(p => p.evidence_id !== null).length || 0;
        const evidenceCompletion = total > 0 ? Number(((withEvidence / total) * 100).toFixed(1)) : 0;

        // Calculate overdue: obligations with calculated_due_date < today and status != 'Closed'
        const overdue = progressData?.filter(p => {
          if (p.status === 'Closed') return false;
          if (!p.calculated_due_date) return false;
          const dueDate = new Date(p.calculated_due_date);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate < today;
        }).length || 0;

        // Calculate in progress (Submitted/Under Review)
        const inProgress = progressData?.filter(p => p.status === 'Submitted/Under Review').length || 0;

        return {
          region: region.name,
          compliance: compliance,
          evidence: evidenceCompletion,
          overdue: overdue,
          totalProgress: total,
          closed: closed,
          submitted: submitted,
          inProgress: inProgress,
        };
      });

      const regionalResults = await Promise.all(regionalPromises);
      // Sort by compliance (highest first) - but keep regions with 0 at the bottom
      regionalResults.sort((a, b) => {
        if (a.totalProgress === 0 && b.totalProgress === 0) return 0;
        if (a.totalProgress === 0) return 1;
        if (b.totalProgress === 0) return -1;
        return b.compliance - a.compliance;
      });
      setData(regionalResults);

    } catch (error) {
      console.error('Error fetching regional data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on user's region
  const getFilteredData = () => {
    if (!data || data.length === 0) {
      return [];
    }
    
    if (isAdmin) {
      // Admin sees all regions
      return data;
    } else if (userRegion) {
      // Regional user only sees their own region
      return data.filter(region => region.region === userRegion);
    }
    return data;
  };

  const filteredData = getFilteredData();

  // Check if any region has data
  const hasAnyData = filteredData.some(r => r.totalProgress > 0);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
            Regional Compliance
          </h3>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full animate-pulse">
            Loading...
          </span>
        </div>
        <div className="text-center py-6 text-gray-500 text-sm">
          Loading regional data...
        </div>
      </div>
    );
  }

  if (!filteredData || filteredData.length === 0 || !hasAnyData) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
            Regional Compliance
          </h3>
          {!isAdmin && userRegion && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
              Region: {userRegion}
            </span>
          )}
          {isAdmin && (
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
              Admin - All Regions
            </span>
          )}
        </div>
        <div className="text-center py-6 text-gray-500 text-sm">
          {!isAdmin 
            ? `No compliance data available for ${userRegion || 'your region'} yet.` 
            : 'No regional compliance data available yet.'}
        </div>
      </div>
    );
  }

  const getStatusColor = (value) => {
    if (value >= 90) return "text-green-600";
    if (value >= 80) return "text-yellow-600";
    if (value >= 70) return "text-orange-600";
    return "text-red-600";
  };

  const getBarColor = (value) => {
    if (value >= 90) return "bg-green-500";
    if (value >= 80) return "bg-yellow-500";
    if (value >= 70) return "bg-orange-500";
    return "bg-red-500";
  };

  const getBarTextColor = (value) => {
    if (value >= 70) return "text-white";
    return "text-gray-700";
  };

  const getOverdueColor = (value) => {
    if (value === 0) return "text-green-600";
    if (value <= 3) return "text-yellow-600";
    if (value <= 5) return "text-orange-600";
    return "text-red-600";
  };

  const getRiskLevel = (compliance, overdue, totalProgress) => {
    // If no data, return "No Data"
    if (totalProgress === 0) return { level: "No Data", color: "bg-gray-500", dot: "⚪" };
    if (compliance >= 90 && overdue <= 3) return { level: "Low", color: "bg-green-500", dot: "🟢" };
    if (compliance >= 80 && overdue <= 5) return { level: "Medium", color: "bg-yellow-500", dot: "🟡" };
    if (compliance >= 70) return { level: "High", color: "bg-orange-500", dot: "🟠" };
    return { level: "Critical", color: "bg-red-500", dot: "🔴" };
  };

  const handleRegionClick = (regionName) => {
    if (isAdmin) {
      navigate('/compliance');
    } else if (regionName === userRegion) {
      navigate('/compliance');
    }
  };

  // Get regions with data for calculations
  const regionsWithData = filteredData.filter(r => r.totalProgress > 0);
  const totalRegionsWithData = regionsWithData.length;

  // Calculate average compliance
  const averageCompliance = totalRegionsWithData > 0 
    ? Number((regionsWithData.reduce((sum, r) => sum + r.compliance, 0) / totalRegionsWithData).toFixed(1))
    : 0;

  // Count regions below target
  const regionsBelowTarget = regionsWithData.filter(r => r.compliance < 80).length;

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
          {isAdmin ? 'Regional Compliance' : 'My Region Compliance'}
        </h3>
        {!isAdmin && userRegion && (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
            Region: {userRegion}
          </span>
        )}
        {isAdmin && (
          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
            Admin - All Regions
          </span>
        )}
      </div>
      
      {/* For Regional User - Show only their region in a card format */}
      {!isAdmin && filteredData.length === 1 && filteredData[0].totalProgress > 0 && (
        <div className="space-y-3">
          {filteredData.map((region, index) => {
            const risk = getRiskLevel(region.compliance, region.overdue, region.totalProgress);
            return (
              <div key={index} className="bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-200 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                      {region.region}
                    </h4>
                    <p className="text-xs text-gray-500">Your Region</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{risk.dot}</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      risk.level === "Low" ? "bg-green-100 text-green-700" :
                      risk.level === "Medium" ? "bg-yellow-100 text-yellow-700" :
                      risk.level === "High" ? "bg-orange-100 text-orange-700" :
                      risk.level === "No Data" ? "bg-gray-100 text-gray-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {risk.level} Risk
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-3">
                  <div>
                    <p className="text-xs text-gray-500">Compliance</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${getBarColor(region.compliance)} transition-all duration-700`}
                          style={{ width: `${region.compliance}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-bold ${getStatusColor(region.compliance)}`}>
                        {region.compliance}%
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {region.closed} of {region.totalProgress} closed
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Evidence Completion</p>
                    <p className="text-lg font-bold text-gray-900">{region.evidence}%</p>
                    <p className="text-[10px] text-gray-400">With evidence uploaded</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Overdue Obligations</p>
                    <p className={`text-lg font-bold ${getOverdueColor(region.overdue)}`}>
                      {region.overdue}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {region.submitted} under review, {region.inProgress} in progress
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => handleRegionClick(region.region)}
                    className="text-xs text-[#8cc63e] hover:underline font-medium"
                  >
                    View all obligations →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* For Admin - Show all regions in table */}
      {isAdmin && (
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-[#ff0099]">
                <tr>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-white uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-white uppercase tracking-wider">
                    Compliance
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-white uppercase tracking-wider">
                    Evidence
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-white uppercase tracking-wider">
                    Overdue
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-white uppercase tracking-wider">
                    Risk
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {regionsWithData.map((region, index) => {
                  const risk = getRiskLevel(region.compliance, region.overdue, region.totalProgress);
                  return (
                    <tr 
                      key={index} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleRegionClick(region.region)}
                    >
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs font-medium text-gray-900">
                        {region.region}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap min-w-[120px]">
                        <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getBarColor(region.compliance)} transition-all duration-700 ease-in-out flex items-center justify-end pr-1.5`}
                            style={{ width: `${region.compliance}%` }}
                          >
                            <span className={`text-[9px] font-semibold ${getBarTextColor(region.compliance)}`}>
                              {region.compliance}%
                            </span>
                          </div>
                        </div>
                        <span className="text-[8px] text-gray-400">
                          {region.closed}/{region.totalProgress}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                        {region.evidence}%
                      </td>
                      <td className={`px-2 py-1.5 whitespace-nowrap text-xs font-medium ${getOverdueColor(region.overdue)}`}>
                        {region.overdue}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-0.5">
                          <span className="text-sm">{risk.dot}</span>
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                            risk.level === "Low" ? "bg-green-100 text-green-700" :
                            risk.level === "Medium" ? "bg-yellow-100 text-yellow-700" :
                            risk.level === "High" ? "bg-orange-100 text-orange-700" :
                            risk.level === "No Data" ? "bg-gray-100 text-gray-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {risk.level}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View for Admin */}
          <div className="sm:hidden space-y-2">
            {regionsWithData.map((region, index) => {
              const risk = getRiskLevel(region.compliance, region.overdue, region.totalProgress);
              return (
                <div 
                  key={index} 
                  className="bg-gray-50 rounded-lg p-2.5 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleRegionClick(region.region)}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="font-medium text-gray-900 text-sm">{region.region}</span>
                    <span className={`text-xs font-bold ${getStatusColor(region.compliance)}`}>
                      {region.compliance}%
                    </span>
                  </div>
                  <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full ${getBarColor(region.compliance)} transition-all duration-700 ease-in-out flex items-center justify-end pr-1.5`}
                      style={{ width: `${region.compliance}%` }}
                    >
                      <span className={`text-[9px] font-semibold ${getBarTextColor(region.compliance)}`}>
                        {region.compliance}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <div className="space-y-0.5">
                      <div className="text-gray-500">Evidence: <span className="font-medium text-gray-700">{region.evidence}%</span></div>
                      <div className="text-gray-500">Overdue: <span className={`font-medium ${getOverdueColor(region.overdue)}`}>{region.overdue}</span></div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <span className="text-sm">{risk.dot}</span>
                      <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded-full ${
                        risk.level === "Low" ? "bg-green-100 text-green-700" :
                        risk.level === "Medium" ? "bg-yellow-100 text-yellow-700" :
                        risk.level === "High" ? "bg-orange-100 text-orange-700" :
                        risk.level === "No Data" ? "bg-gray-100 text-gray-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {risk.level}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Admin footer with summary */}
          {totalRegionsWithData > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap justify-between text-[10px] text-gray-500 gap-2">
              <span>Total Regions: {totalRegionsWithData}</span>
              <span>
                Regions Below Target (&lt;80%): {regionsBelowTarget}
              </span>
              <span>
                Avg Compliance: {averageCompliance}%
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RegionalCompliance;