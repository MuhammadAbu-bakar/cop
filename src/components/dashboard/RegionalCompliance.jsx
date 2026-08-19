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

      // Get all obligations to calculate total
      const { data: allObligations } = await supabase
        .from('obligations')
        .select('id');

      const totalObligations = allObligations?.length || 0;

      // For each region, get progress data
      const regionalPromises = regions.map(async (region) => {
        const { data: progressData, error: progressError } = await supabase
          .from('obligation_progress')
          .select('status')
          .eq('region_id', region.id);

        if (progressError) {
          console.error(`Error fetching progress for region ${region.name}:`, progressError);
          return {
            region: region.name,
            compliance: 0,
            evidence: 0,
            overdue: 0,
          };
        }

        const completed = progressData?.filter(p => p.status === 'Completed').length || 0;
        const overdue = progressData?.filter(p => p.status === 'Overdue').length || 0;
        const total = progressData?.length || 0;
        const compliance = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Calculate evidence completion for this region
        let evidenceCompletion = 0;
        if (totalObligations > 0) {
          // Get obligation IDs for this region
          const { data: regionObligations } = await supabase
            .from('obligations')
            .select('id')
            .eq('region', region.name);

          const obligationIds = regionObligations?.map(o => o.id) || [];
          
          if (obligationIds.length > 0) {
            const { data: evidenceData } = await supabase
              .from('evidence')
              .select('obligation_id')
              .in('obligation_id', obligationIds)
              .eq('region_id', region.id);

            const withEvidence = new Set(evidenceData?.map(e => e.obligation_id) || []);
            evidenceCompletion = totalObligations > 0 ? Math.round((withEvidence.size / totalObligations) * 100) : 0;
          }
        }

        return {
          region: region.name,
          compliance: compliance,
          evidence: evidenceCompletion,
          overdue: overdue,
        };
      });

      const regionalResults = await Promise.all(regionalPromises);
      regionalResults.sort((a, b) => b.compliance - a.compliance);
      setData(regionalResults);

    } catch (error) {
      console.error('Error fetching regional data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on user's region - FIXED: Check if data exists
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

  if (!filteredData || filteredData.length === 0) {
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
          No regional data available for {!isAdmin ? userRegion || 'your region' : 'any region'}
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

  const getRiskLevel = (compliance, overdue) => {
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
      {!isAdmin && filteredData.length === 1 && (
        <div className="space-y-3">
          {filteredData.map((region, index) => {
            const risk = getRiskLevel(region.compliance, region.overdue);
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
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Evidence Completion</p>
                    <p className="text-lg font-bold text-gray-900">{region.evidence}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Overdue Obligations</p>
                    <p className={`text-lg font-bold ${getOverdueColor(region.overdue)}`}>
                      {region.overdue}
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
              <thead className="bg-[#b6d981]">
                <tr>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Compliance
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Evidence
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Overdue
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Risk
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((region, index) => {
                  const risk = getRiskLevel(region.compliance, region.overdue);
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
            {filteredData.map((region, index) => {
              const risk = getRiskLevel(region.compliance, region.overdue);
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
          <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between text-[10px] text-gray-500">
            <span>Total Regions: {filteredData.length}</span>
            <span>
              Regions Below Target (&lt;80%): {
                filteredData.filter(r => r.compliance < 80).length
              }
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default RegionalCompliance;