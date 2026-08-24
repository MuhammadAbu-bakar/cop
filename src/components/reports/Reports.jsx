import { useState, useEffect } from "react";
import {
  getObligations,
  getDashboardStats,
  getComplianceByDomain,
  getRegions,
  getEvidence,
} from "../../api/compliance";
import { supabase } from "../../api/supabase";
import { useAuth } from "../../context/AuthContext";
import JSZip from "jszip";
import { toast } from 'react-toastify';

const Reports = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const userRegion = profile?.region_name || null;

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [regions, setRegions] = useState([]);
  const [stats, setStats] = useState({});
  const [domainData, setDomainData] = useState({ domains: [], compliance: [] });
  const [downloading, setDownloading] = useState(false);
  const [allEvidence, setAllEvidence] = useState([]);
  
  // Filter states
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState("");
  const [selectedClause, setSelectedClause] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  
  // Available options for filters
  const [domains, setDomains] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [allPolicies, setAllPolicies] = useState([]);
  const [clauses, setClauses] = useState([]);
  const [allClauses, setAllClauses] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  const [allRegionOptions, setAllRegionOptions] = useState([]);
  const [months] = useState([
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ]);
  const [years, setYears] = useState([]);

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

  // Get region name from region ID
  const getRegionNameById = async (regionId) => {
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

  useEffect(() => {
    fetchFilterOptions();
    fetchReportData();
  }, []);

  useEffect(() => {
    if (selectedDomain || selectedPolicy || selectedClause || selectedRegion || selectedMonth || selectedYear) {
      fetchReportData();
    }
  }, [selectedDomain, selectedPolicy, selectedClause, selectedRegion, selectedMonth, selectedYear]);

  // Cascading filter effect - Update policies, clauses based on selectedDomain
  useEffect(() => {
    if (selectedDomain) {
      updateFiltersBasedOnDomain(selectedDomain);
    } else {
      setPolicies(allPolicies);
      setClauses(allClauses);
    }
  }, [selectedDomain]);

  const fetchFilterOptions = async () => {
    try {
      // Fetch all obligations to get unique values from compliance_obligations
      const { data: obligationsData, error: obligationsError } = await supabase
        .from('compliance_obligations')
        .select('domain, clause, policy, obligation_type')
        .order('domain');

      if (obligationsError) {
        console.error('Error fetching obligations for filters:', obligationsError);
        toast.error('Failed to load filter options');
        return;
      }

      if (obligationsData) {
        const uniqueDomains = [...new Set(obligationsData.map(o => o.domain).filter(Boolean))];
        setDomains(uniqueDomains);

        const uniqueClauses = [...new Set(obligationsData.map(o => o.clause).filter(Boolean))];
        setAllClauses(uniqueClauses);
        setClauses(uniqueClauses);
      }

      // Fetch policies
      const { data: policiesData, error: policiesError } = await supabase
        .from('policies')
        .select('id, name')
        .order('name');
      
      if (policiesError) {
        console.error('Error fetching policies:', policiesError);
      } else if (policiesData) {
        setAllPolicies(policiesData);
        setPolicies(policiesData);
      }

      // Fetch regions from regions table
      const { data: regionsData, error: regionsError } = await supabase
        .from('regions')
        .select('id, name')
        .order('name');
      
      if (regionsError) {
        console.error('Error fetching regions:', regionsError);
      } else if (regionsData) {
        const regionNames = regionsData.map(r => r.name);
        setAllRegionOptions(regionNames);
        setRegionOptions(regionNames);
      }

      // Generate years
      const currentYear = new Date().getFullYear();
      const yearOptions = [];
      for (let i = currentYear - 4; i <= currentYear; i++) {
        yearOptions.push({ value: i.toString(), label: i.toString() });
      }
      setYears(yearOptions);

      toast.success('Filters loaded successfully');

    } catch (error) {
      console.error('Error fetching filter options:', error);
      toast.error('Failed to load filter options');
    }
  };

  const updateFiltersBasedOnDomain = async (domain) => {
    try {
      const { data: domainObligations, error } = await supabase
        .from('compliance_obligations')
        .select('clause, policy')
        .eq('domain', domain);

      if (error) throw error;

      if (domainObligations) {
        // Filter policies by those used in this domain
        const policyNames = [...new Set(domainObligations.map(o => o.policy).filter(Boolean))];
        const filteredPolicies = allPolicies.filter(p => policyNames.includes(p.name));
        setPolicies(filteredPolicies);

        const uniqueClauses = [...new Set(domainObligations.map(o => o.clause).filter(Boolean))];
        setClauses(uniqueClauses);

        // Clear selections that are no longer valid
        if (selectedPolicy && !filteredPolicies.some(p => p.id === selectedPolicy)) {
          setSelectedPolicy("");
        }
        if (selectedClause && !uniqueClauses.includes(selectedClause)) {
          setSelectedClause("");
        }
      }
    } catch (error) {
      console.error('Error updating filters based on domain:', error);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Build filters for getObligations
      const filters = {};
      if (selectedDomain) filters.domain = selectedDomain;
      if (selectedPolicy) filters.policy = selectedPolicy;
      if (selectedClause) filters.clause = selectedClause;
      if (selectedMonth) filters.month = selectedMonth;
      if (selectedYear) filters.year = selectedYear;

      console.log('📊 Fetching report data with filters:', filters);

      // Fetch obligations with filters
      const obligationsResult = await getObligations(filters, userRegion, isAdmin);
      
      // Fetch all required data
      const [statsData, domainData, regionsData] = await Promise.all([
        getDashboardStats(userRegion, isAdmin),
        getComplianceByDomain(userRegion, isAdmin),
        getRegions(),
      ]);

      setStats(statsData);
      setDomainData(domainData);
      setRegions(regionsData.data || []);

      // Process obligations data
      let obligationsList = obligationsResult.data || [];
      setObligations(obligationsList);

      // ---------------------------------------------------------
      // Fetch evidence properly with all filters
      // ---------------------------------------------------------
      let evidenceData = [];
      
      if (obligationsList.length > 0) {
        // Get all progress records for these obligations
        const obligationIds = obligationsList.map(o => o.obligation_id);
        
        // First, get progress records that have evidence
        let progressQuery = supabase
          .from('compliance_progress')
          .select('id, obligation_id, evidence_id, region_id, status, occurrence_date, calculated_due_date')
          .in('obligation_id', obligationIds)
          .not('evidence_id', 'is', null);

        // Apply region filter for non-admin users
        if (!isAdmin && userRegion) {
          const regionId = await getRegionId(userRegion);
          if (regionId) {
            progressQuery = progressQuery.eq('region_id', regionId);
          }
        }

        // Apply region filter if selected
        if (selectedRegion) {
          const regionId = await getRegionId(selectedRegion);
          if (regionId) {
            progressQuery = progressQuery.eq('region_id', regionId);
          }
        }

        const { data: progressData, error: progressError } = await progressQuery;

        if (progressError) {
          console.error('Error fetching progress for evidence:', progressError);
        }

        if (progressData && progressData.length > 0) {
          // Get all evidence IDs from progress
          const evidenceIds = progressData
            .map(p => p.evidence_id)
            .filter(id => id !== null);

          if (evidenceIds.length > 0) {
            // Fetch the actual evidence files
            let evidenceQuery = supabase
              .from('evidence')
              .select('*')
              .in('id', evidenceIds)
              .order('uploaded_at', { ascending: false });

            // Apply region filter
            if (selectedRegion) {
              const regionId = await getRegionId(selectedRegion);
              if (regionId) {
                evidenceQuery = evidenceQuery.eq('region_id', regionId);
              }
            } else if (!isAdmin && userRegion) {
              const regionId = await getRegionId(userRegion);
              if (regionId) {
                evidenceQuery = evidenceQuery.eq('region_id', regionId);
              }
            }

            // Apply date filters on evidence uploaded_at
            if (selectedMonth && selectedYear) {
              const year = parseInt(selectedYear);
              const month = parseInt(selectedMonth);
              const startDate = new Date(year, month - 1, 1);
              const endDate = new Date(year, month, 0);
              evidenceQuery = evidenceQuery
                .gte("uploaded_at", startDate.toISOString())
                .lte("uploaded_at", endDate.toISOString());
            } else if (selectedYear) {
              const year = parseInt(selectedYear);
              const startDate = new Date(year, 0, 1);
              const endDate = new Date(year, 11, 31);
              evidenceQuery = evidenceQuery
                .gte("uploaded_at", startDate.toISOString())
                .lte("uploaded_at", endDate.toISOString());
            }

            const { data: evidenceResult, error: evidenceError } = await evidenceQuery;

            if (evidenceError) {
              console.error('Error fetching evidence:', evidenceError);
            } else {
              evidenceData = evidenceResult || [];
            }
          }
        }
      }

      console.log(`📊 Found ${evidenceData.length} evidence files`);
      setAllEvidence(evidenceData);

      // Generate the report
      generateReport(
        obligationsList,
        statsData,
        domainData,
        regionsData.data || [],
        evidenceData,
      );
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error('Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = (
    obligationsData,
    stats,
    domains,
    regions,
    evidence,
  ) => {
    const data = generateComplianceSummary(obligationsData || obligations, stats, domains);
    setReportData(data);
  };

  // Report Generation Functions
  const generateComplianceSummary = (obligations, stats, domains) => {
    const getStatus = (item) => item.current_status || 'Open';
    
    const totalObligations = obligations.length;
    const closed = obligations.filter((o) => getStatus(o) === "Closed").length;
    const submitted = obligations.filter((o) => getStatus(o) === "Submitted/Under Review").length;
    const open = obligations.filter((o) => getStatus(o) === "Open").length;
    const overdue = obligations.filter((o) => {
      const dueDate = o.calculated_due_date;
      if (!dueDate) return false;
      return new Date(dueDate) < new Date() && getStatus(o) !== "Closed";
    }).length;

    return {
      title: "Compliance Summary Report",
      stats: stats,
      domains: domains,
      totalObligations: totalObligations,
      closed: closed,
      submitted: submitted,
      open: open,
      overdue: overdue,
      recentObligations: obligations.slice(0, 10),
      filters: {
        domain: selectedDomain,
        policy: selectedPolicy,
        clause: selectedClause,
        region: selectedRegion || (!isAdmin ? userRegion : "All Regions"),
        month: selectedMonth,
        year: selectedYear,
        userRegion: !isAdmin ? userRegion : "All Regions",
      },
    };
  };

  // Download all documents
  const downloadAllDocuments = async () => {
    if (!allEvidence || allEvidence.length === 0) {
      toast.warning("No documents found to download.");
      return;
    }

    setDownloading(true);
    try {
      const zip = new JSZip();
      const documentsFolder = zip.folder("compliance_documents");

      let downloadedCount = 0;
      const totalFiles = allEvidence.length;

      const monthLabel = selectedMonth ? months.find(m => m.value === selectedMonth)?.label : '';
      const yearLabel = selectedYear || '';

      // Filter evidence by region
      let evidenceToDownload = allEvidence;
      if (selectedRegion) {
        const regionId = await getRegionId(selectedRegion);
        if (regionId) {
          evidenceToDownload = allEvidence.filter(item => item.region_id === regionId);
        }
      } else if (!isAdmin && userRegion) {
        const regionId = await getRegionId(userRegion);
        if (regionId) {
          evidenceToDownload = allEvidence.filter(item => item.region_id === regionId);
        } else {
          toast.error("Your region could not be identified. Please contact administrator.");
          setDownloading(false);
          return;
        }
      }

      if (evidenceToDownload.length === 0) {
        toast.warning(`No documents found for ${selectedRegion || (!isAdmin ? userRegion : 'the selected filters')}.`);
        setDownloading(false);
        return;
      }

      // IMPORTANT FIX: evidence.obligation_id is the TEXT obligation_id (e.g., "FMP-027")
      // NOT the bigserial ID. So we query using obligation_id (text) field.
      const obligationTextIds = [...new Set(evidenceToDownload.map(e => e.obligation_id).filter(Boolean))];
      let obligationMap = {};
      if (obligationTextIds.length > 0) {
        const { data: obligationsData, error: obligationsError } = await supabase
          .from('compliance_obligations')
          .select('obligation_id, obligation_name, domain')
          .in('obligation_id', obligationTextIds);
        
        if (obligationsError) {
          console.error('Error fetching obligations for download:', obligationsError);
          toast.error('Failed to fetch obligation details');
        } else if (obligationsData) {
          obligationsData.forEach(ob => {
            obligationMap[ob.obligation_id] = ob;
          });
        }
      }

      // Get region names for region_ids
      const regionIds = [...new Set(evidenceToDownload.map(e => e.region_id).filter(Boolean))];
      let regionMap = {};
      if (regionIds.length > 0) {
        const { data: regionsData, error: regionsError } = await supabase
          .from('regions')
          .select('id, name')
          .in('id', regionIds);
        
        if (regionsError) {
          console.error('Error fetching regions for download:', regionsError);
        } else if (regionsData) {
          regionsData.forEach(r => {
            regionMap[r.id] = r.name;
          });
        }
      }

      // Process each evidence file
      for (const evidence of evidenceToDownload) {
        if (!evidence.file_url) continue;

        try {
          const response = await fetch(evidence.file_url);
          if (!response.ok) throw new Error(`Failed to download: ${evidence.file_name}`);

          const blob = await response.blob();

          const obligation = obligationMap[evidence.obligation_id] || {};
          const obligationId = obligation.obligation_id || evidence.obligation_id || "unknown";
          const domain = obligation.domain || "unknown";
          
          // Get region name
          let region = regionMap[evidence.region_id] || selectedRegion || userRegion || "unknown";
          
          const fileExtension = evidence.file_name.split(".").pop() || "";
          
          // Format: obligation_id_domain_region_monthyear
          let fileName = `${obligationId}`;
          
          if (domain && domain !== "unknown") {
            fileName += `_${domain.replace(/\s/g, '')}`;
          }
          
          if (region && region !== "unknown") {
            fileName += `_${region.replace(/\s/g, '')}`;
          }
          
          // Add month/year if selected
          if (selectedMonth && selectedYear) {
            const monthName = months.find(m => m.value === selectedMonth)?.label || selectedMonth;
            fileName += `_${monthName}${selectedYear}`;
          } else if (selectedYear) {
            fileName += `_${selectedYear}`;
          }
          
          fileName += `.${fileExtension}`;
          fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

          documentsFolder.file(fileName, blob);
          downloadedCount++;
        } catch (error) {
          console.error(`Error downloading ${evidence.file_name}:`, error);
        }
      }

      if (downloadedCount === 0) {
        toast.error("No documents could be downloaded.");
        setDownloading(false);
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });

      let zipFileName = `compliance_documents`;
      if (selectedRegion) {
        zipFileName += `_${selectedRegion.replace(/\s/g, '')}`;
      } else if (!isAdmin && userRegion) {
        zipFileName += `_${userRegion.replace(/\s/g, '')}`;
      }
      if (selectedDomain) zipFileName += `_${selectedDomain}`;
      if (selectedPolicy) {
        const policyName = policies.find(p => p.id === selectedPolicy)?.name || selectedPolicy;
        zipFileName += `_${policyName}`;
      }
      if (selectedClause) zipFileName += `_clause_${selectedClause}`;
      if (selectedMonth && selectedYear) {
        const monthName = months.find(m => m.value === selectedMonth)?.label || selectedMonth;
        zipFileName += `_${monthName}${selectedYear}`;
      } else if (selectedYear) {
        zipFileName += `_${selectedYear}`;
      }
      zipFileName += `_${new Date().toISOString().split("T")[0]}.zip`;
      
      zipFileName = zipFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Successfully downloaded ${downloadedCount} of ${totalFiles} documents.`);
    } catch (error) {
      console.error("Error downloading documents:", error);
      toast.error("Failed to download documents. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      Closed: "bg-green-100 text-green-800",
      "Submitted/Under Review": "bg-blue-100 text-blue-800",
      Open: "bg-yellow-100 text-yellow-800",
      Overdue: "bg-red-100 text-red-800",
      Pending: "bg-yellow-100 text-yellow-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  const clearFilters = () => {
    setSelectedDomain("");
    setSelectedPolicy("");
    setSelectedClause("");
    setSelectedRegion("");
    setSelectedMonth("");
    setSelectedYear("");
    setPolicies(allPolicies);
    setClauses(allClauses);
    setRegionOptions(allRegionOptions);
    toast.info("Filters cleared");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reports</h1>
          {!isAdmin && userRegion && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full mt-1 inline-block">
              Region: {userRegion}
            </span>
          )}
          {isAdmin && (
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full mt-1 inline-block">
              Admin - All Regions
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm sm:text-base"
          >
            Clear Filters
          </button>
          <button
            onClick={() => fetchReportData()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center text-sm sm:text-base"
          >
            <svg
              className="h-4 w-4 mr-2"
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
            Refresh Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Report Configuration */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Report Filters
            </h3>

            <div className="space-y-3 sm:space-y-4">
              <div className="border-t border-gray-200 pt-3 sm:pt-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Domain
                    </label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                    >
                      <option value="">All Domains</option>
                      {domains.map((domain) => (
                        <option key={domain} value={domain}>
                          {domain}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Policy
                    </label>
                    <select
                      value={selectedPolicy}
                      onChange={(e) => setSelectedPolicy(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                    >
                      <option value="">All Policies</option>
                      {policies.map((policy) => (
                        <option key={policy.id} value={policy.id}>
                          {policy.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Clause
                    </label>
                    <select
                      value={selectedClause}
                      onChange={(e) => setSelectedClause(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                    >
                      <option value="">All Clauses</option>
                      {clauses.map((clause) => (
                        <option key={clause} value={clause}>
                          {clause}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Region
                    </label>
                    <select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                    >
                      <option value="">All Regions</option>
                      {regionOptions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Month
                      </label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                      >
                        <option value="">All Months</option>
                        {months.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Year
                      </label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                      >
                        <option value="">All Years</option>
                        {years.map((year) => (
                          <option key={year.value} value={year.value}>
                            {year.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Download Button */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={downloadAllDocuments}
                  disabled={downloading || allEvidence.length === 0}
                  className="w-full bg-[#ff0099] text-white px-4 py-2.5 sm:py-3 rounded-md hover:bg-[#e40076] transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm sm:text-base"
                >
                  {downloading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 sm:h-5 sm:w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Downloading...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4 sm:h-5 sm:w-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Download All ({allEvidence.length})
                    </>
                  )}
                </button>
                {!isAdmin && userRegion && (
                  <p className="text-[9px] sm:text-[10px] text-green-600 text-center mt-1.5">
                    ✓ Only documents from {selectedRegion || userRegion} will be downloaded
                  </p>
                )}
                {allEvidence.length === 0 && !downloading && (
                  <p className="text-[10px] sm:text-xs text-gray-500 text-center mt-2">
                    No documents available to download
                  </p>
                )}
                {allEvidence.length > 0 && (
                  <p className="text-[9px] sm:text-[10px] text-gray-400 text-center mt-1.5">
                    Files will be named: obligation_id_domain_region_monthyear
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                {reportData?.title || "Report Preview"}
              </h3>
              {reportData?.filters && (
                <span className="text-[10px] sm:text-xs text-gray-500">
                  {reportData.filters.userRegion && `Region: ${reportData.filters.userRegion} `}
                  {reportData.filters.domain && `• Domain: ${reportData.filters.domain} `}
                  {reportData.filters.policy && `• Policy: ${reportData.filters.policy} `}
                  {reportData.filters.clause && `• Clause: ${reportData.filters.clause} `}
                  {reportData.filters.region && reportData.filters.region !== "All Regions" && `• Sub Region: ${reportData.filters.region} `}
                  {reportData.filters.month && reportData.filters.year && 
                    `• ${months.find(m => m.value === reportData.filters.month)?.label} ${reportData.filters.year}`
                  }
                </span>
              )}
            </div>

            <div className="space-y-4 sm:space-y-6">
              {/* Summary Stats */}
              {reportData && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <p className="text-[10px] sm:text-sm text-gray-500">Total Obligations</p>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">
                        {reportData.totalObligations || 0}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <p className="text-[10px] sm:text-sm text-gray-500">Compliance Rate</p>
                      <p className="text-lg sm:text-2xl font-bold text-[#8cc63e]">
                        {stats.overallCompliance || 0}%
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <p className="text-[10px] sm:text-sm text-gray-500">Closed</p>
                      <p className="text-lg sm:text-2xl font-bold text-[#8cc63e]">
                        {reportData.closed || 0}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <p className="text-[10px] sm:text-sm text-gray-500">Overdue</p>
                      <p className="text-lg sm:text-2xl font-bold text-red-600">
                        {reportData.overdue || 0}
                      </p>
                    </div>
                  </div>

                  {/* Domain Compliance */}
                  {domainData.domains && domainData.domains.length > 0 ? (
                    <div>
                      <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
                        Compliance by Domain
                      </h4>
                      <div className="space-y-2">
                        {domainData.domains.map((domain, index) => (
                          <div key={domain}>
                            <div className="flex justify-between text-[10px] sm:text-sm">
                              <span className="text-gray-600 truncate max-w-[150px] sm:max-w-none">{domain}</span>
                              <span className="font-medium">
                                {domainData.compliance[index] || 0}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                              <div
                                className={`h-1.5 sm:h-2 rounded-full ${
                                  (domainData.compliance[index] || 0) >= 80
                                    ? "bg-[#8cc63e]"
                                    : (domainData.compliance[index] || 0) >= 60
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                }`}
                                style={{
                                  width: `${domainData.compliance[index] || 0}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <p className="text-sm text-yellow-800">No domain compliance data available</p>
                    </div>
                  )}
                </>
              )}

              <div className="text-center text-[10px] sm:text-sm text-gray-500">
                <p>Compliance Summary Report</p>
                {reportData?.filters && (
                  <p className="text-[8px] sm:text-xs mt-0.5 sm:mt-1">
                    {reportData.filters.userRegion && `Region: ${reportData.filters.userRegion} `}
                    {reportData.filters.domain && `• Domain: ${reportData.filters.domain} `}
                    {reportData.filters.policy && `• Policy: ${reportData.filters.policy} `}
                    {reportData.filters.clause && `• Clause: ${reportData.filters.clause} `}
                    {reportData.filters.region && reportData.filters.region !== "All Regions" && `• Sub Region: ${reportData.filters.region} `}
                    {reportData.filters.month && reportData.filters.year && 
                      `• ${months.find(m => m.value === reportData.filters.month)?.label} ${reportData.filters.year}`
                    }
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;