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

const Reports = () => {
  // Removed useNavigate since it's not needed
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const userRegion = profile?.region_name || null;

  const [reportType, setReportType] = useState("compliance-summary");
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
  const [selectedSubRegion, setSelectedSubRegion] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  
  // Available options for filters
  const [domains, setDomains] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [allPolicies, setAllPolicies] = useState([]);
  const [clauses, setClauses] = useState([]);
  const [allClauses, setAllClauses] = useState([]);
  const [subRegions, setSubRegions] = useState([]);
  const [allSubRegions, setAllSubRegions] = useState([]);
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

  useEffect(() => {
    fetchFilterOptions();
    fetchReportData();
  }, []);

  useEffect(() => {
    if (selectedDomain || selectedPolicy || selectedClause || selectedSubRegion || selectedMonth || selectedYear) {
      fetchReportData();
    }
  }, [selectedDomain, selectedPolicy, selectedClause, selectedSubRegion, selectedMonth, selectedYear]);

  // Cascading filter effect - Update policies, clauses, subRegions based on selectedDomain
  useEffect(() => {
    if (selectedDomain) {
      updateFiltersBasedOnDomain(selectedDomain);
    } else {
      setPolicies(allPolicies);
      setClauses(allClauses);
      setSubRegions(allSubRegions);
    }
  }, [selectedDomain]);

  const fetchFilterOptions = async () => {
    try {
      // Fetch all obligations to get unique values
      const { data: obligationsData } = await supabase
        .from('obligations')
        .select('domain, clause, policy_id, region');

      if (obligationsData) {
        const uniqueDomains = [...new Set(obligationsData.map(o => o.domain).filter(Boolean))];
        setDomains(uniqueDomains);

        const uniqueClauses = [...new Set(obligationsData.map(o => o.clause).filter(Boolean))];
        setAllClauses(uniqueClauses);
        setClauses(uniqueClauses);

        const uniqueSubRegions = [...new Set(obligationsData.map(o => o.region).filter(Boolean))];
        setAllSubRegions(uniqueSubRegions);
        setSubRegions(uniqueSubRegions);

        const { data: policiesData } = await supabase
          .from('policies')
          .select('id, name');
        if (policiesData) {
          setAllPolicies(policiesData);
          setPolicies(policiesData);
        }
      }

      const currentYear = new Date().getFullYear();
      const yearOptions = [];
      for (let i = currentYear - 4; i <= currentYear; i++) {
        yearOptions.push({ value: i.toString(), label: i.toString() });
      }
      setYears(yearOptions);

    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const updateFiltersBasedOnDomain = async (domain) => {
    try {
      const { data: domainObligations, error } = await supabase
        .from('obligations')
        .select('clause, policy_id, region')
        .eq('domain', domain);

      if (error) throw error;

      if (domainObligations) {
        const policyIds = [...new Set(domainObligations.map(o => o.policy_id).filter(Boolean))];
        const filteredPolicies = allPolicies.filter(p => policyIds.includes(p.id));
        setPolicies(filteredPolicies);

        const uniqueClauses = [...new Set(domainObligations.map(o => o.clause).filter(Boolean))];
        setClauses(uniqueClauses);

        const uniqueSubRegions = [...new Set(domainObligations.map(o => o.region).filter(Boolean))];
        setSubRegions(uniqueSubRegions);

        if (selectedPolicy && !filteredPolicies.some(p => p.id === selectedPolicy)) {
          setSelectedPolicy("");
        }
        if (selectedClause && !uniqueClauses.includes(selectedClause)) {
          setSelectedClause("");
        }
        if (selectedSubRegion && !uniqueSubRegions.includes(selectedSubRegion)) {
          setSelectedSubRegion("");
        }
      }
    } catch (error) {
      console.error('Error updating filters based on domain:', error);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Build filters
      const filters = {};
      if (selectedDomain) filters.domain = selectedDomain;
      if (selectedPolicy) filters.policy_id = selectedPolicy;
      if (selectedClause) filters.clause = selectedClause;
      if (selectedSubRegion) filters.region = selectedSubRegion;
      
      // Month and Year filters
      let dateFilter = {};
      if (selectedMonth && selectedYear) {
        const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
        const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0);
        dateFilter = {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        };
      } else if (selectedYear) {
        const startDate = new Date(parseInt(selectedYear), 0, 1);
        const endDate = new Date(parseInt(selectedYear), 11, 31);
        dateFilter = {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        };
      }

      // First, get obligations that match ALL filters
      let obligationQuery = supabase.from("obligations").select("id, domain, region, policy_id, clause");
      
      if (filters.domain) {
        obligationQuery = obligationQuery.eq('domain', filters.domain);
      }
      if (filters.region) {
        obligationQuery = obligationQuery.eq('region', filters.region);
      }
      if (filters.policy_id) {
        obligationQuery = obligationQuery.eq('policy_id', filters.policy_id);
      }
      if (filters.clause) {
        obligationQuery = obligationQuery.eq('clause', filters.clause);
      }
      
      const { data: filteredObligations, error: obligationError } = await obligationQuery;
      
      if (obligationError) {
        console.error("Error fetching filtered obligations:", obligationError);
      }
      
      const obligationIds = filteredObligations?.map(o => o.id) || [];
      
      // Fetch evidence only for the filtered obligations AND region
      let evidenceQuery = supabase
        .from("evidence")
        .select(`
          *,
          obligation:obligations(
            obligation_id,
            name,
            domain,
            current_status,
            evidence_type,
            responsible,
            accountable,
            region,
            policy_id,
            clause,
            created_at
          )
        `)
        .order("uploaded_at", { ascending: false });
      
      // Apply region filter for non-admin users
      if (!isAdmin && userRegion) {
        // Get region ID for the user's region
        const { data: regionData } = await supabase
          .from('regions')
          .select('id')
          .eq('name', userRegion)
          .single();
        
        if (regionData) {
          evidenceQuery = evidenceQuery.eq('region_id', regionData.id);
        }
      }
      
      // Apply obligation ID filter if we have filtered obligations
      if (obligationIds.length > 0) {
        evidenceQuery = evidenceQuery.in('obligation_id', obligationIds);
      } else if (filters.domain || filters.region || filters.policy_id || filters.clause) {
        setAllEvidence([]);
        const filteredData = await fetchFilteredData(filters, dateFilter);
        const regionsData = await getRegions();
        generateReport(
          reportType,
          filteredData,
          stats,
          domainData,
          regionsData?.data || [],
          [],
        );
        setLoading(false);
        return;
      }
      
      // Apply date filters on evidence uploaded_at
      if (dateFilter.startDate && dateFilter.endDate) {
        evidenceQuery = evidenceQuery
          .gte("uploaded_at", dateFilter.startDate)
          .lte("uploaded_at", dateFilter.endDate);
      }

      const { data: evidenceData, error: evidenceError } = await evidenceQuery;
      
      if (evidenceError) {
        console.error("Error fetching evidence:", evidenceError);
      }

      // Fetch all required data with filters and region
      const [
        obligationsData,
        statsData,
        domainData,
        regionsData,
      ] = await Promise.all([
        getObligations(filters, userRegion, isAdmin),
        getDashboardStats(userRegion, isAdmin),
        getComplianceByDomain(userRegion, isAdmin),
        getRegions(),
      ]);

      setObligations(obligationsData.data || []);
      setStats(statsData);
      setDomainData(domainData);
      setRegions(regionsData.data || []);
      setAllEvidence(evidenceData || []);

      const filteredData = await fetchFilteredData(filters, dateFilter);

      generateReport(
        reportType,
        filteredData,
        statsData,
        domainData,
        regionsData.data,
        evidenceData || [],
      );
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilteredData = async (filters, dateFilter) => {
    try {
      let query = supabase.from("obligations").select(`
          *,
          policy:policies(*)
        `);

      if (filters.domain) {
        query = query.eq('domain', filters.domain);
      }
      if (filters.policy_id) {
        query = query.eq('policy_id', filters.policy_id);
      }
      if (filters.clause) {
        query = query.eq('clause', filters.clause);
      }
      if (filters.region) {
        query = query.eq('region', filters.region);
      }

      if (dateFilter.startDate && dateFilter.endDate) {
        query = query
          .gte("created_at", dateFilter.startDate)
          .lte("created_at", dateFilter.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching filtered data:", error);
      return [];
    }
  };

  const generateReport = (
    type,
    filteredData,
    stats,
    domains,
    regions,
    evidence,
  ) => {
    let data = {};

    switch (type) {
      case "compliance-summary":
        data = generateComplianceSummary(
          filteredData || obligations,
          stats,
          domains,
        );
        break;
      case "pending-obligations":
        data = generatePendingObligations(filteredData || obligations);
        break;
      case "overdue-obligations":
        data = generateOverdueObligations(filteredData || obligations);
        break;
      case "audit-readiness":
        data = generateAuditReadiness(filteredData || obligations, stats);
        break;
      case "regional-compliance":
        data = generateRegionalCompliance(filteredData || obligations, regions);
        break;
      case "evidence-report":
        data = generateEvidenceReport(
          filteredData || obligations,
          evidence || allEvidence,
        );
        break;
      default:
        data = generateComplianceSummary(
          filteredData || obligations,
          stats,
          domains,
        );
    }

    setReportData(data);
  };

  // Report Generation Functions
  const generateComplianceSummary = (obligations, stats, domains) => {
    return {
      title: "Compliance Summary Report",
      stats: stats,
      domains: domains,
      totalObligations: obligations.length,
      completed: obligations.filter((o) => o.current_status === "Completed")
        .length,
      pending: obligations.filter((o) => o.current_status === "Pending").length,
      inProgress: obligations.filter((o) => o.current_status === "In Progress")
        .length,
      overdue: obligations.filter((o) => o.current_status === "Overdue").length,
      notStarted: obligations.filter((o) => o.current_status === "Not Started")
        .length,
      recentObligations: obligations.slice(0, 10),
      filters: {
        domain: selectedDomain,
        policy: selectedPolicy,
        clause: selectedClause,
        subRegion: selectedSubRegion,
        month: selectedMonth,
        year: selectedYear,
        region: !isAdmin ? userRegion : "All Regions",
      },
    };
  };

  const generatePendingObligations = (obligations) => {
    const pending = obligations.filter((o) => o.current_status === "Pending");
    return {
      title: "Pending Obligations Report",
      totalPending: pending.length,
      pendingObligations: pending,
      byDomain: pending.reduce((acc, o) => {
        acc[o.domain] = (acc[o.domain] || 0) + 1;
        return acc;
      }, {}),
      filters: {
        domain: selectedDomain,
        policy: selectedPolicy,
        clause: selectedClause,
        subRegion: selectedSubRegion,
        month: selectedMonth,
        year: selectedYear,
        region: !isAdmin ? userRegion : "All Regions",
      },
    };
  };

  const generateOverdueObligations = (obligations) => {
    const overdue = obligations.filter((o) => o.current_status === "Overdue");
    return {
      title: "Overdue Obligations Report",
      totalOverdue: overdue.length,
      overdueObligations: overdue,
      byDomain: overdue.reduce((acc, o) => {
        acc[o.domain] = (acc[o.domain] || 0) + 1;
        return acc;
      }, {}),
      filters: {
        domain: selectedDomain,
        policy: selectedPolicy,
        clause: selectedClause,
        subRegion: selectedSubRegion,
        month: selectedMonth,
        year: selectedYear,
        region: !isAdmin ? userRegion : "All Regions",
      },
    };
  };

  const generateAuditReadiness = (obligations, stats) => {
    const completed = obligations.filter(
      (o) => o.current_status === "Completed",
    );
    const readinessScore = stats.auditReadiness || 0;

    return {
      title: "Audit Readiness Report",
      readinessScore: readinessScore,
      totalObligations: obligations.length,
      completedObligations: completed.length,
      completionRate:
        obligations.length > 0
          ? Math.round((completed.length / obligations.length) * 100)
          : 0,
      readinessLevel:
        readinessScore >= 80
          ? "High"
          : readinessScore >= 60
            ? "Moderate"
            : "Low",
      recommendations:
        readinessScore < 80
          ? [
              "Complete pending obligations",
              "Review overdue items",
              "Ensure evidence is uploaded for all completed obligations",
            ]
          : [
              "Maintain current compliance levels",
              "Continue regular monitoring",
            ],
      filters: {
        domain: selectedDomain,
        policy: selectedPolicy,
        clause: selectedClause,
        subRegion: selectedSubRegion,
        month: selectedMonth,
        year: selectedYear,
        region: !isAdmin ? userRegion : "All Regions",
      },
    };
  };

  const generateRegionalCompliance = (obligations, regions) => {
    const regionalData = regions.map((region) => {
      const regionObligations = obligations.filter(
        (o) => o.region === region.name,
      );
      const completed = regionObligations.filter(
        (o) => o.current_status === "Completed",
      ).length;
      return {
        region: region.name,
        total: regionObligations.length,
        completed: completed,
        complianceRate:
          regionObligations.length > 0
            ? Math.round((completed / regionObligations.length) * 100)
            : 0,
      };
    });

    return {
      title: "Regional Compliance Report",
      regions: regionalData,
      overallCompliance:
        regionalData.length > 0
          ? regionalData.reduce((acc, r) => acc + r.complianceRate, 0) /
            regionalData.length
          : 0,
      filters: {
        domain: selectedDomain,
        policy: selectedPolicy,
        clause: selectedClause,
        subRegion: selectedSubRegion,
        month: selectedMonth,
        year: selectedYear,
        region: !isAdmin ? userRegion : "All Regions",
      },
    };
  };

  const generateEvidenceReport = (obligations, evidence) => {
    const obligationsWithEvidence = new Set();
    const evidenceData = [];

    evidence.forEach((item) => {
      if (item.obligation_id) {
        obligationsWithEvidence.add(item.obligation_id);
        evidenceData.push({
          evidence_id: item.id,
          obligation_id: item.obligation?.obligation_id || "N/A",
          obligation_name: item.obligation?.name || "Unknown",
          file_name: item.file_name,
          file_url: item.file_url,
          file_type: item.file_type,
          file_size: item.file_size,
          uploaded_at: item.uploaded_at,
          status: item.status,
          domain: item.obligation?.domain || "",
          evidence_type: item.obligation?.evidence_type || "",
          region: item.obligation?.region || "",
        });
      }
    });

    const obligationsWithEvidenceRequired = obligations
      .filter((o) => o.evidence_required && !obligationsWithEvidence.has(o.id))
      .map((o) => ({
        obligation_id: o.obligation_id,
        obligation_name: o.name,
        domain: o.domain,
        evidence_type: o.evidence_type || "Not specified",
        status: o.current_status,
        has_evidence: false,
      }));

    return {
      title: "Evidence Report",
      totalEvidenceFiles: evidenceData.length,
      totalObligationsWithEvidence: obligationsWithEvidence.size,
      totalObligationsRequiringEvidence: obligations.filter(
        (o) => o.evidence_required,
      ).length,
      evidenceFiles: evidenceData,
      obligationsWithoutEvidence: obligationsWithEvidenceRequired,
      filters: {
        domain: selectedDomain,
        policy: selectedPolicy,
        clause: selectedClause,
        subRegion: selectedSubRegion,
        month: selectedMonth,
        year: selectedYear,
        region: !isAdmin ? userRegion : "All Regions",
      },
    };
  };

  // FIXED: Download only region-specific evidence
  const downloadAllDocuments = async () => {
    if (!allEvidence || allEvidence.length === 0) {
      alert("No documents found to download.");
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

      // Filter evidence by region for non-admin users
      let evidenceToDownload = allEvidence;
      if (!isAdmin && userRegion) {
        // Get region ID
        const { data: regionData } = await supabase
          .from('regions')
          .select('id')
          .eq('name', userRegion)
          .single();
        
        if (regionData) {
          evidenceToDownload = allEvidence.filter(item => item.region_id === regionData.id);
        } else {
          alert("Your region could not be identified. Please contact administrator.");
          setDownloading(false);
          return;
        }
      }

      if (evidenceToDownload.length === 0) {
        alert(`No documents found for ${!isAdmin ? `region ${userRegion}` : 'the selected filters'}.`);
        setDownloading(false);
        return;
      }

      // Process each evidence file
      for (const evidence of evidenceToDownload) {
        if (!evidence.file_url) continue;

        try {
          const response = await fetch(evidence.file_url);
          if (!response.ok)
            throw new Error(`Failed to download: ${evidence.file_name}`);

          const blob = await response.blob();

          const obligation = evidence.obligation || {};
          const obligationId = obligation.obligation_id || "unknown";
          const domain = obligation.domain || "unknown";
          const region = obligation.region || userRegion || "unknown";
          
          const fileExtension = evidence.file_name.split(".").pop() || "";
          
          let fileName = `${obligationId}_${domain}`;
          
          // Add region to filename
          if (region) {
            fileName += `_${region.replace(/\s/g, '')}`;
          }
          
          if (monthLabel && yearLabel) {
            fileName += `_${monthLabel}_${yearLabel}`;
          } else if (yearLabel) {
            fileName += `_${yearLabel}`;
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
        alert("No documents could be downloaded.");
        setDownloading(false);
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });

      let zipFileName = `compliance_documents`;
      if (!isAdmin && userRegion) {
        zipFileName += `_${userRegion.replace(/\s/g, '')}`;
      }
      if (selectedDomain) zipFileName += `_${selectedDomain}`;
      if (selectedSubRegion) zipFileName += `_${selectedSubRegion}`;
      if (selectedPolicy) {
        const policyName = policies.find(p => p.id === selectedPolicy)?.name || selectedPolicy;
        zipFileName += `_${policyName}`;
      }
      if (selectedClause) zipFileName += `_clause_${selectedClause}`;
      if (monthLabel && yearLabel) zipFileName += `_${monthLabel}_${yearLabel}`;
      if (yearLabel && !monthLabel) zipFileName += `_${yearLabel}`;
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

      alert(
        `Successfully downloaded ${downloadedCount} of ${totalFiles} documents ${!isAdmin ? `for region ${userRegion}` : ''}.`,
      );
    } catch (error) {
      console.error("Error downloading documents:", error);
      alert("Failed to download documents. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      Completed: "bg-green-100 text-green-800",
      "In Progress": "bg-blue-100 text-blue-800",
      Pending: "bg-yellow-100 text-yellow-800",
      Overdue: "bg-red-100 text-red-800",
      "Not Started": "bg-gray-100 text-gray-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  const reports = [
    { id: "compliance-summary", name: "Compliance Summary" },
    { id: "pending-obligations", name: "Pending Obligations" },
    { id: "overdue-obligations", name: "Overdue Obligations" },
    { id: "audit-readiness", name: "Audit Readiness Report" },
    { id: "regional-compliance", name: "Regional Compliance" },
    { id: "evidence-report", name: "Evidence Report" },
  ];

  const clearFilters = () => {
    setSelectedDomain("");
    setSelectedPolicy("");
    setSelectedClause("");
    setSelectedSubRegion("");
    setSelectedMonth("");
    setSelectedYear("");
    setPolicies(allPolicies);
    setClauses(allClauses);
    setSubRegions(allSubRegions);
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
              Report Configuration
            </h3>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Report Type
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                >
                  {reports.map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-gray-200 pt-3 sm:pt-4">
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Filters
                </p>

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
                      Sub Region
                    </label>
                    <select
                      value={selectedSubRegion}
                      onChange={(e) => setSelectedSubRegion(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                    >
                      <option value="">All Sub Regions</option>
                      {subRegions.map((region) => (
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

              {/* Download Button - Region filtered */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={downloadAllDocuments}
                  disabled={downloading || allEvidence.length === 0}
                  className="w-full bg-[#8cc63e] text-white px-4 py-2.5 sm:py-3 rounded-md hover:bg-[#7ab52e] transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm sm:text-base"
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
                    ✓ Only documents from {userRegion} will be downloaded
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
                  {reportData.filters.region && `Region: ${reportData.filters.region} `}
                  {reportData.filters.domain && `• Domain: ${reportData.filters.domain} `}
                  {reportData.filters.policy && `• Policy: ${reportData.filters.policy} `}
                  {reportData.filters.clause && `• Clause: ${reportData.filters.clause} `}
                  {reportData.filters.month && reportData.filters.year && 
                    `• ${months.find(m => m.value === reportData.filters.month)?.label} ${reportData.filters.year}`
                  }
                </span>
              )}
            </div>

            <div className="space-y-4 sm:space-y-6">
              {/* Summary Stats */}
              {reportType === "compliance-summary" && reportData && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <p className="text-[10px] sm:text-sm text-gray-500">Total Obligations</p>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">
                        {reportData.totalObligations}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <p className="text-[10px] sm:text-sm text-gray-500">Compliance Rate</p>
                      <p className="text-lg sm:text-2xl font-bold text-[#8cc63e]">
                        {stats.overallCompliance}%
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <p className="text-[10px] sm:text-sm text-gray-500">Completed</p>
                      <p className="text-lg sm:text-2xl font-bold text-[#8cc63e]">
                        {reportData.completed}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <p className="text-[10px] sm:text-sm text-gray-500">Overdue</p>
                      <p className="text-lg sm:text-2xl font-bold text-red-600">
                        {reportData.overdue}
                      </p>
                    </div>
                  </div>

                  {/* Domain Compliance */}
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
                              {domainData.compliance[index]}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                            <div
                              className={`h-1.5 sm:h-2 rounded-full ${
                                domainData.compliance[index] >= 80
                                  ? "bg-[#8cc63e]"
                                  : domainData.compliance[index] >= 60
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                              }`}
                              style={{
                                width: `${domainData.compliance[index]}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Pending Obligations */}
              {reportType === "pending-obligations" && reportData && (
                <>
                  <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg border border-yellow-200">
                    <p className="text-xs sm:text-sm text-yellow-800">
                      Total Pending Obligations:{" "}
                      <span className="font-bold">
                        {reportData.totalPending}
                      </span>
                    </p>
                  </div>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                            ID
                          </th>
                          <th className="px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                            Name
                          </th>
                          <th className="hidden sm:table-cell px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                            Domain
                          </th>
                          <th className="hidden md:table-cell px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                            Frequency
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.pendingObligations?.slice(0, 10).map((obligation) => (
                          <tr key={obligation.id}>
                            <td className="px-2 sm:px-4 py-2 text-[10px] sm:text-sm">
                              {obligation.obligation_id}
                            </td>
                            <td className="px-2 sm:px-4 py-2 text-[10px] sm:text-sm truncate max-w-[80px] sm:max-w-[150px]">
                              {obligation.name}
                            </td>
                            <td className="hidden sm:table-cell px-2 sm:px-4 py-2 text-[10px] sm:text-sm">
                              {obligation.domain}
                            </td>
                            <td className="hidden md:table-cell px-2 sm:px-4 py-2 text-[10px] sm:text-sm">
                              {obligation.frequency}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {reportData.pendingObligations?.length > 10 && (
                      <p className="text-[10px] sm:text-xs text-gray-500 text-center py-2">
                        Showing 10 of {reportData.pendingObligations.length}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Overdue Obligations */}
              {reportType === "overdue-obligations" && reportData && (
                <>
                  <div className="bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200">
                    <p className="text-xs sm:text-sm text-red-800">
                      Total Overdue Obligations:{" "}
                      <span className="font-bold">
                        {reportData.totalOverdue}
                      </span>
                    </p>
                  </div>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                            ID
                          </th>
                          <th className="px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                            Name
                          </th>
                          <th className="hidden sm:table-cell px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                            Domain
                          </th>
                          <th className="hidden md:table-cell px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                            Accountable
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.overdueObligations?.slice(0, 10).map((obligation) => (
                          <tr key={obligation.id}>
                            <td className="px-2 sm:px-4 py-2 text-[10px] sm:text-sm">
                              {obligation.obligation_id}
                            </td>
                            <td className="px-2 sm:px-4 py-2 text-[10px] sm:text-sm truncate max-w-[80px] sm:max-w-[150px]">
                              {obligation.name}
                            </td>
                            <td className="hidden sm:table-cell px-2 sm:px-4 py-2 text-[10px] sm:text-sm">
                              {obligation.domain}
                            </td>
                            <td className="hidden md:table-cell px-2 sm:px-4 py-2 text-[10px] sm:text-sm">
                              {obligation.accountable}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {reportData.overdueObligations?.length > 10 && (
                      <p className="text-[10px] sm:text-xs text-gray-500 text-center py-2">
                        Showing 10 of {reportData.overdueObligations.length}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Audit Readiness */}
              {reportType === "audit-readiness" && reportData && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
                      <p className="text-[10px] sm:text-sm text-blue-800">Readiness Score</p>
                      <p className="text-xl sm:text-3xl font-bold text-blue-600">
                        {reportData.readinessScore}%
                      </p>
                    </div>
                    <div className="bg-green-50 p-3 sm:p-4 rounded-lg border border-green-200">
                      <p className="text-[10px] sm:text-sm text-green-800">Readiness Level</p>
                      <p className="text-base sm:text-xl font-bold text-green-600">
                        {reportData.readinessLevel}
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <h5 className="font-medium text-gray-700 mb-1 sm:mb-2 text-xs sm:text-sm">
                      Recommendations
                    </h5>
                    <ul className="list-disc list-inside space-y-0.5 sm:space-y-1">
                      {reportData.recommendations?.map((rec, idx) => (
                        <li key={idx} className="text-[10px] sm:text-sm text-gray-600">
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Regional Compliance */}
              {reportType === "regional-compliance" && reportData && (
                <>
                  <div className="bg-indigo-50 p-3 sm:p-4 rounded-lg border border-indigo-200">
                    <p className="text-xs sm:text-sm text-indigo-800">
                      Overall Regional Compliance:{" "}
                      <span className="font-bold">
                        {Math.round(reportData.overallCompliance)}%
                      </span>
                    </p>
                  </div>
                  <div className="space-y-3 sm:space-y-4 max-h-96 overflow-y-auto">
                    {reportData.regions?.map((region) => (
                      <div
                        key={region.region}
                        className="border rounded-lg p-3 sm:p-4"
                      >
                        <div className="flex justify-between items-center mb-1 sm:mb-2">
                          <span className="font-medium text-gray-900 text-xs sm:text-sm">
                            {region.region}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-gray-600">
                            {region.complianceRate}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                          <div
                            className={`h-1.5 sm:h-2 rounded-full ${
                              region.complianceRate >= 80
                                ? "bg-[#8cc63e]"
                                : region.complianceRate >= 60
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                            style={{ width: `${region.complianceRate}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-500">
                          <span>Total: {region.total}</span>
                          <span>Completed: {region.completed}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Evidence Report */}
              {reportType === "evidence-report" && reportData && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-purple-50 p-3 sm:p-4 rounded-lg border border-purple-200">
                      <p className="text-[10px] sm:text-sm text-purple-800">
                        Evidence Files
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-purple-600">
                        {reportData.totalEvidenceFiles || 0}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
                      <p className="text-[10px] sm:text-sm text-blue-800">
                        Obligations with Evidence
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-600">
                        {reportData.totalObligationsWithEvidence || 0}
                      </p>
                    </div>
                  </div>

                  {reportData.evidenceFiles?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
                        Uploaded Evidence Files {!isAdmin && userRegion && `(${userRegion})`}
                      </h4>
                      <div className="overflow-x-auto max-h-60 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                Obligation
                              </th>
                              <th className="hidden sm:table-cell px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                File Name
                              </th>
                              <th className="hidden md:table-cell px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                Region
                              </th>
                              <th className="px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {reportData.evidenceFiles
                              ?.slice(0, 10)
                              .map((item) => (
                                <tr key={item.evidence_id}>
                                  <td className="px-2 sm:px-4 py-2 text-[10px] sm:text-sm">
                                    {item.obligation_id}
                                  </td>
                                  <td className="hidden sm:table-cell px-2 sm:px-4 py-2 text-[10px] sm:text-sm truncate max-w-[100px] sm:max-w-[150px]">
                                    {item.file_name}
                                  </td>
                                  <td className="hidden md:table-cell px-2 sm:px-4 py-2 text-[10px] sm:text-sm">
                                    {item.region || "N/A"}
                                  </td>
                                  <td className="px-2 sm:px-4 py-2">
                                    <span
                                      className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs rounded-full ${getStatusBadge(item.status)}`}
                                    >
                                      {item.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {reportData.evidenceFiles?.length > 10 && (
                          <p className="text-[10px] sm:text-xs text-gray-500 text-center py-2">
                            Showing 10 of {reportData.evidenceFiles.length}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {reportData.obligationsWithoutEvidence?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] sm:text-sm font-medium text-red-700 mb-2 sm:mb-3">
                        Obligations Without Evidence
                      </h4>
                      <div className="overflow-x-auto max-h-60 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                ID
                              </th>
                              <th className="hidden sm:table-cell px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                Name
                              </th>
                              <th className="hidden md:table-cell px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                Domain
                              </th>
                              <th className="px-2 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {reportData.obligationsWithoutEvidence.slice(0, 10).map(
                              (item) => (
                                <tr key={item.obligation_id}>
                                  <td className="px-2 sm:px-4 py-2 text-[10px] sm:text-sm">
                                    {item.obligation_id}
                                  </td>
                                  <td className="hidden sm:table-cell px-2 sm:px-4 py-2 text-[10px] sm:text-sm truncate max-w-[100px] sm:max-w-[150px]">
                                    {item.obligation_name}
                                  </td>
                                  <td className="hidden md:table-cell px-2 sm:px-4 py-2 text-[10px] sm:text-sm">
                                    {item.domain}
                                  </td>
                                  <td className="px-2 sm:px-4 py-2">
                                    <span
                                      className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs rounded-full ${getStatusBadge(item.status)}`}
                                    >
                                      {item.status}
                                    </span>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                        {reportData.obligationsWithoutEvidence.length > 10 && (
                          <p className="text-[10px] sm:text-xs text-gray-500 text-center py-2">
                            Showing 10 of {reportData.obligationsWithoutEvidence.length}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="text-center text-[10px] sm:text-sm text-gray-500">
                <p>
                  Preview of{" "}
                  {reports.find((r) => r.id === reportType)?.name}
                </p>
                {reportData?.filters && (
                  <p className="text-[8px] sm:text-xs mt-0.5 sm:mt-1">
                    {reportData.filters.region && `Region: ${reportData.filters.region} `}
                    {reportData.filters.domain && `• Domain: ${reportData.filters.domain} `}
                    {reportData.filters.policy && `• Policy: ${reportData.filters.policy} `}
                    {reportData.filters.clause && `• Clause: ${reportData.filters.clause} `}
                    {reportData.filters.subRegion && `• Sub Region: ${reportData.filters.subRegion} `}
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